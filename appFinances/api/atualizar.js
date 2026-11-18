export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const BOLSAI_TOKEN = process.env.BOLSAI_TOKEN;

  const tickerUnico = req.query?.ticker?.toUpperCase();
  const tickers = tickerUnico ? [tickerUnico] : ['BBAS3', 'PETR4', 'VALE3', 'HGLG11', 'MXRF11'];

  try {
    const resultados = [];

    for (const ticker of tickers) {
      const respApi = await fetch(`https://api.bolsai.com.br/v1/ativos/${ticker}`, {
        headers: {
          'Authorization': `Bearer ${BOLSAI_TOKEN}`
        }
      });

      if (!respApi.ok) continue;

      const dados = await respApi.json();
      const tipo = ticker.endsWith('11') ? 'FII' : 'Ação';

      resultados.push({
        ticker: ticker,
        tipo: tipo,
        nome: dados.nome || dados.empresa || ticker,
        preco_atual: dados.preco || dados.cotacao || 0,
        dividend_yield: dados.dividend_yield || dados.dy || 0,
        atualizado_em: new Date().toISOString()
      });
    }

    if (resultados.length > 0) {
      const respSupabase = await fetch(`${SUPABASE_URL}/rest/v1/mp_ativos`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(resultados)
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
      erro: erro.message
    });
  }
}