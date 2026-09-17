/* ================= Anadi Godham — Service Worker ================= */
/* Bump this version string whenever customerapp.html (or any cached
   asset) changes, so old visitors' caches get replaced instead of
   silently serving stale content. */
const CACHE_VERSION = 'anadi-godham-v1';
const CORE_CACHE = `${CACHE_VERSION}-core`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

/* The app shell — everything needed to boot the UI offline.
   Firebase/live data still needs a real connection; only the shell
   (markup/manifest/icon) is guaranteed to work offline. */
const CORE_ASSETS = [
  './customerapp.html',
  './manifest.json',
  'https://anadi.co.in/wp-content/uploads/2024/10/WhatsApp_Image_2024-10-06_at_3.59.51_AM-removebg-preview.png'
];

/* ---------------- install: pre-cache the app shell ---------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ---------------- activate: drop old-version caches ---------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('anadi-godham-') && key !== CORE_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---------------- fetch strategy ----------------
   - Navigations (opening/reloading the app) and same-origin core
     assets: network-first, falling back to the cached shell so the
     app still opens when offline.
   - Everything else (fonts, maplibre, firebase, map tiles, images):
     stale-while-revalidate — serve from cache instantly if present
     while quietly refreshing it in the background, otherwise go to
     the network and cache the response for next time.
   Firebase's own realtime-database socket (websocket/long-poll) is
   left completely untouched — this only affects normal fetch() /
   resource requests. */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // App navigations -> network-first with offline fallback to the shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CORE_CACHE).then((cache) => cache.put('./customerapp.html', copy));
          return response;
        })
        .catch(() => caches.match('./customerapp.html'))
    );
    return;
  }

  // Core same-origin assets -> network-first, cache fallback.
  if (url.origin === self.location.origin && CORE_ASSETS.some((a) => request.url.endsWith(a.replace('./', '')))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CORE_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Everything else (fonts, CDN scripts, map tiles, logo, etc.)
  // -> stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/* ---------------- push notifications passthrough ----------------
   OneSignal registers its own service worker for push; this worker
   only handles caching, so nothing extra is needed here. */
