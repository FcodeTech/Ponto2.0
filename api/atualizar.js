export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zwcvaqxdfurmexyuxtvv.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3Y3ZhcXhkZnVybWV4eXV4dHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzI3ODUsImV4cCI6MjA5OTQ0ODc4NX0.lKmjdZznodxT6QPZ8QyZOTpc_DrRROAyjKA1muPtS-Y';

  // Parser seguro do corpo da requisição (JSON)
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {}
  }
  body = body || {};

  const action = body.action;
  const actionTicker = (body.ticker || '').toUpperCase().trim();
  const motivo = body.motivo;

  // 1. Tratamento de Quarentena e Restauração (Alta)
  if (action === 'quarantine' || action === 'restore') {
    if (!actionTicker) {
      return res.status(400).json({ sucesso: false, erro: 'Ticker não informado para quarentena.' });
    }

    try {
      const respGet = await fetch(`${SUPABASE_URL}/rest/v1/mp_ativos?ticker=eq.${encodeURIComponent(actionTicker)}&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const rows = respGet.ok ? await respGet.json() : [];

      if (!rows || rows.length === 0) {
        return res.status(404).json({ sucesso: false, erro: `Ativo ${actionTicker} não encontrado no banco de dados.` });
      }

      const itemAtual = rows[0];
      let tipoBase = (itemAtual.tipo || '').replace(/^(QUARENTENA:)+/, '').trim();
      if (!tipoBase) tipoBase = actionTicker.endsWith('11') ? 'FII' : 'Ação';

      const partesNome = (itemAtual.nome || actionTicker).split(' :: ');
      const nomeBase = partesNome[0].trim();

      let novoTipo = tipoBase;
      let novoNome = nomeBase;

      if (action === 'quarantine') {
        novoTipo = `QUARENTENA:${tipoBase}`;
        const textoMotivo = (motivo || 'Fundamentos ou Dividend Yield abaixo do esperado').trim();
        novoNome = `${nomeBase} :: ${textoMotivo}`;
      }

      const respPatch = await fetch(`${SUPABASE_URL}/rest/v1/mp_ativos?ticker=eq.${encodeURIComponent(actionTicker)}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tipo: novoTipo,
          nome: novoNome,
          atualizado_em: new Date().toISOString()
        })
      });

      if (!respPatch.ok) {
        return res.status(500).json({ sucesso: false, erro: 'Falha ao atualizar quarentena no Supabase.' });
      }

      return res.status(200).json({
        sucesso: true,
        ticker: actionTicker,
        tipo: novoTipo,
        nome: novoNome
      });
    } catch (eQuar) {
      return res.status(500).json({ sucesso: false, erro: eQuar.message });
    }
  }

  // 2. Tratamento de Exclusão Definitiva (DELETE)
  if (req.method === 'DELETE') {
    const delTicker = (req.query?.ticker || '').toUpperCase().trim();
    if (!delTicker) {
      return res.status(400).json({ sucesso: false, erro: 'Ticker não informado para exclusão.' });
    }
    try {
      const respDel = await fetch(`${SUPABASE_URL}/rest/v1/mp_ativos?ticker=eq.${encodeURIComponent(delTicker)}&tipo=neq.MEMORIA`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (!respDel.ok) {
        return res.status(500).json({ sucesso: false, erro: 'Falha ao excluir no Supabase.' });
      }
      return res.status(200).json({ sucesso: true, removido: delTicker });
    } catch (eDel) {
      return res.status(500).json({ sucesso: false, erro: eDel.message });
    }
  }

  const tickerUnico = req.query?.ticker?.toUpperCase()?.trim();
  const tickers = tickerUnico ? [tickerUnico] : ['BBAS3', 'PETR4', 'VALE3', 'HGLG11', 'MXRF11'];

  try {
    const resultados = [];
    const sbPayload = [];

    for (const ticker of tickers) {
      if (!ticker) continue;
      const isFii = ticker.endsWith('11');
      const tipo = isFii ? 'FII' : 'Ação';

      const ativo = {
        ticker: ticker,
        tipo: tipo,
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

      // 1. Tenta StatusInvest (dados mais completos e precisos da B3: Ações, FIIs e Fiagros)
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
        } catch (errSi) {
          // Continua para o próximo endpoint
        }
      }

      // 2. Tenta Fundamentus para enriquecer P/L, P/VP e complementar dados
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
      } catch (errFund) {
        console.warn(`[API] Fundamentus aviso para ${ticker}:`, errFund.message);
      }

      // 3. Fallback Google Finance se preço ainda não encontrado
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
        } catch (errGf) {
          console.warn(`[API] Google Finance aviso para ${ticker}:`, errGf.message);
        }
      }

      if (ativo.preco_atual > 0) {
        resultados.push(ativo);
        sbPayload.push({
          ticker: ativo.ticker,
          tipo: ativo.tipo,
          nome: JSON.stringify({
            n: ativo.nome,
            min: ativo.min_52,
            max: ativo.max_52,
            pvp: ativo.pvp,
            pl: ativo.pl,
            var: ativo.variacao_12m
          }),
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

    // Persiste os resultados na tabela mp_ativos do Supabase
    if (sbPayload.length > 0) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/mp_ativos`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(sbPayload)
        });
      } catch (errSb) {
        console.warn('[API] Aviso ao salvar no Supabase:', errSb.message);
      }
    }

    return res.status(200).json({
      sucesso: true,
      atualizados: resultados
    });
  } catch (error) {
    return res.status(500).json({
      sucesso: false,
      erro: error.message || 'Erro interno no servidor ao consultar cotações.'
    });
  }
}
