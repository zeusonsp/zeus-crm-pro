// ============================================
// ZEUS CRM PRO - Leads Module
// ============================================
const ZeusLeads = (function() {
    let currentPage = 1;
    let currentFilters = {};

    async function render() {
        const container = document.getElementById('tab-leads');
        if (!container) return;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <select class="form-control" style="width:auto" id="filter-stage" onchange="ZeusLeads.applyFilter()">
                        <option value="">Todos Estagios</option>
                        <option value="novo">Novo</option>
                        <option value="contato">Contato</option>
                        <option value="proposta">Proposta</option>
                        <option value="negociacao">Negociacao</option>
                        <option value="fechamento">Fechamento</option>
                    </select>
                    <input type="text" class="form-control" style="width:200px" placeholder="Buscar lead..." id="lead-search" oninput="ZeusLeads.debounceSearch()">
                </div>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-outline btn-sm" onclick="ZeusLeads.exportCSV()">📥 Exportar CSV</button>
                    <button class="btn btn-gold" onclick="ZeusLeads.showAddModal()">+ Novo Lead</button>
                </div>
            </div>
            <div id="leads-table-container">
                <div class="skeleton" style="height:400px;border-radius:var(--radius)"></div>
            </div>
            <div id="leads-pagination" style="margin-top:16px;display:flex;justify-content:center;gap:8px"></div>
        `;

        await loadLeads();
    }

    async function loadLeads() {
        try {
            const params = { page: currentPage, limit: 25, ...currentFilters };
            const response = await ZeusAPI.leads.list(params);
            renderTable(response.items, response.pagination);
        } catch (err) {
            document.getElementById('leads-table-container').innerHTML =
                `<div class="empty-state"><h3>Erro ao carregar leads</h3><p>${err.message}</p></div>`;
        }
    }

    function renderTable(leads, pagination) {
        const stageColors = { novo: 'info', contato: 'warning', proposta: 'gold', negociacao: 'danger', fechamento: 'success' };
        const container = document.getElementById('leads-table-container');

        if (leads.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <div class="empty-icon">👥</div>
                <h3>Nenhum lead encontrado</h3>
                <p>Adicione seu primeiro lead clicando no botao acima</p>
            </div>`;
            return;
        }

        container.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Telefone</th>
                            <th>Empresa</th>
                            <th>Estagio</th>
                            <th>Origem</th>
                            <th>Valor</th>
                            <th>Acoes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${leads.map(lead => `
                            <tr class="animate-fadeIn">
                                <td><strong>${lead.nome}</strong></td>
                                <td>${lead.email || '-'}</td>
                                <td>${lead.telefone ? `<a href="https://wa.me/55${lead.telefone.replace(/\D/g,'')}" target="_blank" style="color:var(--success)">${lead.telefone}</a>` : '-'}</td>
                                <td>${lead.empresa || '-'}</td>
                                <td><span class="badge badge-${stageColors[lead.estagio] || 'info'}">${lead.estagio}</span></td>
                                <td>${lead.origem || '-'}</td>
                                <td style="color:var(--gold)">${lead.valor ? 'R$ ' + parseFloat(lead.valor).toLocaleString('pt-BR') : '-'}</td>
                                <td>
                                    <div style="display:flex;gap:4px">
                                        <button class="btn btn-outline btn-sm" onclick="ZeusLeads.edit('${lead.id}')" title="Editar">✏️</button>
                                        <button class="btn btn-outline btn-sm" onclick="ZeusLeads.changeStage('${lead.id}')" title="Mudar estagio">📊</button>
                                        <button class="btn btn-outline btn-sm" onclick="ZeusLeads.remove('${lead.id}')" title="Remover">🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Pagination
        if (pagination.totalPages > 1) {
            const pagEl = document.getElementById('leads-pagination');
            let html = '';
            for (let i = 1; i <= pagination.totalPages; i++) {
                html += `<button class="btn ${i === pagination.page ? 'btn-gold' : 'btn-outline'} btn-sm" onclick="ZeusLeads.goToPage(${i})">${i}</button>`;
            }
            pagEl.innerHTML = html;
        }
    }

    function showAddModal() {
        ZeusModal.create({
            title: 'Novo Lead',
            content: `
                <div class="form-group"><label>Nome *</label><input type="text" class="form-control" id="new-lead-nome"></div>
                <div class="form-group"><label>Email</label><input type="email" class="form-control" id="new-lead-email"></div>
                <div class="form-group"><label>Telefone</label><input type="text" class="form-control" id="new-lead-telefone"></div>
                <div class="form-group"><label>Empresa</label><input type="text" class="form-control" id="new-lead-empresa"></div>
                <div class="form-group"><label>Origem</label>
                    <select class="form-control" id="new-lead-origem">
                        <option value="website">Website</option>
                        <option value="instagram">Instagram</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="indicacao">Indicacao</option>
                        <option value="google">Google</option>
                        <option value="outro">Outro</option>
                    </select>
                </div>
                <div class="form-group"><label>Valor Estimado (R$)</label><input type="number" class="form-control" id="new-lead-valor" step="0.01"></div>
            `,
            confirmText: 'Salvar Lead',
            onConfirm: async () => {
                const nome = document.getElementById('new-lead-nome')?.value?.trim();
                if (!nome) { ZeusToast.error('Nome obrigatorio'); return; }
                try {
                    await ZeusAPI.leads.create({
                        nome,
                        email: document.getElementById('new-lead-email')?.value || '',
                        telefone: document.getElementById('new-lead-telefone')?.value || '',
                        empresa: document.getElementById('new-lead-empresa')?.value || '',
                        origem: document.getElementById('new-lead-origem')?.value || 'website',
                        valor: parseFloat(document.getElementById('new-lead-valor')?.value) || 0
                    });
                    ZeusToast.success('Lead criado!');
                    loadLeads();
                } catch (err) {
                    ZeusToast.error(err.message);
                }
            }
        });
    }

    async function changeStage(id) {
        const stage = await ZeusModal.prompt('Novo estagio (novo/contato/proposta/negociacao/fechamento):', '');
        if (!stage) return;
        try {
            await ZeusAPI.leads.changeStage(id, stage);
            ZeusToast.success('Estagio atualizado!');
            loadLeads();
        } catch (err) {
            ZeusToast.error(err.message);
        }
    }

    async function remove(id) {
        const confirmed = await ZeusModal.confirm('Remover Lead', 'Tem certeza que deseja remover este lead?');
        if (!confirmed) return;
        try {
            await ZeusAPI.leads.delete(id);
            ZeusToast.success('Lead removido');
            loadLeads();
        } catch (err) {
            ZeusToast.error(err.message);
        }
    }

    async function edit(id) {
        try {
            const response = await ZeusAPI.leads.get(id);
            const lead = response.lead;
            ZeusModal.create({
                title: 'Editar Lead',
                content: `
                    <div class="form-group"><label>Nome</label><input type="text" class="form-control" id="edit-lead-nome" value="${lead.nome || ''}"></div>
                    <div class="form-group"><label>Email</label><input type="email" class="form-control" id="edit-lead-email" value="${lead.email || ''}"></div>
                    <div class="form-group"><label>Telefone</label><input type="text" class="form-control" id="edit-lead-telefone" value="${lead.telefone || ''}"></div>
                    <div class="form-group"><label>Empresa</label><input type="text" class="form-control" id="edit-lead-empresa" value="${lead.empresa || ''}"></div>
                    <div class="form-group"><label>Valor</label><input type="number" class="form-control" id="edit-lead-valor" value="${lead.valor || 0}" step="0.01"></div>
                    <div class="form-group"><label>Notas</label><textarea class="form-control" id="edit-lead-notas">${lead.notas || ''}</textarea></div>
                `,
                confirmText: 'Salvar',
                onConfirm: async () => {
                    try {
                        await ZeusAPI.leads.update(id, {
                            nome: document.getElementById('edit-lead-nome')?.value,
                            email: document.getElementById('edit-lead-email')?.value,
                            telefone: document.getElementById('edit-lead-telefone')?.value,
                            empresa: document.getElementById('edit-lead-empresa')?.value,
                            valor: parseFloat(document.getElementById('edit-lead-valor')?.value) || 0,
                            notas: document.getElementById('edit-lead-notas')?.value
                        });
                        ZeusToast.success('Lead atualizado!');
                        loadLeads();
                    } catch (err) { ZeusToast.error(err.message); }
                }
            });
        } catch (err) { ZeusToast.error(err.message); }
    }

    function applyFilter() {
        const stage = document.getElementById('filter-stage')?.value;
        currentFilters = {};
        if (stage) currentFilters.estagio = stage;
        currentPage = 1;
        loadLeads();
    }

    let searchTimeout = null;
    function debounceSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const q = document.getElementById('lead-search')?.value?.trim();
            if (q && q.length >= 2) {
                try {
                    const response = await ZeusAPI.leads.search(q);
                    renderTable(response.items, { page: 1, totalPages: 1 });
                } catch (err) { ZeusToast.error(err.message); }
            } else {
                loadLeads();
            }
        }, 300);
    }

    async function exportCSV() {
        try {
            const response = await ZeusAPI.leads.list({ limit: 9999 });
            const leads = response.items;
            if (leads.length === 0) { ZeusToast.warning('Nenhum lead para exportar'); return; }

            const headers = ['Nome', 'Email', 'Telefone', 'Empresa', 'Estagio', 'Origem', 'Valor', 'Criado em'];
            const rows = leads.map(l => [
                l.nome, l.email, l.telefone, l.empresa, l.estagio, l.origem, l.valor, l.createdAt
            ]);

            let csv = headers.join(',') + '\n';
            rows.forEach(r => {
                csv += r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `zeus-leads-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            ZeusToast.success(`${leads.length} leads exportados`);
        } catch (err) { ZeusToast.error(err.message); }
    }

    function goToPage(page) { currentPage = page; loadLeads(); }
    function refresh() { loadLeads(); }

    return { render, refresh, showAddModal, edit, changeStage, remove, applyFilter, debounceSearch, exportCSV, goToPage };
})();
