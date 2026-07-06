/* SisVentas · NIXA — Service Worker v1.8.0
   Estrategia: red primero con caché de respaldo. */
const CACHE = 'sisventas-v1.8.0';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/core/version.js',
  './js/core/login.js',
  './js/core/access-control.js',
  './js/core/firebase.js',
  './js/modules/notifications.js',
  './js/legacy/patch-01.js',
  './js/legacy/patch-02.js',
  './js/modules/treasury.js',
  './js/legacy/patch-04.js',
  './js/legacy/patch-05.js',
  './js/legacy/patch-06.js',
  './js/legacy/patch-07.js',
  './js/legacy/patch-08.js',
  './js/legacy/patch-09.js',
  './js/legacy/patch-10.js',
  './js/legacy/patch-11.js',
  './js/legacy/patch-12.js',
  './js/legacy/patch-13.js',
  './js/legacy/patch-14.js',
  './js/legacy/patch-15.js',
  './js/legacy/patch-16.js',
  './js/legacy/patch-17.js',
  './js/legacy/patch-18.js',
  './js/legacy/patch-19.js',
  './js/legacy/patch-20.js',
  './js/legacy/patch-21.js',
  './js/legacy/patch-22.js',
  './js/legacy/patch-23.js',
  './js/legacy/patch-24.js',
  './js/legacy/patch-25.js',
  './js/legacy/patch-26.js',
  './js/legacy/patch-27.js',
  './manifest.webmanifest',
  './nixa-icon-192.png',
  './nixa-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => (
        (await caches.match(event.request, { ignoreSearch: true })) || caches.match('./index.html')
      )),
  );
});
