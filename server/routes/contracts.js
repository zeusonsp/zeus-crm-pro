// ============================================
// ZEUS CRM PRO - Contracts API Routes
// ============================================
const router = require('express').Router();
const FirestoreService = require('../services/firestore');
const { validateContract, validateId } = require('../middleware/validate');
const logger = require('../services/logger');

const contractsDB = new FirestoreService('zeus_contracts');

// GET /api/v1/contracts
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 50, sort = 'createdAt', order = 'desc' } = req.query;
        const filters = {};
        if (req.query.status) filters.status = req.query.status;
        const result = await contractsDB.getAll({ page: +page, limit: +limit, sort, order, filters });
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[Contracts] List error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao listar contratos' });
    }
});

// GET /api/v1/contracts/:id
router.get('/:id', validateId, async (req, res) => {
    try {
        const contract = await contractsDB.getById(req.params.id);
        if (!contract) return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
        res.json({ success: true, contract });
    } catch (err) {
        logger.error('[Contracts] Get error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao buscar contrato' });
    }
});

// POST /api/v1/contracts
router.post('/', validateContract, async (req, res) => {
    try {
        const data = {
            clientName: req.body.clientName,
            clientEmail: req.body.clientEmail || '',
            clientDoc: req.body.clientDoc || '',
            value: +req.body.value,
            description: req.body.description || '',
            status: 'rascunho',
            startDate: req.body.startDate || '',
            endDate: req.body.endDate || '',
            paymentTerms: req.body.paymentTerms || '',
            createdBy: req.user.name
        };
        const contract = await contractsDB.create(data);
        const io = req.app.get('io');
        if (io) io.emit('contract-created', contract);
        res.status(201).json({ success: true, contract });
    } catch (err) {
        logger.error('[Contracts] Create error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar contrato' });
    }
});

// PUT /api/v1/contracts/:id
router.put('/:id', validateId, async (req, res) => {
    try {
        const contract = await contractsDB.update(req.params.id, req.body);
        if (!contract) return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
        res.json({ success: true, contract });
    } catch (err) {
        logger.error('[Contracts] Update error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao atualizar contrato' });
    }
});

// PATCH /api/v1/contracts/:id/sign
router.patch('/:id/sign', validateId, async (req, res) => {
    try {
        const contract = await contractsDB.update(req.params.id, {
            status: 'assinado',
            signedAt: new Date().toISOString(),
            signedBy: req.body.signedBy || req.user.name
        });
        if (!contract) return res.status(404).json({ success: }©lyêë¢°¨ÚÚ¶‰Ú¡éÜ¢{kiÚˆ™\ËšœÛÛŠÈİXØÙ\ÜÎˆYKÛÛ˜XİJNÂˆHØ]Ú
\œŠHÂˆÙÙÙ\‹™\œ›ÜŠ	ÖĞÛÛ˜Xİ×HÚYÛˆ\œ›Ü‰Ë\œ‹›Y\ÜØYÙJNÂˆ™\Ëœİ]\ÊL
KšœÛÛŠÈİXØÙ\ÜÎˆ˜[ÙK\œ›Üˆ	Ñ\œ›È[È\ÜÚ[˜\ˆÛÛ˜]ÉÈJNÂˆBŸJNÂ‚‹ËÈSUHØ\KİŒKØÛÛ˜XİËÎšYœ›İ]\‹™[]J	ËÎšY	Ë˜[Y]RY\Ş[˜È
™\K™\ÊHOˆÂˆHÂˆÛÛœİ[]YH]ØZ]ÛÛ˜XİÑ‹™[]J™\Kœ\˜[\ËšY
NÂˆYˆ
Y[]Y
H™]\›ˆ™\Ëœİ]\Ê
KšœÛÛŠÈİXØÙ\ÜÎˆ˜[ÙK\œ›Üˆ	ĞÛÛ˜]È˜[È[˜ÛÛ˜YÉÈJNÂˆ™\ËšœÛÛŠÈİXØÙ\ÜÎˆYKY\ÜØYÙNˆ	ĞÛÛ˜]È™[[İšYÉÈJNÂˆHØ]Ú
\œŠHÂˆÙÙÙ\‹™\œ›ÜŠ	ÖĞÛÛ˜Xİ×H[]H\œ›Ü‰Ë\œ‹›Y\ÜØYÙJNÂˆ™\Ëœİ]\ÊL
KšœÛÛŠÈİXØÙ\ÜÎˆ˜[ÙK\œ›Üˆ	Ñ\œ›È[È™[[İ™\ˆÛÛ˜]ÉÈJNÂˆBŸJNÂ‚›[Ù[K™^ÜÈH›İ]\Â