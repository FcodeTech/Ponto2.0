// js/admin.js — Painel Administrativo Exclusivo

// ── GUARD: Somente administradores podem acessar ──────────────────────────────
// A verificação real ocorre após auth.js restaurar currentUser.
// Aqui garantimos que initDashboard chame initAdminPanel se estiver na página certa.

window.initAdminPanel = async function () {
    if (!currentUser) return;

    // Proteção de rota — redireciona funcionários
    if (currentUser.role !== 'admin') {
        showToast('Acesso restrito ao administrador.', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        return;
    }

    await renderAdminMetrics();
    await renderUsersTable();
    bindAdminSearch();
};

// ─────────────────────────────────────────────
// MÉTRICAS DE RESUMO
// ─────────────────────────────────────────────
async function renderAdminMetrics() {
    try {
        const users = await db.users.toArray();
        const allRecords = await db.timeRecords.toArray();

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const today = now.toISOString().split('T')[0];

        const totalUsers = users.length;
        const totalEmployees = users.filter(u => u.role !== 'admin').length;
        const recordsToday = allRecords.filter(r => r.date === today).length;
        const recordsMonth = allRecords.filter(r => r.month === currentMonth).length;

        // Horas totais no mês
        let totalMinutesMonth = 0;
        allRecords
            .filter(r => r.month === currentMonth)
            .forEach(r => { totalMinutesMonth += (r.calc?.workedMinutes || 0); });

        const hoursMonth = Math.floor(totalMinutesMonth / 60);
        const minsMonth  = totalMinutesMonth % 60;

        // Usuários ativos no mês (com pelo menos 1 registro)
        const activeUserIds = new Set(
            allRecords.filter(r => r.month === currentMonth).map(r => r.userId)
        );

        setMetric('adm-total-usuarios', totalUsers);
        setMetric('adm-total-funcionarios', totalEmployees);
        setMetric('adm-registros-hoje', recordsToday);
        setMetric('adm-registros-mes', recordsMonth);
        setMetric('adm-horas-mes', `${String(hoursMonth).padStart(2,'0')}:${String(minsMonth).padStart(2,'0')}`);
        setMetric('adm-usuarios-ativos', activeUserIds.size);

    } catch (e) {
        console.error('Erro ao calcular métricas do admin:', e);
    }
}

function setMetric(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ─────────────────────────────────────────────
// TABELA DE USUÁRIOS
// ─────────────────────────────────────────────
let allUsersData = [];

async function renderUsersTable(searchTerm = '') {
    try {
        const users = await db.users.toArray();
        const allRecords = await db.timeRecords.toArray();

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Enriquecer cada usuário com suas métricas
        allUsersData = users.map(u => {
            const userRecords = allRecords.filter(r => r.userId === u.id);
            const monthRecords = userRecords.filter(r => r.month === currentMonth);

            let totalMinutesMonth = 0;
            monthRecords.forEach(r => { totalMinutesMonth += (r.calc?.workedMinutes || 0); });

            const lastRecord = userRecords.sort((a, b) => b.date.localeCompare(a.date))[0];

            return {
                ...u,
                totalRecords: userRecords.length,
                monthRecords: monthRecords.length,
                totalMinutesMonth,
                lastDate: lastRecord ? lastRecord.date : null
            };
        });

        // Filtrar por busca
        const filtered = searchTerm
            ? allUsersData.filter(u =>
                u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (u.matricula || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (u.cpf || '').includes(searchTerm)
              )
            : allUsersData;

        const tbody = document.getElementById('admin-users-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 40px; color: var(--text-muted);">
                <i class="fa-solid fa-user-slash" style="font-size:1.5rem; display:block; margin-bottom:8px; opacity:0.4;"></i>
                Nenhum usuário encontrado.
            </td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        filtered.forEach(u => {
            const roleLabel = u.role === 'admin'
                ? '<span class="role-badge admin-badge"><i class="fa-solid fa-shield-halved"></i> Admin</span>'
                : '<span class="role-badge emp-badge"><i class="fa-solid fa-user"></i> Funcionário</span>';

            let statusLabel = '';
            if (u.status === 'pending') {
                statusLabel = '<span class="role-badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3);"><i class="fa-solid fa-hourglass-half"></i> Pendente</span>';
            } else if (u.status === 'rejected') {
                statusLabel = '<span class="role-badge" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3);"><i class="fa-solid fa-xmark"></i> Rejeitado</span>';
            } else {
                statusLabel = '<span class="role-badge" style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3);"><i class="fa-solid fa-check"></i> Aprovado</span>';
            }

            const color = u.profileColor || '#0066cc';
            const initials = u.name ? u.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : '?';

            const hM = Math.floor(u.totalMinutesMonth / 60);
            const mM = u.totalMinutesMonth % 60;
            const horasStr = `${String(hM).padStart(2,'0')}:${String(mM).padStart(2,'0')}`;

            const lastDateStr = u.lastDate
                ? u.lastDate.split('-').reverse().join('/')
                : '<span style="color:var(--text-muted);">—</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="adm-avatar" style="background-color:${color};">${initials}</div>
                        <div>
                            <div style="font-weight:600;">${u.name}</div>
                            <div style="font-size:0.78rem; color:var(--text-muted);">${u.email || ''}</div>
                        </div>
                    </div>
                </td>
                <td>${u.matricula || '—'}</td>
                <td>${u.cpf || '—'}</td>
                <td>${roleLabel}</td>
                <td style="text-align:center;">${statusLabel}</td>
                <td style="text-align:center; font-weight:600;">${u.totalRecords}</td>
                <td style="text-align:center; font-weight:600; color:var(--primary-color);">${horasStr}</td>
                <td style="text-align:center;">${lastDateStr}</td>
                <td style="text-align:center;">
                    <div style="display:flex; justify-content:center; gap:5px;">
                        ${u.status === 'pending' ? `
                            <button class="btn btn-success adm-action-btn" style="padding:5px 10px; font-size:0.82rem; background-color:#10b981; border-color:#10b981;" title="Aprovar Usuário" onclick="window.approveUser('${u.id}')">
                                <i class="fa-solid fa-check"></i>
                            </button>
                            <button class="btn btn-warning adm-action-btn" style="padding:5px 10px; font-size:0.82rem; background-color:#f59e0b; border-color:#f59e0b;" title="Rejeitar Usuário" onclick="window.rejectUser('${u.id}')">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        ` : ''}
                        <a href="relatorios.html?userId=${u.id}" class="btn btn-primary adm-action-btn" style="padding:5px 10px; font-size:0.82rem;" title="Ver Relatório do Usuário">
                            <i class="fa-solid fa-file-invoice"></i>
                        </a>
                        <button class="btn btn-info adm-action-btn" style="padding:5px 10px; font-size:0.82rem;" title="Editar Usuário" onclick="window.openEditUserModal('${u.id}')">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-danger adm-action-btn" style="padding:5px 10px; font-size:0.82rem;" title="Remover Usuário" onclick="window.deleteUser('${u.id}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Contador de resultados
        const countEl = document.getElementById('adm-users-count');
        if (countEl) countEl.textContent = `${filtered.length} usuário${filtered.length !== 1 ? 's' : ''}`;

    } catch (e) {
        console.error('Erro ao renderizar tabela de usuários:', e);
    }
}

// ─────────────────────────────────────────────
// APROVAR / REJEITAR USUÁRIOS
// ─────────────────────────────────────────────
window.approveUser = async function(userId) {
    if (confirm('Deseja realmente aprovar este usuário? Ele terá acesso ao sistema.')) {
        try {
            await db.users.update(userId, { status: 'approved' });
            showToast('Usuário aprovado com sucesso!', 'success');
            await renderUsersTable();
        } catch(e) {
            console.error(e);
            showToast('Erro ao aprovar usuário.', 'error');
        }
    }
};

window.rejectUser = async function(userId) {
    if (confirm('Deseja rejeitar este usuário? Ele NÃO terá acesso ao sistema.')) {
        try {
            await db.users.update(userId, { status: 'rejected' });
            showToast('Usuário rejeitado com sucesso!', 'success');
            await renderUsersTable();
        } catch(e) {
            console.error(e);
            showToast('Erro ao rejeitar usuário.', 'error');
        }
    }
};

// ─────────────────────────────────────────────
// BUSCA AO VIVO
// ─────────────────────────────────────────────
function bindAdminSearch() {
    const searchInput = document.getElementById('adm-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderUsersTable(searchInput.value.trim());
        });
    }
}

// ─────────────────────────────────────────────
// SUPORTE A ?userId= na URL (relatorios.html)
// ─────────────────────────────────────────────
// Roda em relatorios.html quando há parâmetro userId na URL.
// Pré-seleciona o funcionário no select de filtro após loadReportsData popular o select.
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    if (userId && document.getElementById('filter-employee')) {
        const origLoad = window.loadReportsData;
        window.loadReportsData = async function() {
            await origLoad();
            const sel = document.getElementById('filter-employee');
            if (sel) {
                sel.value = userId;
                // Acionar filtro
                const btnApply = document.getElementById('btn-apply-filters');
                if (btnApply) btnApply.click();
            }
        };
    }
});

// ─────────────────────────────────────────────
// EDITAR E REMOVER USUÁRIO
// ─────────────────────────────────────────────

window.openEditUserModal = async function(userId) {
    try {
        const user = await db.users.get(userId);
        if (!user) {
            showToast('Usuário não encontrado.', 'error');
            return;
        }
        
        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('edit-user-name').value = user.name;
        document.getElementById('edit-user-email').value = user.email || '';
        document.getElementById('edit-user-matricula').value = user.matricula || '';
        document.getElementById('edit-user-cpf').value = user.cpf || '';
        document.getElementById('edit-user-role').value = user.role;
        
        const pwdInput = document.getElementById('edit-user-password');
        if (pwdInput) pwdInput.value = '';

        
        document.getElementById('modal-edit-user').classList.add('active');
    } catch (e) {
        console.error('Erro ao buscar usuário para edição:', e);
        showToast('Erro ao carregar dados do usuário.', 'error');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Fechar modal de edição
    const btnCloseEditUser = document.getElementById('btn-close-edit-user');
    if (btnCloseEditUser) {
        btnCloseEditUser.addEventListener('click', () => {
            document.getElementById('modal-edit-user').classList.remove('active');
        });
    }

    // Salvar edição
    const formEditUser = document.getElementById('form-edit-user');
    if (formEditUser) {
        formEditUser.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-user-id').value;
            const name = document.getElementById('edit-user-name').value.trim();
            const email = document.getElementById('edit-user-email').value.trim();
            const matricula = document.getElementById('edit-user-matricula').value.trim();
            const cpf = document.getElementById('edit-user-cpf').value.trim();
            const role = document.getElementById('edit-user-role').value;
            
            const pwdInput = document.getElementById('edit-user-password');
            const newPassword = pwdInput ? pwdInput.value.trim() : '';

            try {
                const updateData = { name, email, matricula, cpf, role };
                if (newPassword) {
                    updateData.password = newPassword;
                }
                
                await db.users.update(id, updateData);
                showToast('Usuário atualizado com sucesso!', 'success');
                document.getElementById('modal-edit-user').classList.remove('active');
                await renderAdminMetrics();
                
                const searchInput = document.getElementById('adm-search');
                await renderUsersTable(searchInput ? searchInput.value.trim() : '');
            } catch (err) {
                console.error('Erro ao atualizar usuário:', err);
                showToast('Erro ao atualizar usuário.', 'error');
            }
        });
    }
});

window.deleteUser = async function(userId) {
    if (!confirm('Tem certeza que deseja excluir este usuário? Todos os registros de ponto vinculados a ele serão perdidos. Esta ação não pode ser desfeita.')) {
        return;
    }

    // Proteção para não excluir a si mesmo acidentalmente
    if (window.currentUser && window.currentUser.id === userId) {
        showToast('Você não pode excluir sua própria conta por aqui.', 'warning');
        return;
    }

    try {
        // Remover registros de ponto associados
        const recordsToDelete = await db.timeRecords.where('userId').equals(userId).toArray();
        if (recordsToDelete.length > 0) {
            await db.timeRecords.bulkDelete(recordsToDelete.map(r => r.id));
        }

        await db.users.delete(userId);

        showToast('Usuário excluído com sucesso!', 'success');
        await renderAdminMetrics();

        const searchInput = document.getElementById('adm-search');
        await renderUsersTable(searchInput ? searchInput.value.trim() : '');
    } catch (e) {
        console.error('Erro ao excluir usuário:', e);
        showToast('Erro ao excluir usuário.', 'error');
    }
};
