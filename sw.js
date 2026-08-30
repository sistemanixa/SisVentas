/* SisVentas NIXA - Service Worker v3.0.13
   Estrategia: red primero con cache de respaldo. */
const CACHE = 'sisventas-v3.0.13';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './css/v3-preview.css',
  './js/app.js',
  './js/app.v3.0.13.js',
  './js/core/version.js',
  './js/core/version.v3.0.13.js',
  './js/core/login.js',
  './js/core/access-control.js',
  './js/core/firebase.js',
  './js/modules/item-row-order.js',
  './js/core/data-query.js',
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
  './js/modules/dashboard-polish.js',
  './js/modules/pwa-install.js',
  './js/modules/payroll-duplicate-guard.js',
  './js/modules/payroll-legacy-migration.js',
  './js/modules/payroll.js',
  './js/modules/maintenance.js',
  './js/modules/refactor-health.js',
  './js/modules/resizable-tables.js',
  './js/modules/dolar-historico.js',
  './js/modules/ops-hardening.js',
  './js/modules/v2-readiness.js',
  './js/modules/v2-audit.js',
  './js/modules/page-transition.js',
  './js/modules/resource-monitor.js',
  './js/modules/role-guard.js',
  './js/modules/purchase-orders.js',
  './js/modules/ot-material-custody.js',
  './js/modules/release-tour.js',
  './js/modules/v3-launch.js',
  './js/modules/v3-visual-preview.js',
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
        keys.filter((key) => key !== CACHE && key !== 'sisventas-pdf-transitorios').map((key) => caches.delete(key)),
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

  // Los PDF generados en el cliente se guardan unos minutos en Cache Storage
  // y se sirven por una URL normal del propio origen. Esto evita que Chromium
  // bloquee las descargas iniciadas desde una vista previa blob:.
  if (url.pathname.indexOf('/__sisventas_pdf__/') === 0) {
    event.respondWith(
      caches.match(event.request).then((response) => (
        response || new Response('PDF temporal no disponible', { status: 404 })
      )),
    );
    return;
  }

  // Todo el cÃ³digo y los estilos deben salir de la red sin la cachÃ© HTTP
  // intermedia. AsÃ­ una versiÃ³n nueva no mezcla mÃ³dulos nuevos y antiguos.
  const esArchivoCritico = event.request.mode === 'navigate'
    || /\/(?:index\.html|sw\.js|js\/.*\.js|css\/.*\.css)$/.test(url.pathname);
  const solicitudRed = esArchivoCritico
    ? new Request(event.request, { cache: 'no-store' })
    : event.request;

  event.respondWith(
    fetch(solicitudRed)
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

