// ============================================
// ZEUS CRM PRO - Products API Routes
// ============================================
const router = require('express').Router();
const FirestoreService = require('../services/firestore');
const { validateProduct, validateId } = require('../middleware/validate');
const logger = require('../services/logger');

const productsDB = new FirestoreService('zeus_products');

router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 100, sort = 'nome', order = 'asc' } = req.query;
        const filters = {};
        if (req.query.categoria) filters.categoria = req.query.categoria;
        const result = await productsDB.getAll({ page: +page, limit: +limit, sort, order, filters });
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[Products] List error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao listar produtos' });
    }
});

router.get('/:id', validateId, async (req, res) => {
    try {
        const product = await productsDB.getById(req.params.id);
        if (!product) return res.status(404).json({ success: false, error: 'Produto nao encontrado' });
        res.json({ success: true, product });
    } catch (err) {
        logger.error('[Products] Get error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao buscar produto' });
    }
});

router.post('/', validateProduct, async (req, res) => {
    try {
        const data = {
            nome: req.body.nome,
            descricao: req.body.descricao || '',
            preco: +req.body.preco,
            categoria: req.body.categoria || 'geral',
            sku: req.body.sku || '',
            estoque: req.body.estoque || 0,
            ativo: true
        };
        const product = await productsDB.create(data);
        res.status(201).json({ success: true, product });
    } catch (err) {
        logger.error('[Products] Create error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar produto' });
    }
});

router.put('/:id', validateId, async (req, res) => {
    try {
        const product = await productsDB.update(req.params.id, req.body);
        if (!product) return res.status(404).json({ success: false, error: 'Produto nao encontrado' });
        res.json({ success: true, product });
    } catch (err) {
        logger.error('[Products] Update error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao atualizar produto' });
    }
});

router.delete('/:id', validateId, async (req, res) => {
    try {
        const deleted = await productsDB.delete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: 'Produto nao encontrado' });
        res.json({ success: true, message: 'Produto removido' });
    } catch (err) {
        logger.error('[Products] Delete error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao remover produto' });
    }
});

module.exports = router;
