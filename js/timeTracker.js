// js/timeTracker.js

let editingRecordId = null;
let flexPausaCount  = 0; // counter for unique IDs in flex mode

// Helper to clear time inputs automatically
function clearTimeInputs() {
    if (editingRecordId) return; // Não limpa em modo de edição
    ['ponto-entrada', 'ponto-pausa', 'ponto-retorno', 'ponto-saida'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    // Limpa pausas flexíveis
    const container = document.getElementById('pausas-flexiveis-container');
    if (container) {
        container.innerHTML = '';
        flexPausaCount = 0;
    }
}

// Pre-fill Date
document.addEventListener('DOMContentLoaded', () => {
    const pontoData = document.getElementById('ponto-data');
    if (pontoData) {
        pontoData.valueAsDate = new Date();
        pontoData.addEventListener('change', clearTimeInputs);
    }
});

window.initTimeTrackerDefaults = function() {
    if (!currentUser) return;
    const pontoJornada = document.getElementById('ponto-jornada');
    const pontoTipoExtra = document.getElementById('ponto-tipo-extra');
    
    if (pontoJornada && currentUser.hourType) {
        pontoJornada.value = currentUser.hourType;
        pontoJornada.dispatchEvent(new Event('change'));
    }
    if (pontoTipoExtra && currentUser.overtimeType) {
        pontoTipoExtra.value = currentUser.overtimeType;
    }

    // Verificar se estamos em modo de edição via URL ?editId=UUID
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('editId');
    if (editId) {
        // UUID é string — NÃO usar parseInt
        loadRecordForEdit(editId);
    }
};

async function loadRecordForEdit(id) {
    try {
        const record = await db.timeRecords.get(id);
        if (!record) {
            showToast('Registro não encontrado.', 'error');
            return;
        }
        editingRecordId = id;

        // Preencher os campos
        const dataEl      = document.getElementById('ponto-data');
        const jornadaEl   = document.getElementById('ponto-jornada');
        const tipoExtraEl = document.getElementById('ponto-tipo-extra');
        const entradaEl   = document.getElementById('ponto-entrada');
        const pausaEl     = document.getElementById('ponto-pausa');
        const retornoEl   = document.getElementById('ponto-retorno');
        const saidaEl     = document.getElementById('ponto-saida');

        if (dataEl)      dataEl.value      = record.date  || '';
        if (jornadaEl && record.jornada) {
            jornadaEl.value = record.jornada;
            jornadaEl.dispatchEvent(new Event('change'));
        }
        if (tipoExtraEl && record.tipoExtra) tipoExtraEl.value = record.tipoExtra;
        if (entradaEl)   entradaEl.value   = record.entrada  || '';
        if (saidaEl)     saidaEl.value     = record.saida    || '';

        // Restaurar pausas: flex ou simples
        if (record.jornada === '7h20flex' && Array.isArray(record.pausas)) {
            // O change event já criou uma pausa vazia; limpar e repovoar
            const container = document.getElementById('pausas-flexiveis-container');
            if (container) {
                container.innerHTML = '';
                flexPausaCount = 0;
            }
            record.pausas.forEach(p => addFlexPausa(p.pausa || '', p.retorno || ''));
        } else {
            if (pausaEl)   pausaEl.value   = record.pausa   || '';
            if (retornoEl) retornoEl.value = record.retorno || '';
        }

        // Atualizar o título e o botão para modo edição
        const header = document.querySelector('#registro-content .page-header h2');
        if (header) header.textContent = 'Editar Registro de Ponto';

        const saveBtn = document.getElementById('btn-save-ponto');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Atualizar Registro';
            saveBtn.style.backgroundColor = 'var(--warning-color, #f59e0b)';
        }

        // Banner de aviso
        const panel = document.querySelector('#registro-content .panel');
        if (panel) {
            const banner = document.createElement('div');
            banner.style.cssText = 'background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px 15px; margin-bottom: 15px; border-radius: 4px; font-size: 0.9rem; color: #856404;';
            banner.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> <strong>Modo Edição:</strong> Você está editando o registro do dia <strong>' + record.date + '</strong>. Após salvar, você será redirecionado de volta para Relatórios.';
            panel.insertAdjacentElement('beforebegin', banner);
        }

        showToast('Registro carregado para edição.', 'info');
    } catch (e) {
        console.error('Erro ao carregar registro para edição', e);
        showToast('Erro ao carregar registro para edição.', 'error');
    }
}


// UI Logic for Jornada Type
const pontoJornada = document.getElementById('ponto-jornada');
const containerTipoExtra = document.getElementById('container-tipo-extra');
const inputPausa = document.getElementById('ponto-pausa');
const inputRetorno = document.getElementById('ponto-retorno');
const btnPausa = document.getElementById('btn-reg-pausa');
const btnRetorno = document.getElementById('btn-reg-retorno');

if(pontoJornada) {
    pontoJornada.addEventListener('change', (e) => {
        clearTimeInputs();
        const type = e.target.value;
        const blocoPauseSimples   = document.getElementById('bloco-pausa-simples');
        const blocoPausasFlex     = document.getElementById('bloco-pausas-flexiveis');
        const inputPausa   = document.getElementById('ponto-pausa');
        const inputRetorno = document.getElementById('ponto-retorno');
        const btnPausa     = document.getElementById('btn-reg-pausa');
        const btnRetorno   = document.getElementById('btn-reg-retorno');

        if (type === '7h20flex') {
            // Mostrar bloco flex, ocultar simples
            if (blocoPauseSimples) blocoPauseSimples.style.display = 'none';
            if (blocoPausasFlex)   blocoPausasFlex.style.display   = 'block';
            // Adicionar a primeira pausa automáticamente
            if (document.getElementById('pausas-flexiveis-container')?.children.length === 0) {
                addFlexPausa();
            }
        } else {
            // Mostrar bloco simples, ocultar flex
            if (blocoPauseSimples) blocoPauseSimples.style.display = 'block';
            if (blocoPausasFlex)   blocoPausasFlex.style.display   = 'none';

            if (type === '4h' || type === 'extra') {
                if (inputPausa)   inputPausa.disabled   = true;
                if (inputRetorno) inputRetorno.disabled = true;
                if (btnPausa)     btnPausa.disabled     = true;
                if (btnRetorno)   btnRetorno.disabled   = true;
            } else {
                if (inputPausa)   inputPausa.disabled   = false;
                if (inputRetorno) inputRetorno.disabled = false;
                if (btnPausa)     btnPausa.disabled     = false;
                if (btnRetorno)   btnRetorno.disabled   = false;
            }
        }

        if (containerTipoExtra) containerTipoExtra.style.display = 'block';
    });
}

const pontoTipoExtraEl = document.getElementById('ponto-tipo-extra');
if (pontoTipoExtraEl) {
    pontoTipoExtraEl.addEventListener('change', clearTimeInputs);
}

// ─────────────────────────────────────────────
// PAUSAS FLEXÍVEIS — funções dinâmicas
// ─────────────────────────────────────────────

/**
 * Adiciona um novo par (Pausa / Retorno) ao container flexível.
 * @param {string} [pausaVal]   - valor pré-preenchido HH:MM
 * @param {string} [retornoVal] - valor pré-preenchido HH:MM
 */
function addFlexPausa(pausaVal = '', retornoVal = '') {
    const container = document.getElementById('pausas-flexiveis-container');
    if (!container) return;

    flexPausaCount++;
    const idx = flexPausaCount;

    const wrapper = document.createElement('div');
    wrapper.className  = 'flex-pausa-pair';
    wrapper.id         = `flex-pausa-pair-${idx}`;
    wrapper.style.cssText = 'display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; margin-bottom:12px; padding:12px; background:var(--secondary-color); border-radius:8px; border-left:3px solid var(--warning-color, #f59e0b);';

    wrapper.innerHTML = `
        <div class="time-block" style="flex:1; min-width:160px;">
            <label>Pausa ${idx}</label>
            <input type="time" id="flex-pausa-${idx}" class="time-input" value="${pausaVal}">
            <button class="btn btn-warning" type="button" onclick="setFlexTime('flex-pausa-${idx}')">
                <i class="fa-solid fa-clock"></i> Registrar
            </button>
        </div>
        <div class="time-block" style="flex:1; min-width:160px;">
            <label>Retorno ${idx}</label>
            <input type="time" id="flex-retorno-${idx}" class="time-input" value="${retornoVal}">
            <button class="btn btn-info" type="button" onclick="setFlexTime('flex-retorno-${idx}')">
                <i class="fa-solid fa-clock"></i> Registrar
            </button>
        </div>
    `;

    container.appendChild(wrapper);
}

/** Remove um par de pausa/retorno pelo índice */
function removeFlexPausa(idx) {
    const el = document.getElementById(`flex-pausa-pair-${idx}`);
    if (el) el.remove();
}

/** Define a hora atual em um input flex */
function setFlexTime(inputId) {
    const el = document.getElementById(inputId);
    if (el) {
        const now = new Date();
        el.value  = now.toTimeString().substring(0, 5);
    }
}

/** Coleta todos os pares Pausa/Retorno do bloco flexível */
function getFlexPausas() {
    const pairs = [];
    const container = document.getElementById('pausas-flexiveis-container');
    if (!container) return pairs;
    container.querySelectorAll('.flex-pausa-pair').forEach(wrapper => {
        const pausaInput   = wrapper.querySelector('[id^="flex-pausa-"]');
        const retornoInput = wrapper.querySelector('[id^="flex-retorno-"]');
        if (pausaInput && retornoInput) {
            pairs.push({
                pausa:   pausaInput.value   || null,
                retorno: retornoInput.value || null
            });
        }
    });
    return pairs;
}

// Botao Adicionar Pausa
document.getElementById('btn-add-pausa')?.addEventListener('click', () => addFlexPausa());

// Botao Remover Última Pausa
document.getElementById('btn-remove-pausa')?.addEventListener('click', () => {
    const container = document.getElementById('pausas-flexiveis-container');
    if (container && container.lastElementChild) {
        container.lastElementChild.remove();
        if (flexPausaCount > 0) flexPausaCount--;
    }
});

// Helpers for manual time registration buttons
function setCurrentTime(inputId) {
    const el = document.getElementById(inputId);
    if(el && !el.disabled) {
        const now = new Date();
        el.value = now.toTimeString().substring(0, 5);
    }
}
document.getElementById('btn-reg-entrada')?.addEventListener('click',  () => setCurrentTime('ponto-entrada'));
document.getElementById('btn-reg-pausa')?.addEventListener('click',    () => setCurrentTime('ponto-pausa'));
document.getElementById('btn-reg-retorno')?.addEventListener('click',  () => setCurrentTime('ponto-retorno'));
document.getElementById('btn-reg-saida')?.addEventListener('click',    () => setCurrentTime('ponto-saida'));


// Helper: Time to Minutes
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
}

// Helper: Minutes to HH:MM
function minutesToTime(totalMinutes) {
    const hours = Math.floor(Math.abs(totalMinutes) / 60);
    const mins  = Math.abs(totalMinutes) % 60;
    const sign  = totalMinutes < 0 ? '-' : '';
    return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Format Currency
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * Calcula os minutos noturnos trabalhados (CLT art. 73).
 * Período noturno: 22:00 às 05:00 do dia seguinte.
 * Desconta a pausa/almoço caso ela ocorra dentro do período noturno.
 */
function calcNocturnalMinutes(entrada, saida, pausa, retorno) {
    if (!entrada || !saida) return 0;

    const toMin = (hhmm) => {
        const [h, m] = hhmm.split(':').map(Number);
        return h * 60 + m;
    };

    const minEntrada = toMin(entrada);
    let   minSaida   = toMin(saida);
    if (minSaida <= minEntrada) minSaida += 1440;

    let   minPausa   = pausa   ? toMin(pausa)   : null;
    let   minRetorno = retorno ? toMin(retorno) : null;
    
    if (minPausa !== null && minPausa < minEntrada) minPausa += 1440;
    if (minRetorno !== null && minRetorno < (minPausa !== null ? minPausa : minEntrada)) minRetorno += 1440;

    const segments = [];
    if (minPausa !== null && minRetorno !== null && minRetorno > minPausa) {
        segments.push([minEntrada, minPausa]);
        segments.push([minRetorno, minSaida]);
    } else {
        segments.push([minEntrada, minSaida]);
    }

    const nightWindows = [
        [1320, 1440],
        [1440, 1740]
    ];

    let nocturnal = 0;
    segments.forEach(([segStart, segEnd]) => {
        nightWindows.forEach(([nStart, nEnd]) => {
            const overlapStart = Math.max(segStart, nStart);
            const overlapEnd   = Math.min(segEnd,   nEnd);
            if (overlapEnd > overlapStart) {
                nocturnal += overlapEnd - overlapStart;
            }
        });
    });

    return nocturnal;
}

// Calculation Logic
function calculateDay(data) {
    const minEntrada = timeToMinutes(data.entrada);
    let minSaida = timeToMinutes(data.saida);
    let workedMinutes = 0;

    if (data.entrada && data.saida) {
        if (minSaida <= minEntrada) minSaida += 1440;
        workedMinutes = minSaida - minEntrada;

        // Jornada 7h20 Flexível: múltiplas pausas em array
        if (data.jornada === '7h20flex' && Array.isArray(data.pausas) && data.pausas.length > 0) {
            data.pausas.forEach(({ pausa, retorno }) => {
                if (pausa && retorno) {
                    let minP = timeToMinutes(pausa);
                    let minR = timeToMinutes(retorno);
                    if (minP < minEntrada) minP += 1440;
                    if (minR < minP)       minR += 1440;
                    if (minR > minP) workedMinutes -= (minR - minP);
                }
            });
        } else if (data.pausa && data.retorno) {
            // Pausa simples
            let minPausa   = timeToMinutes(data.pausa);
            let minRetorno = timeToMinutes(data.retorno);
            
            if (minPausa < minEntrada) minPausa += 1440;
            if (minRetorno < minPausa) minRetorno += 1440;

            if (minRetorno > minPausa) {
                workedMinutes -= (minRetorno - minPausa);
            }
        }
    }

    if (workedMinutes < 0) workedMinutes = 0;

    let targetMinutes = 0;
    if (data.jornada === '8h')       targetMinutes = 8 * 60;
    if (data.jornada === '7h20')     targetMinutes = (7 * 60) + 20;
    if (data.jornada === '7h20flex') targetMinutes = (7 * 60) + 20; // mesma meta: 7h20
    if (data.jornada === '4h')       targetMinutes = 4 * 60;
    if (data.jornada === 'extra')    targetMinutes = 0;

    let normalMinutes = 0;
    let extra50  = 0;
    let extra100 = 0;

    if (data.jornada === 'extra') {
        if (data.tipoExtra === '100') {
            extra100 = workedMinutes;
        } else {
            extra50 = workedMinutes;
        }
    } else {
        const overTime = workedMinutes - targetMinutes;
        if (overTime > 10) {
            normalMinutes = targetMinutes;
            if (data.tipoExtra === '100') {
                extra100 = overTime;
            } else {
                extra50 = overTime;
            }
        } else {
            normalMinutes = workedMinutes;
        }
    }

    // Para noturno, usa primeira pausa disponível (simples ou primeira do array flex)
    const pausaNoturno   = data.jornada === '7h20flex'
        ? (data.pausas?.[0]?.pausa   || null)
        : (data.pausa   || null);
    const retornoNoturno = data.jornada === '7h20flex'
        ? (data.pausas?.[0]?.retorno || null)
        : (data.retorno || null);

    const minutosNoturnos = calcNocturnalMinutes(
        data.entrada, data.saida, pausaNoturno, retornoNoturno
    );

    return {
        workedMinutes,
        normalMinutes,
        extra50,
        extra100,
        minutosNoturnos,
        horasTrab:     minutesToTime(workedMinutes),
        horasExtra50:  minutesToTime(extra50),
        horasExtra100: minutesToTime(extra100),
        horasNoturnas: minutesToTime(minutosNoturnos)
    };
}


// Save record
const btnSavePonto = document.getElementById('btn-save-ponto');
if (btnSavePonto) {
    btnSavePonto.addEventListener('click', async () => {
        if (!currentUser) {
            showToast('Sessão expirada. Faça login novamente.', 'error');
            return;
        }
        
        const date = document.getElementById('ponto-data').value;
        if(!date) {
            showToast('Selecione uma data.', 'warning');
            return;
        }

        const entrada = document.getElementById('ponto-entrada').value;
        if (!entrada) {
            showToast('O horário de entrada é obrigatório.', 'warning');
            return;
        }

        const record = {
            userId:    currentUser.id,
            date:      date,
            month:     date.substring(0, 7), // YYYY-MM
            jornada:   document.getElementById('ponto-jornada').value,
            tipoExtra: document.getElementById('ponto-tipo-extra').value,
            entrada:   entrada,
            pausa:     document.getElementById('ponto-pausa').value   || null,
            retorno:   document.getElementById('ponto-retorno').value || null,
            saida:     document.getElementById('ponto-saida').value   || null,
        };

        // Se for jornada flex, coletar array de pausas
        if (record.jornada === '7h20flex') {
            record.pausas  = getFlexPausas();
            record.pausa   = record.pausas[0]?.pausa   || null;
            record.retorno = record.pausas[0]?.retorno || null;
        }

        const calc = calculateDay(record);
        record.calc = calc;

        // Desabilitar botão para evitar duplo clique
        btnSavePonto.disabled = true;
        const originalText = btnSavePonto.innerHTML;
        btnSavePonto.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

        try {
            // Modo de edição: atualizar registro específico por ID (UUID)
            if (editingRecordId) {
                record.id = editingRecordId;
                await db.timeRecords.put(record);
                showToast('Registro atualizado com sucesso!', 'success');
                setTimeout(() => {
                    window.location.href = 'relatorios.html';
                }, 1200);
                return;
            }

            // Modo normal: verificar se já existe registro na data (mesmo usuário)
            const existing = await db.timeRecords
                .where({ userId: currentUser.id, date: date })
                .first();

            if (existing) {
                // Atualizar registro existente do dia
                record.id = existing.id;
                await db.timeRecords.put(record);
                showToast('Registro do dia atualizado com sucesso!', 'success');
            } else {
                // Inserir novo registro
                await db.timeRecords.add(record);
                showToast('Registro salvo com sucesso!', 'success');
            }
            
            showDayResultCards(calc);
            updateDashboardStats();
            clearTimeInputs();

        } catch (error) {
            console.error('Erro ao salvar registro de ponto:', error);
            const msg = error?.message || 'Erro ao salvar registro.';
            showToast(msg, 'error');
        } finally {
            btnSavePonto.disabled = false;
            btnSavePonto.innerHTML = originalText;
        }
    });
}

function showDayResultCards(calc) {
    const container = document.getElementById('resultados-dia-cards');
    if(!container) return;
    container.style.display = 'grid';
    container.innerHTML = `
        <div class="stat-card">
            <div class="card-info">
                <h3>Horas Trabalhadas no Dia</h3>
                <span class="value">${calc.horasTrab}</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="card-info">
                <h3>Horas Extras 50% Geradas</h3>
                <span class="value">${calc.horasExtra50}</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="card-info">
                <h3>Horas Extras 100% Geradas</h3>
                <span class="value">${calc.horasExtra100}</span>
            </div>
        </div>
    `;
}

// --- DASHBOARD FILTERS INITIALIZATION ---
window.initDashboardFilters = async function() {
    if (!currentUser) return;

    // Load users if admin
    if (currentUser.role === 'admin') {
        try {
            const users = await db.users.toArray();
            const select = document.getElementById('dash-filter-employee');
            if (select) {
                select.innerHTML = '<option value="all">Todos (Visão Global)</option>';
                users.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u.id;
                    opt.textContent = `${u.name} (Mat: ${u.matricula || '-'})`;
                    select.appendChild(opt);
                });
            }
        } catch (e) {
            console.error('Erro ao carregar usuários no filtro do dashboard', e);
        }
    }

    // Load filters from Supabase
    const settings = await db.settings.get('global') || {};
    const filters = settings.filters || {};
    
    const savedFilterMonth = filters.dashFilterMonth;
    const savedFilterStart = filters.dashFilterStart;
    const savedFilterEnd   = filters.dashFilterEnd;
    const savedFilterEmp   = filters.dashFilterEmp;

    const filterMonth = document.getElementById('dash-filter-month');
    const filterStart = document.getElementById('dash-filter-date-start');
    const filterEnd   = document.getElementById('dash-filter-date-end');
    const filterEmp   = document.getElementById('dash-filter-employee');

    if (filterMonth) {
        if (savedFilterMonth) {
            filterMonth.value = savedFilterMonth;
        } else {
            const now = new Date();
            filterMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
    }

    if (filterStart && savedFilterStart) filterStart.value = savedFilterStart;
    if (filterEnd   && savedFilterEnd)   filterEnd.value   = savedFilterEnd;
    
    if (filterEmp && currentUser.role === 'admin') {
        filterEmp.value = savedFilterEmp || 'all';
    }

    // Bind Apply button
    const btnApply = document.getElementById('btn-dash-apply-filters');
    if (btnApply) {
        btnApply.addEventListener('click', async () => {
            try {
                const settings = await db.settings.get('global') || {};
                const filters = settings.filters || {};
                if (filterMonth) filters.dashFilterMonth = filterMonth.value;
                if (filterStart) filters.dashFilterStart = filterStart.value;
                if (filterEnd)   filters.dashFilterEnd   = filterEnd.value;
                if (filterEmp && currentUser.role === 'admin') filters.dashFilterEmp = filterEmp.value;
                await db.settings.update('global', { filters });
            } catch(e) { console.error('Erro ao salvar filtros do dashboard', e); }
            
            updateDashboardStats();
        });
    }
};

// --- DASHBOARD UPDATES ---
window.updateDashboardStats = async function() {
    if (!currentUser) return;
    
    const dashSalario = document.getElementById('dash-salario-base');
    if (!dashSalario) return; 
    
    try {
        const filterMonth = document.getElementById('dash-filter-month')?.value;
        const dateStart   = document.getElementById('dash-filter-date-start')?.value;
        const dateEnd     = document.getElementById('dash-filter-date-end')?.value;
        let employeeId    = document.getElementById('dash-filter-employee')?.value || 'all';

        // Non-admins can only see their own data
        if (currentUser.role !== 'admin') {
            employeeId = currentUser.id.toString();
        }

        // Determinar o salário base para cálculo
        let targetSalary = currentUser.baseSalary || 0;
        let targetEmployee = currentUser;
        if (currentUser.role === 'admin') {
            if (employeeId === 'all') {
                // Se o usuário logado tiver salário base ou se for o único, usa currentUser como referência padrão
                if (currentUser.baseSalary > 0) {
                    targetSalary = currentUser.baseSalary;
                    targetEmployee = currentUser;
                } else {
                    targetSalary = 0;
                    targetEmployee = null;
                }
            } else {
                const emp = await db.users.get(employeeId);
                if (emp) {
                    targetSalary = emp.baseSalary || 0;
                    targetEmployee = emp;
                }
            }
        }
        dashSalario.textContent = formatCurrency(targetSalary);

        // Buscar registros
        let allDbRecords = await db.timeRecords.toArray();

        // Guardar todos os registros do colaborador para apuração de médias anuais (CLT / 13º)
        const allEmployeeRecords = (employeeId !== 'all')
            ? allDbRecords.filter(r => r.userId === employeeId)
            : allDbRecords;

        let records = [...allEmployeeRecords];

        // Aplicar filtros
        
        if (dateStart && dateEnd) {
            records = records.filter(r => r.date >= dateStart && r.date <= dateEnd);
        } else if (filterMonth) {
            records = records.filter(r => r.month === filterMonth);
        }

        let totalWorked         = 0;
        let totalE50            = 0;
        let totalE100           = 0;
        let totalNoturnoMinutes = 0;
        let daysWorked          = 0;

        records.forEach(r => {
            if (!r.calc) return; // Registro sem cálculo (dados antigos)
            if (r.calc.workedMinutes > 0) daysWorked++;
            totalWorked         += r.calc.workedMinutes        || 0;
            totalE50            += r.calc.extra50              || 0;
            totalE100           += r.calc.extra100             || 0;
            totalNoturnoMinutes += r.calc.minutosNoturnos      || 0;
        });

        document.getElementById('dash-horas-trabalhadas').textContent = minutesToTime(totalWorked);
        document.getElementById('dash-horas-50').textContent          = minutesToTime(totalE50);
        document.getElementById('dash-horas-100').textContent         = minutesToTime(totalE100);
        document.getElementById('dash-dias-trabalhados').textContent  = daysWorked;

        const settings = (await db.settings.get('global')) || {};
        const isNoturnoActive = !!settings.noturnoCalculation;

        // Money calculations
        const valorHora    = targetSalary / 220;
        const valorE50     = (valorHora * 1.5) * (totalE50  / 60);
        const valorE100    = (valorHora * 2)   * (totalE100 / 60);
        const valorNoturno = isNoturnoActive ? ((valorHora * 0.20) * (totalNoturnoMinutes / 60)) : 0;
        const totalExtras  = valorE50 + valorE100;
        let   totalReceber = 0;

        if (employeeId === 'all') {
            totalReceber = totalExtras + valorNoturno;
        } else {
            totalReceber = targetSalary + totalExtras + valorNoturno;
        }

        // ── Card: Adicional Noturno ──────────────────────────────────────────
        const cardNoturno     = document.getElementById('card-adicional-noturno');
        const valNoturnoHoras = document.getElementById('dash-horas-noturnas');
        const valNoturnoValor = document.getElementById('dash-valor-noturno');
        if (cardNoturno) {
            if (isNoturnoActive && totalNoturnoMinutes > 0) {
                cardNoturno.style.display = 'flex';
                if (valNoturnoHoras) valNoturnoHoras.textContent = minutesToTime(totalNoturnoMinutes);
                if (valNoturnoValor) valNoturnoValor.textContent = formatCurrency(valorNoturno);
            } else {
                cardNoturno.style.display = 'none';
            }
        }

        // Remuneração bruta do mês (salário base + horas extras + adicional noturno)
        const salarioBruto = totalReceber;

        // ── Check INSS ───────────────────────────────────────────────────────
        const isInssActive   = !!settings.inssCalculation;
        let inssDiscount     = 0;
        const cardInss       = document.getElementById('card-desconto-inss');
        const valInss        = document.getElementById('dash-desconto-inss');
        const valSalarioBruto = document.getElementById('dash-salario-bruto');
        const valInssNoturno = document.getElementById('dash-inss-noturno');

        const inssOficial = (typeof window.calculateINSS === 'function')
            ? window.calculateINSS(salarioBruto)
            : 0;

        if (isInssActive && employeeId !== 'all') {
            inssDiscount = inssOficial;
            if (valSalarioBruto) valSalarioBruto.textContent = formatCurrency(salarioBruto);
            if (valInssNoturno) {
                valInssNoturno.style.display = (isNoturnoActive && totalNoturnoMinutes > 0) ? 'block' : 'none';
                valInssNoturno.innerHTML = `Adic. Noturno incl.: <strong>${formatCurrency(valorNoturno)}</strong>`;
            }
            totalReceber -= inssDiscount;
            if (cardInss) cardInss.style.display = 'flex';
            if (valInss)  valInss.textContent = `- ${formatCurrency(inssDiscount)}`;
        } else {
            if (cardInss) cardInss.style.display = 'none';
        }

        // ── Check IRRF (2026) ────────────────────────────────────────────────
        const isIrrfActive   = !!settings.irrfCalculation;
        let irrfDiscount     = 0;
        const cardIrrf       = document.getElementById('card-desconto-irrf');
        const valIrrf        = document.getElementById('dash-desconto-irrf');
        const valIrrfBase    = document.getElementById('dash-irrf-base');
        const valIrrfRegra   = document.getElementById('dash-irrf-regra');

        if (isIrrfActive && employeeId !== 'all') {
            const irrfInfo = (typeof window.calculateIRRF === 'function')
                ? window.calculateIRRF(salarioBruto, inssOficial)
                : { valor: 0, isIsento: true, salarioBruto: salarioBruto, baseCalculo: salarioBruto, reducao2026: 0 };
            irrfDiscount = irrfInfo.valor;
            if (cardIrrf) cardIrrf.style.display = 'flex';
            if (valIrrf) {
                if (irrfInfo.valor > 0) {
                    valIrrf.textContent = `- ${formatCurrency(irrfInfo.valor)}`;
                    valIrrf.style.color = 'var(--danger-color, #dc3545)';
                } else {
                    valIrrf.textContent = 'R$ 0,00';
                    valIrrf.style.color = '#10b981';
                }
            }
            if (valIrrfBase) {
                if (irrfInfo.isIsento) {
                    valIrrfBase.textContent = formatCurrency(irrfInfo.salarioBruto);
                } else {
                    valIrrfBase.innerHTML = `${formatCurrency(irrfInfo.baseCalculo)} <span style="font-weight: normal; font-size: 0.82em; opacity: 0.85;">(${irrfInfo.tipoDeducao})</span>`;
                }
            }
            if (valIrrfRegra) {
                if (irrfInfo.isIsento) {
                    valIrrfRegra.innerHTML = '<span style="color: #10b981; font-weight: 600;"><i class="fa-solid fa-check"></i> Isento até R$ 5.000 (Lei 15.270/26)</span>';
                } else if (irrfInfo.reducao2026 > 0) {
                    valIrrfRegra.innerHTML = `Alíq. efetiva: <strong>${irrfInfo.aliquotaEfetiva}%</strong> &bull; Redução 2026: <strong>- ${formatCurrency(irrfInfo.reducao2026)}</strong>`;
                } else {
                    valIrrfRegra.innerHTML = `Base tributável: <strong>${formatCurrency(irrfInfo.baseCalculo)}</strong> (Alíq. ${irrfInfo.aliquotaNominal}%)`;
                }
            }
            totalReceber -= irrfDiscount;
        } else {
            if (cardIrrf) cardIrrf.style.display = 'none';
        }

        // ── Check FGTS (8% CLT) ──────────────────────────────────────────────
        const isFgtsActive   = !!settings.fgtsCalculation;
        const cardFgts       = document.getElementById('card-fgts');
        const valFgts        = document.getElementById('dash-valor-fgts');
        const valFgtsBase    = document.getElementById('dash-fgts-base');

        if (isFgtsActive && employeeId !== 'all') {
            const fgtsValor = (typeof window.calculateFGTS === 'function')
                ? window.calculateFGTS(salarioBruto)
                : Number((salarioBruto * 0.08).toFixed(2));
            if (cardFgts) cardFgts.style.display = 'flex';
            if (valFgts)  valFgts.textContent = formatCurrency(fgtsValor);
            if (valFgtsBase) valFgtsBase.textContent = formatCurrency(salarioBruto);
        } else {
            if (cardFgts) cardFgts.style.display = 'none';
        }

        // ── Check 13º Salário (CLT) ──────────────────────────────────────────
        const isDecimoActive = !!settings.decimoTerceiroCalculation;
        const card13         = document.getElementById('card-decimo-terceiro');
        const val13          = document.getElementById('dash-valor-13');
        const val13Avos      = document.getElementById('dash-13-avos');
        const val13Periodo   = document.getElementById('dash-13-periodo');
        const val13Admissao  = document.getElementById('dash-13-admissao');

        // Permitir visualização individual se funcionário selecionado OU se admin tiver salário base
        const canShowEmployeeCards = (employeeId !== 'all') || (targetEmployee && targetSalary > 0);

        if (isDecimoActive && canShowEmployeeCards) {
            const admissionDate = targetEmployee ? targetEmployee.admissionDate : null;

            // ── Apuração da Média de Horas Extras e Adicionais (CLT / Súmula 45 TST) ──
            let mediaExtrasAno = 0;
            const refYear = filterMonth ? parseInt(filterMonth.split('-')[0], 10) : new Date().getFullYear();
            const refMonth = filterMonth ? parseInt(filterMonth.split('-')[1], 10) : (new Date().getMonth() + 1);

            // Filtrar todos os registros do colaborador no ano consultado até a competência
            const yearRecords = allEmployeeRecords.filter(r => {
                const m = r.month || (r.date ? r.date.substring(0, 7) : null);
                if (!m) return false;
                const [y, mo] = m.split('-').map(Number);
                return y === refYear && mo <= refMonth;
            });

            const monthsWithRecords = new Set();
            let sumE50Min = 0;
            let sumE100Min = 0;
            let sumNoturnoMin = 0;

            yearRecords.forEach(r => {
                if (!r.calc) return;
                const m = r.month || (r.date ? r.date.substring(0, 7) : null);
                if (m) monthsWithRecords.add(m);
                sumE50Min     += (r.calc.extra50 || 0);
                sumE100Min    += (r.calc.extra100 || 0);
                sumNoturnoMin += (r.calc.minutosNoturnos || 0);
            });

            if (monthsWithRecords.size > 0 && (sumE50Min > 0 || sumE100Min > 0 || sumNoturnoMin > 0)) {
                const divMeses = monthsWithRecords.size;
                const medHoras50  = (sumE50Min / 60) / divMeses;
                const medHoras100 = (sumE100Min / 60) / divMeses;
                const vMed50      = medHoras50 * (valorHora * 1.5);
                const vMed100     = medHoras100 * (valorHora * 2.0);
                const vMedNot     = isNoturnoActive ? (((sumNoturnoMin / 60) / divMeses) * (valorHora * 0.20)) : 0;
                mediaExtrasAno    = Number((vMed50 + vMed100 + vMedNot).toFixed(2));
            } else if (totalExtras > 0 || (isNoturnoActive && valorNoturno > 0)) {
                mediaExtrasAno = Number((totalExtras + (isNoturnoActive ? valorNoturno : 0)).toFixed(2));
            }

            const decimoInfo = (typeof window.calculateDecimoTerceiro === 'function')
                ? window.calculateDecimoTerceiro(targetSalary, admissionDate, filterMonth, mediaExtrasAno)
                : { avos: 0, valor: 0, totalAvosAno: 12, valorIntegralAno: 0, mesesEmpresa: 0, admissaoFormatada: '—', remuneracaoBase: targetSalary, mediaExtras: 0, primeiraParcela: 0 };

            if (card13) card13.style.display = 'flex';
            if (val13) val13.textContent = formatCurrency(decimoInfo.valor);
            if (val13Avos) val13Avos.textContent = `${decimoInfo.avos}/12`;
            if (val13Periodo) {
                val13Periodo.textContent = decimoInfo.isCompetenciaIntegral ? 'Integral' : 'Proporcional CLT';
            }

            const badge13 = document.getElementById('dash-13-badge');
            if (badge13) {
                if (decimoInfo.isCompetenciaIntegral) {
                    badge13.style.background = 'rgba(16, 185, 129, 0.12)';
                    badge13.style.color = '#059669';
                } else {
                    badge13.style.background = 'rgba(245, 158, 11, 0.12)';
                    badge13.style.color = '#d97706';
                }
            }

            // Composição da Base (Horas Extras) de forma limpa e organizada
            const elExtras13 = document.getElementById('dash-13-extras-info');
            if (elExtras13) {
                if (decimoInfo.mediaExtras > 0) {
                    elExtras13.style.display = 'block';
                    elExtras13.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; color: var(--text-muted); font-size: 0.74rem;">
                            <span>Salário Base:</span>
                            <strong style="color: var(--text-color);">${formatCurrency(targetSalary)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; color: #d97706; font-size: 0.74rem; margin-top: 2px;">
                            <span><i class="fa-solid fa-clock-rotate-left" style="font-size: 0.8em;"></i> Média Horas Extras:</span>
                            <strong>+ ${formatCurrency(decimoInfo.mediaExtras)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); margin-top: 4px; padding-top: 3px; font-size: 0.76rem; font-weight: 600;">
                            <span style="color: var(--text-color);">Base de Cálculo:</span>
                            <span style="color: #f59e0b;">${formatCurrency(decimoInfo.remuneracaoBase)}</span>
                        </div>
                    `;
                } else {
                    elExtras13.style.display = 'none';
                }
            }

            // Grid das Parcelas CLT organizado e profissional
            const elParcelasGrid = document.getElementById('dash-13-parcelas-grid');
            if (elParcelasGrid) {
                elParcelasGrid.innerHTML = `
                    <div>
                        <span style="display: block; font-size: 0.67rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600;">1ª Parcela (50%)</span>
                        <strong style="display: block; font-size: 0.83rem; color: var(--text-color); margin-top: 1px;">${formatCurrency(decimoInfo.primeiraParcela)}</strong>
                        <span style="display: block; font-size: 0.67rem; color: var(--text-muted);">até 30/nov &bull; sem desc.</span>
                    </div>
                    <div>
                        <span style="display: block; font-size: 0.67rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600;">2ª Parc. Líquida</span>
                        <strong style="display: block; font-size: 0.83rem; color: #10b981; margin-top: 1px;">${formatCurrency(decimoInfo.segundaParcela)}</strong>
                        <span style="display: block; font-size: 0.67rem; color: var(--text-muted);">até 20/dez &bull; líq. a pagar</span>
                    </div>
                `;
            }

            // Rodapé organizado
            if (val13Admissao) {
                const admTxt = decimoInfo.admissaoFormatada !== '—'
                    ? `<span><i class="fa-regular fa-calendar-check" style="font-size: 0.85em; opacity: 0.7;"></i> Adm: <strong>${decimoInfo.admissaoFormatada}</strong></span>`
                    : '<span>CLT Lei 4.090/62</span>';
                const inssTxt = decimoInfo.inssDecimo > 0
                    ? ` <span style="font-size: 0.67rem; color: var(--danger-color, #dc3545);" title="Desconto INSS 13º">(INSS: -${formatCurrency(decimoInfo.inssDecimo)})</span>`
                    : '';
                val13Admissao.innerHTML = `
                    ${admTxt}
                    <span>Total Anual (12/12): <strong style="color: var(--text-color);">${formatCurrency(decimoInfo.valorIntegralAno)}</strong>${inssTxt}</span>
                `;
            }
        } else {
            if (card13) card13.style.display = 'none';
        }

        // ── Check Férias (+ 1/3 CLT) ──────────────────────────────────────────
        const isFeriasActive = (settings.feriasCalculation !== undefined && settings.feriasCalculation !== null)
            ? !!settings.feriasCalculation
            : (localStorage.getItem('ponto_ferias_calculation') !== 'false');
        const cardFerias       = document.getElementById('card-ferias');
        const valFerias        = document.getElementById('dash-valor-ferias');
        const valFeriasAvos    = document.getElementById('dash-ferias-avos');
        const valFeriasPeriodo = document.getElementById('dash-ferias-periodo');
        const valFeriasAdmissao = document.getElementById('dash-ferias-admissao');

        if (isFeriasActive && canShowEmployeeCards) {
            const admissionDate = targetEmployee ? targetEmployee.admissionDate : null;

            // ── Apuração da Média de Horas Extras e Adicionais para Férias (CLT Art. 142 § 5º) ──
            let mediaExtrasAno = 0;
            const refYear = filterMonth ? parseInt(filterMonth.split('-')[0], 10) : new Date().getFullYear();
            const refMonth = filterMonth ? parseInt(filterMonth.split('-')[1], 10) : (new Date().getMonth() + 1);

            const yearRecords = allEmployeeRecords.filter(r => {
                const m = r.month || (r.date ? r.date.substring(0, 7) : null);
                if (!m) return false;
                const [y, mo] = m.split('-').map(Number);
                return y === refYear && mo <= refMonth;
            });

            const monthsWithRecords = new Set();
            let sumE50Min = 0;
            let sumE100Min = 0;
            let sumNoturnoMin = 0;

            yearRecords.forEach(r => {
                if (!r.calc) return;
                const m = r.month || (r.date ? r.date.substring(0, 7) : null);
                if (m) monthsWithRecords.add(m);
                sumE50Min     += (r.calc.extra50 || 0);
                sumE100Min    += (r.calc.extra100 || 0);
                sumNoturnoMin += (r.calc.minutosNoturnos || 0);
            });

            if (monthsWithRecords.size > 0 && (sumE50Min > 0 || sumE100Min > 0 || sumNoturnoMin > 0)) {
                const divMeses = monthsWithRecords.size;
                const medHoras50  = (sumE50Min / 60) / divMeses;
                const medHoras100 = (sumE100Min / 60) / divMeses;
                const vMed50      = medHoras50 * (valorHora * 1.5);
                const vMed100     = medHoras100 * (valorHora * 2.0);
                const vMedNot     = isNoturnoActive ? (((sumNoturnoMin / 60) / divMeses) * (valorHora * 0.20)) : 0;
                mediaExtrasAno    = Number((vMed50 + vMed100 + vMedNot).toFixed(2));
            } else if (totalExtras > 0 || (isNoturnoActive && valorNoturno > 0)) {
                mediaExtrasAno = Number((totalExtras + (isNoturnoActive ? valorNoturno : 0)).toFixed(2));
            }

            const feriasInfo = (typeof window.calculateFerias === 'function')
                ? window.calculateFerias(targetSalary, admissionDate, filterMonth, mediaExtrasAno)
                : { avos: 0, totalAvos: 12, diasFerias: 0, valorFerias: 0, tercoConstitucional: 0, totalBruto: 0, inssFerias: 0, irrfFerias: 0, totalLiquido: 0, valorIntegralAno: 0, remuneracaoBase: targetSalary, mediaExtras: 0, admissaoFormatada: '—', isIntegral: true };

            if (cardFerias) cardFerias.style.display = 'flex';
            if (valFerias) valFerias.textContent = formatCurrency(feriasInfo.totalBruto);
            if (valFeriasAvos) valFeriasAvos.textContent = `${feriasInfo.avos}/12`;
            const valFeriasDias = document.getElementById('dash-ferias-dias');
            if (valFeriasDias) {
                valFeriasDias.textContent = `${feriasInfo.diasFerias} dias ${feriasInfo.isIntegral ? '(Integral)' : '(Proporcional CLT)'}`;
            }

            const badgeFerias = document.getElementById('dash-ferias-badge');
            if (badgeFerias) {
                if (feriasInfo.isIntegral) {
                    badgeFerias.style.background = 'rgba(6, 182, 212, 0.12)';
                    badgeFerias.style.color = '#0891b2';
                } else {
                    badgeFerias.style.background = 'rgba(245, 158, 11, 0.12)';
                    badgeFerias.style.color = '#d97706';
                }
            }

            // Composição da Base (Horas Extras) de forma limpa e organizada
            const elExtrasFerias = document.getElementById('dash-ferias-extras-info');
            if (elExtrasFerias) {
                if (feriasInfo.mediaExtras > 0) {
                    elExtrasFerias.style.display = 'block';
                    elExtrasFerias.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; color: var(--text-muted); font-size: 0.74rem;">
                            <span>Salário Base:</span>
                            <strong style="color: var(--text-color);">${formatCurrency(targetSalary)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; color: #0891b2; font-size: 0.74rem; margin-top: 2px;">
                            <span><i class="fa-solid fa-clock-rotate-left" style="font-size: 0.8em;"></i> Média Horas Extras:</span>
                            <strong>+ ${formatCurrency(feriasInfo.mediaExtras)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); margin-top: 4px; padding-top: 3px; font-size: 0.76rem; font-weight: 600;">
                            <span style="color: var(--text-color);">Base de Cálculo:</span>
                            <span style="color: #0891b2;">${formatCurrency(feriasInfo.remuneracaoBase)}</span>
                        </div>
                    `;
                } else {
                    elExtrasFerias.style.display = 'none';
                }
            }

            // Grid dos Componentes de Férias CLT (Férias + 1/3 Constitucional)
            const elParcelasFerias = document.getElementById('dash-ferias-parcelas-grid');
            if (elParcelasFerias) {
                elParcelasFerias.innerHTML = `
                    <div>
                        <span style="display: block; font-size: 0.67rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600;">Férias (${feriasInfo.diasFerias} dias)</span>
                        <strong style="display: block; font-size: 0.83rem; color: var(--text-color); margin-top: 1px;">${formatCurrency(feriasInfo.valorFerias)}</strong>
                        <span style="display: block; font-size: 0.67rem; color: var(--text-muted);">remuneração base</span>
                    </div>
                    <div>
                        <span style="display: block; font-size: 0.67rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600;">1/3 Constitucional</span>
                        <strong style="display: block; font-size: 0.83rem; color: #0891b2; margin-top: 1px;">+ ${formatCurrency(feriasInfo.tercoConstitucional)}</strong>
                        <span style="display: block; font-size: 0.67rem; color: var(--text-muted);">art. 7º, XVII CF/88</span>
                    </div>
                `;
            }

            // Rodapé organizado
            if (valFeriasAdmissao) {
                const admTxt = feriasInfo.admissaoFormatada !== '—'
                    ? `<span><i class="fa-regular fa-calendar-check" style="font-size: 0.85em; opacity: 0.7;"></i> Adm: <strong>${feriasInfo.admissaoFormatada}</strong></span>`
                    : '<span>CLT Art. 129 a 145</span>';
                const inssTxt = feriasInfo.inssFerias > 0
                    ? ` <span style="font-size: 0.67rem; color: var(--danger-color, #dc3545);" title="Desconto INSS sobre Férias">(INSS: -${formatCurrency(feriasInfo.inssFerias)})</span>`
                    : '';
                valFeriasAdmissao.innerHTML = `
                    ${admTxt}
                    <span>Total 30d (12/12): <strong style="color: var(--text-color);">${formatCurrency(feriasInfo.valorIntegralAno)}</strong>${inssTxt}</span>
                `;
            }
        } else {
            if (cardFerias) cardFerias.style.display = 'none';
        }

        document.getElementById('dash-valor-extras').textContent = formatCurrency(totalExtras);
        document.getElementById('dash-total-receber').textContent = formatCurrency(totalReceber);

        // Recent records table (last 5)
        const recent = records
            .filter(r => r.calc)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
        const tbody = document.querySelector('#recent-records-table tbody');
        if(tbody) {
            tbody.innerHTML = '';
            recent.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${r.date.split('-').reverse().join('/')}</td>
                    <td>${r.entrada  || '--:--'}</td>
                    <td>${r.saida    || '--:--'}</td>
                    <td>${r.calc.horasTrab}</td>
                `;
                tbody.appendChild(tr);
            });
        }

    } catch (e) {
        console.error('Error updating dashboard', e);
    }
};
