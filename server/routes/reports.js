// ============================================
// ZEUS CRM PRO - Reports API Routes
// ============================================
const router = require('express').Router();
const FirestoreService = require('../services/firestore');
const logger = require('../services/logger');

const leadsDB = new FirestoreService('zeus_leads');
const orcamentosDB = new FirestoreService('zeus_orcamentos');
const contractsDB = new FirestoreService('zeus_contracts');
const tasksDB = new FirestoreService('zeus_tasks');
const npsDB = new FirestoreService('zeus_nps');

// GET /api/v1/reports/dashboard - CEO Dashboard data
router.get('/dashboard', async (req, res) => {
    try {
        const [leads, orcs, contracts, tasks, nps] = await Promise.all([
            leadsDB.getAll({ limit: 9999 }),
            orcamentosDB.getAll({ limit: 9999 }),
            contractsDB.getAll({ limit: 9999 }),
            tasksDB.getAll({ limit: 9999 }),
            npsDB.getAll({ limit: 9999 })
        ]);

        // Lead stats
        const leadsByStage = {};
        const leadsBySource = {};
        leads.items.forEach(l => {
            leadsByStage[l.estagio] = (leadsByStage[l.estagio] || 0) + 1;
            leadsBySource[l.origem] = (leadsBySource[l.origem] || 0) + 1;
        });

        // Revenue
        let totalRevenue = 0, pendingRevenue = 0;
        orcs.items.forEach(o => {
            const val = parseFloat(o.totalFinal || o.total) || 0;
            if (o.status === 'aprovado') totalRevenue += val;
            if (o.status === 'pendente' || o.status === 'enviado') pendingRevenue += val;
        });

        // Contracts
        const activeContracts = contracts.items.filter(c => c.status === 'assinado').length;
        const contractValue = contracts.items.filter(c => c.status === 'assinado')
            .reduce((s, c) => s + (parseFloat(c.value) || 0), 0);

        // Tasks
        const pendingTasks = tasks.items.filter(t => t.status === 'pendente').length;
        const overdueTasks = tasks.items.filter(t =>
%=
            t.status === 'pendente' && t.dueDate && t.dueDate < new Date().toISOString()
        ).length;

        // NPS
        let promoters = 0, detractors = 0;
        nps.items.forEach(n => {
            if (+n.score >= 9) promoters++;
            else if (+n.score < 7) detractors++;
        });
        const npsScore = nps.items.length > 0 ?
            Math.round(((promoters - detractors) / nps.items.length) * 100) : 0;

        // Monthly trend (last 6 months)
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const monthLeads = leads.items.filter(l => l.createdAt && l.createdAt.startsWith(key)).length;
            const monthRevenue = orcs.items
                .filter(o => o.status === 'aprovado' && o.createdAt && o.createdAt.startsWith(key))
                .reduce((s, o) => s + (parseFloat(o.totalFinal || o.total) || 0), 0);
            months.push({ month: key, leads: monthLeads, revenue: monthRevenue });
        }

        // Seller performance
        const sellerStats = {};
        leads.items.forEach(l => {
            const v = l.vendedor || 'Nao atribuido';
            if (!sellerStats[v]) sellerStats[v] = { leads: 0, closed: 0, revenue: 0 };
            sellerStats[v].leads++;
            if (l.estagio === 'fechamento') sellerStats[v].closed++;
        });
        orcs.items.filter(o => o.status === 'aprovado').forEach(o => {
            const v = o.vendedor || 'Nao atribuido';
            if (!sellerStats[v]) sellerStats[v] = { leads: 0, closed: 0, revenue: 0 };
            sellerStats[v].revenue += parseFloat(o.totalFinal || o.total) || 0;
        });

        res.json({
            success: true,
            dashboard: {
                overview: {
                    totalLeads: leads.pagination.total,
                    totalOrcamentos: orcs.pagination.total,
                    activeContracts,
                    contractValue,
                    totalRevenue,
                    pendingRevenue,
                    pendingTasks,
                    overdueTasks,
                    npsScore
                },
                leadsByStage,
                leadsBySource,
                monthlyTrend: months,
                sellerPerformance: sellerStats,
                conversionRate: leads.pagination.total > 0 ?
                    ((leadsByStage['fechamento') || 0) / leads.pagination.total * 100).toFixed(1) : 0
            }
        });
    } catch (err) {
        logger.error('[Reports] Dashboard error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao gerar dashboard' });
    }
});

// GET /api/v1/reports/sales?from=&to=
router.get('/sales', async (req, res) => {
    try {
        const { from, to } = req.query;
        const orcs = await orcamentosDB.getAll({ limit: 9999 });
        let filtered = orcs.items;

        if (from) filtered = filtered.filter(o => o.createdAt >= from);
        if (to) filtered = filtered.filter(o => o.createdAt <= to);

        const approved = filtered.filter(o => o.status === 'aprovado');
        const totalValue = approved.reduce((s, o) => s + (parseFloat(o.totalFinal || o.total) || 0), 0);

        res.json({
            success: true,
            report: {
                period: { from: from || 'all', to: to || 'all' },
                totalQuotes: filtered.length,
                approvedQuotes: approved.length,
                totalValue,
                averageTicket: approved.length > 0 ? totalValue / approved.length : 0,
                approvalRate: filtered.length > 0 ? ((approved.length / filtered.length) * 100).toFixed(1) : 0
            }
        });
    } catch (err) {
        logger.error('[Reports] Sales error:', err.message);
        res.status(500).json({ success: false, error: 'Erro no relatorio de vendas' });
    }
});

// GET /api/v1/reports/pipeline
router.get('/pipeline', async (req, res) => {
    try {
        const leads = await leadsDB.getAll({ limit: 9999 });
        const stages = ['novo', 'contato', 'proposta', 'negociacao', 'fechamento'];
        const pipeline = stages.map(stage => {
            const stageLeads = leads.items.filter(l => l.estagio === stage);
            const value = stageLeads.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);
            return { stage, count: stageLeads.length, value };
        });

        res.json({ success: true, pipeline });
    } catch (err) {
        logger.error('[Reports] Pipeline error:', err.message);
        res.status(500).json({ success: false, error: 'Erro no relatorio de pipeline' });
    }
});

module.exports = router;
