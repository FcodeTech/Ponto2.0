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
BOLSAI_TOKEN = os.environ.get('BOLSAI_TOKEN')

def buscar_cotacao_precisa(ticker):
    ticker = ticker.upper().strip()
    is_fii = ticker.endswith('11')
    tipo = 'FII' if is_fii else 'Ação'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    }

    FALLBACK_ATIVOS = {
        'IFRA11': {
            'nome': 'Itaú Infra Debêntures FI-Infra',
            'preco_atual': 81.48,
            'dividend_yield': 13.60,
            'min_52': 81.37,
            'max_52': 100.95,
            'pvp': 0.95,
            'variacao_12m': '-3,48%'
        }
    }

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

    # 0. Tenta Bolsai se houver token configurado
    if BOLSAI_TOKEN:
        try:
            req_bolsa = urllib.request.Request(
                f"https://api.bolsai.com.br/v1/ativos/{ticker}",
                headers={'Authorization': f"Bearer {BOLSAI_TOKEN}", 'User-Agent': headers['User-Agent']}
            )
            with urllib.request.urlopen(req_bolsa, timeout=4) as resp_b:
                d_bolsa = json.loads(resp_b.read().decode('utf-8'))
                if d_bolsa.get('preco') or d_bolsa.get('cotacao'):
                    dados['preco_atual'] = float(d_bolsa.get('preco') or d_bolsa.get('cotacao') or 0)
                if d_bolsa.get('dividend_yield') or d_bolsa.get('dy'):
                    dados['dividend_yield'] = float(d_bolsa.get('dividend_yield') or d_bolsa.get('dy') or 0)
                if d_bolsa.get('nome'):
                    dados['nome'] = d_bolsa.get('nome')
        except Exception:
            pass

    # 1. Tenta StatusInvest (dados mais completos e precisos da B3: Ações, FIIs, FI-Infras e Fiagros)
    si_urls = []
    if is_fii:
        si_urls.append(f"https://statusinvest.com.br/fundos-imobiliarios/{ticker.lower()}")
        si_urls.append(f"https://statusinvest.com.br/fiinfras/{ticker.lower()}")
        si_urls.append(f"https://statusinvest.com.br/fiagros/{ticker.lower()}")
    else:
        si_urls.append(f"https://statusinvest.com.br/acoes/{ticker.lower()}")
        si_urls.append(f"https://statusinvest.com.br/bdrs/{ticker.lower()}")

    for url_si in si_urls:
        try:
            req_si = urllib.request.Request(url_si, headers=headers)
            with urllib.request.urlopen(req_si, timeout=6) as resp_si:
                raw_html = resp_si.read().decode('utf-8', errors='ignore')
                
                # Ignora páginas 404 / custom error do StatusInvest
                if 'Não encontramos o que você está procurando' in raw_html or 'OPS. . .' in raw_html:
                    continue

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

                # Nome da empresa / fundo (evitando 'RESUMO DO DIA' ou 'Observação')
                m_small = re.findall(r'<small[^>]*>([^<]+)</small>', raw_html)
                if m_small:
                    for s in m_small:
                        s_clean = html.unescape(s).strip()
                        if s_clean and 'resumo do dia' not in s_clean.lower() and 'observação' not in s_clean.lower() and len(s_clean) > 3:
                            dados['nome'] = s_clean
                            break

                if dados['preco_atual'] > 0 and dados['dividend_yield'] > 0:
                    break
        except Exception:
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

            if dados['preco_atual'] <= 0:
                c = get_f('Cotação')
                if c:
                    dados['preco_atual'] = float(c.replace('.', '').replace(',', '.'))

            if dados['dividend_yield'] <= 0:
                d = get_f('Div. Yield')
                if d:
                    dados['dividend_yield'] = float(d.replace('%', '').replace('.', '').replace(',', '.'))

            pvp_val = get_f('P/VP')
            if pvp_val and pvp_val != '-':
                try:
                    dados['pvp'] = float(pvp_val.replace('.', '').replace(',', '.'))
                except:
                    pass

            pl_val = get_f('P/L')
            if pl_val and pl_val != '-':
                try:
                    dados['pl'] = float(pl_val.replace('.', '').replace(',', '.'))
                except:
                    pass

            if not dados['min_52']:
                m52 = get_f('Min 52 sem')
                if m52:
                    dados['min_52'] = float(m52.replace('.', '').replace(',', '.'))

            if not dados['max_52']:
                mx52 = get_f('Max 52 sem')
                if mx52:
                    dados['max_52'] = float(mx52.replace('.', '').replace(',', '.'))

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

    # 5. Fallback de segurança para ativos de infraestrutura ou específicos
    if (dados['preco_atual'] <= 0 or dados['dividend_yield'] <= 0) and ticker in FALLBACK_ATIVOS:
        fb = FALLBACK_ATIVOS[ticker]
        if dados['preco_atual'] <= 0:
            dados['preco_atual'] = fb['preco_atual']
        if dados['dividend_yield'] <= 0:
            dados['dividend_yield'] = fb['dividend_yield']
        if not dados['min_52']:
            dados['min_52'] = fb.get('min_52')
        if not dados['max_52']:
            dados['max_52'] = fb.get('max_52')
        if not dados['pvp']:
            dados['pvp'] = fb.get('pvp')
        if not dados['variacao_12m']:
            dados['variacao_12m'] = fb.get('variacao_12m')
        if not dados['nome'] or dados['nome'] == ticker or 'resumo do dia' in dados['nome'].lower():
            dados['nome'] = fb.get('nome', ticker)

    if 'resumo do dia' in str(dados.get('nome', '')).lower():
        dados['nome'] = FALLBACK_ATIVOS.get(ticker, {}).get('nome', ticker)

    if dados['preco_atual'] > 0:
        return dados
    return None

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def send_json(self, data, status=200):
        payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey')
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
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length) if content_length > 0 else b'{}'
            try:
                body = json.loads(body_bytes.decode('utf-8'))
            except:
                body = {}

            action = body.get('action')
            ticker = (body.get('ticker') or '').upper().strip()
            motivo = body.get('motivo')

            if action in ('quarantine', 'restore') and ticker:
                self.handle_quarantine(action, ticker, motivo)
            else:
                self.handle_api(parsed.query)
        else:
            self.send_error(404, "Not Found")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/atualizar':
            params = urllib.parse.parse_qs(parsed.query)
            ticker = params.get('ticker', [''])[0].upper().strip()
            if not ticker:
                self.send_json({'sucesso': False, 'erro': 'Ticker não informado.'}, status=400)
                return

            headers = {
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json'
            }
            try:
                del_url = f"{SUPABASE_URL}/rest/v1/mp_ativos?ticker=eq.{urllib.parse.quote(ticker)}&tipo=neq.MEMORIA"
                req_del = urllib.request.Request(del_url, headers=headers, method='DELETE')
                with urllib.request.urlopen(req_del, timeout=6):
                    pass
                self.send_json({'sucesso': True, 'removido': ticker})
            except Exception as e:
                self.send_json({'sucesso': False, 'erro': str(e)}, status=500)
        else:
            self.send_error(404, "Not Found")

    def handle_quarantine(self, action, ticker, motivo):
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }
        try:
            get_url = f"{SUPABASE_URL}/rest/v1/mp_ativos?ticker=eq.{urllib.parse.quote(ticker)}&select=*"
            req = urllib.request.Request(get_url, headers=headers)
            with urllib.request.urlopen(req, timeout=6) as resp:
                rows = json.loads(resp.read().decode('utf-8'))

            if not rows:
                self.send_json({'sucesso': False, 'erro': f'Ativo {ticker} não encontrado'}, status=404)
                return

            item_atual = rows[0]
            tipo_base = item_atual.get('tipo', '').replace('QUARENTENA:', '')
            nome_base = (item_atual.get('nome') or ticker).split(' :: ')[0].strip()

            if action == 'quarantine':
                novo_tipo = f"QUARENTENA:{tipo_base}"
                texto_motivo = (motivo or 'Fundamentos ou Dividend Yield abaixo do esperado').strip()
                novo_nome = f"{nome_base} :: {texto_motivo}"
            else:
                novo_tipo = tipo_base
                novo_nome = nome_base

            patch_url = f"{SUPABASE_URL}/rest/v1/mp_ativos?ticker=eq.{urllib.parse.quote(ticker)}"
            patch_data = json.dumps({
                'tipo': novo_tipo,
                'nome': novo_nome,
                'atualizado_em': datetime.datetime.now(datetime.timezone.utc).isoformat()
            }).encode('utf-8')

            req_patch = urllib.request.Request(patch_url, data=patch_data, headers=headers, method='PATCH')
            with urllib.request.urlopen(req_patch, timeout=6):
                pass

            self.send_json({'sucesso': True, 'ticker': ticker, 'tipo': novo_tipo, 'nome': novo_nome})
        except Exception as e:
            self.send_json({'sucesso': False, 'erro': str(e)}, status=500)

    def handle_api(self, query_string):
        params = urllib.parse.parse_qs(query_string)
        ticker_unico = params.get('ticker', [''])[0].upper().strip()
        atualizar_todos = params.get('todos', [''])[0].lower() == 'true'

        mapa_existentes = {}
        headers_sb = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }
        try:
            req_all = urllib.request.Request(
                f"{SUPABASE_URL}/rest/v1/mp_ativos?select=ticker,tipo,nome,preco_atual,dividend_yield&tipo=neq.MEMORIA",
                headers=headers_sb
            )
            with urllib.request.urlopen(req_all, timeout=6) as r:
                for row in json.loads(r.read().decode('utf-8')):
                    mapa_existentes[row['ticker']] = row
        except Exception as e:
            print(f"[local_server] Aviso mapa_existentes: {e}")

        if ticker_unico:
            tickers = [ticker_unico]
        elif atualizar_todos and mapa_existentes:
            tickers = list(mapa_existentes.keys())
        else:
            tickers = ['BBAS3', 'PETR4', 'VALE3', 'HGLG11', 'MXRF11']

        resultados = []
        sb_payload = []
        for t in tickers:
            if t:
                existente = mapa_existentes.get(t)
                em_quarentena = existente and existente.get('tipo', '').startswith('QUARENTENA:')
                cot = buscar_cotacao_precisa(t)
                if not cot and existente and float(existente.get('preco_atual', 0)) > 0:
                    cot = {
                        'ticker': t,
                        'tipo': existente.get('tipo', 'FII' if t.endswith('11') else 'Ação'),
                        'nome': existente.get('nome', t),
                        'preco_atual': float(existente.get('preco_atual', 0)),
                        'dividend_yield': float(existente.get('dividend_yield', 0)),
                        'atualizado_em': datetime.datetime.now(datetime.timezone.utc).isoformat()
                    }

                if cot:
                    resultados.append(cot)
                    tipo_final = existente['tipo'] if em_quarentena else ('FII' if t.endswith('11') else 'Ação')
                    meta_nome = json.dumps({
                        'n': cot['nome'],
                        'min': cot.get('min_52'),
                        'max': cot.get('max_52'),
                        'pvp': cot.get('pvp'),
                        'pl': cot.get('pl'),
                        'var': cot.get('variacao_12m')
                    }, ensure_ascii=False)

                    if em_quarentena and ' :: ' in (existente.get('nome') or ''):
                        motivo_salvo = existente['nome'].split(' :: ')[1]
                        meta_nome = f"{meta_nome} :: {motivo_salvo}"

                    sb_payload.append({
                        'ticker': cot['ticker'],
                        'tipo': tipo_final,
                        'nome': meta_nome,
                        'preco_atual': cot['preco_atual'],
                        'dividend_yield': cot['dividend_yield'],
                        'atualizado_em': cot['atualizado_em']
                    })

        if not resultados and ticker_unico:
            self.send_json({
                'sucesso': False,
                'erro': f'Ativo "{ticker_unico}" não encontrado na B3. Verifique o código digitado.'
            }, status=404)
            return

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

        self.send_json({
            'sucesso': True,
            'atualizados': resultados
        })

if __name__ == '__main__':
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Servidor Ponto2.0 com cotações precisas ativo em http://localhost:{PORT}")
        httpd.serve_forever()
