/**
 * Zeus CRM Pro v4.0 - A/B Testing Routes
 */
const router = require('express').Router();
const abService = require('../services/ab-testing');

// GET /api/ab-tests - List all A/B tests
router.get('/', async (req, res) => {
  try {
    const items = await abService.listTests(req.query.campaignId);
    res.json({ success: true, items, total: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao listar A/B tests' });
  }
});

// POST /api/ab-tests - Create A/B test
router.post('/', async (req, res) => {
  try {
    const { campaignId, variants } = req.body;
    if (!campaignId || !variants) {
      return res.status(400).json({ success: false, error: 'campaignId e variants são obrigatórios' });
    }
    const test = await abService.createABTest(campaignId, variants);

    const io = req.app.get('io');
    if (io) io.emit('ab-test-created', { id: test.id, campaignId });

    res.status(201).json({ success: true, item: test });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ab-tests/:id/event - Record tracking event
router.post('/:id/event', async (req, res) => {
  try {
    const { variantId, eventType, leadId } = req.body;
    const result = await abService.recordEvent(req.params.id, variantId, eventType, leadId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ab-tests/:id/results - Get results
router.get('/:id/results', async (req, res) => {
  try {
    const result = await abService.calculateResults(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ab-tests/:id/complete - Force complete test
router.post('/:id/complete', async (req, res) => {
  try {
    const result = await abService.calculateResults(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
