// ============================================
// ZEUS CRM PRO - Contracts Module
// ============================================
const ZeusContracts = (function() {
    async function render() {
        const container = document.getElementById('tab-contracts');
        if (!container) return;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:16px">
                <h3 style="color:var(--gold)">Contratos</h3>
                <button class="btn btn-gold" onclick="ZeusContracts.showAdd()">+ Novo Contrato</button>
            </div>
            <div id="contracts-list"><div class="skeleton" style="height:300px;border-radius:var(--radius)"></div></div>
        `;
        await loadData();
    }

    async function loadData() {
        try {
            const res = await ZeusAPI.contracts.list();
            const items = res.items;
            const el = document.getElementById('contracts-list');
            const statusColors = { rascunho: 'warning', enviado: 'info', assinado: 'success', cancelado: 'danger' };

            el.innerHTML = items.length === 0 ?
                `<div class="empty-state"><div class="empty-icon">📝</div><h3>Nenhum contrato</h3></div>` :
                `<div class="table-container"><table>
                    <thead><tr><th>Cliente</th><th>Valor</th><th>Status</th><th>Inicio</th><th>Fim</th><th>Acoes</th></tr></thead>
                    <tbody>${items.map(c => `<tr>
                        <td><strong>${c.clientName}</strong></td>
                        <td style="color:var(--gold)">R$ ${parseFloat(c.value || 0).toLocaleString('pt-BR')}</td>
                        <td><span class="badge badge-${statusColors[c.status] || 'info'}">${c.status}</span></td>
                        <td>${c.startDate || '-'}</td>
                        <td>${c.endDate || '-'}</td>
                        <td>
                            <button class="btn btn-outline btn-sm" onclick="ZeusContracts.sign('${c.id}')">✍️ Assinar</button>
                            <button class="btn btn-outline btn-sm" onclick="ZeusContracts.remove('${c.id}')">🗑️</button>
                        </td>
                    </tr>`).join('')}</tbody>
                </table></div>`;
        } catch (err) {
            document.getElementById('contracts-list').innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
        }
    }

    function showAdd() {
        ZeusModal.create({
            title: 'Novo Contrato',
            content: `
                <div class="form-group"><label>Cliente *</label><input type="text" class="form-control" id="ct-client"></div>
                <div class="form-group"><label>Valor *</label><input type="number" class="form-control" id="ct-value" step="0.01"></div>
                <div class="form-group"><label>Descricao</label><textarea class="form-control" id="ct-desc"></textarea></div>
                <div style="display:flex;gap:10px">
                    <div class="form-group" style="flex:1"><label>Inicio</label><input type="date" class="form-control" id="ct-start"></div>
                    <div class="form-group" style="flex:1"><label>Fim</label><input type="date" class="form-control" id="ct-end"></div>
                </div>
            `,
            confirmText: 'Criar Contrato',
            onConfirm: async () => {
                try {
                    await ZeusAPI.contracts.create({
                        clientName: document.getElementById('ct-client')?.value,
                        value: parseFloat(document.getElementById('ct-value')?.value) || 0,
                        description: document.getElementById('ct-desc')?.value || '',
                        startDate: document.getElementById('ct-start')?.value || '',
                        endDate: document.getElementById('ct-end')?.value || ''
                    });
                    ZeusToast.success('Contrato criado!');
                    loadData();
                } catch (err) { ZeusToast.error(err.message); }
            }
        });
    }

    async function sign(id) {
        const ok = await ZeusModal.confirm('Assinar Contrato', 'Marcar este contrato como assinado?');
        if (!ok) return;
        try { await ZeusAPI.contracts.sign(id); ZeusToast.success('Contrato assinado!'); loadData(); }
        catch (err) { ZeusToast.error(err.message); }
    }

    async function remove(id) {
        const ok = await ZeusModal.confirm('Remover', 'Remover contrato?');
        if (!ok) return;
        try { await ZeusAPI.contracts.delete(id); ZeusToast.success('Removido'); loadData(); }
        catch (err) { ZeusToast.error(err.message); }
    }

    function refresh() { loadData(); }
    return { render, refresh, showAdd, sign, remove };
})();
