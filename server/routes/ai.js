// ============================================
// ZEUS CRM PRO - AI Routes
// ============================================

const express = require('express');
const router = express.Router();
const ai = require('../services/ai');
const db = require('../services/firestore');
const logger = require('../services/logger');

// POST /api/v1/ai/qualify-lead/:id - Qualify single lead
router.post('/qualify-lead/:id', async (req, res) => {
  try {
    const lead = await db.getById('zeus_leads', req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const qualification = await ai.qualifyLead(lead);

    // Save qualification to lead
    await db.update('zeus_leads', req.params.id, {
      aiScore: qualification.score,
      aiTier: qualification.tier,
      aiQualifiedAt: new Date().toISOString()
    });

    res.json({ leadId: req.params.id, ...qualification });
  } catch (err) {
    logger.error('[AI] Qualify lead error:', err.message);
    res.status(500).json({ error: 'AI qualification failed', details: err.message });
  }
});

// POST /api/v1/ai/bulk-qualify - Qualify multiple leads
router.post('/bulk-qualify', async (req, res) => {
  try {
    const { stage, limit = 20 } = req.body;
    const filters = stage ? [{ field: 'estagio', operator: '==', value: stage }] : [];
    const leads = await db.getAll('zeus_leads', { filters, limit });

    const results = await ai.bulkQualifyLeads(leads);

    // Save scores to leads
    for (const r of results) {
      if (r.score > 0) {
        await db.update('zeus_leads', r.leadId, {
          aiScore: r.score,
          aiTier: r.tier,
          aiQualifiedAt: new Date().toISOString()
        });
      }
    }

    res.json({ qualified: results.length, results });
  } catch (err) {
    logger.error('[AI] Bulk qualify error:', err.message);
    res.status(500).json({ error: 'Bulk qualification failed', details: err.message });
  }
});

// POST /api/v1/ai/follow-up/:id - Get follow-up suggestions
router.post('/follow-up/:id', async (req, res) => {
  try {
    const lead = await db.getById('zeus_leads', req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const suggestions = await ai.suggestFollowUp(lead, req.body.interactions || []);
    res.json({ leadId: req.params.id, ...suggestions });
  } catch (err) {
    logger.error('[AI] Follow-up error:', err.message);
    res.status(500).json({ error: 'Follow-up generation failed', details: err.message });
  }
});

// POST /api/v1/ai/predict/:id - Predict closing
router.post('/predict/:id', async (req, res) => {
  try {
    const lead = await db.getById('zeus_leads', req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Get pipeline stats for context
    const allLeads = await db.getAll('zeus_leads', {});
    const closedLeads = allLeads.filter(l => l.estagio === 'fechamento');
    const avgTicket = closedLeads.length > 0
      ? closedLeads.reduce((sum, l) => sum + (l.valor || 0), 0) / closedLeads.length
      : 0;
    const conversionRate = allLeads.length > 0
      ? ((closedLeads.length / allLeads.length) * 100).toFixed(1)
      : 0;

    const prediction = await ai.predictClosing(lead, { avgTicket, conversionRate });
    res.json({ leadId: req.params.id, ...prediction });
  } catch (err) {
    logger.error('[AI] Prediction error:', err.message);
    res.status(500).json({ error: 'Prediction failed', details: err.message });
  }
});

// POST /api/v1/ai/summarize - Summarize notes
router.post('/summarize', async (req, res) => {
  try {
    const { notes, context } = req.body;
    if (!notes) return res.status(400).json({ error: 'Notes required' });

    const summary = await ai.summarizeNotes(notes, context || '');
    res.json(summary);
  } catch (err) {
    logger.error('[AI] Summarize error:', err.message);
    res.status(500).json({ error: 'Summarization failed', details: err.message });
  }
});

// POST /api/v1/ai/generate-message/:id - Generate email/whatsapp draft
router.post('/generate-message/:id', async (req, res) => {
  try {
    const lead = await db.getById('zeus_leads', req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const { type = 'email', purpose = 'follow-up' } = req.body;
    const message = await ai.generateMessage(lead, type, purpose);
    res.json({ leadId: req.params.id, type, purpose, ...message });
  } catch (err) {
    logger.error('[AI] Message generation error:', err.message);
    res.status(500).json({ error: 'Message generation failed', details: err.message });
  }
});

// GET /api/v1/ai/sales-insights - Analyze sales performance
router.get('/sales-insights', async (req, res) => {
  try {
    const leads = await db.getAll('zeus_leads', {});
    const quotes = await db.getAll('zeus_orcamentos', {});
    const tasks = await db.getAll('zeus_tasks', {});

    // Calculate metrics
    const leadsByStage = {};
    leads.forEach(l => { leadsByStage[l.estagio] = (leadsByStage[l.estagio] || 0) + 1; });

    const approvedQuotes = quotes.filter(q => q.status === 'aprovado');
    const pendingQuotes = quotes.filter(q => ['pendente', 'enviado'].includes(q.status));
    const overdueTasks = tasks.filter(t => t.status === 'pendente' && t.dueDate && new Date(t.dueDate) < new Date());

    // NPS
    let npsScore = 0;
    try {
      const npsData = await db.getAll('zeus_nps', {});
      if (npsData.length > 0) {
        const promoters = npsData.filter(n => n.score >= 9).length;
        const detractors = npsData.filter(n => n.score <= 6).length;
        npsScore = Math.round(((promoters - detractors) / npsData.length) * 100);
      }
    } catch { /* nps collection may not exist */ }

    const closedLeads = leads.filter(l => l.estagio === 'fechamento');
    const conversionRate = leads.length > 0 ? ((closedLeads.length / leads.length) * 100).toFixed(1) : 0;

    const data = {
      totalLeads: leads.length,
      leadsByStage,
      approvedRevenue: approvedQuotes.reduce((s, q) => s + (q.total || 0), 0),
      pendingRevenue: pendingQuotes.reduce((s, q) => s + (q.total || 0), 0),
      conversionRate,
      npsScore,
      overdueTasks: overdueTasks.length,
      monthlyTrend: []
    };

    // Monthly trend (last 6 months)
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthLeads = leads.filter(l => {
        const d = new Date(l.createdAt);
        return d >= month && d <= monthEnd;
      });
      const monthRevenue = approvedQuotes.filter(q => {
        const d = new Date(q.createdAt);
        return d >= month && d <= monthEnd;
      }).reduce((s, q) => s + (q.total || 0), 0);

      data.monthlyTrend.push({
        month: month.toISOString().substring(0, 7),
        leads: monthLeads.length,
        revenue: monthRevenue
      });
    }

    const insights = await ai.analyzeSalesPerformance(data);
    res.json({ metrics: data, ...insights });
  } catch (err) {
    logger.error('[AI] Sales insights error:', err.message);
    res.status(500).json({ error: 'Sales insights failed', details: err.message });
  }
});

module.exports = router;
