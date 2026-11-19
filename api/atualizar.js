export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zwcvaqxdfurmexyuxtvv.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3Y3ZhcXhkZnVybWV4eXV4dHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzI3ODUsImV4cCI6MjA5OTQ0ODc4NX0.lKmjdZznodxT6QPZ8QyZOTpc_DrRROAyjKA1muPtS-Y';
  const API_TOKEN = process.env.BOLSAI_TOKEN || process.env.BRAPI_TOKEN || '';

  const tickerUnico = req.query?.ticker?.toUpperCase()?.trim();
  const tickers = tickerUnico ? [tickerUnico] : ['BBAS3', 'PETR4', 'VALE3', 'HGLG11', 'MXRF11'];

  try {
    const resultados = [];

    for (const ticker of tickers) {
      if (!ticker) continue;
      const tipo = ticker.endsWith('11') ? 'FII' : 'Ação';
      let ativoObtido = null;

      // 1. Tenta Google Finance (preço exato em tempo real para Ações e FIIs da B3)
      try {
        const respGf = await fetch(`https://www.google.com/finance/quote/${ticker}:BVMF`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (respGf.ok) {
          const html = await respGf.text();
          const matchPreco = html.match(/class="[^"]*YMlKec[^"]*fxKbKc[^"]*">R\$([0-9\.,]+)</i) || html.match(/R\$([0-9]+(?:\.[0-9]+)?)/);
          const matchNome = html.match(/class="zzDege">([^<]+)</i);
          if (matchPreco) {
            const precoLimpo = parseFloat(matchPreco[1].replace(',', '.'));
            if (precoLimpo > 0) {
              ativoObtido = {
                ticker: ticker,
                tipo: tipo,
                nome: matchNome ? matchNome[1].trim() : `${ticker} (B3)`,
                preco_atual: precoLimpo,
                dividend_yield: tipo === 'FII' ? 11.5 : 7.0, // Estimativa de base para DY caso não informada
                atualizado_em: new Date().toISOString()
              };
            }
          }
        }
      } catch (errGf) {
        console.warn(`[API] Google Finance falhou para ${ticker}:`, errGf.message);
      }

      // 2. Consulta via brapi.dev
      if (!ativoObtido) {
        try {
          const urlBrapi = API_TOKEN
            ? `https://brapi.dev/api/quote/${ticker}?token=${API_TOKEN}`
            : `https://brapi.dev/api/quote/${ticker}`;

          const respBrapi = await fetch(urlBrapi, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });

          if (respBrapi.ok) {
            const dados = await respBrapi.json();
            const item = dados.results?.[0];
            if (item && item.regularMarketPrice !== undefined) {
              ativoObtido = {
                ticker: ticker,
                tipo: tipo,
                nome: item.longName || item.shortName || ticker,
                preco_atual: Number(item.regularMarketPrice) || 0,
                dividend_yield: Number(item.dividendYield || 0),
                atualizado_em: new Date().toISOString()
              };
            }
          }
        } catch (errBrapi) {
          console.warn(`[API] Brapi falhou para ${ticker}:`, errBrapi.message);
        }
      }

      if (ativoObtido) {
        resultados.push(ativoObtido);
      }
    }

    if (resultados.length === 0 && tickerUnico) {
      return res.status(404).json({
        sucesso: false,
        erro: `Ativo "${tickerUnico}" não encontrado na B3. Verifique o código digitado.`
      });
    }

    // Persiste os resultados na tabela mp_ativos do Supabase
    if (resultados.length > 0) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/mp_ativos`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(resultados)
        });
      } catch (errDb) {
        console.warn(`[API] Erro ao gravar no Supabase:`, errDb.message);
      }
    }

    return res.status(200).json({
      sucesso: true,
      atualizados: resultados
    });

  } catch (erro) {
    return res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
}
