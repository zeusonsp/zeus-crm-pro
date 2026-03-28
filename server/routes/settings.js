// ============================================
// ZEUS CRM PRO - Settings API Routes
// ============================================
const router = require('express').Router();
const FirestoreService = require('../services/firestore');
const { adminOnly } = require('../middleware/auth');
const logger = require('../services/logger');

const settingsDB = new FirestoreService('zeus_settings');

router.get('/', async (req, res) => {
    try {
        const settings = await settingsDB.getById('global');
        res.json({ success: true, settings: settings || getDefaults() });
    } catch (err) {
        logger.error('[Settings] Get error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao buscar configuracoes' });
    }
});

router.put('/', adminOnly, async (req, res) => {
    try {
        const existing = await settingsDB.getById('global');
        let settings;
        if (existing) {
            settings = await settingsDB.update('global', req.body);
        } else {
            settings = await settingsDB.create({ ...getDefaults(), ...req.body }, 'global');
        }
        res.json({ success: true, settings });
    } catch (err) {
        logger.error('[Settings] Update error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao atualizar configuracoes' });
    }
});

// SLA settings
router.get('/sla', async (req, res) => {
    try {
        const sla = await settingsDB.getById('sla');
        res.json({
            success: true,
            sla: sla || { firstResponseHours: 2, proposalHours: 24, closingDays: 7 }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar SLA' });
    }
});

router.put('/sla', adminOnly, async (req, res) => {
    try {
        const existing = await settingsDB.getById('sla');
        let sla;
        if (existing) {
            sla = await settingsDB.update('sla', req.body);
        } else {
            sla = await settingsDB.create(req.body, 'sla');
        }
        res.json({ success: true, sla });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao atualizar SLA' });
    }
});

// Sales goals
router.get('/goals', async (req, res) => {
    try {
        const goals = await settingsDB.getById('salesGoals');
        res.json({ success: true, goals: goals?.items || [] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar metas' });
    }
});

router.put('/goals', async (req, res) => {
    try {
        const existing = await settingsDB.getById('salesGoals');
        if (existing) {
            await settingsDB.update('salesGoals', { items: req.body.goals });
        } else {
            await settingsDB.create({ items: req.body.goals }, 'salesGoals');
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao atualizar metas' });
    }
});

function getDefaults() {
    return {
        companyName: 'Zeus Tecnologia',
        language: 'pt',
        theme: 'dark',
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
        notifications: { email: true, push: true, sms: false },
        branding: { primaryColor: '#D4AF37', logoUrl: '' }
    };
}

module.exports = router;
