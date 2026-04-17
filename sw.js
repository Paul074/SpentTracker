// Kite Tracker — Service Worker
// Strategy: Cache-first for app shell, network-first for external resources
// Version bump this string to force cache refresh on deploy
const CACHE_NAME = 'kite-tracker-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.json'
];

// ── Install: cache app shell ──────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ───────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k  => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for shell, network-first for rest ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and cross-origin Firebase/CDN requests (let them go to network)
  if(e.request.method !== 'GET') return;
  if(url.hostname.includes('firebase') ||
     url.hostname.includes('gstatic')  ||
     url.hostname.includes('google'))  return;

  // App shell — cache first, fallback to network
  if(SHELL.some(s => e.request.url.endsWith(s.replace('./', ''))) ||
     url.pathname === '/' ||
     url.pathname.endsWith('index.html')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if(cached) return cached;
        return fetch(e.request).then(res => {
          if(res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Everything else — network first, fallback to cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if(res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
