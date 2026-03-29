/**
 * Zeus CRM Pro v4.0 - Lead Deduplication Routes
 */
const router = require('express').Router();
const dedup = require('../services/deduplication');

// GET /api/deduplication/scan - Scan for duplicates
router.get('/scan', async (req, res) => {
  try {
    const result = await dedup.findDuplicates();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Dedup] Scan error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao buscar duplicatas' });
  }
});

// POST /api/deduplication/merge - Merge specific leads
router.post('/merge', async (req, res) => {
  try {
    const { primaryId, mergeIds } = req.body;
    if (!primaryId || !mergeIds || !Array.isArray(mergeIds)) {
      return res.status(400).json({ success: false, error: 'primaryId e mergeIds[] são obrigatórios' });
    }
    const result = await dedup.mergeLeads(primaryId, mergeIds);

    const io = req.app.get('io');
    if (io) io.emit('leads-merged', result);

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Dedup] Merge error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao mesclar leads' });
  }
});

// POST /api/deduplication/auto-merge - Auto-merge obvious duplicates
router.post('/auto-merge', async (req, res) => {
  try {
    const result = await dedup.autoMerge();

    const io = req.app.get('io');
    if (io) io.emit('leads-auto-merged', result);

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Dedup] Auto-merge error:', err.message);
    res.status(500).json({ success: false, error: 'Erro na deduplicação automática' });
  }
});

module.exports = router;
