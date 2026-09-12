/* AgriSmart PWA service worker
 * - App shell: cache-first for same-origin static assets (JS/CSS/fonts/images)
 * - Navigation: network-first, fallback to cached index.html (offline shell)
 * - API GET requests: network-first, fallback to last cached response (last-synced data)
 */
const VERSION = 'agrismart-v3';
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;
const OFFLINE_URLS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(OFFLINE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

const isApiGet = (req, url) => req.method === 'GET' && url.pathname.startsWith('/api/');
const isStatic = (url) => /\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|ico|webp)$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;

  if (isApiGet(request, url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(DATA_CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            const headers = new Headers(cached.headers);
            headers.set('X-Offline-Cache', 'true');
            return new Response(await cached.blob(), { status: cached.status, headers });
          }
          return new Response(JSON.stringify({ detail: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
        })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))));
    return;
  }

  if (url.origin === self.location.origin && isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) caches.open(SHELL_CACHE).then((c) => c.put(request, res.clone()));
            return res;
          })
      )
    );
  }
});
