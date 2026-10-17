// js/perfil.js
// Lógica exclusiva da página de Perfil do Usuário

window.initPerfilScreen = async function () {
    if (!currentUser) return;

    // Re-buscar do banco para trazer dados atualizados (ex: editados pelo admin via Funcionários)
    try {
        const freshUser = await db.users.get(currentUser.id);
        if (freshUser) {
            currentUser = freshUser;
        }
    } catch (e) {
        console.error('Erro ao atualizar dados do usuário:', e);
    }

    populateProfileView(currentUser);
    populateProfileForms(currentUser);
};

// ─────────────────────────────────────────────
// PREENCHER VISUALIZAÇÃO (LEITURA)
// ─────────────────────────────────────────────
function populateProfileView(user) {
    // Hero card
    const heroName   = document.getElementById('profile-hero-name');
    const heroEmail  = document.getElementById('profile-hero-email');
    const heroRole   = document.getElementById('profile-hero-role');
    const avatarEl   = document.getElementById('profile-avatar-initials');

    const initials = (user.name || 'U')
        .split(' ')
        .slice(0, 2)
        .map(w => w[0])
        .join('')
        .toUpperCase();

    if (avatarEl) avatarEl.textContent = initials;
    if (heroName)  heroName.textContent  = user.name  || '—';
    if (heroEmail) heroEmail.textContent = user.email || '—';

    if (heroRole) {
        const isAdmin = user.role === 'admin';
        heroRole.innerHTML = isAdmin
            ? '<i class="fa-solid fa-shield-halved"></i> Administrador'
            : '<i class="fa-solid fa-user"></i> Funcionário';
    }

    // Aplica cor do perfil no hero card
    const hero = document.getElementById('profile-hero');
    if (hero && user.profileColor) {
        // Manter gradiente usando a cor do perfil
        const hex = user.profileColor;
        const darker = shadeColor(hex, -20);
        hero.style.background = `linear-gradient(135deg, ${hex}, ${darker})`;
    }

    // Dados pessoais
    setText('info-name',      user.name      || '—');
    setText('info-email',     user.email     || '—');
    setText('info-cpf',       formatCpf(user.cpf)  || '—');
    setText('info-matricula', user.matricula  || '—');
    setText('info-phone',     user.phone      || '—');
    setText('info-role',      user.role === 'admin' ? 'Administrador' : 'Funcionário');

    // Contrato & Jornada
    const salary = user.baseSalary
        ? `R$ ${parseFloat(user.baseSalary).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : 'R$ 0,00';
    setText('info-salary', salary);

    const journeyMap = {
        '8h':    'Jornada 8 Horas',
        '7h20':  'Jornada 07:20 Horas Corridas',
        '4h':    'Jornada 4 Horas Corridas',
        'extra': 'Jornada Horas Extras Corridas'
    };
    const effectiveHourType = user.hourType || '8h';
    setText('info-journey-type', journeyMap[effectiveHourType] || effectiveHourType);
    setText('info-overtime',     (user.overtimeType || '50') + '%');

    // Data de Admissão
    let admText = '—';
    if (user.admissionDate) {
        const parts = user.admissionDate.split('-');
        if (parts.length === 3) {
            admText = `${parts[2]}/${parts[1]}/${parts[0]}`;
            const now = new Date();
            const adm = new Date(parts[0], parts[1] - 1, parts[2]);
            const diffMonths = Math.max(0, (now.getFullYear() - adm.getFullYear()) * 12 + (now.getMonth() - adm.getMonth()));
            const anos = Math.floor(diffMonths / 12);
            const meses = diffMonths % 12;
            let tempoStr = '';
            if (anos > 0) tempoStr += `${anos} ano${anos > 1 ? 's' : ''}`;
            if (meses > 0) tempoStr += `${tempoStr ? ' e ' : ''}${meses} m${meses > 1 ? 'eses' : 'ês'}`;
            if (tempoStr) admText += ` (${tempoStr})`;
        }
    }
    setText('info-admission-date', admText);

    // Horários da jornada
    setText('info-j-start',       user.journeyStart       || '08:00');
    setText('info-j-pause-start', user.journeyPauseStart  || '12:00');
    setText('info-j-pause-end',   user.journeyPauseEnd    || '13:00');
    setText('info-j-end',         user.journeyEnd         || '17:00');
}

// ─────────────────────────────────────────────
// PREENCHER FORMULÁRIOS (EDIÇÃO)
// ─────────────────────────────────────────────
function populateProfileForms(user) {
    const nameInput   = document.getElementById('profile-name');
    const phoneInput  = document.getElementById('profile-phone');
    const emailInput  = document.getElementById('profile-email');

    const salaryInput = document.getElementById('profile-salario');
    const journeyInput = document.getElementById('profile-journey');
    const otInput     = document.getElementById('profile-overtime-type');
    const admInput    = document.getElementById('profile-admission-date');
    const jStart      = document.getElementById('profile-journey-start');
    const jPauseStart = document.getElementById('profile-journey-pause-start');
    const jPauseEnd   = document.getElementById('profile-journey-pause-end');
    const jEnd        = document.getElementById('profile-journey-end');

    if (nameInput)   nameInput.value   = user.name      || '';
    if (phoneInput)  phoneInput.value  = user.phone     || '';
    if (emailInput)  emailInput.value  = user.email     || '';

    if (salaryInput)  salaryInput.value = user.baseSalary || '';
    if (journeyInput) journeyInput.value = user.hourType || '8h';
    if (otInput)      otInput.value     = user.overtimeType || '50';
    if (admInput)     admInput.value    = user.admissionDate || '';
    if (jStart)       jStart.value      = user.journeyStart || '08:00';
    if (jPauseStart)  jPauseStart.value = user.journeyPauseStart || '12:00';
    if (jPauseEnd)    jPauseEnd.value   = user.journeyPauseEnd || '13:00';
    if (jEnd)         jEnd.value        = user.journeyEnd || '17:00';
}

// ─────────────────────────────────────────────
// SALVAR DADOS DO PERFIL
// ─────────────────────────────────────────────
const profileForm = document.getElementById('profile-form');
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const name      = document.getElementById('profile-name').value.trim();
        const phone     = document.getElementById('profile-phone').value.trim();
        const email     = document.getElementById('profile-email').value.trim();
        
        const salary    = parseFloat(document.getElementById('profile-salario').value) || 0;
        const hourType  = document.getElementById('profile-journey').value;
        const overtimeType = document.getElementById('profile-overtime-type').value;
        const admissionDate = document.getElementById('profile-admission-date')?.value || null;
        const journeyStart = document.getElementById('profile-journey-start').value;
        const journeyPauseStart = document.getElementById('profile-journey-pause-start').value;
        const journeyPauseEnd = document.getElementById('profile-journey-pause-end').value;
        const journeyEnd = document.getElementById('profile-journey-end').value;

        if (!name || !email) {
            showToast('Nome e e-mail são obrigatórios.', 'error');
            return;
        }

        // Verificar se e-mail já está em uso por outro usuário
        try {
            const existingEmail = await db.users.where('email').equals(email).first();
            if (existingEmail && existingEmail.id !== currentUser.id) {
                showToast('Este e-mail já está em uso por outro cadastro.', 'error');
                return;
            }

            await db.users.update(currentUser.id, { 
                name, phone, email, 
                baseSalary: salary, 
                hourType, overtimeType, 
                journeyStart, journeyPauseStart, journeyPauseEnd, journeyEnd,
                admissionDate
            });

            // Atualiza currentUser em memória
            currentUser.name       = name;
            currentUser.phone      = phone;
            currentUser.email      = email;
            currentUser.baseSalary = salary;
            currentUser.hourType   = hourType;
            currentUser.overtimeType = overtimeType;
            currentUser.admissionDate = admissionDate;
            currentUser.journeyStart = journeyStart;
            currentUser.journeyPauseStart = journeyPauseStart;
            currentUser.journeyPauseEnd = journeyPauseEnd;
            currentUser.journeyEnd = journeyEnd;

            // Atualiza a sidebar e a view
            const sidebarName = document.getElementById('sidebar-user-name');
            if (sidebarName) sidebarName.textContent = name;

            populateProfileView(currentUser);

            showToast('Perfil atualizado com sucesso!', 'success');
        } catch (err) {
            console.error(err);
            showToast('Erro ao atualizar perfil.', 'error');
        }
    });
}

// ─────────────────────────────────────────────
// ALTERAR SENHA
// ─────────────────────────────────────────────
const changePasswordForm = document.getElementById('change-password-form');
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const current  = document.getElementById('profile-current-password').value;
        const newPass  = document.getElementById('profile-new-password').value;
        const confirm  = document.getElementById('profile-confirm-password').value;

        if (current !== currentUser.password) {
            showToast('Senha atual incorreta.', 'error');
            return;
        }
        if (!newPass || newPass.length < 4) {
            showToast('A nova senha deve ter pelo menos 4 caracteres.', 'error');
            return;
        }
        if (newPass !== confirm) {
            showToast('As senhas não coincidem.', 'error');
            return;
        }

        try {
            await db.users.update(currentUser.id, { password: newPass });
            currentUser.password = newPass;
            changePasswordForm.reset();
            showToast('Senha alterada com sucesso!', 'success');
        } catch (err) {
            console.error(err);
            showToast('Erro ao alterar senha.', 'error');
        }
    });
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatCpf(cpf) {
    if (!cpf) return '—';
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11) return cpf;
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Clarear/Escurecer cor hex
function shadeColor(color, percent) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);
    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);
    R = (R < 255) ? R : 255; G = (G < 255) ? G : 255; B = (B < 255) ? B : 255;
    R = (R > 0) ? R : 0;     G = (G > 0) ? G : 0;     B = (B > 0) ? B : 0;
    const RR = R.toString(16).padStart(2, '0');
    const GG = G.toString(16).padStart(2, '0');
    const BB = B.toString(16).padStart(2, '0');
    return `#${RR}${GG}${BB}`;
}
