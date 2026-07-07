/* SisVentas · NIXA — Service Worker v1.33.2
   Estrategia: red primero con caché de respaldo. */
const CACHE = 'sisventas-v1.33.2';
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
  './js/core/error-monitor.js',
  './js/core/relation-compatibility.js',
  './js/modules/treasury.js',
  './js/modules/ot-data-sync.js',
  './js/modules/finance-details.js',
  './js/modules/ot-workflow.js',
  './js/modules/dashboard-permissions.js',
  './js/modules/sales-metrics.js',
  './js/modules/action-permissions.js',
  './js/core/metrics-cache.js',
  './js/modules/ot-admin.js',
  './js/modules/dashboard-filters.js',
  './js/modules/activity-history.js',
  './js/modules/payroll-selector.js',
  './js/modules/configuration-mobile.js',
  './js/modules/sales-dashboard.js',
  './js/modules/dashboard-ot-layout.js',
  './js/modules/executive-charts.js',
  './js/modules/dashboard-layout.js',
  './js/modules/print-layout.js',
  './js/modules/pwa-install.js',
  './js/modules/payroll-duplicate-guard.js',
  './js/modules/payroll-legacy-migration.js',
  './js/modules/payroll.js',
  './js/modules/maintenance.js',
  './js/modules/role-guard.js',
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
