import http.server
import socketserver
import urllib.parse
import json
import urllib.request
import datetime
import os
import re
import html

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://zwcvaqxdfurmexyuxtvv.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', os.environ.get('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3Y3ZhcXhkZnVybWV4eXV4dHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzI3ODUsImV4cCI6MjA5OTQ0ODc4NX0.lKmjdZznodxT6QPZ8QyZOTpc_DrRROAyjKA1muPtS-Y'))

def buscar_cotacao_precisa(ticker):
    ticker = ticker.upper().strip()
    is_fii = ticker.endswith('11')
    tipo = 'FII' if is_fii else 'Ação'
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

    dados = {
        'ticker': ticker,
        'tipo': tipo,
        'nome': ticker,
        'preco_atual': 0.0,
        'dividend_yield': 0.0,
        'min_52': None,
        'max_52': None,
        'pvp': None,
        'pl': None,
        'variacao_12m': None,
        'atualizado_em': datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

    # 1. Tenta StatusInvest (dados mais completos e precisos da B3: Ações, FIIs e Fiagros)
    si_urls = []
    if is_fii:
        si_urls.append(f"https://statusinvest.com.br/fundos-imobiliarios/{ticker.lower()}")
        si_urls.append(f"https://statusinvest.com.br/fiagros/{ticker.lower()}")
    else:
        si_urls.append(f"https://statusinvest.com.br/acoes/{ticker.lower()}")

    for url_si in si_urls:
        try:
            req_si = urllib.request.Request(url_si, headers=headers)
            with urllib.request.urlopen(req_si, timeout=6) as resp_si:
                raw_html = resp_si.read().decode('utf-8', errors='ignore')
                
                # Preço atual
                m_pr = re.search(r'title="Valor atual[^"]*"[\s\S]*?<strong class="value">([\d,\.]+)', raw_html)
                if not m_pr:
                    vals = re.findall(r'<strong class="value">([\d,\.]+)', raw_html)
                    if vals:
                        dados['preco_atual'] = float(vals[0].replace('.', '').replace(',', '.'))
                else:
                    dados['preco_atual'] = float(m_pr.group(1).replace('.', '').replace(',', '.'))

                # Dividend Yield 12m
                m_dy = re.search(r'title="Dividend Yield[^"]*"[\s\S]*?<strong class="value">([\d,\.]+)', raw_html)
                if m_dy:
                    dados['dividend_yield'] = float(m_dy.group(1).replace('.', '').replace(',', '.'))
                elif len(re.findall(r'<strong class="value">([\d,\.]+)', raw_html)) > 3:
                    vals = re.findall(r'<strong class="value">([\d,\.]+)', raw_html)
                    try:
                        dados['dividend_yield'] = float(vals[3].replace('.', '').replace(',', '.'))
                    except:
                        pass

                # Min. 52 semanas
                m_min = re.search(r'title="Valor m[íi]nimo[^"]*52[^"]*"[\s\S]*?<strong class="value">([\d,\.]+)', raw_html) or re.search(r'Min\. 52 semanas[\s\S]*?<strong class="value">([\d,\.]+)', raw_html)
                if m_min:
                    dados['min_52'] = float(m_min.group(1).replace('.', '').replace(',', '.'))

                # Máx. 52 semanas
                m_max = re.search(r'title="Valor m[áa]ximo[^"]*52[^"]*"[\s\S]*?<strong class="value">([\d,\.]+)', raw_html) or re.search(r'M[áa]x\. 52 semanas[\s\S]*?<strong class="value">([\d,\.]+)', raw_html)
                if m_max:
                    dados['max_52'] = float(m_max.group(1).replace('.', '').replace(',', '.'))

                # Valorização 12m
                m_var = re.search(r'title="Valoriza[çc][ãa]o[^"]*12[^"]*"[\s\S]*?<strong class="value">([^<]+)', raw_html) or re.search(r'Valoriza[çc][ãa]o \(12m\)[\s\S]*?<strong class="value">([^<]+)', raw_html)
                if m_var:
                    dados['variacao_12m'] = m_var.group(1).strip()

                # Nome da empresa / fundo
                m_small = re.findall(r'<small[^>]*>([^<]+)</small>', raw_html)
                if m_small:
                    dados['nome'] = html.unescape(m_small[0]).strip()

                if dados['preco_atual'] > 0 and dados['dividend_yield'] > 0:
                    break
        except Exception as e:
            pass

    # 2. Tenta Fundamentus (enriquece P/L, P/VP e complementa dados ausentes)
    try:
        url_fund = f"https://www.fundamentus.com.br/detalhes.php?papel={ticker}"
        req_f = urllib.request.Request(url_fund, headers=headers)
        with urllib.request.urlopen(req_f, timeout=5) as resp_f:
            content = resp_f.read().decode('latin-1', errors='ignore')

            def get_f(label):
                m = re.search(r'>' + re.escape(label) + r'</span>[\s\S]*?<span class="txt">([^<]+)</span>', content, re.IGNORECASE)
                if not m:
                    m = re.search(r'>' + re.escape(label) + r'[\s\S]{1,200}?<span class="txt">([^<]+)</span>', content, re.IGNORECASE)
                return m.group(1).strip() if m else None

            # Preço se faltou
            if dados['preco_atual'] <= 0:
                c = get_f('Cotação')
                if c:
                    dados['preco_atual'] = float(c.replace('.', '').replace(',', '.'))

            # DY se faltou
            if dados['dividend_yield'] <= 0:
                d = get_f('Div. Yield')
                if d:
                    dados['dividend_yield'] = float(d.replace('%', '').replace('.', '').replace(',', '.'))

            # P/VP
            pvp_val = get_f('P/VP')
            if pvp_val and pvp_val != '-':
                try:
                    dados['pvp'] = float(pvp_val.replace('.', '').replace(',', '.'))
                except:
                    pass

            # P/L
            pl_val = get_f('P/L')
            if pl_val and pl_val != '-':
                try:
                    dados['pl'] = float(pl_val.replace('.', '').replace(',', '.'))
                except:
                    pass

            # Min 52 se faltou
            if not dados['min_52']:
                m52 = get_f('Min 52 sem')
                if m52:
                    dados['min_52'] = float(m52.replace('.', '').replace(',', '.'))

            # Max 52 se faltou
            if not dados['max_52']:
                mx52 = get_f('Max 52 sem')
                if mx52:
                    dados['max_52'] = float(mx52.replace('.', '').replace(',', '.'))

            # Nome se ainda padrão
            if dados['nome'] == ticker:
                nm = get_f('Empresa') or get_f('Fundo')
                if nm:
                    dados['nome'] = html.unescape(nm).strip()
    except Exception as e:
        print(f"[local_server] Fundamentus notice para {ticker}: {e}")

    # 3. Fallback Google Finance se preço ainda zerado
    if dados['preco_atual'] <= 0:
        try:
            gf_url = f'https://www.google.com/finance/quote/{ticker}:BVMF'
            req_gf = urllib.request.Request(gf_url, headers=headers)
            with urllib.request.urlopen(req_gf, timeout=5) as resp_gf:
                raw_gf = resp_gf.read().decode('utf-8', errors='ignore')
                m_preco = re.search(r'class="[^"]*YMlKec[^"]*fxKbKc[^"]*">R\$([0-9\.,]+)<', raw_gf) or re.search(r'R\$([0-9]+(?:\.[0-9]+)?)', raw_gf)
                if m_preco:
                    dados['preco_atual'] = float(m_preco.group(1).replace(',', '.'))
                    m_nome = re.search(r'class="zzDege">([^<]+)<', raw_gf)
                    if m_nome and dados['nome'] == ticker:
                        dados['nome'] = m_nome.group(1).strip()
        except Exception as e:
            print(f"[local_server] Google Finance notice para {ticker}: {e}")

    # 4. Fallback brapi.dev se ainda zerado
    if dados['preco_atual'] <= 0:
        try:
            url_brapi = f'https://brapi.dev/api/quote/{ticker}'
            req_brapi = urllib.request.Request(url_brapi, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req_brapi, timeout=5) as resp_b:
                data = json.loads(resp_b.read().decode())
                item = data.get('results', [{}])[0]
                if item.get('regularMarketPrice'):
                    dados['preco_atual'] = float(item.get('regularMarketPrice') or 0)
                    if dados['dividend_yield'] <= 0:
                        dados['dividend_yield'] = float(item.get('dividendYield') or 0)
                    if dados['nome'] == ticker:
                        dados['nome'] = item.get('longName') or item.get('shortName') or ticker
        except Exception as e:
            print(f"[local_server] brapi notice para {ticker}: {e}")

    if dados['preco_atual'] > 0:
        return dados
    return None

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/atualizar':
            self.handle_api(parsed.query)
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/atualizar':
            self.handle_api(parsed.query)
        else:
            self.send_error(404, "Not Found")

    def handle_api(self, query_string):
        params = urllib.parse.parse_qs(query_string)
        ticker_unico = params.get('ticker', [''])[0].upper().strip()
        tickers = [ticker_unico] if ticker_unico else ['BBAS3', 'PETR4', 'VALE3', 'HGLG11', 'MXRF11']

        resultados = []
        sb_payload = []
        for t in tickers:
            if t:
                cot = buscar_cotacao_precisa(t)
                if cot:
                    resultados.append(cot)
                    # Prepara item para mp_ativos persistindo metadados ricos em 'nome'
                    meta_nome = json.dumps({
                        'n': cot['nome'],
                        'min': cot.get('min_52'),
                        'max': cot.get('max_52'),
                        'pvp': cot.get('pvp'),
                        'pl': cot.get('pl'),
                        'var': cot.get('variacao_12m')
                    }, ensure_ascii=False)
                    sb_payload.append({
                        'ticker': cot['ticker'],
                        'tipo': cot['tipo'],
                        'nome': meta_nome,
                        'preco_atual': cot['preco_atual'],
                        'dividend_yield': cot['dividend_yield'],
                        'atualizado_em': cot['atualizado_em']
                    })

        if not resultados and ticker_unico:
            payload = json.dumps({
                'sucesso': False,
                'erro': f'Ativo "{ticker_unico}" não encontrado na B3. Verifique o código digitado.'
            }).encode('utf-8')
            self.send_response(404)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(payload)
            return

        # Sincroniza com Supabase mp_ativos
        if sb_payload:
            try:
                sb_url = f"{SUPABASE_URL}/rest/v1/mp_ativos"
                req_sb = urllib.request.Request(
                    sb_url,
                    data=json.dumps(sb_payload).encode('utf-8'),
                    headers={
                        'apikey': SUPABASE_KEY,
                        'Authorization': f'Bearer {SUPABASE_KEY}',
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    method='POST'
                )
                with urllib.request.urlopen(req_sb, timeout=6) as r:
                    print(f"[local_server] Supabase mp_ativos sincronizado com indicadores: {r.status}")
            except Exception as e:
                print(f"[local_server] Supabase sync notice: {e}")

        payload = json.dumps({
            'sucesso': True,
            'atualizados': resultados
        }).encode('utf-8')

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Servidor Ponto2.0 com cotações precisas ativo em http://localhost:{PORT}")
        httpd.serve_forever()
