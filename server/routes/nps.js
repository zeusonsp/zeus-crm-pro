// ============================================
// ZEUS CRM PRO - NPS (Net Promoter Score) Routes
// ============================================
const router = require('express').Router();
const FirestoreService = require('../services/firestore');
const logger = require('../services/logger');

const npsDB = new FirestoreService('zeus_nps');

router.get('/', async (req, res) => {
    try {
        const result = await npsDB.getAll({ limit: 9999, sort: 'createdAt', order: 'desc' });
        const surveys = result.items;

        let promoters = 0, passives = 0, detractors = 0;
        surveys.forEach(s => {
            const score = +s.score;
            if (score >= 9) promoters++;
            else if (score >= 7) passives++;
            else detractors++;
        });
        const total = surveys.length;
        const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

        res.json({
            success: true,
            nps: { score: npsScore, promoters, passives, detractors, total },
            surveys
        });
    } catch (err) {
        logger.error('[NPS] List error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao buscar NPS' });
    }
});

router.post('/', async (req, res) => {
    try {
        const data = {
            clientName: req.body.clientName,
            clientEmail: req.body.clientEmail || '',
            score: +req.body.score,
            feedback: req.body.feedback || '',
            source: req.body.source || 'manual'
        };
        if (data.score < 0 || data.score > 10) {
            return res.status(400).json({ success: false, error: 'Score deve ser entre 0 e 10' });
        }
        const survey = await npsDB.create(data);
        res.status(201).json({ success: true, survey });
    } catch (err) {
        logger.error('[NPS] Create error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar pesquisa NPS' });
    }
});

module.exports = router;
