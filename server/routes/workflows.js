/**
 * Zeus CRM Pro v4.0 - Workflow Automation Routes
 * CRUD for workflows + execution + logs
 */
const router = require('express').Router();
const admin = require('firebase-admin');
const engine = require('../services/workflow-engine');

// GET /api/workflows - List all workflows
router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('workflows').orderBy('createdAt', 'desc').get();
    const items = [];
    snap.forEach(doc => items.push(doc.data()));
    res.json({ success: true, items, total: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao listar workflows' });
  }
});

// GET /api/workflows/triggers - List available triggers
router.get('/triggers', (req, res) => {
  res.json({
    success: true,
    triggers: Object.entries(engine.TRIGGER_TYPES).map(([key, value]) => ({
      id: value, label: key.replace(/_/g, ' ')
    })),
    actions: Object.entries(engine.ACTION_TYPES).map(([key, value]) => ({
      id: value, label: key.replace(/_/g, ' ')
    }))
  });
});

// GET /api/workflows/:id - Get single workflow
router.get('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('workflows').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Workflow não encontrado' });
    res.json({ success: true, item: doc.data() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao buscar workflow' });
  }
});

// POST /api/workflows - Create workflow
router.post('/', async (req, res) => {
  try {
    const { name, description, trigger, steps } = req.body;
    if (!name || !trigger) {
      return res.status(400).json({ success: false, error: 'name e trigger são obrigatórios' });
    }
    const workflow = await engine.createWorkflow({ name, description, trigger, steps });

    const io = req.app.get('io');
    if (io) io.emit('workflow-created', { id: workflow.id, name: workflow.name });

    res.status(201).json({ success: true, item: workflow });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao criar workflow' });
  }
});

// PUT /api/workflows/:id - Update workflow
router.put('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const { name, description, trigger, steps, active } = req.body;
    await db.collection('workflows').doc(req.params.id).update({
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(trigger && { trigger }),
      ...(steps && { steps }),
      ...(active !== undefined && { active }),
      updatedAt: new Date().toISOString()
    });
    const updated = await db.collection('workflows').doc(req.params.id).get();
    res.json({ success: true, item: updated.data() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao atualizar workflow' });
  }
});

// DELETE /api/workflows/:id - Delete workflow
router.delete('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    await db.collection('workflows').doc(req.params.id).delete();
    res.json({ success: true, message: 'Workflow removido' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao remover workflow' });
  }
});

// POST /api/workflows/:id/execute - Manual execution
router.post('/:id/execute', async (req, res) => {
  try {
    const result = await engine.executeWorkflow(req.params.id, req.body.data || {});

    const io = req.app.get('io');
    if (io) io.emit('workflow-executed', { workflowId: req.params.id, status: result.status });

    res.json({ success: true, execution: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao executar workflow' });
  }
});

// POST /api/workflows/:id/toggle - Toggle active/inactive
router.post('/:id/toggle', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('workflows').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Não encontrado' });
    const newActive = !doc.data().active;
    await db.collection('workflows').doc(req.params.id).update({ active: newActive });
    res.json({ success: true, active: newActive });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao alternar workflow' });
  }
});

// GET /api/workflows/:id/executions - Execution history
router.get('/:id/executions', async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('workflow_executions')
      .where('workflowId', '==', req.params.id)
      .orderBy('startedAt', 'desc')
      .limit(50)
      .get();
    const items = [];
    snap.forEach(doc => items.push(doc.data()));
    res.json({ success: true, items, total: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao buscar execuções' });
  }
});

module.exports = router;
