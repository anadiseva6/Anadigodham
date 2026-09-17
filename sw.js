/* Anadi Godham — minimal service worker.
   Only having ./manifest.json is not enough for Chrome/Android to show the
   real "Install" prompt — a service worker must also be registered and
   active. This one just caches the app shell so the page can reopen if the
   network briefly drops; it does not try to cache every asset. */

const CACHE_NAME = 'anadi-godham-shell-v2';
const SHELL_URL = '/index.html';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(SHELL_URL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(SHELL_URL))
    );
  }
});
