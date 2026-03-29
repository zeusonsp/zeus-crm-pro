/**
 * Zeus CRM Pro v4.0 - Scheduled Reports Routes
 * CRUD for automated report delivery
 */
const router = require('express').Router();
const admin = require('firebase-admin');
const scheduler = require('../services/scheduler');

// GET /api/scheduled-reports - List all schedules
router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('scheduled_reports').orderBy('createdAt', 'desc').get();
    const items = [];
    snap.forEach(doc => items.push(doc.data()));
    res.json({ success: true, items, total: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao listar agendamentos' });
  }
});

// POST /api/scheduled-reports - Create schedule
router.post('/', async (req, res) => {
  try {
    const { name, reportType, format, frequency, recipients } = req.body;
    if (!name || !recipients || recipients.length === 0) {
      return res.status(400).json({ success: false, error: 'name e recipients[] são obrigatórios' });
    }

    const schedule = await scheduler.createSchedule({
      name, reportType, format, frequency, recipients,
      createdBy: req.user?.name || 'admin'
    });

    res.status(201).json({ success: true, item: schedule });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao criar agendamento' });
  }
});

// PUT /api/scheduled-reports/:id - Update schedule
router.put('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates.id;
    await db.collection('scheduled_reports').doc(req.params.id).update(updates);

    // Re-register job if active
    const doc = await db.collection('scheduled_reports').doc(req.params.id).get();
    const schedule = doc.data();
    if (schedule.active) {
      scheduler.registerJob(schedule);
    } else {
      scheduler.stopJob(req.params.id);
    }

    res.json({ success: true, item: schedule });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao atualizar agendamento' });
  }
});

// DELETE /api/scheduled-reports/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    scheduler.stopJob(req.params.id);
    await db.collection('scheduled_reports').doc(req.params.id).delete();
    res.json({ success: true, message: 'Agendamento removido' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao remover agendamento' });
  }
});

// POST /api/scheduled-reports/:id/send-now - Trigger immediate send
router.post('/:id/send-now', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('scheduled_reports').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Não encontrado' });

    const result = await scheduler.executeScheduledReport(doc.data());
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao enviar relatório' });
  }
});

// POST /api/scheduled-reports/:id/toggle - Toggle active
router.post('/:id/toggle', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('scheduled_reports').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Não encontrado' });

    const newActive = !doc.data().active;
    await db.collection('scheduled_reports').doc(req.params.id).update({ active: newActive });

    if (newActive) scheduler.registerJob({ ...doc.data(), active: true });
    else scheduler.stopJob(req.params.id);

    res.json({ success: true, active: newActive });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao alternar agendamento' });
  }
});

// GET /api/scheduled-reports/:id/logs - View send history
router.get('/:id/logs', async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('scheduled_report_logs')
      .where('scheduleId', '==', req.params.id)
      .orderBy('executedAt', 'desc')
      .limit(50)
      .get();
    const items = [];
    snap.forEach(doc => items.push(doc.data()));
    res.json({ success: true, items, total: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao buscar logs' });
  }
});

module.exports = router;
