// ============================================
// ZEUS CRM PRO - Tasks Module
// ============================================
const ZeusTasks = (function() {
    async function render() {
        const container = document.getElementById('tab-tasks');
        if (!container) return;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:16px">
                <div style="display:flex;gap:8px">
                    <select class="form-control" style="width:auto" id="filter-task-status" onchange="ZeusTasks.refresh()">
                        <option value="">Todas</option>
                        <option value="pendente">Pendentes</option>
                        <option value="concluida">Concluidas</option>
                    </select>
                </div>
                <button class="btn btn-gold" onclick="ZeusTasks.showAdd()">+ Nova Tarefa</button>
            </div>
            <div id="tasks-list"><div class="skeleton" style="height:300px;border-radius:var(--radius)"></div></div>
        `;
        await loadData();
    }

    async function loadData() {
        try {
            const status = document.getElementById('filter-task-status')?.value || '';
            const params = {};
            if (status) params.status = status;
            const res = await ZeusAPI.tasks.list(params);
            const tasks = res.items;
            const el = document.getElementById('tasks-list');

            const priorityColors = { alta: 'danger', media: 'warning', baixa: 'info' };
            const now = new Date().toISOString();

            el.innerHTML = tasks.length === 0 ?
                `<div class="empty-state"><div class="empty-icon">✅</div><h3>Nenhuma tarefa</h3></div>` :
                tasks.map(t => {
                    const overdue = t.status === 'pendente' && t.dueDate && t.dueDate < now;
                    return `<div class="card" style="${overdue ? 'border-left:3px solid var(--danger)' : ''} ${t.status === 'concluida' ? 'opacity:0.6' : ''}">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start">
                            <div style="flex:1">
                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                                    <span style="font-size:16px">${t.status === 'concluida' ? "✅" : overdue ? "🔴" : "⏳"}</span>
                                    <strong style="${t.status === 'concluida' ? 'text-decoration:line-through' : ''}">${t.title}</strong>
                                    <span class="badge badge-${priorityColors[t.priority] || 'info'}" style="font-size:9px">${t.priority}</span>
                                </div>
                                ${t.description ? `<p style="font-size:12px;color:var(--text-secondary);margin:4px 0">${t.description}</p>` : ''}
                                <div style="font-size:11px;color:var(--text-muted);display:flex;gap:12px;margin-top:4px">
                                    ${t.assignedTo ? `<span>👤 ${t.assignedTo}</span>` : ''}
                                    ${t.dueDate ? `<span style="${overdue ? 'color:var(--danger)' : ''}">📏	${new Date(t.dueDate).toLocaleDateString('pt-BR')}</span>` : ''}
                                </div>
                            </div>
                            <div style="display:flex;gap:4px">
                                ${t.status !== 'concluida' ? `<button class="btn btn-success btn-sm" onclick="ZeusTasks.complete('${t.id}')">✓</button>` : ''}
                                <button class="btn btn-outline btn-sm" onclick="ZeusTasks.remove('${t.id}')">🗑️</button>
                            </div>
                        </div>
                    </div>`;
                }).join('');
        } catch (err) {
            document.getElementById('tasks-list').innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
        }
    }

    function showAdd() {
        ZeusModal.create({
            title: 'Nova Tarefa',
            content: `
                <div class="form-group"><label>Titulo *</label><input type="text" class="form-control" id="task-title"></div>
                <div class="form-group"><label>Descricao</label><textarea class="form-control" id="task-desc"></textarea></div>
                <div style="display:flex;gap:10px">
                    <div class="form-group" style="flex:1"><label>Prioridade</label>
                        <select class="form-control" id="task-priority">
                            <option value="media">Media</option><option value="alta">Alta</option><option value="baixa">Baixa</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex:1"><label>Prazo</label><input type="date" class="form-control" id="task-due"></div>
                </div>
                <div class="form-group"><label>Responsavel</label><input type="text" class="form-control" id="task-assign"></div>
            `,
            confirmText: 'Criar Tarefa',
            onConfirm: async () => {
                const title = document.getElementById('task-title')?.value?.trim();
                if (!title) { ZeusToast.error('Titulo obrigatorio'); return; }
                try {
                    await ZeusAPI.tasks.create({
                        title,
                        description: document.getElementById('task-desc')?.value || '',
                        priority: document.getElementById('task-priority')?.value || 'media',
                        dueDate: document.getElementById('task-due')?.value || '',
                        assignedTo: document.getElementById('task-assign')?.value || ''
                    });
                    ZeusToast.success('Tarefa criada!');
                    loadData();
                } catch (err) { ZeusToast.error(err.message); }
            }
        });
    }

    async function complete(id) {
        try { await ZeusAPI.tasks.complete(id); ZeusToast.success('Tarefa concluida!'); loadData(); }
        catch (err) { ZeusToast.error(err.message); }
    }

    async function remove(id) {
        const ok = await ZeusModal.confirm('Remover', 'Remover tarefa?');
        if (!ok) return;
        try { await ZeusAPI.tasks.delete(id); ZeusToast.success('Removida'); loadData(); }
        catch (err) { ZeusToast.error(err.message); }
    }

    function refresh() { loadData(); }
    return { render, refresh, showAdd, complete, remove };
})();
