/* SisVentas NIXA - Service Worker v3.4.0
   Estrategia: red primero con cache de respaldo. */
const CACHE = 'sisventas-v3.4.0';
const PUSH_PREVIEW = new URL(self.location.href).searchParams.get('push_preview') === '1';
let messaging = null;

if (PUSH_PREVIEW) {
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey: 'AIzaSyCw8Q4-fUA69iWFkDuy8qEkEcOGHOjFsto',
    authDomain: 'nixa-sisventas.firebaseapp.com',
    databaseURL: 'https://nixa-sisventas-default-rtdb.firebaseio.com',
    projectId: 'nixa-sisventas',
    storageBucket: 'nixa-sisventas.firebasestorage.app',
    messagingSenderId: '171899432710',
    appId: '1:171899432710:web:47d7d4da42c07166983887',
  });
  messaging = firebase.messaging();
}
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './css/v3-preview.css',
  './js/app.js',
  './js/app.v3.4.0.js',
  './js/modules/product-url-import.js',
  './js/modules/keyboard-actions.js',
  './js/modules/provider-verification.js',
  './js/modules/paraguay-config.js',
  './js/core/version.js',
  './js/core/version.v3.4.0.js',
  './js/core/login.js',
  './js/core/access-control.js',
  './js/core/firebase.js',
  './js/modules/item-row-order.js',
  './js/core/data-query.js',
  './js/modules/notifications.js',
  './js/modules/push-notifications.js',
  './js/modules/offline-core.js',
  './js/modules/business-break-even.js',
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
  './js/modules/grid-default-order.js',
  './js/modules/dolar-historico.js',
  './js/modules/ops-hardening.js',
  './js/modules/v2-readiness.js',
  './js/modules/v2-audit.js',
  './js/modules/page-transition.js',
  './js/modules/resource-monitor.js',
  './js/modules/role-guard.js',
  './js/modules/purchase-orders.js?v=3.3.12-proveedor-final-1',
  './js/modules/ot-material-custody.js',
  './js/modules/release-tour.js',
  './js/modules/v3-launch.js',
  './js/modules/v3-visual-preview.js',
  './manifest.webmanifest',
  './nixa-icon-192.png',
  './nixa-icon-512.png',
];

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const data = payload.data || {};
    self.registration.showNotification(notification.title || data.title || 'SisVentas', {
      body: notification.body || data.body || 'Tenés una nueva notificación.',
      icon: './nixa-icon-192.png',
      badge: './nixa-icon-192.png',
      tag: data.notificationId || data.type || 'sisventas-push',
      renotify: true,
      data,
    });
  });
}

if (PUSH_PREVIEW) {
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const data = event.notification.data || {};
    event.waitUntil((async () => {
      const target = new URL('./index.html', self.location.origin);
      if (data.type) target.searchParams.set('pushType', data.type);
      if (data.notificationId) target.searchParams.set('pushId', data.notificationId);
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: 'SISVENTAS_PUSH_OPEN', data });
        return existing;
      }
      return self.clients.openWindow(target.href);
    })());
  });
}

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
  if (url.origin === 'https://www.gstatic.com' && url.pathname.indexOf('/firebasejs/') >= 0) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const response = await fetch(new Request(event.request, { cache: 'no-store' }));
          if (response.ok) await cache.put(event.request, response.clone());
          return response;
        } catch (_error) {
          return (await cache.match(event.request)) || Response.error();
        }
      }),
    );
    return;
  }
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

