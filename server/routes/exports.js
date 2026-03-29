// ============================================
// ZEUS CRM PRO - Export Routes
// PDF & Excel downloads
// ============================================

const express = require('express');
const router = express.Router();
const exporter = require('../services/reportExporter');
const db = require('../services/firestore');
const logger = require('../services/logger');

// GET /api/v1/exports/dashboard/pdf - Export dashboard as PDF
router.get('/dashboard/pdf', async (req, res) => {
  try {
    const data = await getDashboardData();
    const buffer = await exporter.generateDashboardPDF(data);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=zeus-dashboard-${dateStamp()}.pdf`,
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (err) {
    logger.error('[Export] Dashboard PDF error:', err.message);
    res.status(500).json({ error: 'PDF generation failed', details: err.message });
  }
});

// GET /api/v1/exports/dashboard/excel - Export dashboard as Excel
router.get('/dashboard/excel', async (req, res) => {
  try {
    const data = await getDashboardData();
    const buffer = await exporter.generateDashboardExcel(data);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=zeus-dashboard-${dateStamp()}.xlsx`,
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (err) {
    logger.error('[Export] Dashboard Excel error:', err.message);
    res.status(500).json({ error: 'Excel generation failed', details: err.message });
  }
});

// GET /api/v1/exports/sales/pdf - Export sales report as PDF
router.get('/sales/pdf', async (req, res) => {
  try {
    const { from, to } = req.query;
    const data = await getSalesData(from, to);
    const buffer = await exporter.generateSalesReportPDF(data);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=zeus-vendas-${dateStamp()}.pdf`,
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (err) {
    logger.error('[Export] Sales PDF error:', err.message);
    res.status(500).json({ error: 'PDF generation failed', details: err.message });
  }
});

// GET /api/v1/exports/pipeline/pdf - Export pipeline as PDF
router.get('/pipeline/pdf', async (req, res) => {
  try {
    const data = await getPipelineData();
    const buffer = await exporter.generatePipelinePDF(data);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=zeus-pipeline-${dateStamp()}.pdf`,
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (err) {
    logger.error('[Export] Pipeline PDF error:', err.message);
    res.status(500).json({ error: 'PDF generation failed', details: err.message });
  }
});

// GET /api/v1/exports/leads/excel - Export leads as Excel
router.get('/leads/excel', async (req, res) => {
  try {
    const { stage, origin, vendor } = req.query;
    const filters = [];
    if (stage) filters.push({ field: 'estagio', operator: '==', value: stage });
    if (origin) filters.push({ field: 'origem', operator: '==', value: origin });
    if (vendor) filters.push({ field: 'vendedor', operator: '==', value: vendor });

    const leads = await db.getAll('zeus_leads', { filters, limit: 5000 });
    const buffer = await exporter.generateLeadsExcel(leads);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=zeus-leads-${dateStamp()}.xlsx`,
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (err) {
    logger.error('[Export] Leads Excel error:', err.message);
    res.status(500).json({ error: 'Excel generation failed', details: err.message });
  }
});

// GET /api/v1/exports/quotes/excel - Export quotes as Excel
router.get('/quotes/excel', async (req, res) => {
  try {
    const { status } = req.query;
    const filters = status ? [{ field: 'status', operator: '==', value: status }] : [];
    const quotes = await db.getAll('zeus_orcamentos', { filters, limit: 5000 });
    const buffer = await exporter.generateQuotesExcel(quotes);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=zeus-orcamentos-${dateStamp()}.xlsx`,
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (err) {
    logger.error('[Export] Quotes Excel error:', err.message);
    res.status(500).json({ error: 'Excel generation failed', details: err.message });
  }
});

// ================================
// DATA HELPERS
// ================================

async function getDashboardData() {
  const [leads, quotes, contracts, tasks] = await Promise.all([
    db.getAll('zeus_leads', {}),
    db.getAll('zeus_orcamentos', {}),
    db.getAll('zeus_contracts', {}),
    db.getAll('zeus_tasks', {})
  ]);

  let npsScore = 0;
  try {
    const npsData = await db.getAll('zeus_nps', {});
    if (npsData.length > 0) {
      const promoters = npsData.filter(n => n.score >= 9).length;
      const detractors = npsData.filter(n => n.score <= 6).length;
      npsScore = Math.round(((promoters - detractors) / npsData.length) * 100);
    }
  } catch { /* ok */ }

  const leadsByStage = {};
  leads.forEach(l => { leadsByStage[l.estagio || 'N/A'] = (leadsByStage[l.estagio || 'N/A'] || 0) + 1; });

  const approvedQuotes = quotes.filter(q => q.status === 'aprovado');
  const pendingQuotes = quotes.filter(q => ['pendente', 'enviado'].includes(q.status));
  const activeContracts = contracts.filter(c => c.status === 'assinado');
  const closedLeads = leads.filter(l => l.estagio === 'fechamento');
  const overdueTasks = tasks.filter(t => t.status === 'pendente' && t.dueDate && new Date(t.dueDate) < new Date());

  // Monthly trend
  const monthlyTrend = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    monthlyTrend.push({
      month: month.toISOString().substring(0, 7),
      leads: leads.filter(l => { const d = new Date(l.createdAt); return d >= month && d <= monthEnd; }).length,
      revenue: approvedQuotes.filter(q => { const d = new Date(q.createdAt); return d >= month && d <= monthEnd; }).reduce((s, q) => s + (q.total || 0), 0)
    });
  }

  return {
    totalLeads: leads.length,
    totalQuotes: quotes.length,
    activeContracts: activeContracts.length,
    approvedRevenue: approvedQuotes.reduce((s, q) => s + (q.total || 0), 0),
    pendingRevenue: pendingQuotes.reduce((s, q) => s + (q.total || 0), 0),
    conversionRate: leads.length > 0 ? ((closedLeads.length / leads.length) * 100).toFixed(1) : 0,
    npsScore,
    pendingTasks: tasks.filter(t => t.status === 'pendente').length,
    overdueTasks: overdueTasks.length,
    leadsByStage,
    monthlyTrend
  };
}

async function getSalesData(from, to) {
  const quotes = await db.getAll('zeus_orcamentos', {});
  let filtered = quotes;

  if (from) filtered = filtered.filter(q => new Date(q.createdAt) >= new Date(from));
  if (to) filtered = filtered.filter(q => new Date(q.createdAt) <= new Date(to));

  const approved = filtered.filter(q => q.status === 'aprovado');
  const totalValue = approved.reduce((s, q) => s + (q.total || 0), 0);

  return {
    from, to,
    totalQuotes: filtered.length,
    approvedQuotes: approved.length,
    totalValue,
    avgTicket: approved.length > 0 ? totalValue / approved.length : 0,
    approvalRate: filtered.length > 0 ? ((approved.length / filtered.length) * 100).toFixed(1) : 0,
    quotes: filtered
  };
}

async function getPipelineData() {
  const leads = await db.getAll('zeus_leads', {});
  const stageOrder = ['novo', 'contato', 'proposta', 'negociacao', 'fechamento'];
  const stages = stageOrder.map(stage => {
    const stageLeads = leads.filter(l => l.estagio === stage);
    return {
      name: stage.charAt(0).toUpperCase() + stage.slice(1),
      stage,
      count: stageLeads.length,
      value: stageLeads.reduce((s, l) => s + (l.valor || 0), 0)
    };
  });

  return { stages };
}

function dateStamp() {
  return new Date().toISOString().split('T')[0];
}

module.exports = router;
