// ============================================
// ZEUS CRM PRO - CEO Dashboard Module
// ============================================
const ZeusCEO = (function() {
    let autoRefreshTimer = null;
    let dashboardData = null;

    async function render() {
        const container = document.getElementById('tab-ceo');
        if (!container) return;

        // Show skeleton while loading
        container.innerHTML = `
            <div class="stats-grid">
                ${Array(6).fill('<div class="stat-card"><div class="skeleton" style="height:80px"></div></div>').join('')}
            </div>
            <div class="skeleton" style="height:300px;border-radius:var(--radius);margin-bottom:16px"></div>
        `;

        try {
            const response = await ZeusAPI.reports.dashboard();
            dashboardData = response.dashboard;
            renderDashboard(container, dashboardData);
            startAutoRefresh();
        } catch (err) {
            container.innerHTML = `<div class="empty-state">
                <div class="empty-icon">📊</div>
                <h3>Erro ao carregar dashboard</h3>
                <p>${err.message}</p>
                <button class="btn btn-gold" onclick="ZeusCEO.render()" style="margin-top:16px">Tentar novamente</button>
            </div>`;
        }
    }

    function renderDashboard(container, data) {
        const d = data.overview;
        container.innerHTML = `
            <!-- Stats Cards -->
            <div class="stats-grid">
                <div class="stat-card animate-scaleIn">
                    <div class="stat-icon">👥</div>
                    <div class="stat-value">${d.totalLeads}</div>
                    <div class="stat-label">Total Leads</div>
                </div>
                <div class="stat-card animate-scaleIn" style="animation-delay:0.05s">
                    <div class="stat-icon">💰</div>
                    <div class="stat-value">R$ ${formatCurrency(d.totalRevenue)}</div>
                    <div class="stat-label">Receita Aprovada</div>
                </div>
                <div class="stat-card animate-scaleIn" style="animation-delay:0.1s">
                    <div class="stat-icon">📋</div>
                    <div class="stat-value">${d.totalOrcamentos}</div>
                    <div class="stat-label">Orcamentos</div>
                </div>
                <div class="stat-card animate-scaleIn" style="animation-delay:0.15s">
                    <div class="stat-icon">📝</div>
                    <div class="stat-value">${d.activeContracts}</div>
                    <div class="stat-label">Contratos Ativos</div>
                </div>
                <div class="stat-card animate-scaleIn" style="animation-delay:0.2s">
                    <div class="stat-icon">📈</div>
                    <div class="stat-value">${data.conversionRate}%</div>
                    <div class="stat-label">Taxa Conversao</div>
                </div>
                <div class="stat-card animate-scaleIn" style="animation-delay:0.25s">
                    <div class="stat-icon">⭐</div>
                    <div class="stat-value">${d.npsScore}</div>
                    <div class="stat-label">NPS Score</div>
                </div>
            </div>

            <!-- Revenue Pending -->
            <div class="card" style="border-left:3px solid var(--warning);margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <span style="color:var(--text-secondary);font-size:13px">Receita Pendente</span>
                        <div style="font-size:24px;font-weight:800;color:var(--warning)">R$ ${formatCurrency(d.pendingRevenue)}</div>
                    </div>
                    <div>
                        <span style="color:var(--text-secondary);font-size:13px">Tarefas Atrasadas</span>
                        <div style="font-size:24px;font-weight:800;color:${d.overdueTasks > 0 ? 'var(--danger)' : 'var(--success)'}">${d.overdueTasks}</div>
                    </div>
                    <div>
                        <span style="color:var(--text-secondary);font-size:13px">Valor Contratos</span>
                        <div style="font-size:24px;font-weight:800;color:var(--gold)">R$ ${formatCurrency(d.contractValue)}</div>
                    </div>
                </div>
            </div>

            <!-- Pipeline by Stage -->
            <div class="card">
                <div class="card-header">
                    <h3>Pipeline por Estagio</h3>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    ${renderPipelineBars(data.leadsByStage, d.totalLeads)}
                </div>
            </div>

            <!-- Monthly Trend -->
            <div class="card">
                <div class="card-header">
                    <h3>Tendencia Mensal (6 meses)</h3>
                </div>
                <div style="display:flex;gap:12px;align-items:flex-end;height:150px">
                    ${data.monthlyTrend.map(m => {
                        const maxLeads = Math.max(...data.monthlyTrend.map(x => x.leads), 1);
                        const h = Math.max((m.leads / maxLeads) * 120, 4);
                        return `<div style="flex:1;text-align:center">
                            <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">R$${formatCurrency(m.revenue)}</div>
                            <div style="background:linear-gradient(to top,var(--gold),var(--gold-hover));height:${h}px;border-radius:4px 4px 0 0;margin:0 auto;width:80%"></div>
                            <div style="font-size:10px;color:var(--text-secondary);margin-top:4px">${m.month.substring(5)}</div>
                            <div style="font-size:11px;font-weight:700;color:var(--gold)">${m.leads}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <!-- Seller Performance -->
            <div class="card">
                <div class="card-header">
                    <h3>Performance por Vendedor</h3>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr><th>Vendedor</th><th>Leads</th><th>Fechados</th><th>Receita</th><th>Conversao</th></tr>
                        </thead>
                        <tbody>
                            ${Object.entries(data.sellerPerformance).map(([name, stats]) => `
                                <tr>
                                    <td><strong>${name}</strong></td>
                                    <td>${stats.leads}</td>
                                    <td>${stats.closed}</td>
                                    <td style="color:var(--gold)">R$ ${formatCurrency(stats.revenue)}</td>
                                    <td>${stats.leads > 0 ? ((stats.closed / stats.leads) * 100).toFixed(0) : 0}%</td>
                                </tr>
                            `).join('') || '<tr><td colspan="5" class="empty-state">Nenhum dado</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Leads by Source -->
            <div class="card">
                <div class="card-header">
                    <h3>Leads por Origem</h3>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px">
                    ${Object.entries(data.leadsBySource).map(([source, count]) =>
                        `<span class="badge badge-gold">${source}: ${count}</span>`
                    ).join('') || '<span class="badge badge-info">Sem dados</span>'}
                </div>
            </div>
        `;
    }

    function renderPipelineBars(stages, total) {
        const stageNames = { novo: 'Novo', contato: 'Contato', proposta: 'Proposta', negociacao: 'Negociacao', fechamento: 'Fechamento' };
        const stageColors = { novo: '#2196F3', contato: '#FFB300', proposta: '#9C27B0', negociacao: '#FF5722', fechamento: '#00C853' };

        return Object.entries(stageNames).map(([key, label]) => {
            const count = stages[key] || 0;
            const pct = total > 0 ? (count / total * 100).toFixed(0) : 0;
            return `<div style="flex:1;min-width:120px">
                <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
                    <span style="color:var(--text-secondary)">${label}</span>
                    <span style="color:${stageColors[key]};font-weight:700">${count} (${pct}%)</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width:${pct}%;background:${stageColors[key]}"></div>
                </div>
            </div>`;
        }).join('');
    }

    function formatCurrency(value) {
        if (!value) return '0';
        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
        return value.toFixed(0);
    }

    function startAutoRefresh() {
        if (autoRefreshTimer) clearInterval(autoRefreshTimer);
        autoRefreshTimer = setInterval(() => {
            if (ZeusApp.getCurrentTab() === 'ceo') render();
        }, 30000);
    }

    function refresh() { render(); }

    return { render, refresh };
})();
