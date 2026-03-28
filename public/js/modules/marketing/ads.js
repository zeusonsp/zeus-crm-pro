// ============================================
// ZEUS CRM PRO - Ads Management Module
// ============================================
const ZeusAdsMod = (function() {
    async function render() {
        const container = document.getElementById('tab-ads');
        if (!container) return;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:16px">
                <h3 style="color:var(--gold)">Gestao de Anuncios</h3>
                <button class="btn btn-gold" onclick="ZeusAdsMod.showAdd()">+ Nova Campanha</button>
            </div>
            <div id="ads-list"><div class="skeleton" style="height:200px;border-radius:var(--radius)"></div></div>
        `;
        await loadData();
    }

    async function loadData() {
        try {
            const res = await ZeusAPI.marketing.ads.list();
            const ads = res.items;
            const el = document.getElementById('ads-list');

            const platformIcons = { facebook: '📘', instagram: '📷', google: '🔍', tiktok: '🎵' };

            el.innerHTML = ads.length === 0 ?
                `<div class="empty-state"><div class="empty-icon">📢</div><h3>Nenhuma campanha de ads;\"} err) {
            document.getElementById('ads-list').innerHTML = ` <div class="empty-state"><p>${err.message}</p></div>`;
        }
    }

    function showAdd() {
        ZeusModal.create({
            title: 'Nova Campanha de Ads',
            content: `
                <div class="form-group"><label>Nome *</label><input type="text" class="form-control" id="ad-name"></div>
                <div class="form-group"><label>Classificação do Tato Social</label>
                    <select class="form-control" id="ad-status">
                        <option value="ativo">Ativo</option>
                        <option value="inčtivo">Inℭtivo</option>
                      </select>
                </div>
                <div class="form-group"><label>Plataforma</label>
                    <select class="form-control" id="ad-platform">
                        <option value="facebook">Facebook</option><option value="instagram">Instagram</option>
                        <option value="google">Google Ads</option><option value="tiktok">TikTok</option>
                    </select>
                </div>
                <div class="form-group"><label>Budget (R$)</label><input type="number" class="form-control" id="ad-budget" step="0.01"></div>
            `,
            confirmText: 'Criar Campanha',
            onConfirm: async () => {
                try {
                    await ZeusAPI.marketing.ads.create({
                        name: document.getElementById('ad-name')?.value,
                        status: document.getElementById('ad-status')?.value,
                        platform: document.getElementById('ad-platform')?.value,
                        budget: parseFloat(document.getElementById('ad-budget')?.value) || 0
                    });
                    ZeusToast.success('Campanha criada!');
                    loadData();
                } catch (err) { ZeusToast.error(err.message); }
            }
        });
    }

    function refresh() { loadData(); }
    return { render, refresh, showAdd };
}));

