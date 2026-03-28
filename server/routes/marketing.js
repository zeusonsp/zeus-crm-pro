// ============================================
// ZEUS CRM PRO - Marketing Suite API Routes
// ============================================
const router = require('express').Router();
const FirestoreService = require('../services/firestore');
const logger = require('../services/logger');

const funnelsDB = new FirestoreService('zeus_funnels');
const campaignsDB = new FirestoreService('zeus_campaigns');
const bookingsDB = new FirestoreService('zeus_bookings');
const reviewsDB = new FirestoreService('zeus_reviews');
const adsDB = new FirestoreService('zeus_ads');

// ============================================
// FUNNELS
// ============================================
router.get('/funnels', async (req, res) => {
    try {
        const result = await funnelsDB.getAll({ sort: 'createdAt', order: 'desc' });
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[Marketing] Funnels list error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao listar funis' });
    }
});

router.post('/funnels', async (req, res) => {
    try {
        const funnel = await funnelsDB.create({
            name: req.body.name,
            type: req.body.type || 'lead-capture',
            stages: req.body.stages || [],
            status: 'ativo',
            visits: 0,
            conversions: 0,
            template: req.body.template || null
        });
        res.status(201).json({ success: true, funnel });
    } catch (err) {
        logger.error('[Marketing] Funnel create error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar funil' });
    }
});

router.put('/funnels/:id', async (req, res) => {
    try {
        const funnel = await funnelsDB.update(req.params.id, req.body);
        if (!funnel) return res.status(404).json({ success: false, error: 'Funil nao encontrado' });
        res.json({ success: true, funnel });
    } catch (err) {
        logger.error('[Marketing] Funnel update error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao atualizar funil' });
    }
});

router.delete('/funnels/:id', async (req, res) => {
    try {
        await funnelsDB.delete(req.params.id);
        res.json({ success: true, message: 'Funil removido' });
    } catch (err) {
        logger.error('[Marketing] Funnel delete error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao remover funil' });
    }
});

// ============================================
// EMAIL CAMPAIGNS
// ============================================
router.get('/campaigns', async (req, res) => {
    try {
        const filters = {};
        if (req.query.type) filters.type = req.query.type;
        if (req.query.status) filters.status = req.query.status;
        const result = await campaignsDB.getAll({ sort: 'createdAt', order: 'desc', filters });
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[Marketing] Campaigns list error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao listar campanhas' });
    }
});

router.post('/campaigns', async (req, res) => {
    try {
        const campaign = await campaignsDB.create({
            name: req.body.name,
            type: req.body.type || 'email',
            subject: req.body.subject || '',
            content: req.body.content || '',
            segment: req.body.segment || 'all',
            status: 'rascunho',
            scheduledAt: req.body.scheduledAt || null,
            stats: { sent: 0, opened: 0, clicked: 0, bounced: 0 }
        });
        res.status(201).json({ success: true, campaign });
    } catch (err) {
        logger.error('[Marketing] Campaign create error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar campanha' });
    }
});

router.patch('/campaigns/:id/send', async (req, res) => {
    try {
        const campaign = await campaignsDB.update(req.params.id, {
            status: 'enviada',
            sentAt: new Date().toISOString()
        });
        if (!campaign) return res.status(404).json({ success: false, error: 'Campanha nao encontrada' });
        // TODO: Integrate real email sending via SMTP service
        res.json({ success: true, campaign, message: 'Campanha enviada' });
    } catch (err) {
        logger.error('[Marketing] Campaign send error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao enviar campanha' });
    }
});

// ============================================
// BOOKINGS
// ============================================
router.get('/bookings', async (req, res) => {
    try {
        const result = await bookingsDB.getAll({ sort: 'date', order: 'asc' });
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[Marketing] Bookings list error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao listar agendamentos' });
    }
});

router.post('/bookings', async (req, res) => {
    try {
        const booking = await bookingsDB.create({
            clientName: req.body.clientName,
            clientEmail: req.body.clientEmail || '',
            clientPhone: req.body.clientPhone || '',
            service: req.body.service,
            date: req.body.date,
            time: req.body.time,
            duration: req.body.duration || 60,
            assignedTo: req.body.assignedTo || '',
            status: 'confirmado',
            notes: req.body.notes || ''
        });
        const io = req.app.get('io');
        if (io) io.emit('booking-created', booking);
        res.status(201).json({ success: true, booking });
    } catch (err) {
        logger.error('[Marketing] Booking create error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar agendamento' });
    }
});

router.patch('/bookings/:id/cancel', async (req, res) => {
    try {
        const booking = await bookingsDB.update(req.params.id, {
            status: 'cancelado',
            cancelledAt: new Date().toISOString()
        });
        if (!booking) return res.status(404).json({ success: false, error: 'Agendamento nao encontrado' });
        res.json({ success: true, booking });
    } catch (err) {
        logger.error('[Marketing] Booking cancel error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao cancelar agendamento' });
    }
});

// ============================================
// REVIEWS / REPUTATION
// ============================================
router.get('/reviews', async (req, res) => {
    try {
        const result = await reviewsDB.getAll({ sort: 'createdAt', order: 'desc' });
        const reviews = result.items;
        const avgRating = reviews.length > 0 ?
            (reviews.reduce((s, r) => s + (+r.rating || 0), 0) / reviews.length).toFixed(1) : 0;
        const distribution = [0, 0, 0, 0, 0];
        reviews.forEach(r => {
            const idx = Math.min(Math.max(Math.round(+r.rating) - 1, 0), 4);
            distribution[idx]++;
        });
        res.json({
            success: true,
            reviews,
            stats: { total: reviews.length, avgRating, distribution }
        });
    } catch (err) {
        logger.error('[Marketing] Reviews list error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao listar avaliacoes' });
    }
});

router.post('/reviews', async (req, res) => {
    try {
        const review = await reviewsDB.create({
            clientName: req.body.clientName,
            rating: +req.body.rating,
            comment: req.body.comment || '',
            source: req.body.source || 'manual',
            reply: ''
        });
        res.status(201).json({ success: true, review });
    } catch (err) {
        logger.error('[Marketing] Review create error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar avaliacao' });
    }
});

router.patch('/reviews/:id/reply', async (req, res) => {
    try {
        const review = await reviewsDB.update(req.params.id, {
            reply: req.body.reply,
            repliedAt: new Date().toISOString()
        });
        if (!review) return res.status(404).json({ success: false, error: 'Avaliacao nao encontrada' });
        res.json({ success: true, review });
    } catch (err) {
        logger.error('[Marketing] Review reply error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao responder avaliacao' });
    }
});

// ============================================
// ADS
// ============================================
router.get('/ads', async (req, res) => {
    try {
        const result = await adsDB.getAll({ sort: 'createdAt', order: 'desc' });
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[Marketing] Ads list error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao listar anuncios' });
    }
});

router.post('/ads', async (req, res) => {
    try {
        const ad = await adsDB.create({
            name: req.body.name,
            platform: req.body.platform || 'facebook',
            budget: +req.body.budget || 0,
            status: 'rascunho',
            metrics: { impressions: 0, clicks: 0, leads: 0, spend: 0, roas: 0 }
        });
        res.status(201).json({ success: true, ad });
    } catch (err) {
        logger.error('[Marketing] Ad create error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar anuncio' });
    }
});

router.put('/ads/:id', async (req, res) => {
    try {
        const ad = await adsDB.update(req.params.id, req.body);
        if (!ad) return res.status(404).json({ success: false, error: 'Anuncio nao encontrado' });
        res.json({ success: true, ad });
    } catch (err) {
        logger.error('[Marketing] Ad update error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao atualizar anuncio' });
    }
});

module.exports = router;
