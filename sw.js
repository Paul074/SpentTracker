// Kite Finance — Service Worker v7
// Strategy: NETWORK-FIRST for index.html (always get fresh when online)
//           Cache-first for static assets (manifest, icons)

const CACHE_NAME = 'kite-finance-v7';
const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── Install: cache only static assets, not HTML ───────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ───────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: NETWORK-FIRST for HTML, cache-first for assets ─
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if(e.request.method !== 'GET') return;
  if(url.origin !== self.location.origin) return;

  // HTML / navigation — always try network first so users get latest updates
  const isHTML =
    e.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/');

  if(isHTML) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if(res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./')))
    );
    return;
  }

  // Static assets — cache-first, refresh in background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if(res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('message', e => {
  if(e.data === 'SKIP_WAITING') self.skipWaiting();
});
