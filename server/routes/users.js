// ============================================
// ZEUS CRM PRO - Users Management Routes
// ============================================
const router = require('express').Router();
const { hashPassword } = require('../services/hash');
const FirestoreService = require('../services/firestore');
const { adminOnly } = require('../middleware/auth');
const logger = require('../services/logger');

const usersDB = new FirestoreService('zeus_users');

router.get('/', adminOnly, async (req, res) => {
    try {
        const result = await usersDB.getAll({ sort: 'name', order: 'asc' });
        const users = result.items.map(u => ({
            id: u.id, name: u.name, email: u.email, role: u.role,
            active: u.active, lastLogin: u.lastLogin, createdAt: u.createdAt
        }));
        res.json({ success: true, users });
    } catch (err) {
        logger.error('[Users] List error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao listar usuarios' });
    }
});

router.post('/', adminOnly, async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Dados incompletos' });
        }
        const existing = await usersDB.search('email', email.toLowerCase(), 1);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, error: 'Email ja existe' });
        }
        const passwordHash = hashPassword(password);
        const user = await usersDB.create({
            name, email: email.toLowerCase(), passwordHash,
            role: role || 'vendedor', active: true
        });
        res.status(201).json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        logger.error('[Users] Create error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar usuario' });
    }
});

router.put('/:id', adminOnly, async (req, res) => {
    try {
        const updates = {};
        if (req.body.name) updates.name = req.body.name;
        if (req.body.role) updates.role = req.body.role;
        if (req.body.active !== undefined) updates.active = req.body.active;
        if (req.body.password) updates.passwordHash = hashPassword(req.body.password);
        const user = await usersDB.update(req.params.id, updates);
        if (!user) return res.status(404).json({ success: false, error: 'Usuario nao encontrado' });
        res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        logger.error('[Users] Update error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao atualizar usuario' });
    }
});

router.delete('/:id', adminOnly, async (req, res) => {
    try {
        await usersDB.delete(req.params.id);
        res.json({ success: true, message: 'Usuario removido' });
    } catch (err) {
        logger.error('[Users] Delete error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao remover usuario' });
    }
});

module.exports = router;
