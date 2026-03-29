/**
 * Zeus CRM Pro v4.0 - Custom Reports Builder
 * User-configurable dashboards with drag-and-drop widgets
 */
const router = require('express').Router();
const admin = require('firebase-admin');
const { v4: uuid } = require('uuid');

const WIDGET_TYPES = {
  KPI_CARD: 'kpi_card',        // Single metric display
  BAR_CHART: 'bar_chart',      // Bar chart
  LINE_CHART: 'line_chart',    // Line chart (time series)
  PIE_CHART: 'pie_chart',      // Pie/donut chart
  TABLE: 'table',              // Data table
  FUNNEL: 'funnel',            // Sales funnel
  LEADERBOARD: 'leaderboard',  // Top performers
  TIMELINE: 'timeline',        // Activity timeline
  HEATMAP: 'heatmap'           // Activity heatmap
};

const DATA_SOURCES = {
  LEADS: 'leads',
  QUOTES: 'orcamentos',
  CONTRACTS: 'contracts',
  TASKS: 'tasks',
  CAMPAIGNS: 'campaigns',
  NPS: 'nps_responses',
  REVIEWS: 'reviews'
};

const METRICS = {
  count: 'Contagem',
  sum_value: 'Soma de Valores (R$)',
  avg_value: 'Média de Valores (R$)',
  conversion_rate: 'Taxa de Conversão (%)',
  avg_score: 'Score Médio',
  response_time: 'Tempo de Resposta'
};

// GET /api/custom-reports - List saved reports
router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('custom_reports')
      .where('userId', '==', req.user?.id || 'default')
      .orderBy('updatedAt', 'desc')
      .get();
    const items = [];
    snap.forEach(doc => items.push(doc.data()));

    // Also get shared reports
    const sharedSnap = await db.collection('custom_reports')
      .where('shared', '==', true)
      .orderBy('updatedAt', 'desc')
      .limit(20)
      .get();
    const shared = [];
    sharedSnap.forEach(doc => {
      if (doc.data().userId !== (req.user?.id || 'default')) shared.push(doc.data());
    });

    res.json({ success: true, items, shared, total: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao listar relatórios' });
  }
});

// GET /api/custom-reports/widgets - Available widget types & metrics
router.get('/widgets', (req, res) => {
  res.json({
    success: true,
    widgetTypes: Object.entries(WIDGET_TYPES).map(([k, v]) => ({ id: v, label: k.replace(/_/g, ' ') })),
    dataSources: Object.entries(DATA_SOURCES).map(([k, v]) => ({ id: v, label: k })),
    metrics: Object.entries(METRICS).map(([k, v]) => ({ id: k, label: v }))
  });
});

// GET /api/custom-reports/:id - Get report with live data
router.get('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('custom_reports').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Relatório não encontrado' });

    const report = doc.data();

    // Fetch live data for each widget
    const widgetsWithData = await Promise.all(
      report.widgets.map(async widget => {
        try {
          const data = await fetchWidgetData(widget);
          return { ...widget, data };
        } catch (err) {
          return { ...widget, data: null, error: err.message };
        }
      })
    );

    res.json({ success: true, item: { ...report, widgets: widgetsWithData } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao buscar relatório' });
  }
});

// POST /api/custom-reports - Create custom report
router.post('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const id = uuid();
    const report = {
      id,
      name: req.body.name || 'Novo Relatório',
      description: req.body.description || '',
      widgets: req.body.widgets || [],
      layout: req.body.layout || 'grid', // grid, list, freeform
      shared: req.body.shared || false,
      userId: req.user?.id || 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('custom_reports').doc(id).set(report);
    res.status(201).json({ success: true, item: report });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao criar relatório' });
  }
});

// PUT /api/custom-reports/:id - Update report (widgets, layout, etc.)
router.put('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates.id;
    await db.collection('custom_reports').doc(req.params.id).update(updates);
    const updated = await db.collection('custom_reports').doc(req.params.id).get();
    res.json({ success: true, item: updated.data() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao atualizar relatório' });
  }
});

// DELETE /api/custom-reports/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    await db.collection('custom_reports').doc(req.params.id).delete();
    res.json({ success: true, message: 'Relatório removido' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao remover relatório' });
  }
});

// POST /api/custom-reports/:id/widgets - Add widget to report
router.post('/:id/widgets', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('custom_reports').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Relatório não encontrado' });

    const widget = {
      id: uuid(),
      type: req.body.type || 'kpi_card',
      title: req.body.title || 'Novo Widget',
      dataSource: req.body.dataSource || 'leads',
      metric: req.body.metric || 'count',
      filters: req.body.filters || {},
      groupBy: req.body.groupBy || null,
      dateRange: req.body.dateRange || '30d',
      position: req.body.position || { x: 0, y: 0, w: 4, h: 3 },
      config: req.body.config || {}
    };

    const report = doc.data();
    report.widgets.push(widget);

    await db.collection('custom_reports').doc(req.params.id).update({
      widgets: report.widgets,
      updatedAt: new Date().toISOString()
    });

    res.status(201).json({ success: true, widget });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao adicionar widget' });
  }
});

// POST /api/custom-reports/:id/duplicate - Clone report
router.post('/:id/duplicate', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('custom_reports').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Não encontrado' });

    const original = doc.data();
    const newId = uuid();
    const cloned = {
      ...original,
      id: newId,
      name: `${original.name} (Cópia)`,
      shared: false,
      userId: req.user?.id || 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('custom_reports').doc(newId).set(cloned);
    res.status(201).json({ success: true, item: cloned });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao duplicar' });
  }
});

// Fetch live data for a widget
async function fetchWidgetData(widget) {
  const db = admin.firestore();
  const collection = widget.dataSource || 'leads';

  let query = db.collection(collection);

  // Apply date range filter
  if (widget.dateRange) {
    const now = new Date();
    const days = parseInt(widget.dateRange) || 30;
    const start = new Date(now.getTime() - days * 86400000).toISOString();
    query = query.where('createdAt', '>=', start);
  }

  // Apply custom filters
  if (widget.filters) {
    for (const [field, value] of Object.entries(widget.filters)) {
      if (value !== null && value !== undefined && value !== '') {
        query = query.where(field, '==', value);
      }
    }
  }

  const snap = await query.limit(1000).get();
  const docs = [];
  snap.forEach(doc => docs.push(doc.data()));

  // Calculate metric
  switch (widget.metric) {
    case 'count':
      if (widget.groupBy) {
        const groups = {};
        docs.forEach(d => {
          const key = d[widget.groupBy] || 'Outros';
          groups[key] = (groups[key] || 0) + 1;
        });
        return { total: docs.length, groups };
      }
      return { value: docs.length };

    case 'sum_value':
      const sum = docs.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
      if (widget.groupBy) {
        const groups = {};
        docs.forEach(d => {
          const key = d[widget.groupBy] || 'Outros';
          groups[key] = (groups[key] || 0) + (parseFloat(d.valor) || 0);
        });
        return { value: sum, groups };
      }
      return { value: sum };

    case 'avg_value':
      const avg = docs.length > 0
        ? docs.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0) / docs.length
        : 0;
      return { value: Math.round(avg * 100) / 100 };

    case 'conversion_rate':
      const won = docs.filter(d => d.estagio === 'fechado' || d.status === 'won').length;
      return { value: docs.length > 0 ? Math.round((won / docs.length) * 10000) / 100 : 0 };

    case 'avg_score':
      const scores = docs.filter(d => d.aiScore).map(d => d.aiScore);
      return { value: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0 };

    default:
      return { value: docs.length };
  }
}

module.exports = router;
