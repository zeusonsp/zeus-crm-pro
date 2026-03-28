// ============================================
// ZEUS CRM PRO - Tasks API Routes
// ============================================
const router = require('express').Router();
const FirestoreService = require('../services/firestore');
const { validateId } = require('../middleware/validate');
const logger = require('../services/logger');

const tasksDB = new FirestoreService('zeus_tasks');

router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 50, sort = 'dueDate', order = 'asc' } = req.query;
        const filters = {};
        if (req.query.status) filters.status = req.query.status;
        if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo;
        if (req.query.priority) filters.priority = req.query.priority;
        if (req.user.role === 'vendedor') filters.assignedTo = req.user.name;

        const result = await tasksDB.getAll({ page: +page, limit: +limit, sort, order, filters });
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[Tasks] List error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao listar tarefas' });
    }
});

router.get('/overdue', async (req, res) => {
    try {
        const all = await tasksDB.getAll({ limit: 9999, filters: { status: 'pendente' } });
        const now = new Date().toISOString();
        const overdue = all.items.filter(t => t.dueDate && t.dueDate < now);
        res.json({ success: true, items: overdue, total: overdue.length });
    } catch (err) {
        logger.error('[Tasks] Overdue error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao buscar tarefas atrasadas' });
    }
});

router.get('/:id', validateId, async (req, res) => {
    try {
        const task = await tasksDB.getById(req.params.id);
        if (!task) return res.status(404).json({ success: false, error: 'Tarefa nao encontrada' });
        res.json({ success: true, task });
    } catch (err) {
        logger.error('[Tasks] Get error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao buscar tarefa' });
    }
});

router.post('/', async (req, res) => {
    try {
        const data = {
            title: req.body.title,
            description: req.body.description || '',
            assignedTo: req.body.assignedTo || req.user.name,
            priority: req.body.priority || 'media',
            status: 'pendente',
            dueDate: req.body.dueDate || '',
            relatedLeadId: req.body.relatedLeadId || '',
            tags: req.body.tags || []
        };
        const task = await tasksDB.create(data);
        const io = req.app.get('io');
        if (io) io.emit('task-created', task);
        res.status(201).json({ success: true, task });
    } catch (err) {
        logger.error('[Tasks] Create error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao criar tarefa' });
    }
});

router.put('/:id', validateId, async (req, res) => {
    try {
        const task = await tasksDB.update(req.params.id, req.body);
        if (!task) return res.status(404).json({ success: false, error: 'Tarefa nao encontrada' });
        res.json({ success: true, task });
    } catch (err) {
        logger.error('[Tasks] Update error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao atualizar tarefa' });
    }
});

router.patch('/:id/complete', validateId, async (req, res) => {
    try {
        const task = await tasksDB.update(req.params.id, {
            status: 'concluida',
            completedAt: new Date().toISOString(),
            completedBy: req.user.name
        });
        if (!task) return res.status(404).json({ success: false, error: 'Tarefa nao encontrada' });
        const io = req.app.get('io');
        if (io) io.emit('task-completed', task);
        res.json({ success: true, task });
    } catch (err) {
        logger.error('[Tasks] Complete error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao completar tarefa' });
    }
});

router.delete('/:id', validateId, async (req, res) => {
    try {
        const deleted = await tasksDB.delete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, error: 'Tarefa nao encontrada' });
        res.json({ success: true, message: 'Tarefa removida' });
    } catch (err) {
        logger.error('[Tasks] Delete error:', err.message);
        res.status(500).json({ success: false, error: 'Erro ao remover tarefa' });
    }
});

module.exports = router;
