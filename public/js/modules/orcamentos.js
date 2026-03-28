// ============================================
// ZEUS CRM PRO - Orcamentos Module
// ============================================
const ZeusOrcamentos = (function() {
    async function render() {
        const container = document.getElementById('tab-orcamentos');
        if (!container) return;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
                <select class="form-control" style="width:auto" id="filter-orc-status" onchange="ZeusOrcamentos.refresh()">
                    <option value="">Todos Status</option>
                    <option value="pendente">Pendente</option>
                    <option value="enviado">Enviado</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="rejeitado">Rejeitado</option>
                </select>
                <button class="btn btn-gold" onclick="ZeusOrcamentos.showAdd()">+ Novo Orcamento</button>
            </div>
            <div id="orc-stats" style="margin-bottom:16px"></div>
            <div id="orc-table"><div class="skeleton" style="height:300px;border-radius:var(--radius)"></div></div>
        `;

        await loadData();
    }

    async function loadData() {
        try {
            const [statsRes, listRes] = await Promise.all([
                ZeusAPI.orcamentos.stats(),
                ZeusAPI.orcamentos.list({
                    status: document.getElementById('filter-orc-status')?.value || ''
                })
            ]);

            const s = statsRes.stats;
            document.getElementById('orc-stats').innerHTML = `
                <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
                    <div class="stat-card"><div class="stat-value">${s.total}</div><div class="stat-label">Total</div></div>
                    <div class="stat-card"><div class="stat-value" style="color:var(--success)">R$ ${parseFloat(s.approvedValue || 0).toLocaleString('pt-BR')}</div><div class="stat-label">Aprovados</div></div>
                    <div class="stat-card"><div class="stat-value">${s.approvalRate}%</div><div class="stat-label">Taxa Aprovacao</div></div>
                    <div class="stat-card"><div class="stat-value">R$ ${parseFloat(s.totalValue || 0).toLocaleString('pt-BR')}</div><div class="stat-label">Valor Total</div></div>
                </div>
            `;

            const statusColors = { pendente: 'warning', enviado: 'info', aprovado: 'success', rejeitado: 'danger', expirado: 'danger' };
            const orcs = listRes.items;

            document.getElementById('orc-table').innerHTML = orcs.length === 0 ?
                `<div class="empty-state"><div class="empty-icon">ðŸ“‹</div><h3>Nenhum orcamento</h3></div>` :
                `<div class="table-container"><table>
                    <thead><tr><th>#</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Status</th><th>Data</th><th>Acoes</th></tr></thead>
                    <tbody>${orcs.map(o => `
                        <tr>
                            <td><strong>${o.numero || '-'}</strong></td>
                            <td>${o.cliente}</td>
                            <td>${(o.items || []).length} itens
                            <td style="color:var(--gold);font-weight:700">R$ ${parseFloat(o.totalFinal || o.total || 0).toLocaleString('pt-BR')}</td>
                            <td><span class="badge badge-${statusColors[o.status] || 'info'}">${o.status}</span></td>
                            <td style="font-size:11px;color:var(--text-muted)">${o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : '-'}</td>
                            <td>
                                <div style="display:flex;gap:4px">
                                    <button class="btn btn-outline btn-sm" onclick="ZeusOrcamentos.changeStatus('${o.id}')">ðŸ“Š</button>
                                    <button class="btn btn-outline btn-sm" onclick="ZeusOrcamentos.remove('${o.id}')">ðŸ—‘ââ‹ü/button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}</tbody>
                </table></div>`;
        } catch (err) {
            document.getElementById('orc-table').innerHTML = `<div class="empty-state"><h 3>Erro</h3><p>${err.message}</p></div>`;
        }
    }

    function showAdd() {
        ZeusModal.create({
            title: 'Novo Orcamento',
            content: `
                <div class="form-group"><label>Cliente *</label><input type="text" class="form-control" id="orc-cliente"></div>
                <div class="form-group"><label>Email Cliente</label><input type="email" class="form-control" id="orc-email"></div>
                <div class="form-group"><label>Item - Descricao *</label><input type="text" class="form-control" id="orc-item-desc"></div>
                <div style="display:flex;gap:10px">
                    <div class="form-group" style="flex:1"><label<Qtd *</label><input type="number" class="form-control" id="orc-item-qty" value="1" min="1"></div>
                    <div class="form-group" style="flex:1"><label>Valor Unit *</label><input type="number" class="form-control" id="orc-item-price" step="0.01"></div>
                </div>
                <div class="form-group"><label>Desconto (R$)</label><input type="number" class="form-control" id="orc-desconto" value="0" step="0.01"></div>
                <div class="form-group"><label>Observacoes</label><textarea class="form-control" id="orc-obs"></textarea></div>
            `,
            confirmText: 'Criar Orcamento',
            onConfirm: async () => {
                const cliente = document.getElementById('orc-cliente')?.value?.trim();
                const desc = document.getElementById('orc-item-desc')?.value?.trim();
                const qty = parseInt(document.getElementById('orc-item-qty')?.value) || 1;
                const price = parseFloat(document.getElementById('orc-item-price')?.value) || 0;
               
                if (!cliente || !desc || !price) { ZeusToast.error('Preencha os campos obrigatorios'); return; }
               
                try {
                    await ZeusAPI.orcamentos.create({
                        cliente,
                        clienteEmail: document.getElementById('orc-email')?.value || '',
                        items: [{ descricao: desc, quantidade: qty, valorUnitario: price }],
                        desconto: parseFloat(document.getElementById('orc-desconto')?.value) || 0,
                        observacoes: document.getElementById('orc-obs')?.value || ''
                    });
                    ZeusToast.success('Orcamento criado!');
                    loadData();
                } catch (err) { ZeusToast.error(err.message); }
            }
        });
    }

    async function changeStatus(id) {
        const status = await ZeusModal.prompt('Novo status (pendente/enviado/aprovado/rejeitado):', '');
        if (!status) return;
        try {
            await ZeusAPI.orcamentos.changeStatus(id, status);
            ZeusToast.success('Status atualizado!');
            loadData();
        } catch (err) { ZeusToast.error(err.message); }
    }

    async function remove(id) {
        const ok = await ZeusModal.confirm('Remover', 'Remover orcamento?');
        if (!ok) return;
        try {
            await ZeusAPI.orcamentos.delete(id);
            ZeusToast.success('Removido');
            loadData();
        } catch (err) { ZeusToast.error(err.message); }
    }

    function refresh() { loadData(); }

    return { render, refresh, showAdd, changeStatus, remove };
})();
