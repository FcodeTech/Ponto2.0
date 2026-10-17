// js/export.js

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS FINANCEIROS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula o resumo financeiro completo de um funcionário dado seus registros.
 * Inclui: salário bruto (base + extras + adicional noturno), INSS e salário líquido.
 */
async function calcFinanceiro(user, records) {
    const settings = (await db.settings.get('global')) || {};
    const isInssActive = !!settings.inssCalculation;
    const isNoturnoActive = !!settings.noturnoCalculation;
    const isFgtsActive = !!settings.fgtsCalculation;

    const baseSalary = user.baseSalary || 0;
    const valorHora  = baseSalary / 220;

    let tot50 = 0, tot100 = 0, totNoturnoMinutes = 0;
    records.forEach(r => {
        tot50              += r.calc.extra50              || 0;
        tot100             += r.calc.extra100             || 0;
        totNoturnoMinutes  += r.calc.minutosNoturnos      || 0;
    });

    const recE50        = (valorHora * 1.5) * (tot50  / 60);
    const recE100       = (valorHora * 2.0) * (tot100 / 60);
    const adicNoturno   = isNoturnoActive ? ((valorHora * 0.20) * (totNoturnoMinutes / 60)) : 0; // 20% sobre valor da hora se ativo
    const salarioBruto  = baseSalary + recE50 + recE100 + adicNoturno;

    let descontoInss = 0;
    if (isInssActive && window.calculateINSS) {
        descontoInss = window.calculateINSS(salarioBruto);
    }

    const valorFgts = isFgtsActive ? (typeof window.calculateFGTS === 'function' ? window.calculateFGTS(salarioBruto) : Number((salarioBruto * 0.08).toFixed(2))) : 0;
    const salarioLiquido = salarioBruto - descontoInss;

    return { salarioBruto, descontoInss, salarioLiquido, adicNoturno, totNoturnoMinutes, isInssActive, isNoturnoActive, isFgtsActive, valorFgts };
}

// ─────────────────────────────────────────────────────────────────────────────
// DADOS PARA EXCEL
// ─────────────────────────────────────────────────────────────────────────────

async function getReportDataArray(singleEmployeeMode, targetUserId) {
    const data    = window.getCurrentReportData ? window.getCurrentReportData() : [];
    const userMap = window.getUserMap ? window.getUserMap() : {};
    const rows    = [];

    if (singleEmployeeMode && targetUserId) {
        const u = userMap[targetUserId] || currentUser;

        let cargoStr   = u.role === 'admin' ? 'Administrador' : (u.role || 'Funcionário');
        let jornadaStr = u.hourType === 'horista' ? 'Horista' : 'Mensalista';
        if (u.journeyStart && u.journeyEnd) {
            jornadaStr = `${u.journeyStart} às ${u.journeyEnd}`;
        }

        const { salarioBruto, descontoInss, salarioLiquido, adicNoturno, totNoturnoMinutes, isInssActive, isNoturnoActive } =
            await calcFinanceiro(u, data);

        rows.push(['RELATÓRIO DE PONTO ELETRÔNICO - INDIVIDUAL']);
        rows.push(['Nome:',       u.name      || '-']);
        rows.push(['Matrícula:',  u.matricula || '-']);
        rows.push(['CPF:',        u.cpf       || '-']);
        rows.push(['Cargo:',      cargoStr]);
        rows.push(['Jornada:',    jornadaStr]);
        rows.push([]);

        // ── Resumo financeiro ──────────────────────────────────────────────
        rows.push(['── RESUMO FINANCEIRO ──']);
        if (isNoturnoActive && totNoturnoMinutes > 0) {
            rows.push(['Adicional Noturno:', `${formatCurrency(adicNoturno)} (${minutesToTime(totNoturnoMinutes)} noturnas)`]);
        }
        rows.push(['Salário Bruto:',  formatCurrency(salarioBruto)]);
        if (isInssActive) {
            rows.push(['Desconto INSS:',  `- ${formatCurrency(descontoInss)}`]);
            rows.push(['Salário Líquido (após INSS):', formatCurrency(salarioLiquido)]);
        } else {
            rows.push(['Salário Líquido:',  formatCurrency(salarioLiquido)]);
        }
        if (isFgtsActive) {
            rows.push(['FGTS (8% CLT - Depósito Empregador):', formatCurrency(valorFgts)]);
        }
        rows.push([]);

        // ── Registros de ponto ─────────────────────────────────────────────
        rows.push(['Data', 'Entrada', 'Pausa', 'Retorno', 'Saída', 'H. Noturnas', 'Horas Trab.', 'Extras 50%', 'Extras 100%']);
        data.forEach(r => {
            rows.push([
                r.date.split('-').reverse().join('/'),
                r.entrada               || '--:--',
                r.pausa                 || '--:--',
                r.retorno               || '--:--',
                r.saida                 || '--:--',
                minutesToTime(r.calc.minutosNoturnos || 0),
                r.calc.horasTrab,
                r.calc.horasExtra50,
                r.calc.horasExtra100
            ]);
        });

    } else {
        // ── Relatório geral (todos os funcionários) ────────────────────────
        rows.push(['RELATÓRIO DE PONTO ELETRÔNICO - GERAL']);
        rows.push([]);

        const recordsByUser = {};
        data.forEach(r => {
            if (!recordsByUser[r.userId]) recordsByUser[r.userId] = [];
            recordsByUser[r.userId].push(r);
        });

        rows.push(['── RESUMO FINANCEIRO POR FUNCIONÁRIO ──']);
        rows.push(['Funcionário', 'Matrícula', 'Adic. Noturno', 'Salário Bruto', 'Desconto INSS', 'Salário Líquido']);

        for (const [uid, recs] of Object.entries(recordsByUser)) {
            const u = userMap[parseInt(uid)] || { name: 'N/A', matricula: 'N/A', baseSalary: 0 };
            const { salarioBruto, descontoInss, salarioLiquido, adicNoturno } = await calcFinanceiro(u, recs);
            rows.push([
                u.name,
                u.matricula           || '-',
                formatCurrency(adicNoturno),
                formatCurrency(salarioBruto),
                formatCurrency(descontoInss),
                formatCurrency(salarioLiquido)
            ]);
        }

        rows.push([]);

        rows.push(['Nome', 'Matrícula', 'Data', 'Entrada', 'Pausa', 'Retorno', 'Saída', 'H. Noturnas', 'Horas Trab.', 'Extras 50%', 'Extras 100%']);
        data.forEach(r => {
            const u = userMap[r.userId] || { name: 'N/A', matricula: 'N/A' };
            rows.push([
                u.name,
                u.matricula,
                r.date.split('-').reverse().join('/'),
                r.entrada               || '--:--',
                r.pausa                 || '--:--',
                r.retorno               || '--:--',
                r.saida                 || '--:--',
                minutesToTime(r.calc.minutosNoturnos || 0),
                r.calc.horasTrab,
                r.calc.horasExtra50,
                r.calc.horasExtra100
            ]);
        });
    }

    return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAR EXCEL (XLSX)
// ─────────────────────────────────────────────────────────────────────────────
document.getElementById('btn-export-excel')?.addEventListener('click', async () => {
    try {
        const data = window.getCurrentReportData ? window.getCurrentReportData() : [];
        if (data.length === 0) {
            showToast('Nenhum dado para exportar.', 'warning');
            return;
        }

        const filterEl = document.getElementById('filter-employee');
        let targetUserId = null;
        if (currentUser.role !== 'admin') {
            targetUserId = currentUser.id;
        } else if (filterEl && filterEl.value !== 'all') {
            targetUserId = parseInt(filterEl.value);
        }
        const singleEmployeeMode = (targetUserId !== null);

        const rows = await getReportDataArray(singleEmployeeMode, targetUserId);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);

        const wscols = [
            {wch: 28}, {wch: 15}, {wch: 14}, {wch: 16}, {wch: 16}, {wch: 22},
            {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 15}
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Relatório Ponto");
        XLSX.writeFile(wb, "relatorio_ponto.xlsx");
        showToast('Exportação Excel concluída.', 'success');
    } catch (e) {
        console.error(e);
        showToast('Erro ao exportar Excel.', 'error');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAR PDF (jsPDF)
// ─────────────────────────────────────────────────────────────────────────────
document.getElementById('btn-export-pdf')?.addEventListener('click', async () => {
    try {
        const data = window.getCurrentReportData ? window.getCurrentReportData() : [];
        if (data.length === 0) {
            showToast('Nenhum dado para exportar.', 'warning');
            return;
        }

        const filterEl = document.getElementById('filter-employee');
        let targetUserId = null;
        if (currentUser.role !== 'admin') {
            targetUserId = currentUser.id;
        } else if (filterEl && filterEl.value !== 'all') {
            targetUserId = parseInt(filterEl.value);
        }
        const singleEmployeeMode = (targetUserId !== null);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait' });

        const now     = new Date();
        const dateStr = now.toLocaleDateString('pt-BR');
        const timeStr = now.toLocaleTimeString('pt-BR');
        const genText = `Gerado em: ${dateStr}, ${timeStr}`;

        const primaryDark  = [26, 26, 46];
        const textColor    = [51, 51, 51];
        const greenColor   = [34, 139, 34];
        const redColor     = [180, 0, 0];
        const nightColor   = [75, 0, 130]; // roxo para noturno

        // ── Header ───────────────────────────────────────────────────────────
        const settings = await db.settings.get('global') || {};
        const sysName  = settings.systemName || 'PontoMax';

        doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
        doc.rect(0, 0, 210, 35, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text(sysName, 14, 15);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("Relatório de Controle de Ponto Eletrônico", 14, 22);
        doc.text(genText, 14, 28);

        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        let startY = 45;

        // ── Modo Individual ──────────────────────────────────────────────────
        if (singleEmployeeMode) {
            const userMap = window.getUserMap ? window.getUserMap() : {};
            const u = userMap[targetUserId] || currentUser;

            // Dados do funcionário
            doc.setFontSize(13);
            doc.setFont("helvetica", "bold");
            doc.text("Dados do Funcionário", 14, startY);
            startY += 8;

            doc.setFontSize(10);
            const writeField = (label, value, y) => {
                doc.setFont("helvetica", "bold");
                doc.text(label + ":", 14, y);
                doc.setFont("helvetica", "normal");
                doc.text(String(value || '-'), 52, y);
            };

            writeField("Nome",      u.name,      startY); startY += 7;
            writeField("Matrícula", u.matricula, startY); startY += 7;
            writeField("CPF",       u.cpf,       startY); startY += 7;

            let cargoStr = u.role === 'admin' ? 'Administrador' : (u.role || 'Funcionário');
            writeField("Cargo", cargoStr, startY); startY += 7;

            let jornadaStr = u.hourType === 'horista' ? 'Horista' : 'Mensalista';
            if (u.journeyStart && u.journeyEnd) {
                jornadaStr = `${u.journeyStart} às ${u.journeyEnd}`;
            }
            writeField("Jornada", jornadaStr, startY); startY += 12;

            // ── Resumo Financeiro ─────────────────────────────────────────
            const { salarioBruto, descontoInss, salarioLiquido, adicNoturno, totNoturnoMinutes, isInssActive, isNoturnoActive } =
                await calcFinanceiro(u, data);

            // Título da seção
            doc.setFillColor(240, 240, 240);
            doc.rect(14, startY - 5, 182, 8, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
            doc.text("Resumo Financeiro", 16, startY);
            startY += 10;

            doc.setFontSize(10);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);

            // Horas totais
            let totTrabalhado = 0, totNormal = 0, tot50 = 0, tot100 = 0;
            data.forEach(rec => {
                totTrabalhado += rec.calc.workedMinutes || 0;
                totNormal     += rec.calc.normalMinutes || 0;
                tot50         += rec.calc.extra50       || 0;
                tot100        += rec.calc.extra100      || 0;
            });

            const valorHora    = (u.baseSalary || 0) / 220;
            const valorHora50  = valorHora * 1.5;
            const valorHora100 = valorHora * 2.0;
            const valorHoraNoturno = valorHora * 1.20; // hora + 20%

            const formatHM = (totalMinutes) => {
                const h = Math.floor(totalMinutes / 60);
                const m = totalMinutes % 60;
                return `${h}h ${String(m).padStart(2, '0')}min`;
            };

            const write2Col = (l1, v1, l2, v2, y) => {
                doc.setFont("helvetica", "bold");
                doc.text(l1 + ":", 14, y);
                doc.setFont("helvetica", "normal");
                doc.text(String(v1 || '-'), 60, y);
                doc.setFont("helvetica", "bold");
                doc.text(l2 + ":", 110, y);
                doc.setFont("helvetica", "normal");
                doc.text(String(v2 || '-'), 151, y);
            };

            write2Col("Horas Normais",    formatHM(totNormal), "Valor Hora Normal",   formatCurrency(valorHora),    startY); startY += 7;
            write2Col("Horas Extras 50%", formatHM(tot50),     "Valor Hora 50%",      formatCurrency(valorHora50),  startY); startY += 7;
            write2Col("Horas Extras 100%",formatHM(tot100),    "Valor Hora 100%",     formatCurrency(valorHora100), startY); startY += 7;

            // Adicional Noturno (só exibe se ativo e houver horas noturnas)
            if (isNoturnoActive && totNoturnoMinutes > 0) {
                doc.setTextColor(nightColor[0], nightColor[1], nightColor[2]);
                write2Col("H. Noturnas (22h-05h)", formatHM(totNoturnoMinutes), "Adic. Noturno (20%)", formatCurrency(adicNoturno), startY);
                doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                startY += 7;
            }

            startY += 3;
            // Linha divisória
            doc.setDrawColor(200, 200, 200);
            doc.line(14, startY - 3, 196, startY - 3);

            // ── Salário Bruto ──────────────────────────────────────────────
            doc.setFont("helvetica", "bold");
            doc.text("Salário Bruto:", 14, startY);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(greenColor[0], greenColor[1], greenColor[2]);
            doc.text(formatCurrency(salarioBruto), 60, startY);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            startY += 7;

            if (isInssActive) {
                // ── Desconto INSS ──────────────────────────────────────────
                doc.setFont("helvetica", "bold");
                doc.text("Desconto INSS:", 14, startY);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(redColor[0], redColor[1], redColor[2]);
                doc.text(`- ${formatCurrency(descontoInss)}`, 60, startY);
                doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                startY += 7;
            }

            if (isFgtsActive) {
                // ── FGTS ───────────────────────────────────────────────────
                doc.setFont("helvetica", "bold");
                doc.text("FGTS (8% CLT):", 14, startY);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(16, 185, 129);
                doc.text(`${formatCurrency(valorFgts)} (Depósito Empregador)`, 60, startY);
                doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                startY += 7;
            }

            // ── Salário Líquido (destaque) ─────────────────────────────────
            doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
            doc.rect(14, startY - 5, 182, 10, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            const labelLiquido = isInssActive ? "Salário Líquido (após INSS):" : "Salário Líquido:";
            doc.text(labelLiquido, 16, startY + 2);
            doc.text(formatCurrency(salarioLiquido), 151, startY + 2);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.setFontSize(10);
            startY += 18;

        } else {
            // ── Modo Geral (todos os funcionários) ───────────────────────────
            doc.setFontSize(13);
            doc.setFont("helvetica", "bold");
            doc.text("Relatório Geral de Todos os Funcionários", 14, startY);
            startY += 10;

            doc.setFillColor(240, 240, 240);
            doc.rect(14, startY - 5, 182, 8, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
            doc.text("Resumo Financeiro por Funcionário", 16, startY);
            startY += 6;
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.setFontSize(10);

            const userMap = window.getUserMap ? window.getUserMap() : {};
            const recordsByUser = {};
            data.forEach(r => {
                if (!recordsByUser[r.userId]) recordsByUser[r.userId] = [];
                recordsByUser[r.userId].push(r);
            });

            const financHead = [['Funcionário', 'Matrícula', 'Adic. Noturno', 'Salário Bruto', 'Desc. INSS', 'Salário Líquido']];
            const financBody = [];

            for (const [uid, recs] of Object.entries(recordsByUser)) {
                const u = userMap[parseInt(uid)] || { name: 'N/A', matricula: '-', baseSalary: 0 };
                const { salarioBruto, descontoInss, salarioLiquido, adicNoturno } = await calcFinanceiro(u, recs);
                financBody.push([
                    u.name || '-',
                    u.matricula || '-',
                    formatCurrency(adicNoturno),
                    formatCurrency(salarioBruto),
                    formatCurrency(descontoInss),
                    formatCurrency(salarioLiquido)
                ]);
            }

            doc.autoTable({
                startY: startY,
                head:   financHead,
                body:   financBody,
                theme: 'striped',
                headStyles: { fillColor: primaryDark, textColor: 255, fontSize: 8, fontStyle: 'bold' },
                bodyStyles:         { fontSize: 8, textColor: textColor },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                margin: { left: 14, right: 14 }
            });

            startY = doc.lastAutoTable.finalY + 10;
        }

        // ── Tabela de registros de ponto ─────────────────────────────────────
        let tableHeaders, tableBody;

        if (singleEmployeeMode) {
            tableHeaders = [['Data', 'Entrada', 'Pausa', 'Retorno', 'Saída', 'H. Noturnas', 'H. Trab.', 'HE 50%', 'HE 100%']];
            tableBody = data.map(r => [
                r.date.split('-').reverse().join('/'),
                r.entrada  || '-',
                r.pausa    || '-',
                r.retorno  || '-',
                r.saida    || '-',
                minutesToTime(r.calc.minutosNoturnos || 0),
                r.calc.horasTrab.replace(':', 'h ') + 'm',
                r.calc.horasExtra50.replace(':', 'h ') + 'm',
                r.calc.horasExtra100.replace(':', 'h ') + 'm'
            ]);
        } else {
            const userMap = window.getUserMap ? window.getUserMap() : {};
            tableHeaders = [['Nome', 'Data', 'Entrada', 'Saída', 'H. Noturnas', 'H. Trab.', 'HE 50%', 'HE 100%']];
            tableBody = data.map(r => {
                const u = userMap[r.userId] || {};
                return [
                    u.name || '-',
                    r.date.split('-').reverse().join('/'),
                    r.entrada || '-',
                    r.saida   || '-',
                    minutesToTime(r.calc.minutosNoturnos || 0),
                    r.calc.horasTrab.replace(':', 'h ') + 'm',
                    r.calc.horasExtra50.replace(':', 'h ') + 'm',
                    r.calc.horasExtra100.replace(':', 'h ') + 'm'
                ];
            });
        }

        doc.autoTable({
            startY: startY,
            head:   tableHeaders,
            body:   tableBody,
            theme: 'striped',
            headStyles: { fillColor: primaryDark, textColor: 255, fontSize: 9, fontStyle: 'bold' },
            bodyStyles:         { fontSize: 8, textColor: textColor },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 14, right: 14 }
        });

        // ── Assinaturas ───────────────────────────────────────────────────────
        let finalY = doc.lastAutoTable.finalY + 30;
        if (finalY > 260) {
            doc.addPage();
            finalY = 40;
        }

        doc.setDrawColor(150, 150, 150);
        doc.line(14, finalY, 90, finalY);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Assinatura do Funcionário", 14, finalY + 5);

        doc.line(120, finalY, 196, finalY);
        doc.text("Assinatura do Responsável", 120, finalY + 5);

        doc.setFontSize(8);
        doc.text(`Documento gerado eletronicamente em ${dateStr}, ${timeStr}`, 14, finalY + 15);

        doc.save("relatorio_ponto.pdf");
        showToast('Exportação PDF concluída.', 'success');

    } catch (e) {
        console.error(e);
        showToast('Erro ao exportar PDF.', 'error');
    }
});
