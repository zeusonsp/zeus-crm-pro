// ============================================
// ZEUS CRM PRO - Orcamentos (Quotes) API Routes
// ============================================
const router = require('express').Router();
const FirestoreService = require('../services/firestore');
const { validateOrcamento, validateId, validatePagination } = require('../middleware/validate');
const logger = require('../services/logger');

const orcamentosDB = new FirestoreService('zeus_orcamentos');
const auditDB = new FirestoreService('zeus_audit');

// GET /api/v1/orcamentos
router.get('/', validatePagination, async (req, res) => {
    try {
        const { page = 1, limit = 50, sort = 'createdAt', order = 'desc' } = req.query;
        const filters = {};
        if (req.query.status) filters.status = req.query.status;
        if (req.query.cliente) filters.cliente = req.query.cliente;
        if (req.user.role === 'vendedor') filters.vendedor = req.user.name;

        const result = await orcamentosDB.getAll({ page: +page, limit: +limit, sort, order, filters });
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[Orcamentos] List error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao listar orcamentos' });
    }
});

// GET /api/v1/orcamentos/stats
router.get('/stats', async (req, res) => {
    try {
        const statusCounts = await orcamentosDB.countByField('status');
        const all = await orcamentosDB.getAll({ limit: 9999 });
        let totalValue = 0;
        let approvedValue = 0;
        all.items.forEach(o => {
            const val = parseFloat(o.total) || 0;
            totalValue += val;
            if (o.status === 'aprovado') approvedValue += val;
        });
        res.json({
            success: true,
            stats: {
                total: all.pagination.total,
                byStatus: statusCounts,
                totalValue,
                approvedValue,
                approvalRate: all.pagination.total > 0 ?
                    ((statusCounts['aprovado'] || 0) / all.pagination.total * 100).toFixed(1) : 0
            }
        });
    } catch (err) {
        logger.error('[Orcamentos] Stats error:', err.message);
        res.status(500).json({ success: false, error: 'Erro nas estatisticas' });
    }
});

// GET /api/v1/orcamentos/:id
router.get('/:id', validateId, async (req, res) => {
    try {
        const orc = await orcamentosDB.getById(req.params.id);
        if (!orc) return res.status(404).json({ success: false, error: 'Orcamento nao encontrado' });
        res.json({ success: true, orcamento: orc });
    } catch (err) {
        logger.error('[Orcamentos] Get error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao buscar orcamento' });
    }
});

// POST /api/v1/orcamentos
router.post('/', validateOrcamento, async (req, res) => {
    try {
        const items = req.body.items.map(item => ({
            descricao: item.descricao,
            quantidade: +item.quantidade,
            valorUnitario: +item.valorUnitario,
            subtotal: (+item.quantidade) * (+item.valorUnitario)
        }));
        const total = items.reduce((s, i) => s + i.subtotal, 0);

        const orcData = {
            numero: `ORC-${Date.now().toString(36).toUpperCase()}`,
            cliente: req.body.cliente,
            clienteEmail: req.body.clienteEmail || '',
            clienteTelefone: req.body.clienteTelefone || '',
            items,
            total,
            desconto: req.body.desconto || 0,
            totalFinal: total - (req.body.desconto || 0),
            status: 'pendente',
            vendedor: req.body.vendedor || req.user.name,
            validade: req.body.validade || 30,
            observacoes: req.body.observacoes || '',
            condicaoPagamento: req.body.condicaoPagamento || ''
        };

        const orc = await orcamentosDB.create(orcData);
        const io = req.app.get('io');
        if (io) io.emit('orcamento-created', orc);

        await auditDB.create({
            action: 'orcamento_created', userId: req.user.id,
            details: { orcId: orc.id, total: orc.total }
        });

        res.status(201).json({ success: true, orcamento: orc });
    } catch (err) {
        logger.error('[Orcamentos] Create error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar orcamento' });
    }
});

// PUT /api/v1/orcamentos/:id
router.put('/:id', validateId, async (req, res) => {
    try {
        const orc = await orcamentosDB.update(req.params.id, req.body);
        if (!orc) return res.status(404).json({ success: false, error: 'Orcamento nao encontrado' });
        res.json({ success: true, orcamento: orc });
    } catch (err) {
        logger.error('[Orcamentos] Update error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao atualizar orcamento' });
    }
});

// PATCH /api/v1/orcamentos/:id/status
router.patch('/:id/status', validateId, async (req, res) => {
    try {
        const { status } = req.body;
        const valid = ['pendente', 'enviado', 'aprovado', 'rejeitado', 'expirado'];
        if (!valid.includes(status)) {
            return res.status(400).json({ success: false, error: 'Status invalido' });
        }
        const orc = await orcamentosDB.update(req.params.id, { status });
        if (!orc) return res.status(404).json({ success: false, error: 'Orcamento nao encontrado' });

        const io = req.app.get('io');
        if (io) io.emit('orcamento-status-changed', { id: orc.id, status });

        res.json({ success: true, orcamento: orc });
    } catch (err) {
        logger.error('[Orcamentos] Status error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao mudar status' });
    }
});

// DELETE /api/v1/orcamentos/:id
router.delete('/:id', validateId, async (req, res) => {
    try {
        const deleted = await orcamentosDB.delete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: 'Orcamento nao encontrado' });
        res.json({ success: true, message: 'Orcamento removido' });
    } catch (err) {
        logger.error('[Orcamentos] Delete error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao remover orcamento' });
    }
});

module.exports = router;
