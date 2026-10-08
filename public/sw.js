// OfficeTalk Service Worker v40 - High-Performance PWA Caching
const CACHE_NAME = 'officetalk-v40';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css?v=40',
  '/app.js?v=40',
  '/audio-fx.js?v=40',
  '/manifest.json'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.warn('Cache addAll warning:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  const url = new URL(evt.request.url);
  // Do not intercept or cache dynamic backend APIs or WebSocket handshakes
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return;
  }

  // Navigation requests: Network first with Cache fallback
  if (evt.request.mode === 'navigate') {
    evt.respondWith(
      fetch(evt.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static Assets (CSS, JS, Images, Audio, Fonts): Cache first, fallback to network
  if (evt.request.method === 'GET') {
    evt.respondWith(
      caches.match(evt.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(evt.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(evt.request, responseToCache));
          }
          return networkResponse;
        });
      })
    );
  }
});
