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
 * Calcula o 13º salário de acordo com a CLT (Lei 4.090/1962 e Lei 4.749/1965).
 * - Funcionários com mais de 1 ano de empresa (admitidos em anos anteriores) têm direito
 *   ao 13º INTEGRAL (12/12 avos = salário integral).
 * - Funcionários admitidos no próprio ano corrente recebem proporcional aos meses trabalhados
 *   (a cada mês com 15 dias ou mais trabalhados = 1/12 avos).
 * 
 * @param {number} baseSalary - Salário base
 * @param {string} admissionDateStr - Data de admissão ('YYYY-MM-DD')
 * @param {string} refMonthStr - Mês de referência ('YYYY-MM')
 */
window.calculateDecimoTerceiro = function(baseSalary, admissionDateStr, refMonthStr) {
    if (!baseSalary || baseSalary <= 0) {
        return {
            avos: 0,
            valor: 0,
            valorIntegralAno: 0,
            valorProporcionalMes: 0,
            avosAcumuladosMes: 0,
            totalAvosAno: 12,
            isIntegral: true,
            mesesEmpresa: 0,
            admissaoFormatada: '—',
            primeiraParcela: 0,
            segundaParcela: 0
        };
    }

    const now = new Date();
    let refYear = now.getFullYear();
    let refMonth = now.getMonth() + 1; // 1 a 12

    if (refMonthStr && refMonthStr.includes('-')) {
        const parts = refMonthStr.split('-');
        refYear = parseInt(parts[0], 10) || refYear;
        refMonth = parseInt(parts[1], 10) || refMonth;
    }

    let avosDireito = 12; // Avos totais devidos no ano
    let avosAcumuladosMes = Math.min(12, Math.max(1, refMonth)); // Provisão até o mês filtrado
    let mesesEmpresa = 0;
    let admissaoFormatada = '—';
    let isAdmitidoAnoAtual = false;

    if (admissionDateStr && admissionDateStr.includes('-')) {
        const parts = admissionDateStr.split('-');
        const admYear = parseInt(parts[0], 10);
        const admMonth = parseInt(parts[1], 10);
        const admDay = parseInt(parts[2], 10);

        admissaoFormatada = `${String(admDay).padStart(2, '0')}/${String(admMonth).padStart(2, '0')}/${admYear}`;

        // Cálculo de meses totais de casa
        const diffMonths = ((refYear - admYear) * 12) + (refMonth - admMonth);
        mesesEmpresa = Math.max(0, diffMonths + (admDay <= 15 ? 1 : 0));

        if (admYear < refYear) {
            // Admitido antes do ano consultado (ex: admitido em 2020 e ano consultado 2026):
            // O colaborador tem mais de 1 ano de empresa e trabalhou o ano todo -> 13º INTEGRAL (12/12)
            avosDireito = 12;
            avosAcumuladosMes = Math.min(12, Math.max(0, refMonth));
            isAdmitidoAnoAtual = false;
        } else if (admYear === refYear) {
            // Admitido NO MESMO ANO: cálculo proporcional aos meses a partir da admissão
            isAdmitidoAnoAtual = true;
            const admMonthCount = (admDay <= 15) ? 1 : 0;
            avosDireito = Math.min(12, Math.max(0, (12 - admMonth) + admMonthCount));
            if (refMonth < admMonth) {
                avosAcumuladosMes = 0;
            } else if (refMonth === admMonth) {
                avosAcumuladosMes = admMonthCount;
            } else {
                avosAcumuladosMes = Math.min(avosDireito, Math.max(0, (refMonth - admMonth) + admMonthCount));
            }
        } else {
            // Data de admissão futura ao ano consultado
            avosDireito = 0;
            avosAcumuladosMes = 0;
        }
    }

    const valorDevidoAno = Number(((baseSalary / 12) * avosDireito).toFixed(2));
    const valorProporcionalMes = Number(((baseSalary / 12) * avosAcumuladosMes).toFixed(2));

    return {
        avos: avosDireito,
        valor: valorDevidoAno, // Valor principal: para funcionários com mais de 1 ano, é o 13º integral (12/12)
        valorIntegralAno: valorDevidoAno,
        valorProporcionalMes: valorProporcionalMes,
        avosAcumuladosMes: avosAcumuladosMes,
        totalAvosAno: avosDireito,
        isIntegral: (avosDireito === 12),
        isAdmitidoAnoAtual: isAdmitidoAnoAtual,
        mesesEmpresa: mesesEmpresa,
        admissaoFormatada: admissaoFormatada,
        primeiraParcela: Number((valorDevidoAno * 0.5).toFixed(2)),
        segundaParcela: Number((valorDevidoAno * 0.5).toFixed(2))
    };
};

/**
 * Calcula o desconto do Imposto de Renda Retido na Fonte (IRRF) conforme
 * as novas regras de 2026 (Lei nº 15.270/2025).
 * 
 * Regras principais de 2026:
 * 1. Isenção Total: Rendimentos brutos até R$ 5.000,00 possuem imposto R$ 0,00.
 * 2. Faixa de Transição (R$ 5.000,01 a R$ 7.350,00):
 *    - Calcula a base de cálculo tributável: Salário Bruto deduzido do INSS ou
 *      da dedução simplificada mensal (R$ 607,20), aplicando a dedução mais vantajosa.
 *    - Aplica a tabela progressiva oficial.
 *    - Aplica a Redução Adicional de 2026: Redução = 978,62 - (0,133145 * Salário Bruto).
 *    - Imposto devido = max(0, Imposto da Tabela - Redução).
 * 3. Acima de R$ 7.350,00:
 *    - Imposto calculado pela tabela progressiva integralmente.
 * 
 * @param {number} grossSalary - Rendimento mensal bruto (Salário base + Horas extras + Adicionais)
 * @param {number} [inssDiscount] - Valor do INSS já apurado no mês
 * @returns {object} Detalhamento completo do cálculo do IRRF
 */
window.calculateIRRF = function(grossSalary, inssDiscount) {
    if (!grossSalary || grossSalary <= 0) {
        return {
            valor: 0,
            baseCalculo: 0,
            salarioBruto: 0,
            aliquotaNominal: 0,
            aliquotaEfetiva: 0,
            impostoTabela: 0,
            reducao2026: 0,
            deducaoUtilizada: 0,
            isIsento: true,
            regra: 'Isento'
        };
    }

    // Regra 1: Isenção geral para salário bruto de até R$ 5.000,00
    if (grossSalary <= 5000.00) {
        return {
            valor: 0,
            baseCalculo: grossSalary,
            salarioBruto: grossSalary,
            aliquotaNominal: 0,
            aliquotaEfetiva: 0,
            impostoTabela: 0,
            reducao2026: 0,
            deducaoUtilizada: 0,
            isIsento: true,
            regra: 'Isento até R$ 5.000,00 (Lei 15.270/2026)'
        };
    }

    // Determinar o INSS para dedução da base de cálculo
    const inssVal = (typeof inssDiscount === 'number' && inssDiscount >= 0)
        ? inssDiscount
        : ((typeof window.calculateINSS === 'function') ? window.calculateINSS(grossSalary) : 0);

    // Comparar dedução legal (INSS) com o desconto simplificado padrão (R$ 607,20)
    // Conforme regra da Receita Federal, aplica-se o mais vantajoso ao trabalhador
    const deducaoSimplificada = 607.20;
    const deducaoUtilizada = Math.max(inssVal, deducaoSimplificada);
    const baseCalculo = Math.max(0, grossSalary - deducaoUtilizada);

    // Tabela Progressiva Padrão do IRRF:
    // Faixa 1: Até 2.428,80 -> Isento
    // Faixa 2: 2.428,81 até 2.826,65 -> 7,5% (dedução 182,16)
    // Faixa 3: 2.826,66 até 3.751,05 -> 15%  (dedução 394,16)
    // Faixa 4: 3.751,06 até 4.664,68 -> 22,5% (dedução 675,49)
    // Faixa 5: Acima de 4.664,68     -> 27,5% (dedução 908,73)
    let aliquota = 0;
    let parcelaDeduzir = 0;

    if (baseCalculo <= 2428.80) {
        aliquota = 0;
        parcelaDeduzir = 0;
    } else if (baseCalculo <= 2826.65) {
        aliquota = 0.075;
        parcelaDeduzir = 182.16;
    } else if (baseCalculo <= 3751.05) {
        aliquota = 0.15;
        parcelaDeduzir = 394.16;
    } else if (baseCalculo <= 4664.68) {
        aliquota = 0.225;
        parcelaDeduzir = 675.49;
    } else {
        aliquota = 0.275;
        parcelaDeduzir = 908.73;
    }

    const impostoTabela = Math.max(0, (baseCalculo * aliquota) - parcelaDeduzir);

    // Regra 2: Faixa de Transição 2026 (R$ 5.000,01 a R$ 7.350,00)
    // Fórmula do redutor de 2026: 978,62 - (0,133145 * Salário Bruto)
    let reducao2026 = 0;
    let regraDesc = 'Tabela Progressiva 2026';

    if (grossSalary <= 7350.00) {
        reducao2026 = Math.max(0, 978.62 - (0.133145 * grossSalary));
        regraDesc = 'Faixa Transição 2026 (com Redutor)';
    }

    const impostoFinal = Math.max(0, impostoTabela - reducao2026);
    const impostoFinalArredondado = Number(impostoFinal.toFixed(2));

    return {
        valor: impostoFinalArredondado,
        baseCalculo: Number(baseCalculo.toFixed(2)),
        salarioBruto: grossSalary,
        aliquotaNominal: aliquota * 100,
        aliquotaEfetiva: Number(((impostoFinalArredondado / grossSalary) * 100).toFixed(2)),
        impostoTabela: Number(impostoTabela.toFixed(2)),
        reducao2026: Number(reducao2026.toFixed(2)),
        deducaoUtilizada: Number(deducaoUtilizada.toFixed(2)),
        isIsento: impostoFinalArredondado <= 0,
        regra: regraDesc
    };
};

