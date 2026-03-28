// ============================================
// ZEUS CRM PRO - Orcamentos (Quotes) API Routes
// ============================================
const router = require('express').Router();
const FirestoreService = require('../services/firestore');
const { validateOrcamento, validateId, validatePagination } = require('../middleware/validate');
const logger = require('../services/logger');

const orcamentosDB = new FirestoreService('zeus_orcamentos');
const auditDB = new FirestoreService('zeus_audit');

router.get('/', validatePagination, async (req, res) => {
    try {
        const { page = 1, limit = 50, sort = 'createdAt', order = 'desc' } = req.query;
        const filters = {};
        if (req.query.status) filters.status = req.query.status;
        if (req.user.role === 'vendedor') filters.vendedor = req.user.name;
        const result = await orcamentosDB.getAll({ page: +page, limit: +limit, sort, order, filters });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao listar orcamentos' });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const statusCounts = await orcamentosDB.countByField('status');
        const all = await orcamentosDB.getAll({ limit: 9999 });
        let totalValue = 0, approvedValue = 0;
        all.items.forEach(o => { const v = parseFloat(o.total) || 0; totalValue += v; if (o.status === 'aprovado') approvedValue += v; });
        res.json({ success: true, stats: { total: all.pagination.total, byStatus: statusCounts, totalValue, approvedValue } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro nas estatisticas' });
    }
});

router.get('/:id', validateId, async (req, res) => {
    try {
        const orc = await orcamentosDB.getById(req.params.id);
        if (!orc) return res.status(404).json({ success: false, error: 'Orcamento nao encontrado' });
        res.json({ success: true, orcamento: orc });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar orcamento' });
    }
});

router.post('/', validateOrcamento, async (req, res) => {
    try {
        const items = req.body.items.map(i => ({ descricao: i.descricao, quantidade: +i.quantidade, valorUnitario: +i.valorUnitario, subtotal: (+i.quantidade) * (+i.valorUnitario) }));
        const total = items.reduce((s, i) => s + i.subtotal, 0);
        const orc = await orcamentosDB.create({ numero: `ORC-${Date.now().toString(36).toUpperCase()}`, cliente: req.body.cliente, clienteEmail: req.body.clienteEmail || '', items, total, desconto: req.body.desconto || 0, totalFinal: total - (req.body.desconto || 0), status: 'pendente', vendedor: req.user.name, validade: req.body.validade || 30, observacoes: req.body.observacoes || '' });
        res.status(201).json({ success: true, orcamento: orc });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao criar orcamento' });
    }
});

router.put('/:id', validateId, async (req, res) => {
    try {
        const orc = await orcamentosDB.update(req.params.id, req.body);
        if (!orc) return res.status(404).json({ success: false, error: 'Orcamento nao encontrado' });
        res.json({ success: true, orcamento: orc });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao atualizar orcamento' });
    }
});

router.patch('/:id/status', validateId, async (req, res) => {
    try {
        const { status } = req.body;
        const valid = ['pendente', 'enviado', 'aprovado', 'rejeitado', 'expirado'];
        if (!valid.includes(status)) return res.status(400).json({ success: false, error: 'Status invalido' });
        const orc = await orcamentosDB.update(req.params.id, { status });
        if (!orc) return res.status(404).json({ success: false, error: 'Orcamento nao encontrado' });
        res.json({ success: true, orcamento: orc });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao mudar status' });
    }
});

router.delete('/:id', validateId, async (req, res) => {
    try {
        const deleted = await orcamentosDB.delete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: 'Orcamento nao encontrado' });
        res.json({ success: true, message: 'Orcamento removido' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao remover orcamento' });
    }
});

module.exports = router;
