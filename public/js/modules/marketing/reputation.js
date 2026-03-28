// ============================================
// ZEUS CRM PRO - Reputation Module
// ============================================
const ZeusReputation = (function() {
    async function render() {
        const container = document.getElementById('tab-reputation');
        if (!container) return;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:16px">
                <h3 style="color:var(--gold)">Reputacao & Avaliacoes</h3>
                <button class="btn btn-gold" onclick="ZeusReputation.showAdd()">+ Nova Avaliacao</button>
            </div>
            <div id="reputation-stats" style="margin-bottom:16px"></div>
            <div id="reviews-list"><div class="skeleton" style="height:200px;border-radius:var(--radius)"></div></div>
        `;
        await loadData();
    }

    async function loadData() {
        try {
            const res = await ZeusAPI.marketing.reviews.list();
            const { reviews, stats } = res;

            document.getElementById('reputation-stats').innerHTML = `
                <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
                    <div class="stat-card">
                        <div class="stat-value" style="font-size:36px">${stats.avgRating}</div>
                        <div class="stat-label">${'⭐'.repeat(Math.round(stats.avgRating))} Media</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.total}</div>
                        <div class="stat-label">Total Avaliacoes</div>
                    </div>
                    <div class="stat-card">
                        <div style="display:flex;flex-direction:column;gap:4px;margin-top:8px">
                            ${[5,4,3,2,1].map(i => {
                                const count = stats.distribution[i-1] || 0;
                                const pct = stats.total > 0 ? (count / stats.total * 100) : 0;
                                return `<div style="display:flex;align-items:center;gap:4px;font-size:11px">
                                    <span>${i}⭐</span>
                                    <div class="progress-bar" style="flex:1;height:4px"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
                                    <span style="color:var(--text-muted);width:20px">${count}</span>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('reviews-list').innerHTML = reviews.length === 0 ?
                `<div class="empty-state"><div class="empty-icon">⭐</div><h3>Nenhuma avaliacao</h3></div>` :
                reviews.map(r => `
                    <div class="card">
                        <div style="display:flex;justify-content:space-between">
                            <div>
                                <strong>${r.clientName}</strong>
                                <span style="margin-left:8px">${'⭐'.repeat(r.rating)}</span>
                            </div>
                            <span style="font-size:11px;color:var(--text-muted)">${r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : ''}</span>
                        </div>
                        ${r.comment ? `<p style="font-size:13px;color:var(--text-secondary);margin: ‘8px 0">${r.comment}</p>` : ''}
                        ${r.reply ? `<div style="background:var(--bg-input);padding:8px 12px;border-radius:var(--radius-sm);margin-top:8px;font-size:12px">
                            <strong style="color:var(--gold)">Resposta:</strong> ${r.reply}
                        </div>` : `<button class="btn btn-outline btn-sm" style="margin-top:8px" onclick="ZeusReputation.reply('${r.id}')">💬 Responder</button>`}
                      </div>
                `).join('');
        } catch (err) {
            document.getElementById('reviews-list').innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
        }
    }

    function showAdd() {
        ZeusModal.create({
            title: 'Nova Avaliacao',
            content: `
                <div class="form-group"><label>Cliente *</label><input type="text" class="form-control" id="rev-client"></div>
                <div class="form-group"><label>Nota (1-5) *</label><input type="number" class="form-control" id="rev-rating" min="1" max="5" value="5"></div>
                <div class="form-group"><label>Comentario</label><textarea class="form-control" id="rev-comment"></textarea></div>
            `,
            confirmText: 'Salvar',
            onConfirm: async () => {
                try {
                    await ZeusAPI.marketing.reviews.create({
                        clientName: document.getElementById('rev-client')?.value,
                        rating: parseInt(document.getElementById('rev-rating')?.value) || 5,
                        comment: document.getElementById('rev-comment')?.value
                    });
                    ZeusToast.success('Avaliacao salva!');
                    loadData();
                } catch (err) { ZeusToast.error(err.message); }
            }
        });
    }

    async function reply(id) {
        const text = await ZeusModal.prompt('Sua resposta:', '');
        if (!text) return;
        try { await ZeusAPI.marketing.reviews.reply(id, text); ZeusToast.success('Resposta enviada!'); loadData(); }
        catch (err) { ZeusToast.error(err.message); }
    }

    function refresh() { loadData(); }
    return { render, refresh, showAdd, reply };
})();
