// La Aventura — Service Worker
// Cache-first strategy for app shell, network-first for API calls
const CACHE_NAME = 'la-aventura-v1';
const APP_SHELL = [
  './',
  './index.html',
  './planner.html',
  './style.css',
  './app.js',
  './planner.js',
  './tripdata.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Network-first for live APIs (weather, currency)
  if (url.hostname.includes('open-meteo.com') || url.hostname.includes('er-api.com')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else (app shell, CDN libs, tiles)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache successful GETs from same-origin or known CDNs
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => {
            try { cache.put(e.request, clone); } catch {}
          });
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
