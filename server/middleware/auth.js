// ============================================
// ZEUS CRM PRO - Authentication Middleware
// ============================================
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('../services/logger');

// JWT Authentication middleware
function authMiddleware(req, res, next) {
    try {
        // Check for admin key (backward compatibility)
        const adminKey = req.headers['x-admin-key'];
        if (adminKey === config.admin.key) {
            req.user = { role: 'admin', id: 'admin', name: 'Admin' };
            return next();
        }

        // Check for Bearer token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Token de autenticacao necessario',
                code: 'AUTH_REQUIRED'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret);

        req.user = {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role || 'vendedor'
        };

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expirado',
                code: 'TOKEN_EXPIRED'
            });
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Token invalido',
                code: 'TOKEN_INVALID'
            });
        }
        logger.error('[Auth] Error:', err.message);
        return res.status(500).json({
            success: false,
            error: 'Erro de autenticacao'
        });
    }
}

// Role-based access control
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Nao autenticado'
            });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado. Role necessaria: ' + roles.join(' ou '),
                code: 'INSUFFICIENT_ROLE'
            });
        }
        next();
    };
}

// Admin only
function adminOnly(req, res, next) {
    return requireRole('admin')(req, res, next);
}

module.exports = { authMiddleware, requireRole, adminOnly };
