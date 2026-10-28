// js/db.js — Camada de Compatibilidade Supabase
// Substitui o Dexie/IndexedDB. Mantém a mesma API usada pelos outros arquivos JS.

// ─────────────────────────────────────────────
// HELPERS DE MAPEAMENTO (snake_case ↔ camelCase)
// ─────────────────────────────────────────────

function _mapUserFromDB(row) {
    if (!row) return null;
    const localAdmission = row.id ? localStorage.getItem('user_admission_date_' + row.id) : null;
    return {
        id:                 row.id,
        name:               row.name,
        cpf:                row.cpf,
        matricula:          row.matricula,
        email:              row.email,
        phone:              row.phone,
        role:               row.role,
        baseSalary:         row.base_salary,
        hourType:           row.hour_type,
        overtimeType:       row.overtime_type,
        journeyStart:       row.journey_start,
        journeyPauseStart:  row.journey_pause_start,
        journeyPauseEnd:    row.journey_pause_end,
        journeyEnd:         row.journey_end,
        admissionDate:      (row.admission_date !== undefined && row.admission_date !== null) ? row.admission_date : (localAdmission || null),
        profileColor:       row.profile_color,
        status:             row.status,
        createdAt:          row.created_at
    };
}

function _mapUserToDB(data) {
    const row = {};
    if (data.name              !== undefined) row.name               = data.name;
    if (data.cpf               !== undefined) row.cpf                = data.cpf;
    if (data.matricula         !== undefined) row.matricula          = data.matricula;
    if (data.email             !== undefined) row.email              = data.email;
    if (data.phone             !== undefined) row.phone              = data.phone;
    if (data.role              !== undefined) row.role               = data.role;
    if (data.baseSalary        !== undefined) row.base_salary        = data.baseSalary;
    if (data.hourType          !== undefined) row.hour_type          = data.hourType;
    if (data.overtimeType      !== undefined) row.overtime_type      = data.overtimeType;
    if (data.journeyStart      !== undefined) row.journey_start      = data.journeyStart;
    if (data.journeyPauseStart !== undefined) row.journey_pause_start= data.journeyPauseStart;
    if (data.journeyPauseEnd   !== undefined) row.journey_pause_end  = data.journeyPauseEnd;
    if (data.journeyEnd        !== undefined) row.journey_end        = data.journeyEnd;
    if (data.admissionDate     !== undefined) row.admission_date     = data.admissionDate;
    if (data.profileColor      !== undefined) row.profile_color      = data.profileColor;
    if (data.status            !== undefined) row.status             = data.status;
    return row;
}

function _mapRecordFromDB(row) {
    if (!row) return null;
    return {
        id:        row.id,
        userId:    row.user_id,
        date:      row.date,
        month:     row.month,
        jornada:   row.jornada,
        tipoExtra: row.tipo_extra,
        entrada:   row.entrada,
        pausa:     row.pausa,
        retorno:   row.retorno,
        saida:     row.saida,
        pausas:    row.pausas    || null,  // array de pausas flexíveis
        calc:      row.calc,
        createdAt: row.created_at
    };
}

function _mapRecordToDB(data) {
    const row = {};
    if (data.userId    !== undefined) row.user_id   = data.userId;
    if (data.date      !== undefined) row.date      = data.date;
    if (data.month     !== undefined) row.month     = data.month;
    if (data.jornada   !== undefined) row.jornada   = data.jornada;
    if (data.tipoExtra !== undefined) row.tipo_extra= data.tipoExtra;
    if (data.entrada   !== undefined) row.entrada   = data.entrada;
    if (data.pausa     !== undefined) row.pausa     = data.pausa;
    if (data.retorno   !== undefined) row.retorno   = data.retorno;
    if (data.saida     !== undefined) row.saida     = data.saida;
    if (data.pausas    !== undefined) row.pausas    = data.pausas;  // array flex
    if (data.calc      !== undefined) row.calc      = data.calc;
    return row;
}

function _mapSettingsFromDB(row) {
    if (!row) return null;
    const localFgts = localStorage.getItem('ponto_fgts_calculation');
    const local13 = localStorage.getItem('ponto_decimo_terceiro_calculation');
    const localIrrf = localStorage.getItem('ponto_irrf_calculation');
    return {
        id:                         row.user_id,
        userId:                     row.user_id,
        theme:                      row.theme,
        primaryColor:               row.primary_color,
        logoUrl:                    row.logo_url,
        systemName:                 row.system_name,
        inssCalculation:            row.inss_calculation,
        noturnoCalculation:         row.noturno_calculation,
        fgtsCalculation:            row.fgts_calculation !== undefined && row.fgts_calculation !== null
                                        ? !!row.fgts_calculation
                                        : (localFgts === 'true'),
        decimoTerceiroCalculation:  row.decimo_terceiro_calculation !== undefined && row.decimo_terceiro_calculation !== null
                                        ? !!row.decimo_terceiro_calculation
                                        : (local13 === 'true'),
        irrfCalculation:            row.irrf_calculation !== undefined && row.irrf_calculation !== null
                                        ? !!row.irrf_calculation
                                        : (localIrrf === 'true'),
        resetTokens:                row.reset_tokens,
        filters:                    row.filters || {}
    };
}

function _mapSettingsToDB(data) {
    const row = {};
    if (data.theme                      !== undefined) row.theme                       = data.theme;
    if (data.primaryColor               !== undefined) row.primary_color               = data.primaryColor;
    if (data.logoUrl                    !== undefined) row.logo_url                    = data.logoUrl;
    if (data.systemName                 !== undefined) row.system_name                 = data.systemName;
    if (data.inssCalculation            !== undefined) row.inss_calculation            = data.inssCalculation;
    if (data.noturnoCalculation         !== undefined) row.noturno_calculation         = data.noturnoCalculation;
    if (data.fgtsCalculation            !== undefined) row.fgts_calculation            = data.fgtsCalculation;
    if (data.decimoTerceiroCalculation  !== undefined) row.decimo_terceiro_calculation  = data.decimoTerceiroCalculation;
    if (data.irrfCalculation            !== undefined) row.irrf_calculation            = data.irrfCalculation;
    if (data.resetTokens                !== undefined) row.reset_tokens                = data.resetTokens;
    if (data.filters                    !== undefined) row.filters                     = data.filters;
    return row;
}

// Helper: obter user_id do auth atual
async function _getAuthUserId() {
    const { data: { session } } = await _supabase.auth.getSession();
    return session?.user?.id || null;
}

// Helper: cria objeto de coleção com .toArray() e .first()
function _createCollection(queryFn, mapFn) {
    return {
        toArray: async () => {
            const data = await queryFn();
            return (data || []).map(mapFn);
        },
        first: async () => {
            const data = await queryFn();
            return (data && data.length > 0) ? mapFn(data[0]) : null;
        }
    };
}

// ─────────────────────────────────────────────
// OBJETO db — API COMPATÍVEL COM DEXIE
// ─────────────────────────────────────────────

const db = {

    // ── USERS ──────────────────────────────────────────────────────────
    users: {
        async get(id) {
            const { data, error } = await _supabase
                .from('users').select('*').eq('id', String(id)).maybeSingle();
            if (error) throw error;
            return _mapUserFromDB(data);
        },

        async toArray() {
            const { data, error } = await _supabase
                .from('users').select('*').order('name');
            if (error) throw error;
            return (data || []).map(_mapUserFromDB);
        },

        where(field) {
            // Suporte a compound where: { userId: x, date: y }
            if (typeof field === 'object') {
                const conditions = field;
                return _createCollection(async () => {
                    let q = _supabase.from('users').select('*');
                    for (const [key, val] of Object.entries(conditions)) {
                        const dbKey = { userId: 'user_id' }[key] || key;
                        q = q.eq(dbKey, val);
                    }
                    const { data, error } = await q;
                    if (error) throw error;
                    return data;
                }, _mapUserFromDB);
            }
            // Campo simples: .where('email').equals('...')
            return {
                equals: (value) => {
                    const dbField = { userId: 'user_id' }[field] || field;
                    return _createCollection(async () => {
                        const { data, error } = await _supabase
                            .from('users').select('*').eq(dbField, value);
                        if (error) throw error;
                        return data;
                    }, _mapUserFromDB);
                }
            };
        },

        async add(data) {
            // Usado apenas pelo admin ao adicionar funcionário manualmente
            // O ID deve ser fornecido em data.id (UUID do Supabase Auth)
            const row = { ...{ id: data.id }, ..._mapUserToDB(data) };
            const { error } = await _supabase.from('users').insert(row);
            if (error) throw error;
        },

        async update(id, data) {
            // Se houver senha, precisa atualizar via RPC primeiro (auth.users)
            if (data.password) {
                const { error: pwdError } = await _supabase.rpc('admin_update_user_password', { 
                    target_user_id: id, 
                    new_password: data.password 
                });
                if (pwdError) throw pwdError;
            }

            if (data.admissionDate !== undefined) {
                if (data.admissionDate) {
                    localStorage.setItem('user_admission_date_' + id, data.admissionDate);
                } else {
                    localStorage.removeItem('user_admission_date_' + id);
                }
            }

            const row = _mapUserToDB(data);
            if (Object.keys(row).length > 0) {
                try {
                    const { error } = await _supabase
                        .from('users').update(row).eq('id', String(id));
                    if (error) throw error;
                } catch (err) {
                    if (err && err.message && (err.message.includes('admission_date') || err.code === '42703' || err.code === 'PGRST204')) {
                        console.warn('[db.users] Coluna admission_date ainda não criada no Supabase. Salvo localmente.');
                        delete row.admission_date;
                        if (Object.keys(row).length > 0) {
                            const { error: err2 } = await _supabase
                                .from('users').update(row).eq('id', String(id));
                            if (err2) throw err2;
                        }
                    } else {
                        throw err;
                    }
                }
            }
        },

        async delete(id) {
            // Usa a RPC que criamos para garantir que o usuário seja removido 
            // tanto de auth.users quanto de public.users
            const { error } = await _supabase.rpc('admin_delete_user', { target_user_id: id });
            if (error) throw error;
        },

        async clear() {
            // Remove todos exceto o admin atual (proteção básica)
            const { data: { session } } = await _supabase.auth.getSession();
            const currentId = session?.user?.id || '';
            const { error } = await _supabase
                .from('users').delete().neq('id', currentId);
            if (error) throw error;
        }
    },

    // ── TIME RECORDS ───────────────────────────────────────────────────
    timeRecords: {
        async get(id) {
            const { data, error } = await _supabase
                .from('registros').select('*').eq('id', String(id)).maybeSingle();
            if (error) throw error;
            return _mapRecordFromDB(data);
        },

        async toArray() {
            const { data, error } = await _supabase
                .from('registros').select('*').order('date', { ascending: false });
            if (error) throw error;
            return (data || []).map(_mapRecordFromDB);
        },

        toCollection() {
            return _createCollection(async () => {
                const { data, error } = await _supabase
                    .from('registros').select('*').order('date', { ascending: false });
                if (error) throw error;
                return data;
            }, _mapRecordFromDB);
        },

        where(field) {
            // Compound where: { userId: x, date: y }
            if (typeof field === 'object') {
                const conditions = field;
                return _createCollection(async () => {
                    let q = _supabase.from('registros').select('*');
                    for (const [key, val] of Object.entries(conditions)) {
                        const dbKey = { userId: 'user_id', tipoExtra: 'tipo_extra' }[key] || key;
                        q = q.eq(dbKey, val);
                    }
                    const { data, error } = await q;
                    if (error) throw error;
                    return data;
                }, _mapRecordFromDB);
            }
            // Campo simples
            return {
                equals: (value) => {
                    const dbField = { userId: 'user_id', tipoExtra: 'tipo_extra' }[field] || field;
                    return _createCollection(async () => {
                        const { data, error } = await _supabase
                            .from('registros').select('*').eq(dbField, value)
                            .order('date', { ascending: false });
                        if (error) throw error;
                        return data;
                    }, _mapRecordFromDB);
                }
            };
        },

        async add(data) {
            const row = _mapRecordToDB(data);
            const { data: result, error } = await _supabase
                .from('registros').insert(row).select('id').single();
            if (error) throw error;
            return result.id;
        },

        async put(data) {
            const row = _mapRecordToDB(data);
            if (data.id) {
                // Atualizar registro existente
                const { error } = await _supabase
                    .from('registros').update(row).eq('id', String(data.id));
                if (error) throw error;
            } else {
                // Inserir novo
                const { error } = await _supabase.from('registros').insert(row);
                if (error) throw error;
            }
        },

        async delete(id) {
            const { error } = await _supabase
                .from('registros').delete().eq('id', String(id));
            if (error) throw error;
        },

        async clear() {
            // Admin: apagar todos os registros
            const { error } = await _supabase
                .from('registros').delete().not('id', 'is', null);
            if (error) throw error;
        },

        // Compatibilidade com bulkDelete (usado em admin.js)
        async bulkDelete(ids) {
            if (!ids || ids.length === 0) return;
            const { data, error } = await _supabase
                .from('registros').delete().in('id', ids.map(String));
            if (error) throw error;
        }
    },

    // ── SETTINGS (per-user isolation) ──────────────────────────────────
    settings: {
        /**
         * Busca settings. Se id === 'global' ou undefined, retorna do user logado.
         * Se id for um UUID específico, busca por aquele user_id (admin only via RLS).
         */
        async get(id) {
            let userId = id;
            if (!userId || userId === 'global') {
                // Obter user_id da sessão logada
                userId = await _getAuthUserId();
                if (!userId) return null;
            }
            
            const { data, error } = await _supabase
                .from('settings').select('*').eq('user_id', userId).maybeSingle();
            if (error) throw error;
            return _mapSettingsFromDB(data);
        },

        /**
         * Atualiza settings. Se id === 'global' ou undefined, atualiza do user logado.
         * Usa upsert para criar se não existir.
         */
        async update(id, data) {
            let userId = id;
            if (!userId || userId === 'global') {
                userId = await _getAuthUserId();
                if (!userId) throw new Error('Usuário não autenticado');
            }
            if (data.fgtsCalculation !== undefined) {
                localStorage.setItem('ponto_fgts_calculation', String(data.fgtsCalculation));
            }
            if (data.decimoTerceiroCalculation !== undefined) {
                localStorage.setItem('ponto_decimo_terceiro_calculation', String(data.decimoTerceiroCalculation));
            }
            if (data.irrfCalculation !== undefined) {
                localStorage.setItem('ponto_irrf_calculation', String(data.irrfCalculation));
            }
            let row = _mapSettingsToDB(data);
            
            try {
                const { data: updated, error: updateError } = await _supabase
                    .from('settings').update(row).eq('user_id', userId).select();
                
                if (updateError) throw updateError;
                
                if (!updated || updated.length === 0) {
                    const { error: insertError } = await _supabase
                        .from('settings').insert({ user_id: userId, ...row });
                    if (insertError) throw insertError;
                }
            } catch (err) {
                if (err && err.message && (err.message.includes('irrf_calculation') || err.message.includes('decimo_terceiro_calculation') || err.message.includes('fgts_calculation') || err.code === '42703' || err.code === 'PGRST204')) {
                    delete row.irrf_calculation;
                    delete row.decimo_terceiro_calculation;
                    delete row.fgts_calculation;
                    const { data: updated2, error: err2 } = await _supabase
                        .from('settings').update(row).eq('user_id', userId).select();
                    if (err2) throw err2;
                    if (!updated2 || updated2.length === 0) {
                        const { error: insertError2 } = await _supabase
                            .from('settings').insert({ user_id: userId, ...row });
                        if (insertError2) throw insertError2;
                    }
                } else {
                    throw err;
                }
            }
        },

        async put(data) {
            let userId = data.userId || data.id;
            if (!userId || userId === 'global') {
                userId = await _getAuthUserId();
                if (!userId) throw new Error('Usuário não autenticado');
            }
            if (data.fgtsCalculation !== undefined) {
                localStorage.setItem('ponto_fgts_calculation', String(data.fgtsCalculation));
            }
            if (data.decimoTerceiroCalculation !== undefined) {
                localStorage.setItem('ponto_decimo_terceiro_calculation', String(data.decimoTerceiroCalculation));
            }
            if (data.irrfCalculation !== undefined) {
                localStorage.setItem('ponto_irrf_calculation', String(data.irrfCalculation));
            }
            let row = _mapSettingsToDB(data);
            
            try {
                const { data: updated, error: updateError } = await _supabase
                    .from('settings').update(row).eq('user_id', userId).select();
                
                if (updateError) throw updateError;
                
                if (!updated || updated.length === 0) {
                    const { error: insertError } = await _supabase
                        .from('settings').insert({ user_id: userId, ...row });
                    if (insertError) throw insertError;
                }
            } catch (err) {
                if (err && err.message && (err.message.includes('irrf_calculation') || err.message.includes('decimo_terceiro_calculation') || err.message.includes('fgts_calculation') || err.code === '42703' || err.code === 'PGRST204')) {
                    delete row.irrf_calculation;
                    delete row.decimo_terceiro_calculation;
                    delete row.fgts_calculation;
                    const { data: updated2, error: err2 } = await _supabase
                        .from('settings').update(row).eq('user_id', userId).select();
                    if (err2) throw err2;
                    if (!updated2 || updated2.length === 0) {
                        const { error: insertError2 } = await _supabase
                            .from('settings').insert({ user_id: userId, ...row });
                        if (insertError2) throw insertError2;
                    }
                } else {
                    throw err;
                }
            }
        },

        async add(data) {
            let userId = data.userId || data.id;
            if (!userId || userId === 'global') {
                userId = await _getAuthUserId();
                if (!userId) throw new Error('Usuário não autenticado');
            }
            const row = { user_id: userId, ..._mapSettingsToDB(data) };
            const { error } = await _supabase.from('settings').insert(row);
            if (error) throw error;
        }
    }
};

// ─────────────────────────────────────────────
// UTILITÁRIOS GLOBAIS
// ─────────────────────────────────────────────

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error')   icon = 'fa-circle-xmark';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            if (container.contains(toast)) container.removeChild(toast);
        }, 300);
    }, 3000);
}

/**
 * Calcula o desconto do INSS de acordo com as faixas progressivas de 2026.
 */
window.calculateINSS = function(grossSalary) {
    if (grossSalary <= 0) return 0;
    let inss = 0;
    if (grossSalary <= 1621.00) {
        inss = grossSalary * 0.075;
    } else if (grossSalary <= 2902.84) {
        inss = (1621.00 * 0.075) + ((grossSalary - 1621.00) * 0.09);
    } else if (grossSalary <= 4354.27) {
        inss = (1621.00 * 0.075) + ((2902.84 - 1621.00) * 0.09) + ((grossSalary - 2902.84) * 0.12);
    } else {
        const limit = Math.min(grossSalary, 8475.55);
        inss = (1621.00 * 0.075) + ((2902.84 - 1621.00) * 0.09) + ((4354.27 - 2902.84) * 0.12) + ((limit - 4354.27) * 0.14);
    }
    return Number(inss.toFixed(2));
};

/**
 * Calcula o valor do FGTS mensal de acordo com a CLT (Art. 15 da Lei nº 8.036/1990).
 * O FGTS é uma obrigação do empregador (8% sobre a remuneração mensal bruta:
 * salário base + horas extras + adicionais).
 * Não é descontado do salário líquido do trabalhador.
 */
window.calculateFGTS = function(grossSalary) {
    if (grossSalary <= 0) return 0;
    return Number((grossSalary * 0.08).toFixed(2));
};

/**
 * Calcula o 13º salário de acordo com a CLT (Lei nº 4.090/1962, Lei nº 4.749/1965 e Súmulas TST).
 * 
 * Regras Oficiais da CLT:
 * 1. Proporcionalidade dos Avos (Art. 1º, § 1º e § 2º da Lei 4.090/1962):
 *    - A gratificação corresponde a 1/12 da remuneração devida por mês trabalhado no ano.
 *    - Fração igual ou superior a 15 dias trabalhados no mês conta como 1 mês integral (1 avo).
 *    - No decorrer do ano, na competência mensal consultada (ex: Outubro = mês 10), o funcionário
 *      acumulou os avos decorridos até o respectivo mês (ex: 10/12 avos como provisão acumulada).
 *    - Em Dezembro (ou na quitação final), atinge o total de avos do ano (12/12 Integral para vínculo regular).
 * 
 * 2. Parcelas Oficiais (Lei nº 4.749/1965):
 *    - 1ª Parcela (Adiantamento): Paga entre 1º de fevereiro e 30 de novembro.
 *      Equivale a 50% do valor total devido no ano, SEM incidência de descontos (INSS/IRRF).
 *    - 2ª Parcela (Saldo final): Paga até 20 de dezembro.
 *      Deduz a 1ª parcela adiantada e sofre incidência exclusiva de INSS e IRRF sobre o valor integral do 13º.
 * 
 * 3. Base Remuneratória (CLT Art. 457, Súmulas 45 e 60 do TST):
 *    - Inclui o salário base somado às médias habituais de horas extras e adicionais.
 * 
 * @param {number} baseSalary - Salário base (ou remuneração)
 * @param {string} admissionDateStr - Data de admissão ('YYYY-MM-DD')
 * @param {string} refMonthStr - Mês de referência ('YYYY-MM')
 * @param {number} [mediaExtras=0] - Média de adicionais/horas extras habituais
 */
window.calculateDecimoTerceiro = function(baseSalary, admissionDateStr, refMonthStr, mediaExtras = 0) {
    const remuneracaoBase = Number((Number(baseSalary || 0) + Number(mediaExtras || 0)).toFixed(2));
    if (remuneracaoBase <= 0) {
        return {
            avos: 0,
            valor: 0,
            valorIntegralAno: 0,
            valorProporcionalMes: 0,
            avosAcumuladosMes: 0,
            totalAvosAno: 12,
            isIntegral: true,
            isCompetenciaIntegral: false,
            mesesEmpresa: 0,
            admissaoFormatada: '—',
            primeiraParcela: 0,
            segundaParcelaBruta: 0,
            inssDecimo: 0,
            irrfDecimo: 0,
            segundaParcela: 0,
            remuneracaoBase: 0,
            refMonth: 12,
            refYear: new Date().getFullYear()
        };
    }

    const now = new Date();
    let refYear = now.getFullYear();
    let refMonth = now.getMonth() + 1; // 1 a 12

    if (refMonthStr && typeof refMonthStr === 'string' && refMonthStr.includes('-')) {
        const parts = refMonthStr.split('-');
        refYear = parseInt(parts[0], 10) || refYear;
        refMonth = parseInt(parts[1], 10) || refMonth;
    }

    let avosAcumuladosMes = Math.min(12, Math.max(1, refMonth)); // Provisão até o mês filtrado
    let totalAvosAno = 12; // Total de avos devidos no ano completo
    let mesesEmpresa = 0;
    let admissaoFormatada = '—';
    let isAdmitidoAnoAtual = false;

    // Quantidade real de dias no mês
    function _diasNoMes(ano, mes) {
        return new Date(ano, mes, 0).getDate();
    }

    if (admissionDateStr && typeof admissionDateStr === 'string' && admissionDateStr.includes('-')) {
        const parts = admissionDateStr.split('-');
        const admYear = parseInt(parts[0], 10);
        const admMonth = parseInt(parts[1], 10);
        const admDay = parseInt(parts[2], 10);

        admissaoFormatada = String(admDay).padStart(2, '0') + '/' + String(admMonth).padStart(2, '0') + '/' + admYear;

        // Cálculo de meses totais de vínculo na empresa
        const diffMonths = ((refYear - admYear) * 12) + (refMonth - admMonth);
        const diasMesAdm = _diasNoMes(admYear, admMonth);
        const diasTrabalhadosAdm = Math.max(0, diasMesAdm - admDay + 1);
        const admMonthValido = (diasTrabalhadosAdm >= 15);

        mesesEmpresa = Math.max(0, diffMonths + (admMonthValido ? 1 : 0));

        if (admYear < refYear) {
            // Admitido em ano anterior: em refYear trabalhou desde 1º de janeiro
            totalAvosAno = 12;
            avosAcumuladosMes = Math.min(12, Math.max(0, refMonth));
            isAdmitidoAnoAtual = false;
        } else if (admYear === refYear) {
            // Admitido no próprio ano consultado
            isAdmitidoAnoAtual = true;
            const admMonthCount = admMonthValido ? 1 : 0;
            totalAvosAno = Math.min(12, Math.max(0, (12 - admMonth) + admMonthCount));

            if (refMonth < admMonth) {
                avosAcumuladosMes = 0;
            } else if (refMonth === admMonth) {
                avosAcumuladosMes = admMonthCount;
            } else {
                avosAcumuladosMes = Math.min(totalAvosAno, Math.max(0, (refMonth - admMonth) + admMonthCount));
            }
        } else {
            // Data futura ao ano consultado
            totalAvosAno = 0;
            avosAcumuladosMes = 0;
        }
    }

    const valorDevidoAno = Number(((remuneracaoBase / 12) * totalAvosAno).toFixed(2));
    const valorProporcionalMes = Number(((remuneracaoBase / 12) * avosAcumuladosMes).toFixed(2));

    // 1ª Parcela (50% do total anual devido, paga entre fevereiro e 30 de novembro - SEM descontos de INSS/IRRF)
    const primeiraParcela = Number((valorDevidoAno * 0.5).toFixed(2));

    // 2ª Parcela Bruta (Quitação final até 20 de dezembro)
    const segundaParcelaBruta = Number((valorDevidoAno - primeiraParcela).toFixed(2));

    // Descontos oficiais de INSS e IRRF sobre o valor total anual do 13º (tributação exclusiva)
    const inssDecimo = (typeof window.calculateINSS === 'function')
        ? window.calculateINSS(valorDevidoAno)
        : 0;

    const irrfInfoDecimo = (typeof window.calculateIRRF === 'function')
        ? window.calculateIRRF(valorDevidoAno, inssDecimo)
        : { valor: 0 };
    const irrfDecimo = irrfInfoDecimo ? (irrfInfoDecimo.valor || 0) : 0;

    // 2ª Parcela Líquida final a receber (deduz adiantamento da 1ª parcela, INSS e IRRF)
    const segundaParcelaLiquida = Math.max(0, Number((segundaParcelaBruta - inssDecimo - irrfDecimo).toFixed(2)));

    // Se consultado em Dezembro, a competência é integral
    const isCompetenciaIntegral = (avosAcumuladosMes === 12);

    return {
        // Avos e valores apurados para a competência consultada (provisão CLT)
        avos: avosAcumuladosMes,
        valor: isCompetenciaIntegral ? valorDevidoAno : valorProporcionalMes,
        valorIntegralAno: valorDevidoAno,
        valorProporcionalMes: valorProporcionalMes,
        avosAcumuladosMes: avosAcumuladosMes,
        totalAvosAno: totalAvosAno,
        isIntegral: (totalAvosAno === 12),
        isCompetenciaIntegral: isCompetenciaIntegral,
        isAdmitidoAnoAtual: isAdmitidoAnoAtual,
        mesesEmpresa: mesesEmpresa,
        admissaoFormatada: admissaoFormatada,
        primeiraParcela: primeiraParcela,
        segundaParcelaBruta: segundaParcelaBruta,
        inssDecimo: inssDecimo,
        irrfDecimo: irrfDecimo,
        segundaParcela: segundaParcelaLiquida,
        remuneracaoBase: remuneracaoBase,
        refMonth: refMonth,
        refYear: refYear
    };
};



/**
 * Calcula o desconto do Imposto de Renda Retido na Fonte (IRRF) conforme
 * a Lei nº 15.270/2025 (novas regras de 2026) e Lei nº 15.191/2025 (tabela progressiva).
 * 
 * Regras Oficiais da Receita Federal:
 * 1. Rendimentos até R$ 5.000,00:
 *    - Isenção total garantida por lei (imposto final = R$ 0,00).
 * 2. Rendimentos de R$ 5.000,01 até R$ 7.350,00 (Faixa de Transição):
 *    - Aplica-se a tabela progressiva oficial sobre a base deduzida.
 *    - Aplica-se o Redutor Decrescente da Lei nº 15.270/2025:
 *      Redução = 978,62 - (0,133145 * Remuneração Bruta)
 *    - Aplica-se a opção mais favorável ao trabalhador (dedução legal de INSS ou desconto simplificado de R$ 607,20).
 *    - Imposto Final = max(0, Imposto da Tabela - Redução).
 * 3. Rendimentos acima de R$ 7.350,00:
 *    - Tabela progressiva integral sem redutor adicional.
 * 
 * @param {number} grossSalary - Remuneração bruta total mensal (Salário base + Horas extras + Adicionais)
 * @param {number} [inssDiscount] - Valor da contribuição ao INSS retida no mês
 * @returns {object} Detalhamento completo do cálculo do IRRF 2026
 */
window.calculateIRRF = function(grossSalary, inssDiscount) {
    if (!grossSalary || grossSalary <= 0) {
        return {
            valor: 0,
            baseCalculo: 0,
            salarioBruto: 0,
            inss: 0,
            aliquotaNominal: 0,
            aliquotaEfetiva: 0,
            impostoTabela: 0,
            reducao2026: 0,
            deducaoUtilizada: 0,
            tipoDeducao: 'Nenhuma',
            isIsento: true,
            regra: 'Isento'
        };
    }

    // 1. INSS oficial
    const inssVal = (typeof inssDiscount === 'number' && inssDiscount >= 0)
        ? inssDiscount
        : ((typeof window.calculateINSS === 'function') ? window.calculateINSS(grossSalary) : 0);

    // 2. Isenção total da Lei 15.270/2025 para remuneração de até R$ 5.000,00
    if (grossSalary <= 5000.00) {
        const baseINSS = Math.max(0, grossSalary - inssVal);
        return {
            valor: 0,
            baseCalculo: Number(baseINSS.toFixed(2)),
            salarioBruto: grossSalary,
            inss: inssVal,
            aliquotaNominal: 0,
            aliquotaEfetiva: 0,
            impostoTabela: 0,
            reducao2026: 0,
            deducaoUtilizada: inssVal,
            tipoDeducao: 'Isenção Integral',
            isIsento: true,
            regra: 'Isento até R$ 5.000 (Lei 15.270/26)'
        };
    }

    // 3. Tabela Progressiva Oficial Mensal (Lei nº 15.191/2025)
    function calcImpostoBruto(base) {
        if (base <= 2428.80) return { imposto: 0, aliq: 0, deduc: 0 };
        if (base <= 2826.65) return { imposto: Math.max(0, (base * 0.075) - 182.16), aliq: 7.5, deduc: 182.16 };
        if (base <= 3751.05) return { imposto: Math.max(0, (base * 0.15) - 394.16), aliq: 15.0, deduc: 394.16 };
        if (base <= 4664.68) return { imposto: Math.max(0, (base * 0.225) - 675.49), aliq: 22.5, deduc: 675.49 };
        return { imposto: Math.max(0, (base * 0.275) - 908.73), aliq: 27.5, deduc: 908.73 };
    }

    // 4. Redutor da Lei nº 15.270/2025 para a faixa de transição (R$ 5.000,01 a R$ 7.350,00)
    let reducao2026 = 0;
    let regraDesc = 'Tabela Progressiva 2026';

    if (grossSalary <= 7350.00) {
        reducao2026 = Math.max(0, 978.62 - (0.133145 * grossSalary));
        regraDesc = 'Faixa Transição 2026 (com Redutor)';
    }

    // 5. Comparar deduções legais: INSS real vs Desconto Simplificado (R$ 607,20)
    // A Receita Federal assegura a aplicação do desconto mais vantajoso ao trabalhador
    const baseINSS = Math.max(0, grossSalary - inssVal);
    const impostoINSS = calcImpostoBruto(baseINSS);
    const finalINSS = Math.max(0, impostoINSS.imposto - reducao2026);

    const deducaoSimplificada = 607.20;
    const baseSimp = Math.max(0, grossSalary - deducaoSimplificada);
    const impostoSimp = calcImpostoBruto(baseSimp);
    const finalSimp = Math.max(0, impostoSimp.imposto - reducao2026);

    let baseFinal = baseINSS;
    let deducaoFinal = inssVal;
    let tipoDeducao = 'Dedução INSS';
    let impostoTabela = impostoINSS.imposto;
    let aliquotaNominal = impostoINSS.aliq;
    let impostoFinal = finalINSS;

    if (finalSimp < finalINSS) {
        baseFinal = baseSimp;
        deducaoFinal = deducaoSimplificada;
        tipoDeducao = 'Desconto Simplificado';
        impostoTabela = impostoSimp.imposto;
        aliquotaNominal = impostoSimp.aliq;
        impostoFinal = finalSimp;
    }

    const impostoArredondado = Number(impostoFinal.toFixed(2));

    return {
        valor: impostoArredondado,
        baseCalculo: Number(baseFinal.toFixed(2)),
        salarioBruto: grossSalary,
        inss: inssVal,
        aliquotaNominal: aliquotaNominal,
        aliquotaEfetiva: Number(((impostoArredondado / grossSalary) * 100).toFixed(2)),
        impostoTabela: Number(impostoTabela.toFixed(2)),
        reducao2026: Number(reducao2026.toFixed(2)),
        deducaoUtilizada: Number(deducaoFinal.toFixed(2)),
        tipoDeducao: tipoDeducao,
        isIsento: impostoArredondado <= 0,
        regra: regraDesc
    };
};

