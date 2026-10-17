// js/db.js — Camada de Compatibilidade Supabase
// Substitui o Dexie/IndexedDB. Mantém a mesma API usada pelos outros arquivos JS.

// ─────────────────────────────────────────────
// HELPERS DE MAPEAMENTO (snake_case ↔ camelCase)
// ─────────────────────────────────────────────

function _mapUserFromDB(row) {
    if (!row) return null;
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
    return {
        id:                  row.user_id,
        userId:              row.user_id,
        theme:               row.theme,
        primaryColor:        row.primary_color,
        logoUrl:             row.logo_url,
        systemName:          row.system_name,
        inssCalculation:     row.inss_calculation,
        noturnoCalculation:  row.noturno_calculation,
        fgtsCalculation:     row.fgts_calculation !== undefined && row.fgts_calculation !== null
                                ? !!row.fgts_calculation
                                : (localFgts === 'true'),
        resetTokens:         row.reset_tokens,
        filters:             row.filters || {}
    };
}

function _mapSettingsToDB(data) {
    const row = {};
    if (data.theme              !== undefined) row.theme               = data.theme;
    if (data.primaryColor       !== undefined) row.primary_color       = data.primaryColor;
    if (data.logoUrl            !== undefined) row.logo_url            = data.logoUrl;
    if (data.systemName         !== undefined) row.system_name         = data.systemName;
    if (data.inssCalculation    !== undefined) row.inss_calculation    = data.inssCalculation;
    if (data.noturnoCalculation !== undefined) row.noturno_calculation = data.noturnoCalculation;
    if (data.fgtsCalculation    !== undefined) row.fgts_calculation    = data.fgtsCalculation;
    if (data.resetTokens        !== undefined) row.reset_tokens        = data.resetTokens;
    if (data.filters            !== undefined) row.filters             = data.filters;
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

            const row = _mapUserToDB(data);
            if (Object.keys(row).length > 0) {
                const { error } = await _supabase
                    .from('users').update(row).eq('id', String(id));
                if (error) throw error;
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
                if (err && err.message && (err.message.includes('fgts_calculation') || err.code === '42703' || err.code === 'PGRST204')) {
                    console.warn('[db.settings] Coluna fgts_calculation ainda não criada no Supabase. Salvo localmente.');
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
                if (err && err.message && (err.message.includes('fgts_calculation') || err.code === '42703' || err.code === 'PGRST204')) {
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
