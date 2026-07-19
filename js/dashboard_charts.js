// js/dashboard_charts.js — v3.0 Modern Charts
// Gráficos premium para o Dashboard — Chart.js 4.x + Canvas API nativa

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// STATE — instâncias dos gráficos
// ─────────────────────────────────────────────────────────────────────────────
const DashCharts = {
    horasDia:   null,
    composicao: null,
    evolucao:   null,
    radar:      null,
    financeiro: null,
    _ready:     false,
    _pending:   false,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — cores adaptáveis ao tema
// ─────────────────────────────────────────────────────────────────────────────
function getPrimaryColor() {
    return getComputedStyle(document.documentElement)
        .getPropertyValue('--primary-color').trim() || '#0066cc';
}

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
    };
}

function rgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}

function getThemeColors() {
    const primary = getPrimaryColor();
    const isDark  = document.documentElement.getAttribute('data-theme') === 'dark';
    const { r, g, b } = hexToRgb(primary);
    return {
        primary,
        primaryRgb: `${r},${g},${b}`,
        amber:    '#f59e0b',
        rose:     '#ef4444',
        emerald:  '#10b981',
        violet:   '#8b5cf6',
        cyan:     '#06b6d4',
        grid:     isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        tick:     isDark ? '#94a3b8' : '#6c757d',
        tooltip:  isDark ? '#1e2d3d' : '#ffffff',
        tooltipBorder: isDark ? '#334155' : '#e2e8f0',
        tooltipText:   isDark ? '#e2e8f0' : '#1e293b',
        cardBg:   isDark ? '#151e2e' : '#ffffff',
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATADORES
// ─────────────────────────────────────────────────────────────────────────────
function minutesToDecimal(min) {
    return +(min / 60).toFixed(2);
}

function formatHM(min) {
    const h = Math.floor(Math.abs(min) / 60);
    const m = Math.abs(min) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function monthShort(yyyymm) {
    const [y, m] = yyyymm.split('-');
    const names  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${names[parseInt(m) - 1]}/${y.slice(2)}`;
}

function fmtCurrency(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// OPÇÕES GLOBAIS Chart.js
// ─────────────────────────────────────────────────────────────────────────────
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Inter', 'Segoe UI', -apple-system, sans-serif";
    Chart.defaults.animation   = { duration: 700, easing: 'easeInOutQuart' };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — construir tooltip base
// ─────────────────────────────────────────────────────────────────────────────
function tooltipBase(c) {
    return {
        backgroundColor: c.tooltip,
        titleColor:      c.tooltipText,
        bodyColor:       c.tooltipText,
        borderColor:     c.tooltipBorder,
        borderWidth:     1,
        cornerRadius:    10,
        padding:         14,
        boxPadding:      6,
        titleFont: { size: 13, weight: '600' },
        bodyFont:  { size: 12 },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — mostrar/ocultar empty state
// ─────────────────────────────────────────────────────────────────────────────
function setChartEmpty(canvas, emptyEl, isEmpty) {
    if (!canvas) return;
    canvas.style.display   = isEmpty ? 'none' : 'block';
    if (emptyEl) emptyEl.style.display = isEmpty ? 'flex' : 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GRÁFICO DE BARRAS EMPILHADAS — Horas por dia do mês
// ─────────────────────────────────────────────────────────────────────────────
function renderBarChart(records) {
    const canvas  = document.getElementById('chart-horas-dia');
    const emptyEl = document.getElementById('chart-bar-empty');
    if (!canvas) return;

    const sorted = [...records]
        .filter(r => r.date && r.calc)
        .sort((a, b) => a.date.localeCompare(b.date));

    if (sorted.length === 0) {
        setChartEmpty(canvas, emptyEl, true);
        if (DashCharts.horasDia) { DashCharts.horasDia.destroy(); DashCharts.horasDia = null; }
        return;
    }
    setChartEmpty(canvas, emptyEl, false);

    const c      = getThemeColors();
    const labels = sorted.map(r => r.date.split('-').slice(1).reverse().join('/'));

    const dataNorm   = sorted.map(r => minutesToDecimal(r.calc.normalMinutes  || 0));
    const dataE50    = sorted.map(r => minutesToDecimal(r.calc.extra50         || 0));
    const dataE100   = sorted.map(r => minutesToDecimal(r.calc.extra100        || 0));
    const dataNoturno= sorted.map(r => minutesToDecimal(r.calc.minutosNoturnos || 0));

    if (DashCharts.horasDia) DashCharts.horasDia.destroy();

    DashCharts.horasDia = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Horas Normais',
                    data:  dataNorm,
                    backgroundColor: rgba(c.primary, 0.82),
                    borderColor:     c.primary,
                    borderWidth: 1,
                    borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 5, bottomRight: 5 },
                    borderSkipped: 'bottom',
                },
                {
                    label: 'Extra 50%',
                    data:  dataE50,
                    backgroundColor: rgba(c.amber, 0.82),
                    borderColor:     c.amber,
                    borderWidth: 1,
                    borderRadius: 0,
                    borderSkipped: 'bottom',
                },
                {
                    label: 'Extra 100%',
                    data:  dataE100,
                    backgroundColor: rgba(c.rose, 0.82),
                    borderColor:     c.rose,
                    borderWidth: 1,
                    borderRadius: 0,
                    borderSkipped: 'bottom',
                },
                {
                    label: 'Noturno',
                    data:  dataNoturno,
                    backgroundColor: rgba(c.violet, 0.75),
                    borderColor:     c.violet,
                    borderWidth: 1,
                    borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 0, bottomRight: 0 },
                    borderSkipped: 'bottom',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color:    c.tick,
                        font:     { size: 12, weight: '500' },
                        boxWidth: 14,
                        padding:  18,
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                    },
                },
                tooltip: {
                    ...tooltipBase(c),
                    callbacks: {
                        label: ctx => {
                            const min = Math.round(ctx.parsed.y * 60);
                            return ` ${ctx.dataset.label}: ${formatHM(min)}`;
                        },
                        footer: items => {
                            const total = items.reduce((s, i) => s + i.parsed.y, 0);
                            return `  Total: ${formatHM(Math.round(total * 60))}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    stacked: true,
                    grid:  { color: c.grid, drawBorder: false },
                    ticks: { color: c.tick, maxRotation: 45, font: { size: 10 } },
                },
                y: {
                    stacked:      true,
                    beginAtZero:  true,
                    grid:  { color: c.grid, drawBorder: false },
                    ticks: {
                        color:    c.tick,
                        font:     { size: 11 },
                        callback: v => `${v}h`,
                    },
                },
            },
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GRÁFICO DE ROSCA — Composição de horas
// ─────────────────────────────────────────────────────────────────────────────
function renderDonutChart(records) {
    const canvas  = document.getElementById('chart-composicao');
    const emptyEl = document.getElementById('chart-donut-empty');
    if (!canvas) return;

    const totalNormal  = records.reduce((s, r) => s + (r.calc?.normalMinutes  || 0), 0);
    const totalE50     = records.reduce((s, r) => s + (r.calc?.extra50         || 0), 0);
    const totalE100    = records.reduce((s, r) => s + (r.calc?.extra100        || 0), 0);
    const totalNoturno = records.reduce((s, r) => s + (r.calc?.minutosNoturnos || 0), 0);
    const grand = totalNormal + totalE50 + totalE100;

    if (records.length === 0 || grand === 0) {
        setChartEmpty(canvas, emptyEl, true);
        if (DashCharts.composicao) { DashCharts.composicao.destroy(); DashCharts.composicao = null; }
        return;
    }
    setChartEmpty(canvas, emptyEl, false);

    const c = getThemeColors();
    if (DashCharts.composicao) DashCharts.composicao.destroy();

    const hasNoturno = totalNoturno > 0;
    const labels = ['Horas Normais', 'Extra 50%', 'Extra 100%'];
    const values = [totalNormal, totalE50, totalE100];
    const colors = [c.primary, c.amber, c.rose];

    if (hasNoturno) {
        labels.push('Noturno');
        values.push(totalNoturno);
        colors.push(c.violet);
    }

    DashCharts.composicao = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data:            values,
                backgroundColor: colors.map(col => rgba(col, 0.88)),
                borderColor:     colors,
                borderWidth:     2,
                hoverOffset:     14,
                hoverBorderWidth: 3,
            }],
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            cutout:              '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color:         c.tick,
                        font:          { size: 11, weight: '500' },
                        boxWidth:      12,
                        padding:       14,
                        usePointStyle: true,
                        pointStyle:    'circle',
                    },
                },
                tooltip: {
                    ...tooltipBase(c),
                    callbacks: {
                        label: ctx => {
                            const min = ctx.parsed;
                            const pct = ((min / grand) * 100).toFixed(1);
                            return ` ${ctx.label}: ${formatHM(min)} (${pct}%)`;
                        },
                    },
                },
            },
        },
        // Plugin personalizado: texto central com total
        plugins: [{
            id: 'centerText',
            afterDraw(chart) {
                const { ctx, chartArea: { left, top, right, bottom } } = chart;
                const cx  = (left + right) / 2;
                const cy  = (top + bottom) / 2;
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                const textCol = isDark ? '#f8fafc' : '#1e293b';
                const mutedCol = isDark ? '#94a3b8' : '#6c757d';

                ctx.save();
                // Horas totais
                ctx.font         = 'bold 18px Inter, sans-serif';
                ctx.fillStyle    = textCol;
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(formatHM(grand), cx, cy - 10);
                // Legenda
                ctx.font      = '11px Inter, sans-serif';
                ctx.fillStyle = mutedCol;
                ctx.fillText('Total', cx, cy + 12);
                ctx.restore();
            },
        }],
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. GRÁFICO DE LINHA — Evolução mensal (últimos 6 meses)
// ─────────────────────────────────────────────────────────────────────────────
async function renderLineChart(userId) {
    const canvas  = document.getElementById('chart-evolucao');
    const emptyEl = document.getElementById('chart-line-empty');
    if (!canvas) return;

    // Gerar últimos 6 meses
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.push(key);
    }

    try {
        let all = await db.timeRecords.toArray();
        if (userId && userId !== 'all') {
            all = all.filter(r => r.userId === parseInt(userId));
        }

        const horasTrab  = months.map(m => {
            const recs = all.filter(r => r.month === m);
            return minutesToDecimal(recs.reduce((s, r) => s + (r.calc?.workedMinutes || 0), 0));
        });
        const horasExtra = months.map(m => {
            const recs = all.filter(r => r.month === m);
            return minutesToDecimal(recs.reduce((s, r) => s + (r.calc?.extra50 || 0) + (r.calc?.extra100 || 0), 0));
        });
        const diasTrab = months.map(m => {
            return all.filter(r => r.month === m && (r.calc?.workedMinutes || 0) > 0).length;
        });

        const hasData = all.length > 0;
        if (!hasData) {
            setChartEmpty(canvas, emptyEl, true);
            if (DashCharts.evolucao) { DashCharts.evolucao.destroy(); DashCharts.evolucao = null; }
            return;
        }
        setChartEmpty(canvas, emptyEl, false);

        const c      = getThemeColors();
        const labels = months.map(monthShort);

        if (DashCharts.evolucao) DashCharts.evolucao.destroy();

        DashCharts.evolucao = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label:              'Horas Trabalhadas',
                        data:               horasTrab,
                        borderColor:        c.primary,
                        backgroundColor:    rgba(c.primary, 0.10),
                        fill:               true,
                        tension:            0.45,
                        pointBackgroundColor: c.primary,
                        pointBorderColor:   '#fff',
                        pointBorderWidth:   2.5,
                        pointRadius:        7,
                        pointHoverRadius:   10,
                        borderWidth:        3,
                        yAxisID:            'y',
                    },
                    {
                        label:              'Horas Extras',
                        data:               horasExtra,
                        borderColor:        c.amber,
                        backgroundColor:    rgba(c.amber, 0.08),
                        fill:               true,
                        tension:            0.45,
                        pointBackgroundColor: c.amber,
                        pointBorderColor:   '#fff',
                        pointBorderWidth:   2.5,
                        pointRadius:        6,
                        pointHoverRadius:   9,
                        borderWidth:        2.5,
                        borderDash:         [6, 4],
                        yAxisID:            'y',
                    },
                    {
                        label:              'Dias Trabalhados',
                        data:               diasTrab,
                        borderColor:        c.emerald,
                        backgroundColor:    'transparent',
                        fill:               false,
                        tension:            0.35,
                        pointBackgroundColor: c.emerald,
                        pointBorderColor:   '#fff',
                        pointBorderWidth:   2,
                        pointRadius:        5,
                        pointHoverRadius:   8,
                        borderWidth:        2,
                        borderDash:         [3, 3],
                        yAxisID:            'y2',
                    },
                ],
            },
            options: {
                responsive:          true,
                maintainAspectRatio: false,
                interaction:         { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color:         c.tick,
                            font:          { size: 12, weight: '500' },
                            boxWidth:      14,
                            padding:       18,
                            usePointStyle: true,
                        },
                    },
                    tooltip: {
                        ...tooltipBase(c),
                        callbacks: {
                            label: ctx => {
                                if (ctx.dataset.yAxisID === 'y2') {
                                    return ` ${ctx.dataset.label}: ${ctx.parsed.y} dias`;
                                }
                                const min = Math.round(ctx.parsed.y * 60);
                                return ` ${ctx.dataset.label}: ${formatHM(min)}`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        grid:  { color: c.grid, drawBorder: false },
                        ticks: { color: c.tick, font: { size: 11 } },
                    },
                    y: {
                        position:    'left',
                        beginAtZero: true,
                        grid:        { color: c.grid, drawBorder: false },
                        ticks: {
                            color:    c.tick,
                            font:     { size: 11 },
                            callback: v => `${v}h`,
                        },
                    },
                    y2: {
                        position:    'right',
                        beginAtZero: true,
                        grid:        { drawOnChartArea: false },
                        ticks: {
                            color:     c.emerald,
                            font:      { size: 10 },
                            precision: 0,
                            callback:  v => `${v}d`,
                        },
                    },
                },
            },
        });
    } catch (e) {
        console.error('[DashCharts] Erro ao renderizar evolução mensal:', e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GRÁFICO RADAR — Distribuição semanal (média de horas por dia)
// ─────────────────────────────────────────────────────────────────────────────
function renderRadarChart(records) {
    const canvas  = document.getElementById('chart-radar-semanal');
    const emptyEl = document.getElementById('chart-radar-empty');
    if (!canvas) return;

    if (records.length === 0) {
        setChartEmpty(canvas, emptyEl, true);
        if (DashCharts.radar) { DashCharts.radar.destroy(); DashCharts.radar = null; }
        return;
    }
    setChartEmpty(canvas, emptyEl, false);

    const diasSemana  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const totalMin    = [0, 0, 0, 0, 0, 0, 0];
    const contagem    = [0, 0, 0, 0, 0, 0, 0];
    const extraMin    = [0, 0, 0, 0, 0, 0, 0];

    records.forEach(r => {
        if (!r.date || !r.calc) return;
        const dayIdx = new Date(r.date + 'T12:00:00').getDay();
        totalMin[dayIdx]  += r.calc.workedMinutes  || 0;
        extraMin[dayIdx]  += (r.calc.extra50 || 0) + (r.calc.extra100 || 0);
        contagem[dayIdx]++;
    });

    const mediaTrab  = totalMin.map((t, i) => contagem[i] > 0 ? minutesToDecimal(t / contagem[i]) : 0);
    const mediaExtra = extraMin.map((t, i) => contagem[i] > 0 ? minutesToDecimal(t / contagem[i]) : 0);

    const c = getThemeColors();
    if (DashCharts.radar) DashCharts.radar.destroy();

    DashCharts.radar = new Chart(canvas, {
        type: 'radar',
        data: {
            labels:   diasSemana,
            datasets: [
                {
                    label:           'Média Trabalhada',
                    data:            mediaTrab,
                    borderColor:     c.primary,
                    backgroundColor: rgba(c.primary, 0.18),
                    borderWidth:     2.5,
                    pointBackgroundColor: c.primary,
                    pointBorderColor:    '#fff',
                    pointBorderWidth:    2,
                    pointRadius:         5,
                    pointHoverRadius:    8,
                },
                {
                    label:           'Média de Extras',
                    data:            mediaExtra,
                    borderColor:     c.amber,
                    backgroundColor: rgba(c.amber, 0.12),
                    borderWidth:     2,
                    pointBackgroundColor: c.amber,
                    pointBorderColor:    '#fff',
                    pointBorderWidth:    2,
                    pointRadius:         4,
                    pointHoverRadius:    7,
                    borderDash:          [5, 3],
                },
            ],
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color:         c.tick,
                        font:          { size: 11, weight: '500' },
                        boxWidth:      12,
                        padding:       14,
                        usePointStyle: true,
                    },
                },
                tooltip: {
                    ...tooltipBase(c),
                    callbacks: {
                        label: ctx => {
                            const min = Math.round(ctx.parsed.r * 60);
                            return ` ${ctx.dataset.label}: ${formatHM(min)}`;
                        },
                    },
                },
            },
            scales: {
                r: {
                    angleLines:   { color: c.grid },
                    grid:         { color: c.grid },
                    pointLabels:  { color: c.tick, font: { size: 12, weight: '600' } },
                    ticks: {
                        color:           c.tick,
                        backdropColor:   'transparent',
                        font:            { size: 10 },
                        callback:        v => `${v}h`,
                    },
                    beginAtZero: true,
                },
            },
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. GRÁFICO FINANCEIRO — Barras horizontais com breakdown de valores
// ─────────────────────────────────────────────────────────────────────────────
async function renderFinanceChart(records, employeeId) {
    const canvas  = document.getElementById('chart-financeiro');
    const emptyEl = document.getElementById('chart-finance-empty');
    if (!canvas) return;

    if (records.length === 0 || employeeId === 'all') {
        setChartEmpty(canvas, emptyEl, true);
        if (emptyEl && employeeId === 'all') {
            emptyEl.innerHTML = `
                <i class="fa-solid fa-users" style="font-size:2rem; opacity:.35; display:block; margin-bottom:10px;"></i>
                Selecione um funcionário para ver o resumo financeiro.
            `;
        }
        if (DashCharts.financeiro) { DashCharts.financeiro.destroy(); DashCharts.financeiro = null; }
        return;
    }
    setChartEmpty(canvas, emptyEl, false);

    let targetSalary = 0;
    try {
        const emp = await db.users.get(parseInt(employeeId));
        if (emp) targetSalary = emp.baseSalary || 0;
    } catch (_) {}

    const totalE50  = records.reduce((s, r) => s + (r.calc?.extra50  || 0), 0);
    const totalE100 = records.reduce((s, r) => s + (r.calc?.extra100 || 0), 0);
    const totalNot  = records.reduce((s, r) => s + (r.calc?.minutosNoturnos || 0), 0);

    const valorHora   = targetSalary / 220;
    const valorE50    = (valorHora * 1.5) * (totalE50  / 60);
    const valorE100   = (valorHora * 2.0) * (totalE100 / 60);
    const totalExtras = valorE50 + valorE100;

    let valorNoturno = 0;
    let inssDiscount = 0;
    try {
        const settings = await db.settings.get('global');
        if (settings?.noturnoCalculation) valorNoturno = (valorHora * 0.20) * (totalNot / 60);
        if (settings?.inssCalculation && typeof window.calculateINSS === 'function') {
            inssDiscount = window.calculateINSS(targetSalary + totalExtras + valorNoturno);
        }
    } catch (_) {}

    const totalLiquido = targetSalary + totalExtras + valorNoturno - inssDiscount;
    const c = getThemeColors();
    if (DashCharts.financeiro) DashCharts.financeiro.destroy();

    const dataLabels = ['Salário Base', 'Extra 50%', 'Extra 100%'];
    const dataValues = [targetSalary, valorE50, valorE100];
    const bgColors   = [rgba(c.primary, 0.82), rgba(c.amber, 0.82), rgba(c.rose, 0.82)];
    const bdColors   = [c.primary, c.amber, c.rose];

    if (valorNoturno > 0) {
        dataLabels.push('Adic. Noturno');
        dataValues.push(valorNoturno);
        bgColors.push(rgba(c.violet, 0.80));
        bdColors.push(c.violet);
    }
    if (inssDiscount > 0) {
        dataLabels.push('(-) INSS');
        dataValues.push(-inssDiscount);
        bgColors.push('rgba(107,114,128,0.55)');
        bdColors.push('#6b7280');
    }
    dataLabels.push('Total Líquido');
    dataValues.push(totalLiquido);
    bgColors.push(rgba(c.emerald, 0.85));
    bdColors.push(c.emerald);

    DashCharts.financeiro = new Chart(canvas, {
        type: 'bar',
        data: {
            labels:   dataLabels,
            datasets: [{
                label:           'Valor (R$)',
                data:            dataValues,
                backgroundColor: bgColors,
                borderColor:     bdColors,
                borderWidth:     1.5,
                borderRadius:    8,
                borderSkipped:   false,
            }],
        },
        options: {
            indexAxis:           'y',
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...tooltipBase(c),
                    callbacks: {
                        label: ctx => ` ${fmtCurrency(ctx.parsed.x)}`,
                    },
                },
            },
            scales: {
                x: {
                    grid:  { color: c.grid, drawBorder: false },
                    ticks: {
                        color:    c.tick,
                        font:     { size: 11 },
                        callback: v => fmtCurrency(v),
                    },
                },
                y: {
                    grid:  { display: false },
                    ticks: { color: c.tick, font: { size: 12, weight: '600' } },
                },
            },
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. MINI-GRÁFICOS SPARKLINE — indicadores visuais nas stat-cards
// ─────────────────────────────────────────────────────────────────────────────
function renderSparklines(records) {
    const container = document.getElementById('dashboard-charts-section');
    if (!container) return;

    // Agrupar por dia para sparkline das últimas 7 entradas
    const last7 = [...records]
        .filter(r => r.date && r.calc)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7);

    if (last7.length < 2) return;

    const sparkData = last7.map(r => minutesToDecimal(r.calc.workedMinutes || 0));

    // Criar/atualizar canvas sparkline no card de horas trabalhadas
    let sparkCanvas = document.getElementById('sparkline-horas');
    if (!sparkCanvas) {
        const cardHoras = document.getElementById('dash-horas-trabalhadas')?.closest('.stat-card');
        if (cardHoras) {
            sparkCanvas = document.createElement('canvas');
            sparkCanvas.id     = 'sparkline-horas';
            sparkCanvas.width  = 80;
            sparkCanvas.height = 32;
            sparkCanvas.style.cssText = 'display:block; margin-top:6px; opacity:0.7;';
            const cardInfo = cardHoras.querySelector('.card-info');
            if (cardInfo) cardInfo.appendChild(sparkCanvas);
        }
    }

    if (!sparkCanvas) return;

    const sparkCtx = sparkCanvas.getContext('2d');
    const W = sparkCanvas.width, H = sparkCanvas.height;
    sparkCtx.clearRect(0, 0, W, H);

    const max = Math.max(...sparkData, 0.1);
    const pad = 3;
    const stepX = (W - pad * 2) / (sparkData.length - 1);

    const primary = getPrimaryColor();
    const { r, g, b } = hexToRgb(primary);

    // Gradiente
    const grad = sparkCtx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.4)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

    sparkCtx.beginPath();
    sparkData.forEach((v, i) => {
        const x = pad + i * stepX;
        const y = H - pad - ((v / max) * (H - pad * 2));
        if (i === 0) sparkCtx.moveTo(x, y); else sparkCtx.lineTo(x, y);
    });
    // Fechar para fill
    const lastX = pad + (sparkData.length - 1) * stepX;
    sparkCtx.lineTo(lastX, H); sparkCtx.lineTo(pad, H); sparkCtx.closePath();
    sparkCtx.fillStyle = grad;
    sparkCtx.fill();

    // Linha
    sparkCtx.beginPath();
    sparkData.forEach((v, i) => {
        const x = pad + i * stepX;
        const y = H - pad - ((v / max) * (H - pad * 2));
        if (i === 0) sparkCtx.moveTo(x, y); else sparkCtx.lineTo(x, y);
    });
    sparkCtx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
    sparkCtx.lineWidth   = 1.8;
    sparkCtx.lineJoin    = 'round';
    sparkCtx.stroke();
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL — renderizar todos os gráficos
// ─────────────────────────────────────────────────────────────────────────────
async function renderDashboardCharts() {
    if (!window.currentUser) return;
    if (!document.getElementById('chart-horas-dia')) return;
    if (typeof Chart === 'undefined') {
        console.warn('[DashCharts] Chart.js não carregou ainda, tentando novamente...');
        setTimeout(renderDashboardCharts, 500);
        return;
    }

    try {
        const filterMonth = document.getElementById('dash-filter-month')?.value;
        const dateStart   = document.getElementById('dash-filter-date-start')?.value;
        const dateEnd     = document.getElementById('dash-filter-date-end')?.value;
        let   employeeId  = document.getElementById('dash-filter-employee')?.value || 'all';

        if (window.currentUser.role !== 'admin') {
            employeeId = window.currentUser.id.toString();
        }

        // Atualizar textos de período
        const periodText = (() => {
            if (dateStart && dateEnd)
                return `${dateStart.split('-').reverse().join('/')} → ${dateEnd.split('-').reverse().join('/')}`;
            if (filterMonth)
                return monthShort(filterMonth);
            return 'Mês atual';
        })();

        const barPeriodEl  = document.getElementById('chart-bar-period');
        const finPeriodEl  = document.getElementById('chart-finance-period');
        if (barPeriodEl)  barPeriodEl.textContent  = periodText;
        if (finPeriodEl)  finPeriodEl.textContent   = periodText;

        // Buscar e filtrar registros
        let records = await db.timeRecords.toArray();

        if (employeeId !== 'all') {
            records = records.filter(r => r.userId === parseInt(employeeId));
        }
        if (dateStart && dateEnd) {
            records = records.filter(r => r.date >= dateStart && r.date <= dateEnd);
        } else if (filterMonth) {
            records = records.filter(r => r.month === filterMonth);
        }

        // Renderizar todos os gráficos em paralelo onde possível
        renderBarChart(records);
        renderDonutChart(records);
        renderRadarChart(records);
        renderSparklines(records);
        await Promise.all([
            renderLineChart(employeeId),
            renderFinanceChart(records, employeeId),
        ]);

    } catch (e) {
        console.error('[DashCharts] Erro ao atualizar gráficos:', e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — interceptar updateDashboardStats de forma segura
// O timeTracker.js define a função ANTES de carregar este script,
// então o override aqui funciona corretamente.
// ─────────────────────────────────────────────────────────────────────────────
(function hookDashboardStats() {
    // Aguardar até a função real estar disponível
    function tryHook() {
        const original = window.updateDashboardStats;
        if (typeof original !== 'function' || original._chartsHooked) return;

        const hooked = async function (...args) {
            await original.apply(this, args);
            await renderDashboardCharts();
        };
        hooked._chartsHooked = true;
        window.updateDashboardStats = hooked;
    }

    // Tentar imediatamente e depois no DOMContentLoaded como fallback
    tryHook();
    document.addEventListener('DOMContentLoaded', tryHook);
})();

// ─────────────────────────────────────────────────────────────────────────────
// RECRIAR GRÁFICOS ao mudar tema (dark/light)
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const themeCheckbox = document.getElementById('checkbox-theme');
    if (themeCheckbox) {
        themeCheckbox.addEventListener('change', () => {
            // Delay para o CSS atualizar as variáveis antes de redesenhar
            setTimeout(renderDashboardCharts, 180);
        });
    }

    // Renderização inicial caso a página já tenha dados ao carregar
    if (document.getElementById('chart-horas-dia')) {
        // Esperar o auth.js restaurar sessão e chamar initDashboard
        // que chama updateDashboardStats() que agora está hookado
    }
});

// Expor globalmente para chamadas manuais (ex: testes)
window.renderDashboardCharts = renderDashboardCharts;
