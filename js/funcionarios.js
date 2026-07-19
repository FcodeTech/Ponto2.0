// js/funcionarios.js

let currentEmployees = [];
let editingEmployeeId = null;

window.initEmployeesScreen = function() {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    // Somente administradores podem acessar a tela de funcionários
    if (currentUser.role !== 'admin') {
        showToast('Acesso restrito ao administrador.', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        return;
    }
    loadEmployees();

    // Event Listeners for switching views
    const btnNew = document.getElementById('btn-new-employee');
    const btnBack = document.getElementById('btn-back-list');
    const form = document.getElementById('employee-form');
    
    if (btnNew) {
        btnNew.addEventListener('click', () => {
            editingEmployeeId = null;
            document.getElementById('form-employee-title').textContent = 'Adicionar Funcionário';
            if (form) form.reset();
            
            // Habilita o email novamente para novo funcionário
            const emailInput = document.getElementById('emp-email');
            if (emailInput) {
                emailInput.removeAttribute('disabled');
                emailInput.removeAttribute('readonly');
            }

            // Habilita senha como obrigatória
            const pwdInput = document.getElementById('emp-password');
            if (pwdInput) {
                pwdInput.placeholder = 'Mínimo 6 caracteres (obrigatório)';
            }

            // Set defaults
            document.getElementById('emp-color').value = '#0066cc';
            updateColorSelector('#0066cc');
            
            showFormView();
        });
    }

    if (btnBack) {
        btnBack.addEventListener('click', (e) => {
            e.preventDefault();
            showListView();
        });
    }

    // Color Selector
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(opt => {
        opt.addEventListener('click', (e) => {
            const color = e.target.getAttribute('data-color');
            document.getElementById('emp-color').value = color;
            updateColorSelector(color);
        });
    });

    // Form Submit
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveEmployee();
        });
    }

    // Event delegation para botões de editar e excluir na tabela
    const tbody = document.getElementById('employees-table-body');
    if (tbody) {
        tbody.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('[data-action="edit"]');
            const deleteBtn = e.target.closest('[data-action="delete"]');

            if (editBtn) {
                const id = editBtn.getAttribute('data-id');
                await editEmployee(id);
            } else if (deleteBtn) {
                const id = deleteBtn.getAttribute('data-id');
                await deleteEmployee(id);
            }
        });
    }
}

function showFormView() {
    document.getElementById('employee-list-container').classList.add('hidden');
    document.getElementById('employee-form-container').classList.add('active');
}

function showListView() {
    document.getElementById('employee-list-container').classList.remove('hidden');
    document.getElementById('employee-form-container').classList.remove('active');
}

function updateColorSelector(color) {
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(opt => {
        if (opt.getAttribute('data-color') === color) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
}

async function loadEmployees() {
    try {
        currentEmployees = await db.users.toArray();
        const tbody = document.getElementById('employees-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (currentEmployees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum funcionário encontrado.</td></tr>';
            return;
        }

        currentEmployees.forEach(emp => {
            const tr = document.createElement('tr');
            
            // Badge color for name
            const color = emp.profileColor || '#0066cc';
            const roleBadge = emp.role === 'admin'
                ? '<span style="background: #dc3545; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em;">Admin</span>'
                : 'Funcionário';
            
            // Usa data-id para evitar problema com UUIDs em onclick inline
            tr.innerHTML = `
                <td data-label="Matrícula">${emp.matricula || '-'}</td>
                <td data-label="Nome">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 15px; height: 15px; border-radius: 50%; background-color: ${color};"></div>
                        <span>${emp.name}</span>
                    </div>
                </td>
                <td data-label="Cargo">${roleBadge}</td>
                <td data-label="Jornada">${emp.hourType || '8h'}</td>
                <td data-label="Ações">
                    <button class="btn btn-primary" style="padding: 5px 10px;" data-action="edit" data-id="${emp.id}" title="Editar funcionário">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-danger" style="padding: 5px 10px; margin-left: 5px;" data-action="delete" data-id="${emp.id}" title="Excluir funcionário">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (e) {
        console.error('Erro ao carregar funcionários:', e);
        showToast('Erro ao carregar lista de funcionários.', 'error');
    }
}

async function editEmployee(id) {
    try {
        const emp = await db.users.get(id);
        if (!emp) {
            showToast('Funcionário não encontrado.', 'error');
            return;
        }
        
        editingEmployeeId = id;
        document.getElementById('form-employee-title').textContent = 'Editar Funcionário';
        
        document.getElementById('emp-name').value = emp.name || '';

        // E-mail: exibir mas não permitir edição (está vinculado ao Auth do Supabase)
        const emailInput = document.getElementById('emp-email');
        emailInput.value = emp.email || '';
        emailInput.setAttribute('disabled', 'disabled');

        document.getElementById('emp-cpf').value = emp.cpf || '';
        document.getElementById('emp-matricula').value = emp.matricula || '';

        // Senha: opcional na edição — deixar em branco para manter a atual
        const pwdInput = document.getElementById('emp-password');
        pwdInput.value = '';
        pwdInput.placeholder = 'Deixe em branco para manter a senha atual';

        document.getElementById('emp-role').value = emp.role || 'employee';
        
        document.getElementById('emp-salary').value = emp.baseSalary || '';
        const journeyInput = document.getElementById('emp-journey');
        if (journeyInput) journeyInput.value = emp.hourType || '8h';
        const otInput = document.getElementById('emp-overtime-type');
        if (otInput) otInput.value = emp.overtimeType || '50';
        
        document.getElementById('emp-journey-start').value = emp.journeyStart || '08:00';
        document.getElementById('emp-journey-pause-start').value = emp.journeyPauseStart || '12:00';
        document.getElementById('emp-journey-pause-end').value = emp.journeyPauseEnd || '13:00';
        document.getElementById('emp-journey-end').value = emp.journeyEnd || '17:00';
        
        const color = emp.profileColor || '#0066cc';
        document.getElementById('emp-color').value = color;
        updateColorSelector(color);
        
        showFormView();
    } catch (e) {
        console.error('Erro ao carregar dados do funcionário:', e);
        showToast('Erro ao carregar dados do funcionário.', 'error');
    }
}

async function saveEmployee() {
    const journeyEl = document.getElementById('emp-journey');
    const otEl = document.getElementById('emp-overtime-type');
    const pwdInput = document.getElementById('emp-password');
    const emailInput = document.getElementById('emp-email');

    const data = {
        name:             document.getElementById('emp-name').value.trim(),
        email:            emailInput.value.trim(),
        cpf:              document.getElementById('emp-cpf').value.trim(),
        matricula:        document.getElementById('emp-matricula').value.trim(),
        password:         pwdInput ? pwdInput.value : '',
        role:             document.getElementById('emp-role').value,
        baseSalary:       parseFloat(document.getElementById('emp-salary').value) || 0,
        hourType:         journeyEl ? journeyEl.value : '8h',
        overtimeType:     otEl ? otEl.value : '50',
        journeyStart:     document.getElementById('emp-journey-start').value,
        journeyPauseStart:document.getElementById('emp-journey-pause-start').value,
        journeyPauseEnd:  document.getElementById('emp-journey-pause-end').value,
        journeyEnd:       document.getElementById('emp-journey-end').value,
        profileColor:     document.getElementById('emp-color').value
    };

    if (!data.name) {
        showToast('O nome do funcionário é obrigatório.', 'error');
        return;
    }

    try {
        if (editingEmployeeId) {
            // ── ATUALIZAR FUNCIONÁRIO ────────────────────────────────────────

            // Atualizar senha somente se uma nova foi informada
            if (data.password && data.password.trim() !== '') {
                if (data.password.length < 6) {
                    showToast('A senha deve ter no mínimo 6 caracteres.', 'error');
                    return;
                }
                const { error: rpcError } = await _supabase.rpc('admin_update_user_password', {
                    target_user_id: editingEmployeeId,
                    new_password: data.password.trim()
                });
                if (rpcError) {
                    console.error('Erro RPC senha:', rpcError);
                    showToast('Erro ao atualizar a senha: ' + (rpcError.message || rpcError), 'error');
                    return;
                }
            }
            
            // Não salvar senha em texto claro na tabela public
            delete data.password;
            // Email não é editável (gerenciado pelo Supabase Auth)
            delete data.email;
            
            await db.users.update(editingEmployeeId, data);
            showToast('Funcionário atualizado com sucesso!', 'success');

        } else {
            // ── CRIAR NOVO FUNCIONÁRIO ───────────────────────────────────────

            if (!data.email) {
                showToast('O e-mail é obrigatório.', 'error');
                return;
            }
            if (!data.password || data.password.length < 6) {
                showToast('A senha é obrigatória e deve ter no mínimo 6 caracteres.', 'error');
                return;
            }
            if (!data.cpf) {
                showToast('O CPF é obrigatório.', 'error');
                return;
            }

            // Verificar e-mail duplicado
            const existingEmail = await db.users.where('email').equals(data.email).first();
            if (existingEmail) {
                showToast('E-mail já cadastrado.', 'error');
                return;
            }
            // Verificar CPF duplicado
            const existingCpf = await db.users.where('cpf').equals(data.cpf).first();
            if (existingCpf) {
                showToast('CPF já cadastrado.', 'error');
                return;
            }
            
            // Criar o usuário no Supabase Auth usando um cliente temporário
            // para não sobrescrever a sessão atual do Administrador
            const tempClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });
            
            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: data.email,
                password: data.password
            });
            
            if (authError) {
                showToast(authError.message || 'Erro ao criar autenticação do funcionário.', 'error');
                return;
            }

            if (!authData.user) {
                showToast('Erro ao obter dados do usuário criado. Verifique o e-mail informado.', 'error');
                return;
            }
            
            // Atribuir o ID gerado pelo Supabase Auth ao perfil
            data.id = authData.user.id;
            data.status = 'approved'; // Funcionários criados pelo admin já nascem aprovados
            
            // Não salvar senha em texto claro na tabela public
            delete data.password;
            
            await db.users.add(data);
            showToast('Funcionário cadastrado com sucesso!', 'success');
        }
        
        showListView();
        await loadEmployees();

    } catch (e) {
        console.error('Erro ao salvar funcionário:', e);
        const msg = e?.message || 'Erro desconhecido ao salvar funcionário.';
        showToast(msg, 'error');
    }
}

async function deleteEmployee(id) {
    if (id === currentUser.id) {
        showToast('Você não pode excluir a si mesmo.', 'warning');
        return;
    }

    // Localiza o nome do funcionário para exibir na confirmação
    const emp = currentEmployees.find(e => e.id === id);
    const name = emp ? emp.name : 'este funcionário';
    
    if (confirm(`Tem certeza que deseja excluir "${name}"?\n\nOs registros de ponto associados ficarão sem identificação no painel, mas não serão apagados.`)) {
        try {
            await db.users.delete(id);
            showToast('Funcionário excluído com sucesso.', 'success');
            await loadEmployees();
        } catch (e) {
            console.error('Erro ao excluir funcionário:', e);
            const msg = e?.message || 'Erro ao excluir funcionário.';
            showToast(msg, 'error');
        }
    }
}

// Expor globalmente para compatibilidade com outros módulos se necessário
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;
