/**
 * js/imc.js
 * Módulo de Cálculo de Índice de Massa Corporal (IMC) e Indicadores de Saúde
 * Padrão OMS (Organização Mundial da Saúde)
 */

(function () {
    // Estado local
    let currentGender = 'm';
    const STORAGE_KEY = 'ponto_imc_history';

    // Inicialização da Tela
    window.initIMCScreen = function () {
        setupEventListeners();
        loadHistory();
        calculateIMC(); // Cálculo inicial com valores padrão
    };

    function setupEventListeners() {
        // Inputs numéricos
        const inputHeight = document.getElementById('imc-height');
        const inputWeight = document.getElementById('imc-weight');
        const inputAge    = document.getElementById('imc-age');

        // Sliders
        const sliderHeight = document.getElementById('slider-height');
        const sliderWeight = document.getElementById('slider-weight');
        const sliderAge    = document.getElementById('slider-age');

        if (!inputHeight || !inputWeight) return;

        // Sincronização Altura
        inputHeight.addEventListener('input', () => {
            let val = normalizeNumber(inputHeight.value);
            // Se usuário digitou em centímetros (ex: 175)
            if (val > 3.0) val = val / 100;
            if (val >= 1.0 && val <= 2.3) {
                if (sliderHeight) sliderHeight.value = val;
            }
            calculateIMC();
        });

        if (sliderHeight) {
            sliderHeight.addEventListener('input', () => {
                inputHeight.value = parseFloat(sliderHeight.value).toFixed(2);
                calculateIMC();
            });
        }

        // Sincronização Peso
        inputWeight.addEventListener('input', () => {
            let val = normalizeNumber(inputWeight.value);
            if (val >= 30 && val <= 220 && sliderWeight) {
                sliderWeight.value = val;
            }
            calculateIMC();
        });

        if (sliderWeight) {
            sliderWeight.addEventListener('input', () => {
                inputWeight.value = parseFloat(sliderWeight.value).toFixed(1);
                calculateIMC();
            });
        }

        // Sincronização Idade
        if (inputAge) {
            inputAge.addEventListener('input', () => {
                let val = parseInt(inputAge.value) || 0;
                if (val >= 10 && val <= 100 && sliderAge) {
                    sliderAge.value = val;
                }
                calculateIMC();
            });
        }

        if (sliderAge && inputAge) {
            sliderAge.addEventListener('input', () => {
                inputAge.value = sliderAge.value;
                calculateIMC();
            });
        }

        // Botões Steppers
        setupStepper('btn-height-minus', 'btn-height-plus', inputHeight, sliderHeight, -0.01, 2, 1.0, 2.3);
        setupStepper('btn-weight-minus', 'btn-weight-plus', inputWeight, sliderWeight, -0.5, 1, 30, 220);
        setupStepper('btn-age-minus', 'btn-age-plus', inputAge, sliderAge, -1, 0, 10, 100);

        // Seletor de Gênero
        const genderBtns = document.querySelectorAll('.gender-btn');
        genderBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                genderBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentGender = btn.dataset.gender || 'm';
                calculateIMC();
            });
        });

        // Botão Calcular
        const btnCalc = document.getElementById('btn-imc-calculate');
        if (btnCalc) {
            btnCalc.addEventListener('click', (e) => {
                e.preventDefault();
                calculateIMC();
                if (typeof showToast === 'function') {
                    showToast('Cálculo de IMC atualizado com sucesso!', 'success');
                }
            });
        }

        // Botão Limpar / Resetar
        const btnReset = document.getElementById('btn-imc-reset');
        if (btnReset) {
            btnReset.addEventListener('click', (e) => {
                e.preventDefault();
                resetForm();
            });
        }

        // Botão Salvar Histórico
        const btnSave = document.getElementById('btn-imc-save');
        if (btnSave) {
            btnSave.addEventListener('click', (e) => {
                e.preventDefault();
                saveCurrentEvaluation();
            });
        }

        // Botão Limpar Todo o Histórico
        const btnClearHist = document.getElementById('btn-clear-history');
        if (btnClearHist) {
            btnClearHist.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Deseja realmente limpar todo o histórico de avaliações de IMC?')) {
                    localStorage.removeItem(getStorageKey());
                    loadHistory();
                    if (typeof showToast === 'function') {
                        showToast('Histórico limpo com sucesso.', 'info');
                    }
                }
            });
        }
    }

    function setupStepper(btnMinusId, btnPlusId, inputEl, sliderEl, delta, decimals, min, max) {
        const btnMinus = document.getElementById(btnMinusId);
        const btnPlus  = document.getElementById(btnPlusId);

        if (btnMinus && inputEl) {
            btnMinus.addEventListener('click', (e) => {
                e.preventDefault();
                let current = normalizeNumber(inputEl.value) || min;
                let next = Math.max(min, current + delta);
                inputEl.value = next.toFixed(decimals);
                if (sliderEl) sliderEl.value = next;
                calculateIMC();
            });
        }

        if (btnPlus && inputEl) {
            btnPlus.addEventListener('click', (e) => {
                e.preventDefault();
                let current = normalizeNumber(inputEl.value) || min;
                let next = Math.min(max, current + Math.abs(delta));
                inputEl.value = next.toFixed(decimals);
                if (sliderEl) sliderEl.value = next;
                calculateIMC();
            });
        }
    }

    function normalizeNumber(str) {
        if (!str) return 0;
        return parseFloat(String(str).replace(',', '.').trim()) || 0;
    }

    function resetForm() {
        const inputHeight = document.getElementById('imc-height');
        const inputWeight = document.getElementById('imc-weight');
        const inputAge    = document.getElementById('imc-age');
        const sliderHeight = document.getElementById('slider-height');
        const sliderWeight = document.getElementById('slider-weight');
        const sliderAge    = document.getElementById('slider-age');

        if (inputHeight) inputHeight.value = '1.70';
        if (sliderHeight) sliderHeight.value = 1.70;
        if (inputWeight) inputWeight.value = '70.0';
        if (sliderWeight) sliderWeight.value = 70.0;
        if (inputAge) inputAge.value = '28';
        if (sliderAge) sliderAge.value = 28;

        calculateIMC();
        if (typeof showToast === 'function') {
            showToast('Valores restaurados para o padrão.', 'info');
        }
    }

    // ─────────────────────────────────────────────
    // CÁLCULO PRINCIPAL DO IMC E MÉTRICAS
    // ─────────────────────────────────────────────
    function calculateIMC() {
        const inputHeight = document.getElementById('imc-height');
        const inputWeight = document.getElementById('imc-weight');
        const inputAge    = document.getElementById('imc-age');

        if (!inputHeight || !inputWeight) return;

        let height = normalizeNumber(inputHeight.value);
        let weight = normalizeNumber(inputWeight.value);
        let age    = parseInt(inputAge ? inputAge.value : 25) || 25;

        // Se altura foi digitada em cm (ex: 170 em vez de 1.70)
        if (height > 3.0) {
            height = height / 100;
        }

        if (height <= 0 || weight <= 0) return;

        // Fórmula Oficial da OMS: IMC = peso (kg) / (altura (m) ^ 2)
        const imc = weight / (height * height);

        // Obter classificação da OMS
        const info = getWHOClassification(imc);

        // 1. Atualizar display numérico grande
        const displayVal = document.getElementById('imc-display-value');
        if (displayVal) {
            displayVal.textContent = imc.toFixed(2).replace('.', ',');
        }

        // 2. Atualizar badge de status
        const badge = document.getElementById('imc-status-badge');
        if (badge) {
            badge.style.backgroundColor = info.badgeBg;
            badge.style.color = info.color;
            badge.innerHTML = `<span class="status-dot" style="background:${info.color};"></span> ${info.label}`;
        }

        // 3. Atualizar medidor visual (Gauge / Espectro)
        updateGaugeNeedle(imc);

        // 4. Faixa de Peso Ideal para a altura informada (IMC 18.5 a 24.9)
        const minIdealWeight = 18.5 * (height * height);
        const maxIdealWeight = 24.9 * (height * height);

        const elIdealWeight = document.getElementById('metric-ideal-weight');
        if (elIdealWeight) {
            elIdealWeight.textContent = `${minIdealWeight.toFixed(1).replace('.', ',')} kg — ${maxIdealWeight.toFixed(1).replace('.', ',')} kg`;
        }

        // 5. Diferença / Variação para o Peso Ideal
        const elWeightDiff = document.getElementById('metric-weight-diff');
        const elWeightDiffSub = document.getElementById('metric-weight-diff-sub');
        if (elWeightDiff) {
            if (imc < 18.5) {
                const diff = (minIdealWeight - weight).toFixed(1).replace('.', ',');
                elWeightDiff.innerHTML = `<span style="color:#0ea5e9;">+${diff} kg</span>`;
                if (elWeightDiffSub) elWeightDiffSub.textContent = 'Ganho sugerido para faixa ideal';
            } else if (imc > 24.9) {
                const diff = (weight - maxIdealWeight).toFixed(1).replace('.', ',');
                elWeightDiff.innerHTML = `<span style="color:#ef4444;">-${diff} kg</span>`;
                if (elWeightDiffSub) elWeightDiffSub.textContent = 'Redução sugerida para faixa ideal';
            } else {
                elWeightDiff.innerHTML = `<span style="color:#10b981;">✓ Faixa Ideal</span>`;
                if (elWeightDiffSub) elWeightDiffSub.textContent = 'Peso perfeitamente equilibrado';
            }
        }

        // 6. Taxa Metabólica Basal Estimada (Fórmula de Harris-Benedict)
        const heightCm = height * 100;
        let tmb = 0;
        if (currentGender === 'm') {
            tmb = 88.362 + (13.397 * weight) + (4.799 * heightCm) - (5.677 * age);
        } else {
            tmb = 447.593 + (9.247 * weight) + (3.098 * heightCm) - (4.330 * age);
        }

        const elTmb = document.getElementById('metric-tmb');
        if (elTmb) {
            elTmb.textContent = `${Math.round(tmb).toLocaleString('pt-BR')} kcal/dia`;
        }

        // 7. Recomendação Médica / Dica Personalizada
        const elRecom = document.getElementById('imc-recommendation-text');
        if (elRecom) {
            elRecom.textContent = info.recommendation;
        }

        // 8. Destacar linha ativa na tabela OMS
        highlightTableRow(info.categoryIndex);

        // Guardar no dataset para persistência se o usuário salvar
        window.currentEvaluation = {
            height: height,
            weight: weight,
            age: age,
            gender: currentGender,
            imc: imc,
            classification: info.label,
            color: info.color
        };
    }

    // ─────────────────────────────────────────────
    // CLASSIFICAÇÃO OFICIAL DA OMS (ADULTOS)
    // ─────────────────────────────────────────────
    function getWHOClassification(imc) {
        if (imc < 18.5) {
            return {
                label: 'Baixo peso',
                color: '#0ea5e9',
                badgeBg: 'rgba(14, 165, 233, 0.15)',
                categoryIndex: 0,
                recommendation: 'Atenção para ingestão adequada de nutrientes e calorias. Uma avaliação com nutricionista pode ajudar a atingir uma composição corporal equilibrada.'
            };
        } else if (imc < 25.0) {
            return {
                label: 'Peso normal',
                color: '#10b981',
                badgeBg: 'rgba(16, 185, 129, 0.15)',
                categoryIndex: 1,
                recommendation: 'Excelente! Seu índice está na faixa de menor risco para a saúde e comorbidades. Mantenha rotina de hidratação e atividades regulares.'
            };
        } else if (imc < 30.0) {
            return {
                label: 'Sobrepeso',
                color: '#f59e0b',
                badgeBg: 'rgba(245, 158, 11, 0.15)',
                categoryIndex: 2,
                recommendation: 'Fase de pré-obesidade: momento ideal para readequação de hábitos nutricionais e prática de exercícios para evitar progressão.'
            };
        } else if (imc < 35.0) {
            return {
                label: 'Obesidade grau I',
                color: '#f97316',
                badgeBg: 'rgba(249, 115, 22, 0.15)',
                categoryIndex: 3,
                recommendation: 'Risco moderado de hipertensão, resistência à insulina e diabetes. Aconselha-se acompanhamento multidisciplinar com médico e nutricionista.'
            };
        } else if (imc < 40.0) {
            return {
                label: 'Obesidade grau II',
                color: '#ef4444',
                badgeBg: 'rgba(239, 68, 68, 0.15)',
                categoryIndex: 4,
                recommendation: 'Risco cardiovascular e metabólico severo. Recomenda-se acompanhamento clínico intensivo e exames preventivos regulares.'
            };
        } else {
            return {
                label: 'Obesidade grau III (mórbida)',
                color: '#b91c1c',
                badgeBg: 'rgba(185, 28, 28, 0.2)',
                categoryIndex: 5,
                recommendation: 'Risco muito grave para o organismo. Priorize consulta com médico especialista para traçar um plano de tratamento integral.'
            };
        }
    }

    // ─────────────────────────────────────────────
    // ATUALIZAR INDICADOR / NEEDLE NO ESPECTRO
    // ─────────────────────────────────────────────
    function updateGaugeNeedle(imc) {
        const needle = document.getElementById('imc-needle');
        if (!needle) return;

        // Escala calibrada de IMC 14 (0%) a IMC 44 (100%)
        const minIMC = 14;
        const maxIMC = 44;
        let pct = ((imc - minIMC) / (maxIMC - minIMC)) * 100;
        pct = Math.max(3, Math.min(97, pct));

        needle.style.left = `${pct}%`;
    }

    // ─────────────────────────────────────────────
    // DESTACAR LINHA ATIVA NA TABELA
    // ─────────────────────────────────────────────
    function highlightTableRow(activeIndex) {
        const rows = document.querySelectorAll('#imc-table tbody tr');
        rows.forEach((row, idx) => {
            const statusCell = row.querySelector('.status-col');
            if (idx === activeIndex) {
                row.classList.add('table-row-active');
                if (statusCell) {
                    statusCell.innerHTML = `<span class="imc-pill-tag" style="background:rgba(0,102,204,0.15); color:var(--primary-color);">✦ Sua Faixa Atual</span>`;
                }
            } else {
                row.classList.remove('table-row-active');
                if (statusCell) {
                    statusCell.innerHTML = `<span style="color:var(--text-muted); font-size:0.8rem;">—</span>`;
                }
            }
        });
    }

    // ─────────────────────────────────────────────
    // HISTÓRICO DE MEDIÇÕES NO LOCALSTORAGE
    // ─────────────────────────────────────────────
    function getStorageKey() {
        const userId = window.currentUser ? window.currentUser.id : 'global';
        return `${STORAGE_KEY}_${userId}`;
    }

    function saveCurrentEvaluation() {
        if (!window.currentEvaluation) return;

        const record = {
            id: Date.now(),
            date: new Date().toLocaleDateString('pt-BR'),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            height: window.currentEvaluation.height,
            weight: window.currentEvaluation.weight,
            age: window.currentEvaluation.age,
            gender: window.currentEvaluation.gender,
            imc: window.currentEvaluation.imc,
            classification: window.currentEvaluation.classification,
            color: window.currentEvaluation.color
        };

        let history = [];
        try {
            const raw = localStorage.getItem(getStorageKey());
            if (raw) history = JSON.parse(raw);
        } catch (e) {
            history = [];
        }

        history.unshift(record); // Inserir no topo
        if (history.length > 20) history = history.slice(0, 20); // Limitar a 20 registros

        localStorage.setItem(getStorageKey(), JSON.stringify(history));
        loadHistory();

        if (typeof showToast === 'function') {
            showToast('Avaliação salva no seu histórico!', 'success');
        }
    }

    function loadHistory() {
        const container = document.getElementById('imc-history-container');
        if (!container) return;

        let history = [];
        try {
            const raw = localStorage.getItem(getStorageKey());
            if (raw) history = JSON.parse(raw);
        } catch (e) {
            history = [];
        }

        if (!history || history.length === 0) {
            container.innerHTML = `
                <div class="imc-history-empty">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <p>Nenhuma avaliação gravada ainda.<br>Clique em <strong>"Salvar Avaliação"</strong> para registrar seu progresso ao longo do tempo.</p>
                </div>
            `;
            return;
        }

        let html = '<div class="imc-history-list">';
        history.forEach(item => {
            const genderLabel = item.gender === 'f' ? 'Feminino' : 'Masculino';
            html += `
                <div class="imc-history-item">
                    <div class="imc-history-info">
                        <span class="imc-history-date"><i class="fa-regular fa-calendar"></i> ${item.date} às ${item.time}</span>
                        <span class="imc-history-details">
                            <strong>${item.weight.toFixed(1).replace('.', ',')} kg</strong> • 
                            ${item.height.toFixed(2).replace('.', ',')} m • 
                            ${item.age} anos (${genderLabel})
                        </span>
                    </div>
                    <div class="imc-history-right">
                        <span class="imc-history-score" style="color:${item.color || 'var(--text-color)'};">
                            ${item.imc.toFixed(2).replace('.', ',')}
                        </span>
                        <span class="imc-pill-tag" style="background:rgba(0,0,0,0.06); color:${item.color};">
                            ${item.classification}
                        </span>
                        <button class="btn-delete-history" onclick="window.deleteIMCHistoryItem(${item.id})" title="Excluir medição">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    window.deleteIMCHistoryItem = function (id) {
        let history = [];
        try {
            const raw = localStorage.getItem(getStorageKey());
            if (raw) history = JSON.parse(raw);
        } catch (e) {
            history = [];
        }

        history = history.filter(item => item.id !== id);
        localStorage.setItem(getStorageKey(), JSON.stringify(history));
        loadHistory();

        if (typeof showToast === 'function') {
            showToast('Registro excluído.', 'info');
        }
    };
})();

