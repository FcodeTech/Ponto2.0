// js/app.js

// --- INICIALIZAÇÃO DE CONFIGURAÇÕES GLOBAIS ---
document.addEventListener('DOMContentLoaded', async () => {
    await applyGlobalSettings();
});

/**
 * Aplica as configurações globais (tema, cor, logo, nome) na página atual.
 * Funciona com logo armazenada no Supabase Storage (URL pública) ou base64 legado.
 */
async function applyGlobalSettings() {
    try {
        let settings = await db.settings.get('global');
        
        // Fallback: se não estiver logado (tela de login), busca preferências do localStorage
        if (!settings) {
            settings = {
                logoUrl: localStorage.getItem('user_logo_url') || '',
                theme: localStorage.getItem('user_theme') || 'light',
                systemName: localStorage.getItem('user_system_name') || 'Ponto Eletrônico'
            };
        } else {
            // Logado: Atualiza o localStorage com as preferências do usuário atual
            if (settings.logoUrl) localStorage.setItem('user_logo_url', settings.logoUrl);
            else localStorage.removeItem('user_logo_url');
            
            if (settings.theme) localStorage.setItem('user_theme', settings.theme);
            if (settings.systemName) localStorage.setItem('user_system_name', settings.systemName);
        }

        if (!settings) return;

        // ── Tema ─────────────────────────────────────────────
        const theme = settings.theme || 'light';
        document.documentElement.setAttribute('data-theme', theme);
        const themeSwitch = document.getElementById('checkbox-theme');
        if (themeSwitch) themeSwitch.checked = (theme === 'dark');

        // ── Cor Principal ────────────────────────────────────
        if (settings.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
        }

        // ── Logo ─────────────────────────────────────────────
        // Suporta URL do Supabase Storage e base64 (legado)
        const logoUrl = settings.logoUrl || 'favicon.png';

        // Tela de login
        const loginLogoImg = document.getElementById('login-logo');
        if (loginLogoImg) {
            loginLogoImg.src = logoUrl;
            loginLogoImg.style.display = 'block';
            const defaultIcon = document.querySelector('.login-default-icon');
            if (defaultIcon) defaultIcon.style.display = 'none';
        }

        // Sidebar (todas as páginas autenticadas)
        document.querySelectorAll('.brand-logo').forEach(el => {
            el.src = logoUrl;
            el.style.display = 'inline-block';
        });
        document.querySelectorAll('.brand-icon-default').forEach(el => {
            el.style.display = 'none';
        });

        // Preview na página de configurações
        if (settings.logoUrl) {
            const previewImg = document.getElementById('config-logo-preview');
            const previewContainer = document.getElementById('config-logo-preview-container');
            if (previewImg && previewContainer) {
                previewImg.src = settings.logoUrl;
                previewContainer.style.display = 'block';
            }
        }

        // ── Nome do Sistema ──────────────────────────────────
        const sysName = settings.systemName || 'PontoMax';
        document.title = document.title.replace(/PontoMax|Ponto Eletrônico/g, sysName);
        document.querySelectorAll('.brand').forEach(el => {
            el.textContent = sysName;
        });

        // Popular input de nome na página de configurações
        const nameInput = document.getElementById('config-system-name');
        if (nameInput) nameInput.value = sysName;

        // ── Toggles (página de configurações) ───────────────
        const inssSwitch = document.getElementById('checkbox-inss');
        if (inssSwitch) inssSwitch.checked = !!settings.inssCalculation;

        const irrfSwitch = document.getElementById('checkbox-irrf');
        if (irrfSwitch) irrfSwitch.checked = !!settings.irrfCalculation;

        const noturnoSwitch = document.getElementById('checkbox-noturno');
        if (noturnoSwitch) noturnoSwitch.checked = !!settings.noturnoCalculation;

        const fgtsSwitch = document.getElementById('checkbox-fgts');
        if (fgtsSwitch) fgtsSwitch.checked = !!settings.fgtsCalculation;

        const decimoSwitch = document.getElementById('checkbox-13');
        if (decimoSwitch) decimoSwitch.checked = !!settings.decimoTerceiroCalculation;

        const feriasSwitch = document.getElementById('checkbox-ferias');
        if (feriasSwitch) feriasSwitch.checked = (settings.feriasCalculation !== undefined && settings.feriasCalculation !== null) ? !!settings.feriasCalculation : (localStorage.getItem('ponto_ferias_calculation') !== 'false');

    } catch (e) {
        console.error('[applyGlobalSettings] Erro ao carregar settings:', e);
    }
}

// ─────────────────────────────────────────────
// CONTROLE DE ACESSO — HELPERS GLOBAIS
// ─────────────────────────────────────────────

/** Retorna true se o usuário logado for administrador */
window.isAdmin = function() {
    return currentUser && currentUser.role === 'admin';
};

/**
 * Verifica se o usuário tem acesso à página atual.
 * Se não tiver, redireciona para index.html.
 * @param {string} requiredRole - 'admin' para páginas restritas ao admin
 */
window.enforceAccessControl = function(requiredRole = 'admin') {
    // A verificação ocorre após a sessão ser restaurada (currentUser disponível)
    if (!currentUser) {
        window.location.href = 'login.html';
        return false;
    }
    if (requiredRole === 'admin' && currentUser.role !== 'admin') {
        showToast('Acesso restrito. Redirecionando...', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        return false;
    }
    return true;
};

// --- DASHBOARD UI INITIALIZATION ---
async function initDashboard() {
    if (!currentUser) return;

    // Set user details in Sidebar
    document.getElementById('sidebar-user-name').textContent = currentUser.name;
    document.getElementById('sidebar-user-role').textContent = currentUser.role === 'admin' ? 'Administrador' : 'Funcionário';

    // Mostrar/ocultar itens de menu admin-only conforme a role
    const adminMenus = document.querySelectorAll('.admin-only');
    adminMenus.forEach(menu => {
        if (currentUser.role === 'admin') {
            menu.style.display = 'flex';
        } else {
            menu.style.display = 'none';
        }
    });
    
    // Config values
    const profileSalario = document.getElementById('profile-salario');
    if (profileSalario && currentUser.baseSalary) {
        profileSalario.value = currentUser.baseSalary;
    }

    // Initialize specific pages
    if (document.getElementById('dashboard-content')) {
        if (typeof initDashboardFilters === 'function') await initDashboardFilters();
        updateDashboardStats();
    }
    if (document.getElementById('relatorios-content')) loadReportsData();
    if (document.getElementById('funcionarios-content') && typeof initEmployeesScreen === 'function') {
        initEmployeesScreen();
    }
    if (document.getElementById('registro-content') && typeof initTimeTrackerDefaults === 'function') {
        initTimeTrackerDefaults();
    }
    if (document.getElementById('perfil-content') && typeof initPerfilScreen === 'function') {
        await initPerfilScreen();
    }
}

// --- SPA NAVIGATION (REMOVIDO PARA MPA) ---
// Agora a navegação é feita por links normais no HTML.
// Apenas destacamos o menu ativo baseado na URL.
document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const currentPath = window.location.pathname;
    
    navItems.forEach(item => {
        item.classList.remove('active');
        const href = item.getAttribute('href');
        
        if (href && href !== '#' && currentPath.endsWith(href)) {
            item.classList.add('active');
        } else if (currentPath.endsWith('/') && href === 'index.html') {
            item.classList.add('active'); // default to index
        }
    });
});

// --- SIDEBAR TOGGLE ---
const btnToggle = document.getElementById('btn-toggle-sidebar');
const btnClose = document.getElementById('btn-close-sidebar');
const sidebar = document.getElementById('sidebar');

if (btnToggle && sidebar) {
    btnToggle.addEventListener('click', () => {
        sidebar.classList.add('open');
    });
}
if (btnClose && sidebar) {
    btnClose.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });
}

// --- THEME SWITCHING ---
const themeSwitch = document.getElementById('checkbox-theme');
if (themeSwitch) {
    themeSwitch.addEventListener('change', async (e) => {
        const theme = e.target.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        try {
            await db.settings.update('global', { theme });
        } catch (err) { console.error(err); }
    });
}

// --- REALTIME CLOCK ---
function updateClock() {
    const clockEl = document.getElementById('realtime-clock');
    if(clockEl) {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('pt-BR');
    }
}
setInterval(updateClock, 1000);
updateClock();

// --- CONFIGURAÇÕES: lógica delegada para js/configuracoes.js ---
// Os botões de cor, upload de logo e salvamento são gerenciados por configuracoes.js.
// Aqui mantemos apenas a compatibilidade para páginas que não carregam configuracoes.js.

// --- RESET SYSTEM: delegado para configuracoes.js ---
// O botão btn-reset-system é gerenciado por js/configuracoes.js quando disponível.

// Placeholder for updateDashboardStats (Will be implemented in timeTracker.js)
window.updateDashboardStats = window.updateDashboardStats || function() {};
window.loadReportsData = window.loadReportsData || function() {};
