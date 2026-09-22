// OfficeTalk Service Worker v30 - PWA Offline Shell & Caching
const CACHE_NAME = 'officetalk-v30';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css?v=30',
  '/app.js?v=30',
  '/audio-fx.js?v=30',
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
  if (evt.request.mode === 'navigate') {
    evt.respondWith(
      fetch(evt.request).catch(() => caches.match('/index.html'))
    );
  }
});
