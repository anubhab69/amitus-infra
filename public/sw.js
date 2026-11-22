// Amitus Infra Service Worker - Transparent Passthrough & Offline Support
const CACHE_NAME = 'amitus-infra-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Network first, fall back to cache only if network fails
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response && response.status === 200 && event.request.method === 'GET') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});
