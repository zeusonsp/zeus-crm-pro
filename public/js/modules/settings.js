// ============================================
// ZEUS CRM PRO - Settings Module
// ============================================
const ZeusSettings = (function() {
    async function render() {
        const container = document.getElementById('tab-settings');
        if (!container) return;

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:16px">

                <!-- General Settings -->
                <div class="card">
                    <div class="card-header"><h3>⚙️ Geral</h3></div>
                    <div class="form-group"><label>Nome da Empresa</label><input type="text" class="form-control" id="set-company" value="Zeus Tecnologia"></div>
                    <div class="form-group"><label>Idioma</label>
                        <select class="form-control" id="set-lang">
                            <option value="pt" selected>Portugues</option>
                            <option value="en">English</option>
                            <option value="es">Espanol</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Moeda</label>
                        <select class="form-control" id="set-currency">
                            <option value="BRL" selected>R$ (BRL)</option>
                            <option value="USD">$ (USD)</option>
                            <option value="EUR">EUR</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Fuso Horario</label><input type="text" class="form-control" id="set-tz" value="America/Sao_Paulo"></div>
                    <button class="btn btn-gold" onclick="ZeusSettings.saveGeneral()">Salvar Geral</button>
                </div>

                <!-- Theme -->
                <div class="card">
                    <div class="card-header"><h3>🎨 Tema & Aparencia</h3></div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
                        <button class="btn ${getTheme() === 'dark' ? 'btn-gold' : 'btn-outline'}" onclick="ZeusSettings.setTheme('dark')">🌙 Dark</button>
                        <button class="btn ${getTheme() === 'light' ? 'btn-gold' : 'btn-outline'}" onclick="ZeusSettings.setTheme('light')">☀️ Light</button>
                        <button class="btn ${getTheme() === 'midnight' ? 'btn-gold' : 'btn-outline'}" onclick="ZeusSettings.setTheme('midnight')">🌌 Midnight</button>
                    </div>
                    <div class="form-group"><label>Cor Primaria</label>
                        <div style="display:flex;gap:8px;align-items:center">
                            <input type="color" id="set-color" value="#D4AF37" style="width:40px;height:40px;border:none;cursor:pointer">
                            <input type="text" class="form-control" id="set-color-hex" value="#D4AF37" style="width:100px">
                        </div>
                    </div>
                </div>

                <!-- SLA -->
                <div class="card">
                    <div class="card-header"><h3>⏱️ SLA (Acordo de Nivel de Servico)</h3></div>
                    <div class="form-group"><label>Primeira Resposta (horas)</label><input type="number" class="form-control" id="set-sla-response" value="2" min="1"></div>
                    <div class="form-group"><label>Enviar Proposta (horas)</label><input type="number" class="form-control" id="set-sla-proposal" value="24" min="1"></div>
                    <div class="form-group"><label>Fechamento (dias)</label><input type="number" class="form-control" id="set-sla-closing" value="7" min="1"></div>
                    <button class="btn btn-gold" onclick="ZeusSettings.saveSLA()">Salvar SLA</button>
                </div>

                <!-- Users -->
                <div class="card">
                    <div class="card-header">
                        <h3>👥 Usuarios & Permissoes</h3>
                        <button class="btn btn-outline btn-sm" onclick="ZeusSettings.addUser()">+ Adicionar</button>
                    </div>
                    <div id="settings-users"><div class="skeleton" style="height:100px"></div></div>
                </div>

                <!-- Sales Goals -->
                <div class="card">
                    <div class="card-header">
                        <h3>🎯 Metas de Vendas</h3>
                        <button class="btn btn-outline btn-sm" onclick="ZeusSettings.addGoal()">+ Nova Meta</button>
                    </div>
                    <div id="settings-goals"><div class="skeleton" style="height:100px"></div></div>
                </div>

                <!-- Notifications -->
                <div class="card">
                    <div class="card-header"><h3>🔔 Notificacoes</h3></div>
                    <div style="display:flex;flex-direction:column;gap:12px">
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                            <input type="checkbox" id="set-notif-email" checked>
                            <span>Notificacoes por Email</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                            <input type="checkbox" id="set-notif-push" checked>
                            <span>Notificacoes Push (Browser)</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                            <input type="checkbox" id="set-notif-sms">
                            <span>Notificacoes SMS</span>
                        </label>
                    </div>
                    <button class="btn btn-gold" style="margin-top:12px" onclick="ZeusSettings.saveNotifications()">Salvar Notificacoes</button>
                </div>

                <!-- Integrations -->
                <div class="card">
                    <div class="card-header"><h3>🔌 Integracoes</h3></div>
                    <div style="display:flex;flex-direction:column;gap:8px">
                        <div style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);display:flex;justify-content:space-between;align-items:center">
                            <div><strong>WhatsApp Business</strong><br><span style="font-size:11px;color:var(--text-muted)">Envio automatico de mensagens</span></div>
                            <span class="badge badge-warning">Configurar</span>
                        </div>
                        <div style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);display:flex;justify-content:space-between;align-items:center">
                            <div><strong>SMTP / Email</strong><br><span style="font-size:11px;color:var(--text-muted)">Envio de emails e campanhas</span></div>
                            <span class="badge badge-warning">Configurar</span>
                        </div>
                        <div style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);display:flex;justify-content:space-between;align-items:center">
                            <div><strong>Firebase</strong><br><span style="font-size:11px;color:var(--text-muted)">Banco de dados principal</span></div>
                            <span class="badge badge-success">Conectado</span>
                        </div>
                        <div style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);display:flex;justify-content:space-between;align-items:center">
                            <div><strong>Facebook Ads</strong><br><span style="font-size:11px;color:var(--text-muted)">Gestao de anuncios</span></div>
                            <span class="badge badge-warning">Configurar</span>
                        </div>
                        <div style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);display:flex;justify-content:space-between;align-items:center">
                            <div><strong>Google Ads</strong><br><span style="font-size:11px;color:var(--text-muted)">Gestao de anuncios</span></div>
                            <span class="badge badge-warning">Configurar</span>
                        </div>
                    </div>
                </div>

                <!-- System Info -->
                <div class="card">
                    <div class="card-header"><h3>ℹ️ Sistema</h3></div>
                    <div style="font-size:13px;color:var(--text-secondary)">
                        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                            <span>Versao</span><strong>Zeus CRM Pro v2.0.0</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                            <span>Backend</span><strong>Node.js + Express</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                            <span>Database</span><strong>Firebase Firestore</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                            <span>Real-time</span><strong>Socket.IO</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:6px 0">
                            <span>Empresa</span><strong style="color:var(--gold)">Zeus Tecnologia</strong>
                        </div>
                    </div>
                    <div style="margin-top:16px;text-align:center">
                        <button class="btn btn-outline btn-sm" onclick="ZeusSettings.checkHealth()">🏥 Verificar Saude do Sistema</button>
                    </div>
                </div>
            </div>
        `;

        // Load dynamic data
        loadUsers();
        loadGoals();
        loadCurrentSettings();
    }

    function getTheme() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('zeus_theme', theme);
        ZeusToast.success(`Tema alterado: ${theme}`);
        render(); // Re-render to update active buttons
    }

    async function loadCurrentSettings() {
        try {
            const res = await ZeusAPI.settings.get();
            const s = res.settings;
            if (s.companyName) document.getElementById('set-company').value = s.companyName;
            if (s.language) document.getElementById('set-lang').value = s.language;
            if (s.currency) document.getElementById('set-currency').value = s.currency;
            if (s.timezone) document.getElementById('set-tz').value = s.timezone;

            // Load SLA
            const slaRes = await ZeusAPI.settings.sla.get();
            const sla = slaRes.sla;
            if (sla) {
                document.getElementById('set-sla-response').value = sla.firstResponseHours || 2;
                document.getElementById('set-sla-proposal').value = sla.proposalHours || 24;
                document.getElementById('set-sla-closing').value = sla.closingDays || 7;
            }
        } catch (err) {
            // Settings may not exist yet - use defaults
        }
    }

    async function loadUsers() {
        try {
            const res = await ZeusAPI.users.list();
            const users = res.users || [];
            const el = document.getElementById('settings-users');
            const roleColors = { admin: 'gold', vendedor: 'info', viewer: 'warning' };

            el.innerHTML = users.length === 0 ?
                '<p style="color:var(--text-muted);font-size:12px">Nenhum usuario cadastrado</p>' :
                users.map(u => `
                    <div style="background:var(--bg-input);padding:10px;border-radius:var(--radius-sm);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <strong>${u.name}</strong>
                            <span style="font-size:11px;color:var(--text-muted);margin-left:8px">${u.email}</span>
                        </div>
                        <div style="display:flex;gap:4px;align-items:center">
                            <span class="badge badge-${roleColors[u.role] || 'info'}">${u.role}</span>
                            <button class="btn btn-outline btn-sm" onclick="ZeusSettings.removeUser('${u.id}')" style="padding:2px 6px">×</button>
                        </div>
                    </div>
                `).join('');
        } catch (err) {
            document.getElementById('settings-users').innerHTML = '<p style="color:var(--text-muted);font-size:12px">Erro ao carregar usuarios</p>';
        }
    }

    async function loadGoals() {
        try {
            const res = await ZeusAPI.settings.goals.get();
            const goals = res.goals || [];
            const el = document.getElementById('settings-goals');

            el.innerHTML = goals.length === 0 ?
                '<p style="color:var(--text-muted);font-size:12px">Nenhuma meta definida</p>' :
                goals.map((g, i) => `
                    <div style="background:var(--bg-input);padding:10px;border-radius:var(--radius-sm);margin-bottom:6px">
                        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                            <strong>${g.seller || 'Equipe'}</strong>
                            <span style="color:var(--gold);font-weight:700">R$ ${parseFloat(g.target || 0).toLocaleString('pt-BR')}</span>
                        </div>
                        <div class="progress-bar" style="height:8px">
                            <div class="progress-bar-fill" style="width:${Math.min((g.current || 0) / (g.target || 1) * 100, 100)}%"></div>
                        </div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
                            R$ ${parseFloat(g.current || 0).toLocaleString('pt-BR')} de R$ ${parseFloat(g.target || 0).toLocaleString('pt-BR')} (${g.month || ''})
                        </div>
                    </div>
                `).join('');
        } catch (err) {
            document.getElementById('settings-goals').innerHTML = '<p style="color:var(--text-muted);font-size:12px">Erro ao carregar metas</p>';
        }
    }

    async function saveGeneral() {
        try {
            await ZeusAPI.settings.update({
                companyName: document.getElementById('set-company')?.value,
                language: document.getElementById('set-lang')?.value,
                currency: document.getElementById('set-currency')?.value,
                timezone: document.getElementById('set-tz')?.value
            });
            ZeusToast.success('Configuracoes salvas!');
        } catch (err) { ZeusToast.error(err.message); }
    }

    async function saveSLA() {
        try {
            await ZeusAPI.settings.sla.update({
                firstResponseHours: parseInt(document.getElementById('set-sla-response')?.value) || 2,
                proposalHours: parseInt(document.getElementById('set-sla-proposal')?.value) || 24,
                closingDays: parseInt(document.getElementById('set-sla-closing')?.value) || 7
            });
            ZeusToast.success('SLA atualizado!');
        } catch (err) { ZeusToast.error(err.message); }
    }

    async function saveNotifications() {
        try {
            await ZeusAPI.settings.update({
                notifications: {
                    email: document.getElementById('set-notif-email')?.checked,
                    push: document.getElementById('set-notif-push')?.checked,
                    sms: document.getElementById('set-notif-sms')?.checked
                }
            });
            ZeusToast.success('Notificacoes salvas!');
        } catch (err) { ZeusToast.error(err.message); }
    }

    function addUser() {
        ZeusModal.create({
            title: 'Novo Usuario',
            content: `
                <div class="form-group"><label>Nome *</label><input type="text" class="form-control" id="new-user-name"></div>
                <div class="form-group"><label>Email *</label><input type="email" class="form-control" id="new-user-email"></div>
                <div class="form-group"><label>Senha *</label><input type="password" class="form-control" id="new-user-pass"></div>
                <div class="form-group"><label>Funcao</label>
                    <select class="form-control" id="new-user-role">
                        <option value="vendedor">Vendedor</option>
                        <option value="admin">Admin</option>
                        <option value="viewer">Viewer</option>
                    </select>
                </div>
            `,
            confirmText: 'Criar Usuario',
            onConfirm: async () => {
                try {
                    await ZeusAPI.users.create({
                        name: document.getElementById('new-user-name')?.value,
                        email: document.getElementById('new-user-email')?.value,
                        password: document.getElementById('new-user-pass')?.value,
                        role: document.getElementById('new-user-role')?.value
                    });
                    ZeusToast.success('Usuario criado!');
                    loadUsers();
                } catch (err) { ZeusToast.error(err.message); }
            }
        });
    }

    async function removeUser(id) {
        const ok = await ZeusModal.confirm('Remover Usuario', 'Tem certeza?');
        if (!ok) return;
        try { await ZeusAPI.users.delete(id); ZeusToast.success('Removido'); loadUsers(); }
        catch (err) { ZeusToast.error(err.message); }
    }

    function addGoal() {
        ZeusModal.create({
            title: 'Nova Meta de Vendas',
            content: `
                <div class="form-group"><label>Vendedor</label><input type="text" class="form-control" id="goal-seller" placeholder="Nome ou 'Equipe'"></div>
                <div class="form-group"><label>Meta (R$) *</label><input type="number" class="form-control" id="goal-target" step="0.01"></div>
                <div class="form-group"><label>Mes</label><input type="month" class="form-control" id="goal-month"></div>
            `,
            confirmText: 'Criar Meta',
            onConfirm: async () => {
                try {
                    const goalsRes = await ZeusAPI.settings.goals.get();
                    const current = goalsRes.goals || [];
                    current.push({
                        seller: document.getElementById('goal-seller')?.value || 'Equipe',
                        target: parseFloat(document.getElementById('goal-target')?.value) || 0,
                        current: 0,
                        month: document.getElementById('goal-month')?.value || ''
                    });
                    await ZeusAPI.settings.goals.update(current);
                    ZeusToast.success('Meta criada!');
                    loadGoals();
                } catch (err) { ZeusToast.error(err.message); }
            }
        });
    }

    async function checkHealth() {
        try {
            const res = await ZeusAPI.health();
            ZeusModal.create({
                title: 'Saude do Sistema',
                content: `
                    <div style="text-align:center;margin-bottom:16px">
                        <div style="font-size:48px">${res.status === 'ok' ? '✅' : '❌'}</div>
                        <h3 style="color:${res.status === 'ok' ? 'var(--success)' : 'var(--danger)'}">${res.status === 'ok' ? 'Sistema Saudavel' : 'Problema Detectado'}</h3>
                    </div>
                    <div style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);font-family:monospace;font-size:12px">
                        <div>Servico: ${res.service}</div>
                        <div>Versao: ${res.version}</div>
                        <div>Uptime: ${Math.floor(res.uptime / 60)} min</div>
                        <div>Timestamp: ${res.timestamp}</div>
                    </div>
                `,
                confirmText: 'OK',
                showCancel: false
            });
        } catch (err) {
            ZeusToast.error('Servidor offline ou inacessivel: ' + err.message);
        }
    }

    function refresh() { render(); }
    return { render, refresh, setTheme, saveGeneral, saveSLA, saveNotifications, addUser, removeUser, addGoal, checkHealth };
})();
