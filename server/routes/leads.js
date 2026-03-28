// ============================================
// ZEUS CRM PRO - Leads API Routes
// ============================================
const router = require('express').Router();
const FirestoreService = require('../services/firestore');
const { validateLead, validateId, validatePagination } = require('../middleware/validate');
const logger = require('../services/logger');

const leadsDB = new FirestoreService('zeus_leads');
const auditDB = new FirestoreService('zeus_audit');

// Helper: log audit
async function logAudit(action, userId, details) {
    await auditDB.create({
        action,
        userId,
        details,
        timestamp: new Date().toISOString()
    });
}

// GET /api/v1/leads - List all leads
router.get('/', validatePagination, async (req, res) => {
    try {
        const { page = 1, limit = 50, sort = 'createdAt', order = 'desc' } = req.query;
        const filters = {};

        if (req.query.estagio) filters.estagio = req.query.estagio;
        if (req.query.origem) filters.origem = req.query.origem;
        if (req.query.vendedor) filters.vendedor = req.query.vendedor;

        // Role-based filtering
        if (req.user.role === 'vendedor') {
            filters.vendedor = req.user.name;
        }

        const result = await leadsDB.getAll({ page: +page, limit: +limit, sort, order, filters });
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[Leads] List error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao listar leads' });
    }
});

// GET /api/v1/leads/search?q=
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.status(400).json({ success: false, error: 'Minimo 2 caracteres para busca' });
        }
        const results = await leadsDB.search('nome', q, 20);
        res.json({ success: true, items: results, total: results.length });
    } catch (err) {
        logger.error('[Leads] Search error:', err.message);
        res.status(500).json({ success: false, error: 'Erro na busca' });
    }
});

// GET /api/v1/leads/stats - Dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const stageCounts = await leadsDB.countByField('estagio');
        const sourceCounts = await leadsDB.countByField('origem');
        const total = Object.values(stageCounts).reduce((a, b) => a + b, 0);

        res.json({
            success: true,
            stats: {
                total,
                byStage: stageCounts,
                bySource: sourceCounts,
                conversionRate: total > 0 ? ((stageCounts['fechamento'] || 0) / total * 100).toFixed(1) : 0
            }
        });
    } catch (err) {
        logger.error('[Leads] Stats error:', err.message);
        res.status(500).json({ success: false, error: 'Erro nas estatisticas' });
    }
});

// GET /api/v1/leads/:id
router.get('/:id', validateId, async (req, res) => {
    try {
        const lead = await leadsDB.getById(req.params.id);
        if (!lead) {
            return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
        }
        res.json({ success: true, lead });
    } catch (err) {
        logger.error('[Leads] Get error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao buscar lead' });
    }
});

// POST /api/v1/leads
router.post('/', validateLead, async (req, res) => {
    try {
        const leadData = {
            nome: req.body.nome,
            email: req.body.email || '',
            telefone: req.body.telefone || '',
            empresa: req.body.empresa || '',
            estagio: req.body.estagio || 'novo',
            origem: req.body.origem || 'manual',
            vendedor: req.body.vendedor || req.user.name,
            valor: req.body.valor || 0,
            notas: req.body.notas || '',
            tags: req.body.tags || [],
            score: 0,
            interactions: []
        };

        const lead = await leadsDB.create(leadData);

        // Emit real-time event
        const io = req.app.get('io');
        if (io) io.emit('lead-created', lead);

        await logAudit('lead_created', req.user.id, { leadId: lead.id, nome: lead.nome });

        res.status(201).json({ success: true, lead });
    } catch (err) {
        logger.error('[Leads] Create error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar lead' });
    }
});

// PUT /api/v1/leads/:id
router.put('/:id', validateId, async (req, res) => {
    try {
        const lead = await leadsDB.update(req.params.id, req.body);
        if (!lead) {
            return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
        }

        const io = req.app.get('io');
        if (io) io.emit('lead-updated', lead);

        await logAudit('lead_updated', req.user.id, { leadId: lead.id, changes: Object.keys(req.body) });

        res.json({ success: true, lead });
    } catch (err) {
        logger.error('[Leads] Update error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao atualizar lead' });
    }
});

// PATCH /api/v1/leads/:id/stage
router.patch('/:id/stage', validateId, async (req, res) => {
    try {
        const { estagio } = req.body;
        const validStages = ['novo', 'contato', 'proposta', 'negociacao', 'fechamento'];
        if (!validStages.includes(estagio)) {
            return res.status(400).json({ success: false, error: 'Estagio invalido' });
        }

        const lead = await leadsDB.update(req.params.id, { estagio });
        if (!lead) {
            return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
        }

        const io = req.app.get('io');
        if (io) io.emit('lead-stage-changed', { id: lead.id, estagio });

        await logAudit('lead_stage_changed', req.user.id, { leadId: lead.id, newStage: estagio });

        res.json({ success: true, lead });
    } catch (err) {
        logger.error('[Leads] Stage change error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao mudar estagio' });
    }
});

// DELETE /api/v1/leads/:id
router.delete('/:id', validateId, async (req, res) => {
    try {
        const deleted = await leadsDB.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
        }

        const io = req.app.get('io');
        if (io) io.emit('lead-deleted', { id: req.params.id });

        await logAudit('lead_deleted', req.user.id, { leadId: req.params.id });

        res.json({ success: true, message: 'Lead removido' });
    } catch (err) {
        logger.error('[Leads] Delete error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao remover lead' });
    }
});

// POST /api/v1/leads/bulk/stage
router.post('/bulk/stage', async (req, res) => {
    try {
        const { ids, estagio } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'IDs obrigatorios' });
        }

        const updates = ids.map(id => ({ id, data: { estagio } }));
        await leadsDB.bulkUpdate(updates);

        const io = req.app.get('io');
        if (io) io.emit('leads-bulk-updated', { ids, estagio });

        res.json({ success: true, updated: ids.length });
    } catch (err) {
        logger.error('[Leads] Bulk stage error:', err.message);
        res.status(500).json({ success: false, error: 'Erro na acao em massa' });
    }
});

// POST /api/v1/leads/import
router.post('/import', async (req, res) => {
    try {
        const { leads } = req.body;
        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ success: false, error: 'Array de leads obrigatorio' });
        }

        const created = await leadsDB.bulkCreate(leads.map(l => ({
            ...l,
            estagio: l.estagio || 'novo',
            origem: l.origem || 'import',
            vendedor: l.vendedor || req.user.name
        })));

        await logAudit('leads_imported', req.user.id, { count: created.length });

        res.status(201).json({ success: true, imported: created.length, leads: created });
    } catch (err) {
        logger.error('[Leads] Import error:', err.message);
        res.status(500).json({ success: false, error: 'Erro na importacao' });
    }
});

module.exports = router;
