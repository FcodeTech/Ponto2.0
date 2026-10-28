// js/reports.js

let currentReportData = [];
let currentPage = 1;
const rowsPerPage = 10;
let userMap = {};

// Load data specifically for the Reports tab
window.loadReportsData = async function() {
    if (!currentUser) return;

    // Load users for filter
    try {
        const select = document.getElementById('filter-employee');
        const filterEmployeeGroup = document.getElementById('filter-employee-group');
        userMap = {};

        if (currentUser.role === 'admin') {
            // Admin: popula o select com todos os usuários
            const users = await db.users.toArray();
            select.innerHTML = '<option value="all">Todos</option>';
            users.forEach(u => {
                userMap[u.id] = u;
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = `${u.name} (Mat: ${u.matricula})`;
                select.appendChild(opt);
            });
            if (filterEmployeeGroup) filterEmployeeGroup.style.display = '';
        } else {
            // Funcionário: carrega apenas seu próprio dado no userMap e oculta o select
            userMap[currentUser.id] = currentUser;
            if (filterEmployeeGroup) filterEmployeeGroup.style.display = 'none';
        }
        
        // Restaurar filtros salvos do Supabase
        const settings = await db.settings.get('global') || {};
        const filters = settings.filters || {};
        
        const savedEmp   = currentUser.role === 'admin' ? filters.relFilterEmployee : null;
        const savedMonth = filters.relFilterMonth;
        const savedStart = filters.relFilterStart;
        const savedEnd   = filters.relFilterEnd;

        const filterEmployee  = document.getElementById('filter-employee');
        const filterMonth     = document.getElementById('filter-month');
        const filterDateStart = document.getElementById('filter-date-start');
        const filterDateEnd   = document.getElementById('filter-date-end');

        if (savedEmp)   filterEmployee.value  = savedEmp;
        if (savedStart) filterDateStart.value = savedStart;
        if (savedEnd)   filterDateEnd.value   = savedEnd;

        if (savedMonth) {
            filterMonth.value = savedMonth;
        } else if (!filterMonth.value) {
            const now = new Date();
            filterMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        
        await applyReportFilters();
        
    } catch (e) {
        console.error('Error loading reports initialization', e);
    }
};

const btnApplyFilters = document.getElementById('btn-apply-filters');
if (btnApplyFilters) {
    btnApplyFilters.addEventListener('click', async () => {
        // Salvar filtros no banco antes de aplicar
        const emp   = document.getElementById('filter-employee')?.value;
        const month = document.getElementById('filter-month')?.value;
        const start = document.getElementById('filter-date-start')?.value;
        const end   = document.getElementById('filter-date-end')?.value;

        try {
            const settings = await db.settings.get('global') || {};
            const filters = settings.filters || {};
            if (emp   != null) filters.relFilterEmployee = emp;
            if (month != null) filters.relFilterMonth    = month;
            if (start != null) filters.relFilterStart    = start;
            if (end   != null) filters.relFilterEnd      = end;
            await db.settings.update('global', { filters });
        } catch(e) { console.error('Erro ao salvar filtros', e); }

        applyReportFilters();
    });
}


async function applyReportFilters() {
    const month = document.getElementById('filter-month').value;
    const dateStart = document.getElementById('filter-date-start').value;
    const dateEnd = document.getElementById('filter-date-end').value;
    
    // Controle de acesso: funcionário só vê seus próprios dados
    let employeeId;
    if (currentUser.role === 'admin') {
        employeeId = document.getElementById('filter-employee').value;
    } else {
        employeeId = currentUser.id.toString();
    }

    try {
        let query = db.timeRecords.toCollection();

        if (employeeId !== 'all') {
            query = db.timeRecords.where('userId').equals(employeeId);
        }

        let records = await query.toArray();

        // Apply manual filters
        if (dateStart && dateEnd) {
            records = records.filter(r => r.date >= dateStart && r.date <= dateEnd);
        } else if (month) {
            records = records.filter(r => r.month === month);
        }

        // Sort descending by date
        records.sort((a,b) => new Date(b.date) - new Date(a.date));
        
        currentReportData = records;
        currentPage = 1;
        renderReportsTable();
        await updateReportTotals();

    } catch (e) {
        console.error('Error filtering reports', e);
        showToast('Erro ao filtrar relatórios.', 'error');
    }
}

function renderReportsTable() {
    const tbody = document.getElementById('reports-table-body');
    const pagination = document.getElementById('reports-pagination');
    if(!tbody) return;

    tbody.innerHTML = '';
    
    if (currentReportData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Nenhum registro encontrado.</td></tr>';
        pagination.innerHTML = '';
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedItems = currentReportData.slice(startIndex, endIndex);

    paginatedItems.forEach(r => {
        const user = userMap[r.userId] || { name: 'Desconhecido' };
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.name}</td>
            <td>${r.date.split('-').reverse().join('/')}</td>
            <td>${r.entrada || '--:--'}</td>
            <td>${r.pausa || '--:--'}</td>
            <td>${r.retorno || '--:--'}</td>
            <td>${r.saida || '--:--'}</td>
            <td>${r.calc.horasTrab}</td>
            <td>${r.calc.horasExtra50}</td>
            <td>${r.calc.horasExtra100}</td>
            <td style="text-align: center;">
                <button class="btn-icon text-primary btn-edit-record" data-id="${r.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon text-danger btn-delete-record" data-id="${r.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination(currentReportData.length);
}

function renderPagination(totalItems) {
    const pagination = document.getElementById('reports-pagination');
    if(!pagination) return;
    pagination.innerHTML = '';
    
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    if(totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => {
            currentPage = i;
            renderReportsTable();
        });
        pagination.appendChild(btn);
    }
}

async function updateReportTotals() {
    let totalWorked = 0;
    let totalE50 = 0;
    let totalE100 = 0;
    let totalMoney = 0;
    let totalNoturnoMinutes = 0;

    const settings = (await db.settings.get('global')) || {};
    const isNoturnoActive = !!settings.noturnoCalculation;
    const isInssActive = !!settings.inssCalculation;
    const isIrrfActive = !!settings.irrfCalculation;
    const isFgtsActive = !!settings.fgtsCalculation;
    const isDecimoActive = !!settings.decimoTerceiroCalculation;

    currentReportData.forEach(r => {
        const user = userMap[r.userId];
        const baseSalary = user ? (user.baseSalary || 0) : 0;
        const valorHora = baseSalary / 220;
        
        totalWorked            += r.calc.workedMinutes;
        totalE50               += r.calc.extra50;
        totalE100              += r.calc.extra100;
        totalNoturnoMinutes    += r.calc.minutosNoturnos || 0;
        
        const moneyE50     = (valorHora * 1.5)  * (r.calc.extra50  / 60);
        const moneyE100    = (valorHora * 2)    * (r.calc.extra100 / 60);
        const moneyNoturno = isNoturnoActive ? ((valorHora * 0.20) * ((r.calc.minutosNoturnos || 0) / 60)) : 0;
        
        totalMoney += moneyE50 + moneyE100 + moneyNoturno;
    });

    const filterEmployeeVal = document.getElementById('filter-employee')?.value;
    let targetUserId = null;
    if (currentUser.role !== 'admin') {
        targetUserId = currentUser.id;
    } else if (filterEmployeeVal && filterEmployeeVal !== 'all') {
        targetUserId = filterEmployeeVal;
    }
    
    const singleEmployeeMode = (targetUserId !== null);

    // Atualizar dados de cadastro na tela do relatório
    const infoPanel = document.getElementById('rel-employee-info');
    if (infoPanel) {
        if (singleEmployeeMode) {
            const u = userMap[targetUserId] || currentUser;
            let cargoStr = u.role === 'admin' ? 'Administrador' : (u.role || 'Funcionário');
            let jornadaStr = u.hourType === 'horista' ? 'Horista' : 'Mensalista';
            if (u.journeyStart && u.journeyEnd) {
                jornadaStr = `${u.journeyStart} às ${u.journeyEnd}`;
            }

            const valorHora    = (u.baseSalary || 0) / 220;
            const valorNoturno = (valorHora * 0.20) * (totalNoturnoMinutes / 60);

            infoPanel.innerHTML = `
                <div class="panel-body" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; padding: 15px;">
                    <div><strong>Funcionário:</strong> ${u.name || '-'}</div>
                    <div><strong>Matrícula:</strong> ${u.matricula || '-'}</div>
                    <div><strong>CPF:</strong> ${u.cpf || '-'}</div>
                    <div><strong>Cargo:</strong> ${cargoStr}</div>
                    <div><strong>Jornada:</strong> ${jornadaStr}</div>
                    <div><strong>Salário Base:</strong> ${formatCurrency(u.baseSalary || 0)}</div>
                    ${(isNoturnoActive && totalNoturnoMinutes > 0) ? `<div style="color: var(--purple-color, #6f42c1);"><strong>⬛ Adic. Noturno:</strong> ${formatCurrency(valorNoturno)} <small>(${minutesToTime(totalNoturnoMinutes)} noturnas)</small></div>` : ''}
                </div>
            `;
            infoPanel.style.display = 'block';
        } else {
            infoPanel.style.display = 'none';
        }
    }

    if (singleEmployeeMode && currentReportData.length > 0) {
        const u = userMap[targetUserId] || currentUser;
        const valorHora    = (u.baseSalary || 0) / 220;
        const valorNoturno = (valorHora * 0.20) * (totalNoturnoMinutes / 60);
        totalMoney += (u.baseSalary || 0);
        // valorNoturno já foi acumulado no loop acima
        _ = valorNoturno; // referência para evitar lint
    }

    // Remuneração bruta do mês antes dos descontos
    const salarioBrutoReport = totalMoney;

    // Check se INSS está ativo (settings já lido acima)
    let inssDiscount = 0;
    const relCardInss    = document.getElementById('rel-card-inss');
    const relTotInss     = document.getElementById('rel-tot-inss');
    const relSalarioBruto = document.getElementById('rel-salario-bruto');
    const relInssNoturno = document.getElementById('rel-inss-noturno');
    
    const inssOficial = (typeof window.calculateINSS === 'function')
        ? window.calculateINSS(salarioBrutoReport)
        : 0;

    if (isInssActive && singleEmployeeMode && currentReportData.length > 0) {
        inssDiscount = inssOficial;
        if (relSalarioBruto) relSalarioBruto.textContent = formatCurrency(salarioBrutoReport);
        totalMoney -= inssDiscount;
        if (relCardInss) relCardInss.style.display = 'flex';
        if (relTotInss) relTotInss.textContent = `- ${formatCurrency(inssDiscount)}`;
        if (relInssNoturno) {
            const u = userMap[targetUserId] || currentUser;
            const valorHora    = (u.baseSalary || 0) / 220;
            const valorNoturno = isNoturnoActive ? ((valorHora * 0.20) * (totalNoturnoMinutes / 60)) : 0;
            relInssNoturno.style.display = (isNoturnoActive && totalNoturnoMinutes > 0) ? 'block' : 'none';
            relInssNoturno.innerHTML = `Adic. Noturno incl.: <strong>${formatCurrency(valorNoturno)}</strong>`;
        }
    } else {
        if (relCardInss) relCardInss.style.display = 'none';
        if (relInssNoturno) relInssNoturno.style.display = 'none';
    }

    // Check se IRRF está ativo
    let irrfDiscount = 0;
    const relCardIrrf = document.getElementById('rel-card-irrf');
    const relTotIrrf = document.getElementById('rel-tot-irrf');
    const relIrrfBruto = document.getElementById('rel-irrf-bruto');
    const relIrrfRegra = document.getElementById('rel-irrf-regra');

    if (isIrrfActive && singleEmployeeMode && currentReportData.length > 0) {
        const irrfInfo = (typeof window.calculateIRRF === 'function')
            ? window.calculateIRRF(salarioBrutoReport, inssOficial)
            : { valor: 0, isIsento: true, reducao2026: 0, baseCalculo: salarioBrutoReport };
        irrfDiscount = irrfInfo.valor;
        totalMoney -= irrfDiscount;
        if (relCardIrrf) relCardIrrf.style.display = 'flex';
        if (relTotIrrf) {
            if (irrfDiscount > 0) {
                relTotIrrf.textContent = `- ${formatCurrency(irrfDiscount)}`;
                relTotIrrf.style.color = '#e11d48';
            } else {
                relTotIrrf.textContent = 'R$ 0,00';
                relTotIrrf.style.color = '#10b981';
            }
        }
        if (relIrrfBruto) {
            if (irrfInfo.isIsento) {
                relIrrfBruto.textContent = formatCurrency(irrfInfo.salarioBruto);
            } else {
                relIrrfBruto.textContent = `${formatCurrency(irrfInfo.baseCalculo)} (${irrfInfo.tipoDeducao})`;
            }
        }
        if (relIrrfRegra) {
            if (irrfInfo.isIsento) {
                relIrrfRegra.textContent = 'Isento até R$ 5.000 (Lei 15.270/26)';
            } else if (irrfInfo.reducao2026 > 0) {
                relIrrfRegra.textContent = `Alíq. ${irrfInfo.aliquotaEfetiva}% (Redução 2026: - ${formatCurrency(irrfInfo.reducao2026)})`;
            } else {
                relIrrfRegra.textContent = `Alíq. ${irrfInfo.aliquotaNominal}%`;
            }
        }
    } else {
        if (relCardIrrf) relCardIrrf.style.display = 'none';
    }

    // Check se FGTS está ativo
    const relCardFgts   = document.getElementById('rel-card-fgts');
    const relTotFgts    = document.getElementById('rel-tot-fgts');
    const relFgtsBruto  = document.getElementById('rel-fgts-bruto');

    if (isFgtsActive && singleEmployeeMode && currentReportData.length > 0) {
        const fgtsValor = (typeof window.calculateFGTS === 'function')
            ? window.calculateFGTS(salarioBrutoReport)
            : Number((salarioBrutoReport * 0.08).toFixed(2));
        if (relCardFgts)  relCardFgts.style.display = 'flex';
        if (relTotFgts)   relTotFgts.textContent = formatCurrency(fgtsValor);
        if (relFgtsBruto) relFgtsBruto.textContent = formatCurrency(salarioBrutoReport);
    } else {
        if (relCardFgts) relCardFgts.style.display = 'none';
    }

    // Check se 13º Salário está ativo
    const relCard13    = document.getElementById('rel-card-13');
    const relTot13     = document.getElementById('rel-tot-13');
    const rel13Avos    = document.getElementById('rel-13-avos');
    const rel13Detalhe = document.getElementById('rel-13-detalhe');

    if (isDecimoActive && singleEmployeeMode && currentReportData.length > 0) {
        const u = userMap[targetUserId] || currentUser;
        const filterMonth = document.getElementById('filter-month')?.value;
        const decimoInfo = (typeof window.calculateDecimoTerceiro === 'function')
            ? window.calculateDecimoTerceiro(u.baseSalary || 0, u.admissionDate, filterMonth)
            : { avos: 0, valor: 0, admissaoFormatada: '—' };
        if (relCard13) relCard13.style.display = 'flex';
        if (relTot13)  relTot13.textContent = formatCurrency(decimoInfo.valor);
        if (rel13Avos) rel13Avos.textContent = `${decimoInfo.avos}/12`;
        if (rel13Detalhe) {
            if (decimoInfo.isCompetenciaIntegral) {
                rel13Detalhe.textContent = `Integral (12/12) • 1ª: ${formatCurrency(decimoInfo.primeiraParcela)} • 2ª líq: ${formatCurrency(decimoInfo.segundaParcela)}`;
            } else {
                rel13Detalhe.textContent = `Provisão até o mês • Prev. anual: ${formatCurrency(decimoInfo.valorIntegralAno)} (1ª: ${formatCurrency(decimoInfo.primeiraParcela)} • 2ª líq: ${formatCurrency(decimoInfo.segundaParcela)})`;
            }
        }
    } else {
        if (relCard13) relCard13.style.display = 'none';
    }

    document.getElementById('rel-tot-horas').textContent = minutesToTime(totalWorked);
    const elExtra50 = document.getElementById('rel-tot-extras-50');
    if (elExtra50) elExtra50.textContent = minutesToTime(totalE50);
    const elExtra100 = document.getElementById('rel-tot-extras-100');
    if (elExtra100) elExtra100.textContent = minutesToTime(totalE100);
    if (document.getElementById('rel-tot-receber')) document.getElementById('rel-tot-receber').textContent = formatCurrency(totalMoney) + (singleEmployeeMode ? '' : ' (Só Extras)');
}

// Event Listeners para botões da tabela (Editar / Excluir)
document.getElementById('reports-table-body')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit-record');
    const delBtn  = e.target.closest('.btn-delete-record');
    
    if (delBtn) {
        // UUID string — não usar parseInt
        const id = delBtn.getAttribute('data-id');
        // Encontrar o registro para mostrar a data na confirmação
        const record = currentReportData.find(r => String(r.id) === String(id));
        const dateStr = record ? record.date.split('-').reverse().join('/') : 'selecionado';
        
        if (confirm(`Tem certeza que deseja excluir o registro do dia ${dateStr}?\nEsta ação não pode ser desfeita.`)) {
            try {
                await db.timeRecords.delete(id);
                showToast('Registro excluído com sucesso!', 'success');
                await applyReportFilters();
            } catch (err) {
                console.error('Erro ao excluir registro:', err);
                showToast(err?.message || 'Erro ao excluir registro.', 'error');
            }
        }
    }
    
    if (editBtn) {
        // UUID string — passar direto na URL
        const id = editBtn.getAttribute('data-id');
        window.location.href = `registrar_ponto.html?editId=${id}`;
    }
});

// Limpar todos os registros
document.getElementById('btn-clear-all-records')?.addEventListener('click', async () => {
    if (confirm('ATENÇÃO: Você está prestes a excluir TODOS os registros de ponto do sistema. Esta ação não pode ser desfeita. Tem certeza?')) {
        await db.timeRecords.clear();
        showToast('Todos os registros foram excluídos!', 'success');
        await applyReportFilters();
    }
});

// Make sure to expose variables for export
window.getCurrentReportData = () => currentReportData;
window.getUserMap = () => userMap;
