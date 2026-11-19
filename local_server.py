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

    # 1. Tenta StatusInvest (dados mais completos e precisos da B3: Preço + DY)
    try:
        url_si = f"https://statusinvest.com.br/fundos-imobiliarios/{ticker.lower()}" if is_fii else f"https://statusinvest.com.br/acoes/{ticker.lower()}"
        req_si = urllib.request.Request(url_si, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req_si, timeout=5) as resp_si:
            raw_html = resp_si.read().decode('utf-8', errors='ignore')
            vals = re.findall(r'<strong class="value">([\d,\.]+)', raw_html)
            if vals:
                price = float(vals[0].replace('.', '').replace(',', '.'))
                # Extrai DY
                dy = 0.0
                m_dy = re.search(r'title="Dividend Yield[^"]*"[\s\S]*?<strong class="value">([\d,\.]+)', raw_html)
                if m_dy:
                    dy = float(m_dy.group(1).replace('.', '').replace(',', '.'))
                elif len(vals) > 3:
                    try:
                        dy = float(vals[3].replace('.', '').replace(',', '.'))
                    except:
                        pass

                # Extrai nome
                m_small = re.findall(r'<small[^>]*>([^<]+)</small>', raw_html)
                nome = html.unescape(m_small[0]).strip() if m_small else f"{ticker} B3"

                if price > 0:
                    return {
                        'ticker': ticker,
                        'tipo': tipo,
                        'nome': nome,
                        'preco_atual': price,
                        'dividend_yield': dy,
                        'atualizado_em': datetime.datetime.now(datetime.timezone.utc).isoformat()
                    }
    except Exception as e:
        print(f"[local_server] StatusInvest falhou para {ticker}: {e}")

    # 2. Tenta Google Finance
    try:
        gf_url = f'https://www.google.com/finance/quote/{ticker}:BVMF'
        req_gf = urllib.request.Request(gf_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req_gf, timeout=5) as resp_gf:
            raw_gf = resp_gf.read().decode('utf-8', errors='ignore')
            m_preco = re.search(r'class="[^"]*YMlKec[^"]*fxKbKc[^"]*">R\$([0-9\.,]+)<', raw_gf) or re.search(r'R\$([0-9]+(?:\.[0-9]+)?)', raw_gf)
            if m_preco:
                price = float(m_preco.group(1).replace(',', '.'))
                m_nome = re.search(r'class="zzDege">([^<]+)<', raw_gf)
                nome = m_nome.group(1).strip() if m_nome else f"{ticker} (B3)"
                return {
                    'ticker': ticker,
                    'tipo': tipo,
                    'nome': nome,
                    'preco_atual': price,
                    'dividend_yield': 0.0,
                    'atualizado_em': datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
    except Exception as e:
        print(f"[local_server] Google Finance falhou para {ticker}: {e}")

    # 3. Tenta brapi.dev
    try:
        url_brapi = f'https://brapi.dev/api/quote/{ticker}'
        req_brapi = urllib.request.Request(url_brapi, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req_brapi, timeout=5) as resp_b:
            data = json.loads(resp_b.read().decode())
            item = data.get('results', [{}])[0]
            if item.get('regularMarketPrice'):
                return {
                    'ticker': ticker,
                    'tipo': tipo,
                    'nome': item.get('longName') or item.get('shortName') or ticker,
                    'preco_atual': float(item.get('regularMarketPrice') or 0),
                    'dividend_yield': float(item.get('dividendYield') or 0),
                    'atualizado_em': datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
    except Exception as e:
        print(f"[local_server] brapi falhou para {ticker}: {e}")

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
        for t in tickers:
            if t:
                cot = buscar_cotacao_precisa(t)
                if cot:
                    resultados.append(cot)

        if not resultados and ticker_unico:
            payload = json.dumps({
                'sucesso': False,
                'erro': f'Ativo "{ticker_unico}" não encontrado na B3. Verifique o código.'
            }).encode('utf-8')
            self.send_response(404)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(payload)
            return

        # Sincroniza com Supabase mp_ativos
        if resultados:
            try:
                sb_url = f"{SUPABASE_URL}/rest/v1/mp_ativos"
                req_sb = urllib.request.Request(
                    sb_url,
                    data=json.dumps(resultados).encode('utf-8'),
                    headers={
                        'apikey': SUPABASE_KEY,
                        'Authorization': f'Bearer {SUPABASE_KEY}',
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    method='POST'
                )
                with urllib.request.urlopen(req_sb, timeout=5) as r:
                    print(f"[local_server] Supabase mp_ativos sincronizado: {r.status}")
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
