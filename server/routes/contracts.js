// ============================================
// ZEUS CRM PRO - Contracts API Routes
// ============================================
const router = require('express').Router();
const FirestoreService = require('../services/firestore');
const { validateContract, validateId } = require('../middleware/validate');
const logger = require('../services/logger');

const contractsDB = new FirestoreService('zeus_contracts');

router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 50, sort = 'createdAt', order = 'desc' } = req.query;
        const filters = {};
        if (req.query.status) filters.status = req.query.status;
        const result = await contractsDB.getAll({ page: +page, limit: +limit, sort, order, filters });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao listar contratos' });
    }
});

router.get('/:id', validateId, async (req, res) => {
    try {
        const contract = await contractsDB.getById(req.params.id);
        if (!contract) return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
        res.json({ success: true, contract });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao buscar contrato' });
    }
});

router.post('/', validateContract, async (req, res) => {
    try {
        const data = { clientName: req.body.clientName, clientEmail: req.body.clientEmail || '', clientDoc: req.body.clientDoc || '', value: +req.body.value, description: req.body.description || '', status: 'rascunho', startDate: req.body.startDate || '', endDate: req.body.endDate || '', paymentTerms: req.body.paymentTerms || '', createdBy: req.user.name };
        const contract = await contractsDB.create(data);
        res.status(201).json({ success: true, contract });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao criar contrato' });
    }
});

router.put('/:id', validateId, async (req, res) => {
    try {
        const contract = await contractsDB.update(req.params.id, req.body);
        if (!contract) return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
        res.json({ success: true, contract });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao atualizar contrato' });
    }
});

router.patch('/:id/sign', validateId, async (req, res) => {
    try {
        const contract = await contractsDB.update(req.params.id, { status: 'assinado', signedAt: new Date().toISOString(), signedBy: req.body.signedBy || req.user.name });
        if (!contract) return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
        res.json({ success: true, contract });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao assinar contrato' });
    }
});

router.delete('/:id', validateId, async (req, res) => {
    try {
        const deleted = await contractsDB.delete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
        res.json({ success: true, message: 'Contrato removido' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Erro ao remover contrato' });
    }
});

module.exports = router;
