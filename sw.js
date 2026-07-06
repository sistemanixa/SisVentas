/* SisVentas · NIXA — Service Worker v20.358
   Estrategia: red primero con caché de respaldo.
   Las versiones nuevas publicadas en el repo entran apenas hay conexión;
   sin internet, la app abre desde la última copia cacheada. */
const CACHE = 'sisventas-v20.358';
const SHELL = ['./', './index.html', './manifest.webmanifest', './nixa-icon-192.png', './nixa-icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* El botón de actualización de SisVentas envía este mensaje al SW en espera. */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Firebase/gstatic/CDNs pasan directo
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
