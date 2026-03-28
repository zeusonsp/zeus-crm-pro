// ============================================
// ZEUS CRM PRO - Auth Routes
// ============================================
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { hashPassword, verifyPassword } = require('../services/hash');
const config = require('../config/env');
const { authLimiter } = require('../middleware/rateLimiter');
const FirestoreService = require('../services/firestore');
const logger = require('../services/logger');

const usersDB = new FirestoreService('zeus_users');

// POST /api/v1/auth/login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password, adminKey } = req.body;

        // Admin key login (backward compat)
        if (adminKey === config.admin.key) {
            const token = jwt.sign(
                { id: 'admin', email: 'admin@zeus.com', name: 'Administrador', role: 'admin' },
                config.jwt.secret,
                { expiresIn: config.jwt.expiresIn }
            );
            return res.json({
                success: true,
                token,
                user: { id: 'admin', name: 'Administrador', role: 'admin' }
            });
        }

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email e senha obrigatorios'
            });
        }

        // Find user
        const results = await usersDB.search('email', email.toLowerCase(), 1);
        const user = results[0];

        if (!user || !user.passwordHash) {
            return res.status(401).json({
                success: false,
                error: 'Credenciais invalidas'
            });
        }

        // Verify password
        const valid = verifyPassword(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({
                success: false,
                error: 'Credenciais invalidas'
            });
        }

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        // Update last login
        await usersDB.update(user.id, { lastLogin: new Date().toISOString() });

        logger.info(`[Auth] Login: ${user.email}`);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        logger.error('[Auth] Login error:', err.message);
        res.status(500).json({ success: false, error: 'Erro no login' });
    }
});

// POST /api/v1/auth/register
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { name, email, password, adminKey } = req.body;

        // Only admin can register new users
        if (adminKey !== config.admin.key) {
            return res.status(403).json({
                success: false,
                error: 'Chave admin necessaria para registro'
            });
        }

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Nome, email e senha obrigatorios'
            });
        }

        // Check if user exists
        const existing = await usersDB.search('email', email.toLowerCase(), 1);
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Email ja cadastrado'
            });
        }

        // Hash password
        const passwordHash = hashPassword(password);

        // Create user
        const user = await usersDB.create({
            name,
            email: email.toLowerCase(),
            passwordHash,
            role: req.body.role || 'vendedor',
            active: true
        });

        logger.info(`[Auth] New user registered: ${email}`);

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        logger.error('[Auth] Register error:', err.message);
        res.status(500).json({ success: false, error: 'Erro no registro' });
    }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
    try {
        const { token } = req.body;
        const decoded = jwt.verify(token, config.jwt.secret, { ignoreExpiration: true });

        // Check if expired less than 30 days ago
        const expiredAt = new Date(decoded.exp * 1000);
        const now = new Date();
        const daysSinceExpiry = (now - expiredAt) / (1000 * 60 * 60 * 24);

        if (daysSinceExpiry > 30) {
            return res.status(401).json({
                success: false,
                error: 'Token expirado ha muito tempo. Faca login novamente.'
            });
        }

        const newToken = jwt.sign(
            { id: decoded.id, email: decoded.email, name: decoded.name, role: decoded.role },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.json({ success: true, token: newToken });
    } catch (err) {
        res.status(401).json({ success: false, error: 'Token invalido' });
    }
});

module.exports = router;
