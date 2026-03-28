// ============================================
// ZEUS CRM PRO - Webhooks (Public Endpoints)
// ============================================
const router = require('express').Router();
const FirestoreService = require('../services/firestore');
const { webhookLimiter } = require('../middleware/rateLimiter');
const logger = require('../services/logger');

const leadsDB = new FirestoreService('zeus_leads');
const bookingsDB = new FirestoreService('zeus_bookings');
const reviewsDB = new FirestoreService('zeus_reviews');

router.use(webhookLimiter);

// POST /api/v1/webhooks/lead - Capture lead from external forms
router.post('/lead', async (req, res) => {
    try {
        const { nome, email, telefone, empresa, origem, mensagem } = req.body;
        if (!nome) {
            return res.status(400).json({ success: false, error: 'Nome obrigatorio' });
        }
        const lead = await leadsDB.create({
            nome, email: email || '', telefone: telefone || '',
            empresa: empresa || '', origem: origem || 'website',
            estagio: 'novo', notas: mensagem || '', vendedor: '',
            valor: 0, score: 0, tags: ['webhook']
        });

        const io = req.app.get('io');
        if (io) io.emit('lead-created', lead);

        logger.info(`[Webhook] New lead captured: ${nome}`);
        res.status(201).json({ success: true, leadId: lead.id });
    } catch (err) {
        logger.error('[Webhook] Lead capture error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao capturar lead' });
    }
});

// POST /api/v1/webhooks/booking - External booking
router.post('/booking', async (req, res) => {
    try {
        const booking = await bookingsDB.create({
            clientName: req.body.clientName || req.body.nome,
            clientEmail: req.body.clientEmail || req.body.email || '',
            clientPhone: req.body.clientPhone || req.body.telefone || '',
            service: req.body.service || req.body.servico || 'Consulta',
            date: req.body.date, time: req.body.time,
            duration: req.body.duration || 60,
            status: 'pendente', notes: req.body.notes || '',
            source: 'webhook'
        });

        const io = req.app.get('io');
        if (io) io.emit('booking-created', booking);

        res.status(201).json({ success: true, bookingId: booking.id });
    } catch (err) {
        logger.error('[Webhook] Booking error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar agendamento' });
    }
});

// POST /api/v1/webhooks/review - External review
router.post('/review', async (req, res) => {
    try {
        const review = await reviewsDB.create({
            clientName: req.body.clientName || req.body.nome,
            rating: +req.body.rating || 5,
            comment: req.body.comment || req.body.comentario || '',
            source: req.body.source || 'webhook'
        });
        res.status(201).json({ success: true, reviewId: review.id });
    } catch (err) {
        logger.error('[Webhook] Review error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar avaliacao' });
    }
});

// POST /api/v1/webhooks/whatsapp - WhatsApp webhook receiver
router.post('/whatsapp', async (req, res) => {
    try {
        logger.info('[Webhook] WhatsApp message received:', JSON.stringify(req.body).substring(0, 200));
        // TODO: Process incoming WhatsApp messages
        res.json({ success: true });
    } catch (err) {
        logger.error('[Webhook] WhatsApp error:', err.message);
        res.status(500).json({ success: false });
    }
});

// GET /api/v1/webhooks/whatsapp - WhatsApp verification
router.get('/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

module.exports = router;
