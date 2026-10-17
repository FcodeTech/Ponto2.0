// sw.js - Service Worker para PWA do Ponto Eletrônico
const CACHE_NAME = 'ponto-pwa-v1.0.0';

const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'login.html',
  'registrar_ponto.html',
  'relatorios.html',
  'funcionarios.html',
  'admin.html',
  'configuracoes.html',
  'perfil.html',
  'reset-senha.html',
  'manifest.json',
  'css/styles.css',
  'js/app.js',
  'js/auth.js',
  'js/db.js',
  'js/pwa.js',
  'js/supabase.js',
  'favicon.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usa addAll com catch individual para não falhar a instalação se um arquivo opcional falhar
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Aviso ao pré-carregar item:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Removendo cache obsoleto:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições (Fetch)
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Apenas métodos GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Não intercepta chamadas para API Supabase (deixar direto na rede)
  if (url.origin.includes('supabase.co')) {
    return;
  }

  // Estratégia: Network First com fallback para Cache
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Se a resposta for válida e da mesma origem, armazena em cache
        if (networkResponse && networkResponse.status === 200 && url.origin === location.origin) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Se a rede falhar (offline), busca no cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Se for navegação de página e estiver offline, retorna index.html em cache se disponível
        if (request.mode === 'navigate') {
          return caches.match('index.html');
        }

        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});
