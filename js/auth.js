// js/auth.js

let currentUser = null;

// ─────────────────────────────────────────────
// VERIFICAR SESSÃO AO CARREGAR A PÁGINA
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Aplicar configurações globais (cores, logo, nome)
    try {
        let settings = await db.settings.get('global');
        
        if (!settings) {
            settings = {
                logoUrl: localStorage.getItem('user_logo_url') || '',
                theme: localStorage.getItem('user_theme') || 'light',
                systemName: localStorage.getItem('user_system_name') || 'Ponto Eletrônico'
            };
        } else {
            if (settings.logoUrl) localStorage.setItem('user_logo_url', settings.logoUrl);
            else localStorage.removeItem('user_logo_url');
            
            if (settings.theme) localStorage.setItem('user_theme', settings.theme);
            if (settings.systemName) localStorage.setItem('user_system_name', settings.systemName);
        }

        if (settings) {
            document.documentElement.setAttribute('data-theme', settings.theme || 'light');
            if (settings.primaryColor) {
                document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
            }

            const sysName = settings.systemName || 'PontoMax';
            document.title = document.title.replace(/PontoMax|Ponto Eletrônico/g, sysName);
            document.querySelectorAll('.brand').forEach(el => el.textContent = sysName);

            if (settings.logoUrl) {
                const logoUrl = settings.logoUrl;

                // Logo na tela de login
                const loginLogoImg = document.getElementById('login-logo');
                if (loginLogoImg) {
                    loginLogoImg.src = logoUrl;
                    loginLogoImg.style.display = 'block';
                    const defaultIcon = document.querySelector('.login-default-icon');
                    if (defaultIcon) defaultIcon.style.display = 'none';
                }

                // Logo nas sidebars (outras páginas)
                document.querySelectorAll('.brand-logo').forEach(el => {
                    el.src = logoUrl;
                    el.style.display = 'inline-block';
                });
                document.querySelectorAll('.brand-icon-default').forEach(el => {
                    el.style.display = 'none';
                });
            }
        }
    } catch(e) { console.error('Erro ao carregar settings:', e); }


    const path = window.location.pathname;
    const isLoginPage = path.endsWith('login.html') || path === '/' || path.endsWith('/');

    try {
        const { data: { session } } = await _supabase.auth.getSession();

        if (session) {
            // Buscar perfil do usuário na tabela users
            currentUser = await db.users.get(session.user.id);

            if (currentUser) {
                if (currentUser.role !== 'admin' && currentUser.status !== 'approved') {
                    if (isLoginPage) {
                        await _supabase.auth.signOut();
                        showToast('Sua conta está aguardando aprovação do administrador.', 'error');
                    } else {
                        document.body.innerHTML = `
                            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:var(--bg-color, #f4f7f6); color:var(--text-color, #333); font-family:var(--font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif); text-align:center; padding:20px;">
                                <i class="fa-solid fa-hourglass-half" style="font-size:4rem; color:var(--primary-color, #0066cc); margin-bottom:20px;"></i>
                                <h2 style="margin-bottom:10px;">Conta Pendente</h2>
                                <p style="max-width:400px; color:var(--text-muted, #777); margin-bottom:30px;">Sua conta foi criada com sucesso, mas está aguardando aprovação do administrador para acessar o sistema.</p>
                                <button onclick="window.supabase.createClient('${SUPABASE_URL}', '${SUPABASE_ANON_KEY}').auth.signOut().then(() => window.location.href='login.html')" style="padding:10px 20px; border:none; border-radius:4px; background:var(--primary-color, #0066cc); color:#fff; cursor:pointer; font-weight:600;">Voltar ao Login</button>
                            </div>
                        `;
                    }
                    return;
                }

                if (isLoginPage) {
                    window.location.href = 'index.html';
                } else {
                    if (typeof initDashboard === 'function') initDashboard();
                }
            } else {
                // Sessão existe mas sem perfil — deslogar
                await _supabase.auth.signOut();
                if (!isLoginPage) window.location.href = 'login.html';
            }
        } else {
            if (!isLoginPage) window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Erro na verificação de sessão:', error);
        if (!isLoginPage) window.location.href = 'login.html';
    }
});

// ─────────────────────────────────────────────
// PREPARAR FORMULÁRIO DE REGISTRO
// ─────────────────────────────────────────────
async function prepareRegisterForm() {
    const roleSelect = document.getElementById('reg-role');
    const adminOpt   = roleSelect ? roleSelect.querySelector('option[value="admin"]') : null;
    if (!roleSelect) return;

    try {
        const { data: adminExists, error } = await _supabase
            .rpc('has_admin');

        if (error) throw error;

        if (adminExists) {
            // Ocultar opção admin e forçar 'employee'
            if (adminOpt) adminOpt.style.display = 'none';
            roleSelect.value    = 'employee';
            roleSelect.disabled = true;
            const hint = document.getElementById('reg-role-hint');
            if (hint) hint.style.display = 'block';
        } else {
            // Ainda não há admin: liberar opção
            if (adminOpt) adminOpt.style.display = '';
            roleSelect.disabled = false;
            const hint = document.getElementById('reg-role-hint');
            if (hint) hint.style.display = 'none';
        }
    } catch (e) { console.error('Erro ao preparar formulário de registro:', e); }
}

// Extrai mensagem amigável de erros do banco (trigger exceptions) ou do Supabase Auth
function parseSupabaseError(error) {
    if (!error) return 'Erro desconhecido. Tente novamente.';
    const msg = error.message || '';
    if (msg.includes('single_admin_violation')) {
        return 'Já existe um administrador no sistema. Novos cadastros só podem ser como Funcionário.';
    }
    if (msg.includes('duplicate key') || msg.includes('already registered')) {
        return 'Este e-mail já está cadastrado no sistema.';
    }
    return msg || 'Erro ao realizar cadastro. Tente novamente.';
}

// ─────────────────────────────────────────────
// REGISTRAR CONTA
// ─────────────────────────────────────────────
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name            = document.getElementById('reg-name').value.trim();
        const cpf             = document.getElementById('reg-cpf').value.trim();
        const matricula       = document.getElementById('reg-matricula').value.trim();
        const email           = document.getElementById('reg-email').value.trim().toLowerCase();
        const phone           = document.getElementById('reg-phone').value.trim();
        const password        = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        const role            = document.getElementById('reg-role').value;

        if (password !== confirmPassword) {
            showToast('As senhas não coincidem.', 'error');
            return;
        }
        if (password.length < 6) {
            showToast('A senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }

        try {
            // ── Camada 1: Verificação frontend (UX rápida) ──────────────────────
            // Bloqueia tentativa de cadastrar admin quando já existe um no banco
            if (role === 'admin') {
                const { data: adminExists, error: rpcError } = await _supabase.rpc('has_admin');
                if (!rpcError && adminExists) {
                    showToast('Já existe um administrador. Novos usuários só podem ser Funcionários.', 'error');
                    // Forçar UI para 'employee'
                    const roleSelect = document.getElementById('reg-role');
                    if (roleSelect) { roleSelect.value = 'employee'; roleSelect.disabled = true; }
                    return;
                }
            }

            // 1. Criar conta no Supabase Auth
            const { data: authData, error: authError } = await _supabase.auth.signUp({ email, password });
            if (authError) {
                showToast(parseSupabaseError(authError), 'error');
                return;
            }

            // 2. Inserir perfil na tabela users
            // ── Camada 2: O trigger `enforce_single_admin` no banco bloqueia
            //    qualquer tentativa de inserir um segundo admin, mesmo via API direta.
            const { error: insertError } = await _supabase.from('users').insert({
                id:                  authData.user.id,
                name,
                cpf,
                matricula,
                email,
                phone,
                role:                role === 'admin' ? 'admin' : 'employee',
                status:              role === 'admin' ? 'approved' : 'pending',
                base_salary:         0,
                hour_type:           '8h',
                overtime_type:       '50',
                journey_start:       '08:00',
                journey_pause_start: '12:00',
                journey_pause_end:   '13:00',
                journey_end:         '17:00',
                profile_color:       '#0066cc'
            });

            if (insertError) {
                console.error('Erro ao inserir perfil:', insertError);
                // Captura erro do trigger de único admin ou outros erros do banco
                showToast(parseSupabaseError(insertError), 'error');
                // Limpar a conta Auth criada para não deixar conta órfã
                await _supabase.auth.signOut();
                return;
            }

            showToast('Cadastro realizado com sucesso! Faça login.', 'success');
            // Deslogar a sessão criada automaticamente pelo signUp para forçar login manual
            await _supabase.auth.signOut();
            registerForm.reset();
            showView('login-view');

        } catch (error) {
            console.error(error);
            showToast(parseSupabaseError(error), 'error');
        }
    });
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email    = document.getElementById('login-email').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;

        try {
            const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

            if (error) {
                showToast('E-mail ou senha inválidos.', 'error');
                return;
            }

            currentUser = await db.users.get(data.user.id);
            if (currentUser && currentUser.role !== 'admin' && currentUser.status !== 'approved') {
                await _supabase.auth.signOut();
                showToast('Sua conta está aguardando aprovação do administrador.', 'error');
                return;
            }
            window.location.href = 'index.html';

        } catch (error) {
            console.error(error);
            showToast('Erro ao fazer login.', 'error');
        }
    });
}

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
        e.preventDefault();
        currentUser = null;
        await _supabase.auth.signOut();
        window.location.href = 'login.html';
    });
}

// ─────────────────────────────────────────────
// HELPER: TROCAR VIEWS NA PÁGINA DE LOGIN
// ─────────────────────────────────────────────
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
}

document.getElementById('btn-show-register')?.addEventListener('click', async () => {
    if (typeof prepareRegisterForm === 'function') await prepareRegisterForm();
    showView('register-view');
});
document.getElementById('btn-back-login')?.addEventListener('click', () => {
    showView('login-view');
});

// ─────────────────────────────────────────────
// RECUPERAÇÃO DE SENHA (via Supabase)
// ─────────────────────────────────────────────
const RESET_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 horas

// Abrir modal
document.getElementById('link-forgot-password')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('modal-forgot-password').classList.add('active');
    document.getElementById('forgot-step-1').style.display = 'block';
    document.getElementById('forgot-step-2').style.display = 'none';
    document.getElementById('forgot-email').value = '';
});

// Fechar modal
document.getElementById('btn-close-forgot')?.addEventListener('click', () => {
    document.getElementById('modal-forgot-password').classList.remove('active');
});
document.getElementById('btn-close-forgot-success')?.addEventListener('click', () => {
    document.getElementById('modal-forgot-password').classList.remove('active');
});

// Enviar link de recuperação
document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim().toLowerCase();
    const btn   = document.getElementById('btn-send-recovery');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    try {
        // Verificar se o e-mail está cadastrado
        const { data: userExists } = await _supabase
            .from('users').select('email').eq('email', email).maybeSingle();

        if (!userExists) {
            showStep2(`Se o e-mail <strong>${email}</strong> estiver cadastrado, você receberá o link em instantes.`);
            return;
        }

        // Usar Supabase para enviar o e-mail de reset
        const redirectTo = `${window.location.origin}${window.location.pathname.replace(/login\.html$/, '')}reset-senha.html`;
        const { error } = await _supabase.auth.resetPasswordForEmail(email, { redirectTo });

        if (error) {
            showStep2(`
                Não foi possível enviar o e-mail automaticamente.<br><br>
                <strong>Entre em contato com o administrador do sistema.</strong>
            `);
        } else {
            showStep2(`Link de recuperação enviado para <strong>${email}</strong>! Verifique sua caixa de entrada e spam.`);
        }
    } catch (err) {
        console.error('Erro na recuperação de senha:', err);
        showToast('Erro ao processar solicitação. Tente novamente.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Link de Recuperação';
    }
});

function showStep2(msg) {
    document.getElementById('forgot-step-1').style.display = 'none';
    document.getElementById('forgot-step-2').style.display = 'block';
    document.getElementById('forgot-success-msg').innerHTML = msg;
}

// ─────────────────────────────────────────────
// MOSTRAR/OCULTAR SENHAS
// ─────────────────────────────────────────────
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('toggle-password')) {
        const targetId = e.target.getAttribute('data-target');
        if (targetId) {
            const input = document.getElementById(targetId);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    e.target.classList.remove('fa-eye');
                    e.target.classList.add('fa-eye-slash');
                } else {
                    input.type = 'password';
                    e.target.classList.remove('fa-eye-slash');
                    e.target.classList.add('fa-eye');
                }
            }
        }
    }
});
