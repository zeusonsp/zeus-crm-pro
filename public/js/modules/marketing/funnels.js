// ============================================
// ZEUS CRM PRO - Funnels Module
// ============================================
const ZeusFunnels = (function() {
    async function render() {
        const container = document.getElementById('tab-funnels');
        if (!container) return;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:16px">
                <h3 style="color:var(--gold)">Funis de Venda</h3>
                <button class="btn btn-gold" onclick="ZeusFunnels.showAdd()">+ Novo Funil</button>
            </div>
            <div id="funnels-list"><div class="skeleton" style="height:200px;border-radius:var(--radius)"></div></div>
        `;
        await loadData();
    }

    async function loadData() {
        try {
            const res = await ZeusAPI.marketing.funnels.list();
            const funnels = res.items;
            const el = document.getElementById('funnels-list');

            el.innerHTML = funnels.length === 0 ?
                `<div class="empty-state"><div class="empty-icon">🚀</div><h3>Nenhum funil</h3><p>Crie seu primeiro funil de vendas</p></div>` :
                `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
                    ${funnels.map(f => `
                        <div class="card">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                                <strong>${f.name}</strong>
                                <span class="badge badge-${f.status === 'ativo' ? 'success' : 'warning'}">${f.status}</span>
                            </div>
                            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Tipo: ${f.type}</div>
                            <div style="display:flex;gap:12px;font-size:12px;margin-bottom:12px">
                                <span>👀 ${f.visits || 0} visitas</span>
                                <span>🎯 ${f.conversions || 0} conversoes</span>
                                <span style="color:var(--gold)">${f.visits > 0 ? ((f.conversions || 0) / f.visits * 100).toFixed(1) : 0}%</span>
                            </div>
                            <div style="display:flex;gap:4px">
                                <button class="btn btn-outline btn-sm" onclick="ZeusFunnels.remove('${f.id}')">🗑️</button>
                            </div>
                        </div>
                    `).join('')}
                </div>`;
        } catch (err) {
            document.getElementById('funnels-list').innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
        }
    }

    function showAdd() {
        ZeusModal.create({
            title: 'Novo Funil',
            content: `
                <div class="form-group"><label>Nome *</label><input type="text" class="form-control" id="funnel-name"></div>
                <div class="form-group"><label>Tipo</label>
                    <select class="form-control" id="funnel-type">
                        <option value="lead-capture">Captura de Lead</option>
                        <option value="sales-page">Pagina de Vendas</option>
                        <option value="webinar">Webinar</option>
                        <option value="thank-you">Pagina de Obrigado</option>
                    </select>
                </div>
            `,
            confirmText: 'Criar Funil',
            onConfirm: async () => {
                const name = document.getElementById('funnel-name')?.value?.trim();
                if (!name) { ZeusToast.error('Nome obrigatorio'); return; }
                try {
                    await ZeusAPI.marketing.funnels.create({
                        name,
                        type: document.getElementById('funnel-type')?.value || 'lead-capture'
                    });
                    ZeusToast.success('Funil criado!');
                    loadData();
                } catch (err) { ZeusToast.error(err.message); }
            }
        });
    }

    async function remove(id) {
        const ok = await ZeusModal.confirm('Remover', 'Remover funil?');
        if (!ok) return;
        try { await ZeusAPI.marketing.funnels.delete(id); ZeusToast.success('Removido'); loadData(); }
        catch (err) { ZeusToast.error(err.message); }
    }

    function refresh() { loadData(); }
    return { render, refresh, showAdd, remove };
})();
