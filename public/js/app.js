// ============================================
// ZEUS CRM PRO v2.0 - Main Application
// Zeus Tecnologia - @zeustecnologiaonlife
// ============================================

const ZeusApp = (function() {
    let currentTab = 'ceo';
    let currentUser = null;
    let socket = null;

    // ============================================
    // INITIALIZATION
    // ============================================
    function init() {
        ZeusAPI.init({
            onUnauthorized: () => showLogin()
        });

        if (ZeusAPI.getToken()) {
            loadApp();
        } else {
            showLogin();
        }

        setupKeyboardShortcuts();
        setupMobileMenu();
    }

    // ============================================
    // AUTH
    // ============================================
    function showLogin() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
    }

    async function handleLogin() {
        const emailOrKey = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!emailOrKey) {
            ZeusToast.error('Informe email ou chave admin');
            return;
        }

        try {
            const btn = document.getElementById('login-btn');
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner"></span> Entrando...';

            let data;
            if (emailOrKey === 'zeus2026admin' || !emailOrKey.includes('@')) {
                data = await ZeusAPI.auth.loginWithAdminKey(emailOrKey);
            } else {
                data = await ZeusAPI.auth.login(emailOrKey, password);
            }

            currentUser = data.user;
            loadApp();
        } catch (err) {
            ZeusToast.error(err.message);
        } finally {
            const btn = document.getElementById('login-btn');
            btn.disabled = false;
            btn.textContent = 'ENTRAR';
        }
    }

    function handleLogout() {
        ZeusAPI.auth.logout();
        currentUser = null;
        if (socket) socket.disconnect();
        showLogin();
    }

    // ============================================
    // LOAD APP
    // ============================================
    async function loadApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'flex';

        // Display user name
        const userNameEl = document.getElementById('user-name');
        if (userNameEl && currentUser) {
            userNameEl.textContent = currentUser.name;
        }

        // Connect socket
        connectSocket();

        // Load initial data
        switchTab('ceo');

        // Apply saved theme
        const savedTheme = localStorage.getItem('zeus_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // ============================================
    // SOCKET.IO REAL-TIME
    // ============================================
    function connectSocket() {
        if (typeof io === 'undefined') return;

        socket = io();

        socket.on('connect', () => {
            console.log('[Zeus] Real-time connected');
        });

        socket.on('lead-created', (lead) => {
            ZeusToast.success(`Novo lead: ${lead.nome}`);
            if (currentTab === 'ceo') ZeusCEO.refresh();
            if (currentTab === 'leads') ZeusLeads.refresh();
        });

        socket.on('lead-updated', () => {
            if (currentTab === 'leads') ZeusLeads.refresh();
        });

        socket.on('lead-stage-changed', () => {
            if (currentTab === 'pipeline') ZeusPipeline.refresh();
        });

        socket.on('orcamento-created', (orc) => {
            ZeusToast.info(`Novo orcamento: ${orc.numero}`);
            if (currentTab === 'orcamentos') ZeusOrcamentos.refresh();
        });

        socket.on('task-created', (task) => {
            ZeusToast.info(`Nova tarefa: ${task.title}`);
        });

        socket.on('task-completed', (task) => {
            ZeusToast.success(`Tarefa concluida: ${task.title}`);
        });

        socket.on('booking-created', (booking) => {
            ZeusToast.info(`Novo agendamento: ${booking.clientName}`);
        });

        socket.on('notification', (data) => {
            ZeusToast.info(data.message || 'Nova notificacao');
        });

        socket.on('disconnect', () => {
            console.log('[Zeus] Real-time disconnected');
        });
    }

    // ============================================
    // TAB NAVIGATION
    // ============================================
    function switchTab(tabName) {
        currentTab = tabName;

        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');

        // Show selected tab
        const tabEl = document.getElementById(`tab-${tabName}`);
        if (tabEl) tabEl.style.display = 'block';

        // Update sidebar active state
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabName);
        });

        // Update header title
        const titles = {
            ceo: 'Dashboard CEO',
            leads: 'Gestao de Leads',
            pipeline: 'Pipeline / Kanban',
            orcamentos: 'Orcamentos',
            contracts: 'Contratos',
            products: 'Produtos',
            nf: 'Notas Fiscais',
            tasks: 'Tarefas',
            funnels: 'Funis de Venda',
            emailmkt: 'Email Marketing',
            whatsapp: 'WhatsApp Business',
            smsvoice: 'SMS & Voice',
            chatwidget: 'Chat Widget',
            booking: 'Agendamentos',
            reputation: 'Reputacao',
            ads: 'Gestao de Anuncios',
            settings: 'Configuracoes'
        };
        const headerTitle = document.getElementById('header-title');
        if (headerTitle) headerTitle.textContent = titles[tabName] || tabName;

        // Trigger tab-specific render
        renderTab(tabName);

        // Close mobile menu
        closeMobileMenu();
    }

    async function renderTab(tabName) {
        try {
            switch (tabName) {
                case 'ceo': if (window.ZeusCEO) ZeusCEO.render(); break;
                case 'leads': if (window.ZeusLeads) ZeusLeads.render(); break;
                case 'pipeline': if (window.ZeusPipeline) ZeusPipeline.render(); break;
                case 'orcamentos': if (window.ZeusOrcamentos) ZeusOrcamentos.render(); break;
                case 'contracts': if (window.ZeusContracts) ZeusContracts.render(); break;
                case 'products': if (window.ZeusProducts) ZeusProducts.render(); break;
                case 'tasks': if (window.ZeusTasks) ZeusTasks.render(); break;
                case 'funnels': if (window.ZeusFunnels) ZeusFunnels.render(); break;
                case 'emailmkt': if (window.ZeusEmailMkt) ZeusEmailMkt.render(); break;
                case 'whatsapp': if (window.ZeusWhatsAppMod) ZeusWhatsAppMod.render(); break;
                case 'booking': if (window.ZeusBooking) ZeusBooking.render(); break;
                case 'reputation': if (window.ZeusReputation) ZeusReputation.render(); break;
                case 'ads': if (window.ZeusAdsMod) ZeusAdsMod.render(); break;
                case 'settings': if (window.ZeusSettings) ZeusSettings.render(); break;
            }
        } catch (err) {
            console.error(`[Zeus] Error rendering tab ${tabName}:`, err);
        }
    }

    // ============================================
    // MOBILE MENU
    // ============================================
    function setupMobileMenu() {
        const menuBtn = document.getElementById('mobile-menu-btn');
        const overlay = document.getElementById('mobile-overlay');

        if (menuBtn) menuBtn.addEventListener('click', toggleMobileMenu);
        if (overlay) overlay.addEventListener('click', closeMobileMenu);
    }

    function toggleMobileMenu() {
        document.querySelector('.sidebar').classList.toggle('open');
        document.getElementById('mobile-overlay').classList.toggle('active');
    }

    function closeMobileMenu() {
        document.querySelector('.sidebar')?.classList.remove('open');
        document.getElementById('mobile-overlay')?.classList.remove('active');
    }

    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K: Global search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.querySelector('.header-search input');
                if (searchInput) searchInput.focus();
            }

            // Ctrl+1-5: Quick tab switch
            if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '5') {
                e.preventDefault();
                const tabs = ['ceo', 'leads', 'pipeline', 'orcamentos', 'contracts'];
                switchTab(tabs[+e.key - 1]);
            }

            // Escape: Close modals
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(m => {
                    m.classList.remove('active');
                });
                closeMobileMenu();
            }
        });
    }

    // ============================================
    // UTILITY: THEME TOGGLE
    // ============================================
    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const themes = ['dark', 'light', 'midnight'];
        const next = themes[(themes.indexOf(current) + 1) % themes.length];
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('zeus_theme', next);
        ZeusToast.info(`Tema: ${next}`);
    }

    // ============================================
    // PUBLIC API
    // ============================================
    return {
        init,
        switchTab,
        handleLogin,
        handleLogout,
        toggleTheme,
        getCurrentTab: () => currentTab,
        getCurrentUser: () => currentUser,
        getSocket: () => socket
    };
})();

// ============================================
// TOAST SYSTEM
// ============================================
const ZeusToast = (function() {
    function show(message, type = 'info', duration = 4000) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    return {
        success: (msg) => show(msg, 'success'),
        error: (msg) => show(msg, 'error'),
        warning: (msg) => show(msg, 'warning'),
        info: (msg) => show(msg, 'info')
    };
})();

// ============================================
// MODAL SYSTEM
// ============================================
const ZeusModal = (function() {
    function open(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
    }

    function close(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    }

    function create({ title, content, onConfirm, confirmText = 'Confirmar', showCancel = true }) {
        const id = 'modal-' + Date.now();
        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="ZeusModal.close('${id}');this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">${content}</div>
                <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
                    ${showCancel ? `<button class="btn btn-outline" onclick="ZeusModal.close('${id}');this.closest('.modal-overlay').remove()">Cancelar</button>` : ''}
                    <button class="btn btn-gold" id="${id}-confirm">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        if (onConfirm) {
            document.getElementById(`${id}-confirm`).addEventListener('click', () => {
                onConfirm();
                overlay.remove();
            });
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        return id;
    }

    // Promise-based confirm
    function confirm(title, message) {
        return new Promise((resolve) => {
            create({
                title,
                content: `<p style="color:var(--text-secondary)">${message}</p>`,
                onConfirm: () => resolve(true),
                confirmText: 'Sim'
            });
            // Override cancel to resolve false
            const overlay = document.querySelector('.modal-overlay.active:last-child');
            const cancelBtn = overlay?.querySelector('.btn-outline');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => resolve(false));
            }
        });
    }

    // Promise-based prompt
    function prompt(title, placeholder = '') {
        return new Promise((resolve) => {
            const inputId = 'prompt-' + Date.now();
            create({
                title,
                content: `<input type="text" id="${inputId}" class="form-control" placeholder="${placeholder}" autofocus>`,
                onConfirm: () => {
                    resolve(document.getElementById(inputId)?.value || '');
                },
                confirmText: 'OK'
            });
            setTimeout(() => document.getElementById(inputId)?.focus(), 100);
        });
    }

    return { open, close, create, confirm, prompt };
})();

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', ZeusApp.init);
