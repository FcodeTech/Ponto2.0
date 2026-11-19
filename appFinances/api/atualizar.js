export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zwcvaqxdfurmexyuxtvv.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3Y3ZhcXhkZnVybWV4eXV4dHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzI3ODUsImV4cCI6MjA5OTQ0ODc4NX0.lKmjdZznodxT6QPZ8QyZOTpc_DrRROAyjKA1muPtS-Y';
  const BOLSAI_TOKEN = process.env.BOLSAI_TOKEN;

  const headersSupabase = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. MOVIMENTAÇÃO DE QUARENTENA OU RESTAURAÇÃO (POST)
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { action, ticker, motivo } = body;
      const tickerLimpo = (ticker || '').toUpperCase().trim();

      if (!tickerLimpo) {
        return res.status(400).json({ sucesso: false, erro: 'Ticker não informado.' });
      }

      const respAtual = await fetch(
        `${SUPABASE_URL}/rest/v1/mp_ativos?ticker=eq.${encodeURIComponent(tickerLimpo)}&select=*`,
        { headers: headersSupabase }
      );
      const rows = respAtual.ok ? await respAtual.json() : [];
      const itemAtual = rows[0];

      if (!itemAtual) {
        return res.status(404).json({ sucesso: false, erro: `Ativo ${tickerLimpo} não encontrado.` });
      }

      const tipoBase = itemAtual.tipo.replace(/^QUARENTENA:/, '');
      const nomeBase = (itemAtual.nome || tickerLimpo).split(' :: ')[0].trim();

      let novoTipo = tipoBase;
      let novoNome = nomeBase;

      if (action === 'quarantine') {
        novoTipo = `QUARENTENA:${tipoBase}`;
        const textoMotivo = (motivo || 'Fundamentos ou Dividend Yield abaixo do esperado').trim();
        novoNome = `${nomeBase} :: ${textoMotivo}`;
      } else if (action === 'restore') {
        novoTipo = tipoBase;
        novoNome = nomeBase;
      } else {
        return res.status(400).json({ sucesso: false, erro: 'Ação inválida.' });
      }

      const respPatch = await fetch(
        `${SUPABASE_URL}/rest/v1/mp_ativos?ticker=eq.${encodeURIComponent(tickerLimpo)}`,
        {
          method: 'PATCH',
          headers: headersSupabase,
          body: JSON.stringify({
            tipo: novoTipo,
            nome: novoNome,
            atualizado_em: new Date().toISOString()
          })
        }
      );

      if (!respPatch.ok) {
        const erroPatch = await respPatch.text();
        throw new Error(`Erro ao atualizar status: ${erroPatch}`);
      }

      return res.status(200).json({ sucesso: true, ticker: tickerLimpo, tipo: novoTipo, nome: novoNome });
    }

    // 2. REMOÇÃO DEFINITIVA DE ATIVO (DELETE)
    if (req.method === 'DELETE') {
      const tickerRemover = (req.query?.ticker || '').toUpperCase().trim();
      if (!tickerRemover) {
        return res.status(400).json({ sucesso: false, erro: 'Ticker não informado para remoção.' });
      }

      const respDel = await fetch(
        `${SUPABASE_URL}/rest/v1/mp_ativos?ticker=eq.${encodeURIComponent(tickerRemover)}&tipo=neq.MEMORIA`,
        { method: 'DELETE', headers: headersSupabase }
      );

      if (!respDel.ok) {
        const erroDel = await respDel.text();
        throw new Error(`Erro ao remover ativo: ${erroDel}`);
      }

      return res.status(200).json({ sucesso: true, removido: tickerRemover });
    }

    // 3. CONSULTA DE MAPA EXISTENTE (PARA PRESERVAR QUARENTENA NA ATUALIZAÇÃO)
    const mapaExistentes = {};
    const respTodos = await fetch(
      `${SUPABASE_URL}/rest/v1/mp_ativos?select=ticker,tipo,nome,preco_atual,dividend_yield&tipo=neq.MEMORIA`,
      { headers: headersSupabase }
    );
    if (respTodos.ok) {
      const lista = await respTodos.json();
      lista.forEach(item => {
        mapaExistentes[item.ticker] = item;
      });
    }

    // 4. DEFINIÇÃO DOS TICKERS A ATUALIZAR
    let tickers = [];
    const tickerUnico = req.query?.ticker?.toUpperCase().trim();
    const atualizarTodos = req.query?.todos === 'true';

    if (tickerUnico) {
      tickers = [tickerUnico];
    } else if (atualizarTodos) {
      tickers = Object.keys(mapaExistentes);
      if (tickers.length === 0) {
        tickers = ['BBAS3', 'PETR4', 'VALE3', 'HGLG11', 'MXRF11'];
      }
    } else {
      tickers = ['BBAS3', 'PETR4', 'VALE3', 'HGLG11', 'MXRF11'];
    }

    // 5. CONSULTA DE DADOS DE MERCADO (COM BOLSAI E RESILIENTE A STATUSINVEST / FUNDAMENTUS / GOOGLE FINANCE / BRAPI)
    const resultados = [];
    const sbPayload = [];

    for (const ticker of tickers) {
      if (!ticker) continue;
      const existente = mapaExistentes[ticker];
      const emQuarentena = existente?.tipo?.startsWith('QUARENTENA:');
      const tipoPadrao = ticker.endsWith('11') ? 'FII' : 'Ação';
      const tipoFinal = emQuarentena ? existente.tipo : tipoPadrao;

      const ativo = {
        ticker: ticker,
        tipo: tipoFinal,
        nome: ticker,
        preco_atual: 0.0,
        dividend_yield: 0.0,
        min_52: null,
        max_52: null,
        pvp: null,
        pl: null,
        variacao_12m: null,
        atualizado_em: new Date().toISOString()
      };

      // 5.1 Se houver token da BolsaAI, tenta a API oficial da BolsaAI
      if (BOLSAI_TOKEN) {
        try {
          const respApi = await fetch(`https://api.bolsai.com.br/v1/ativos/${ticker}`, {
            headers: { 'Authorization': `Bearer ${BOLSAI_TOKEN}` }
          });
          if (respApi.ok) {
            const dadosBolsa = await respApi.json();
            ativo.preco_atual = dadosBolsa.preco || dadosBolsa.cotacao || 0;
            ativo.dividend_yield = dadosBolsa.dividend_yield || dadosBolsa.dy || 0;
            if (dadosBolsa.nome || dadosBolsa.empresa) ativo.nome = dadosBolsa.nome || dadosBolsa.empresa;
          }
        } catch (eBolsa) {
          // Continua para scrapers
        }
      }

      // 5.2 Se ainda não obteve cotação, consulta StatusInvest (Ações, FIIs e Fiagros)
      if (ativo.preco_atual <= 0) {
        const isFii = ticker.endsWith('11');
        const urlsSi = [];
        if (isFii) {
          urlsSi.push(`https://statusinvest.com.br/fundos-imobiliarios/${ticker.toLowerCase()}`);
          urlsSi.push(`https://statusinvest.com.br/fiagros/${ticker.toLowerCase()}`);
        } else {
          urlsSi.push(`https://statusinvest.com.br/acoes/${ticker.toLowerCase()}`);
        }

        for (const urlSi of urlsSi) {
          try {
            const respSi = await fetch(urlSi, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            if (respSi.ok) {
              const htmlSi = await respSi.text();
              const mPreco = htmlSi.match(/title="Valor atual[^"]*"[\s\S]*?<strong class="value">([\d,\.]+)/i) ||
                             htmlSi.match(/<strong class="value">([\d,\.]+)/i);
              if (mPreco) {
                ativo.preco_atual = parseFloat(mPreco[1].replace(/\./g, '').replace(',', '.'));
              }

              const mDy = htmlSi.match(/title="Dividend Yield[^"]*"[\s\S]*?<strong class="value">([\d,\.]+)/i);
              if (mDy) {
                ativo.dividend_yield = parseFloat(mDy[1].replace(/\./g, '').replace(',', '.'));
              }

              const mMin = htmlSi.match(/Min\. 52 semanas[\s\S]*?<strong class="value">([\d,\.]+)/i);
              if (mMin) ativo.min_52 = parseFloat(mMin[1].replace(/\./g, '').replace(',', '.'));

              const mMax = htmlSi.match(/M[áa]x\. 52 semanas[\s\S]*?<strong class="value">([\d,\.]+)/i);
              if (mMax) ativo.max_52 = parseFloat(mMax[1].replace(/\./g, '').replace(',', '.'));

              const mVar = htmlSi.match(/Valoriza[çc][ãa]o \(12m\)[\s\S]*?<strong class="value">([^<]+)/i);
              if (mVar) ativo.variacao_12m = mVar[1].trim();

              const mNome = htmlSi.match(/<small[^>]*>([^<]+)<\/small>/i);
              if (mNome) ativo.nome = mNome[1].trim();

              if (ativo.preco_atual > 0 && ativo.dividend_yield > 0) break;
            }
          } catch (errSi) {}
        }
      }

      // 5.3 Enriquecimento via Fundamentus (P/L, P/VP, etc.)
      try {
        const respFund = await fetch(`https://www.fundamentus.com.br/detalhes.php?papel=${ticker}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (respFund.ok) {
          const buf = await respFund.arrayBuffer();
          const decoder = new TextDecoder('iso-8859-1');
          const textFund = decoder.decode(buf);

          const getLabel = (label) => {
            const rx = new RegExp(`>${label}<[\\s\\S]{1,200}?<span class="txt">([^<]+)</span>`, 'i');
            const m = textFund.match(rx);
            return m ? m[1].trim() : null;
          };

          if (ativo.preco_atual <= 0) {
            const c = getLabel('Cotação');
            if (c) ativo.preco_atual = parseFloat(c.replace(/\./g, '').replace(',', '.'));
          }

          if (ativo.dividend_yield <= 0) {
            const d = getLabel('Div. Yield');
            if (d) ativo.dividend_yield = parseFloat(d.replace('%', '').replace(/\./g, '').replace(',', '.'));
          }

          const pvp = getLabel('P/VP');
          if (pvp && pvp !== '-') {
            try { ativo.pvp = parseFloat(pvp.replace(/\./g, '').replace(',', '.')); } catch {}
          }

          const pl = getLabel('P/L');
          if (pl && pl !== '-') {
            try { ativo.pl = parseFloat(pl.replace(/\./g, '').replace(',', '.')); } catch {}
          }

          if (!ativo.min_52) {
            const mn = getLabel('Min 52 sem');
            if (mn) ativo.min_52 = parseFloat(mn.replace(/\./g, '').replace(',', '.'));
          }
          if (!ativo.max_52) {
            const mx = getLabel('Max 52 sem');
            if (mx) ativo.max_52 = parseFloat(mx.replace(/\./g, '').replace(',', '.'));
          }

          if (ativo.nome === ticker) {
            const nm = getLabel('Empresa') || getLabel('Fundo');
            if (nm) ativo.nome = nm;
          }
        }
      } catch (errFund) {}

      // 5.4 Fallback Google Finance se ainda não achou preço
      if (ativo.preco_atual <= 0) {
        try {
          const respGf = await fetch(`https://www.google.com/finance/quote/${ticker}:BVMF`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (respGf.ok) {
            const html = await respGf.text();
            const matchPreco = html.match(/class="[^"]*YMlKec[^"]*fxKbKc[^"]*">R\$([0-9\.,]+)</i) || html.match(/R\$([0-9]+(?:\.[0-9]+)?)/);
            if (matchPreco) {
              ativo.preco_atual = parseFloat(matchPreco[1].replace(',', '.'));
            }
          }
        } catch (errGf) {}
      }

      // Se achou preço ou se o ativo já existia na carteira
      if (ativo.preco_atual > 0 || (existente && Number(existente.preco_atual) > 0)) {
        if (ativo.preco_atual <= 0 && existente) {
          ativo.preco_atual = Number(existente.preco_atual);
          ativo.dividend_yield = Number(existente.dividend_yield);
        }

        // Monta o nome preservando quarentena e metadados
        let nomeBaseFormatado = ativo.nome;
        if (ativo.min_52 || ativo.max_52 || ativo.pvp || ativo.pl || ativo.variacao_12m) {
          nomeBaseFormatado = JSON.stringify({
            n: ativo.nome,
            min: ativo.min_52,
            max: ativo.max_52,
            pvp: ativo.pvp,
            pl: ativo.pl,
            var: ativo.variacao_12m
          });
        }

        let nomeFinal = nomeBaseFormatado;
        if (emQuarentena && existente?.nome?.includes(' :: ')) {
          const motivoSalvo = existente.nome.split(' :: ')[1];
          nomeFinal = `${nomeBaseFormatado} :: ${motivoSalvo}`;
        }

        resultados.push(ativo);
        sbPayload.push({
          ticker: ativo.ticker,
          tipo: tipoFinal,
          nome: nomeFinal,
          preco_atual: ativo.preco_atual,
          dividend_yield: ativo.dividend_yield,
          atualizado_em: ativo.atualizado_em
        });
      }
    }

    if (resultados.length === 0 && tickerUnico) {
      return res.status(404).json({
        sucesso: false,
        erro: `Ativo "${tickerUnico}" não encontrado na B3. Verifique o código digitado.`
      });
    }

    // 6. GRAVAÇÃO NA TABELA ÚNICA DO SUPABASE (UPSERT)
    if (sbPayload.length > 0) {
      const respSupabase = await fetch(`${SUPABASE_URL}/rest/v1/mp_ativos`, {
        method: 'POST',
        headers: {
          ...headersSupabase,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(sbPayload)
      });

      if (!respSupabase.ok) {
        const erroDb = await respSupabase.text();
        throw new Error(`Erro no Supabase (mp_ativos): ${erroDb}`);
      }
    }

    return res.status(200).json({
      sucesso: true,
      atualizados: resultados
    });

  } catch (erro) {
    return res.status(500).json({
      sucesso: false,
      erro: erro.message || 'Erro interno no servidor ao processar requisição.'
    });
  }
}
