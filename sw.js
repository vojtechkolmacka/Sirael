const CACHE_NAME = 'sirael-v7-stable';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './src/app.js',
  './src/storage/db.js',
  './src/settings/settingsService.js',
  './src/library/responseLibraryService.js',
  './src/memory/memoryService.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
