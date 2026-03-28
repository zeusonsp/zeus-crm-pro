// ============================================
// ZEUS CRM PRO - Email Marketing Module
// ============================================
const ZeusEmailMkt = (function() {
    async function render() {
        const container = document.getElementById('tab-emailmkt');
        if (!container) return;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:16px">
                <h3 style="color:var(--gold)">Email Marketing</h3>
                <button class="btn btn-gold" onclick="ZeusEmailMkt.showAdd()">+ Nova Campanha</button>
            </div>
            <div id="email-campaigns"><div class="skeleton" style="height:200px;border-radius:var(--radius)"></div></div>
        `;
        await loadData();
    }

    async function loadData() {
        try {
            const res = await ZeusAPI.marketing.campaigns.list({ type: 'email' });
            const campaigns = res.items;
            const el = document.getElementById('email-campaigns');

            el.innerHTML = campaigns.length === 0 ?
                `<div class="empty-state"><div class="empty-icon">📧</div><h3>Nenhuma campanha</h3></div>` :
                `<div class="table-container"><table>
                    <thead><tr><th>Campanha</th><th>Assunto</th><th>Segmento</th><th>Status</th><th>Enviados</th><th>Abertos</th><th>Acoes</th></tr></thead>
                    <tbody>${campaigns.map(c => `<tr>
                        <td><strong>${c.name}</strong></td>
                        <td>${c.subject || '-'}</td>
                        <td><span class="badge badge-info">${c.segment}</span></td>
                        <td><span class="badge badge-${c.status === 'enviada' ? 'success' : 'warning'}">${c.status}</span></td>
                        <td>${c.stats?.sent || 0}</td>
                        <td>${c.stats?.opened || 0}</td>
                        <td>
                            ${c.status === 'rascunho' ? `<button class="btn btn-success btn-sm" onclick="ZeusEmailMkt.send('${c.id}')">🚀 Enviar</button>` : ''}
                        </td>
                    </tr>`).join('')}</tbody>
                </table></div>`;
        } catch (err) {
            document.getElementById('email-campaigns').innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
        }
    }

    function showAdd() {
        ZeusModal.create({
            title: 'Nova Campanha de Email',
            content: `
                <div class="form-group"><label>Nome *</label><input type="text" class="form-control" id="camp-name"></div>
                <div class="form-group"><label>Assunto *</label><input type="text" class="form-control" id="camp-subject"></div>
                <div class="form-group"><label>Hegmento</label>
                    <select class="form-control" id="camp-segment">
                        <option value="all">Todos</option><option value="hot">Leads Quentes</option><option value="cold">Leads Frios</option>
                    </select>
                </div>
                <div class="form-group"><label>Conteudo HTML</label><textarea class="form-control" id="camp-content" rows="6"></textarea></div>
            `,
            confirmText: 'Criar Campanha',
            onConfirm: async () => {
                try {
                    await ZeusAPI.marketing.campaigns.create({
                        name: document.getElementById('camp-name')?.value,
                        type: 'email',
                        subject: document.getElementById('camp-subject')?.value,
                        segment: document.getElementById('camp-segment')?.value,
                        content: document.getElementById('camp-content')?.value
                    });
                    ZeusToast.success('Campanha criada!');
                    loadData();
                } catch (err) { ZeusToast.error(err.message); }
            }
        });
    }

    async function send(id) {
        const ok = await ZeusModal.confirm('Enviar Campanha', 'Enviar esta campanha agora?');
        if (!ok) return;
        try { await ZeusAPI.marketing.campaigns.send(id); ZeusToast.success('Campanha enviada!'); loadData(); }
        catch (err) { ZeusToast.error(err.message); }
    }

    function refresh() { loadData(); }
    return { render, refresh, showAdd, send };
})();
