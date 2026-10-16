/* SisVentas NIXA - Service Worker v3.9.10
   Estrategia: red primero con cache de respaldo. */
const CACHE = 'sisventas-v3.11.13';
const SHELL = [
 './js/core/permission-index.js?v=3.11.11',
 './js/core/user-directory.js?v=3.11.11',
 './js/core/chat-security.js?v=3.11.11',
 './css/projects.css?v=3.11.10',
 './js/core/projects-model.js?v=3.11.13',
 './js/modules/projects.js?v=3.11.10',
 './js/core/public-catalog-entry.js?v=3.11.8-catalog-entry',
 './css/user-access.css?v=3.11.9',
 './js/core/user-access.js?v=3.11.9',
 './js/core/distribuidora-money.js?v=3.11.1',
 './css/surface-scroll.css?v=3.11.1-gap4',
 './js/modules/roles-help.js?v=3.10.35',
 './css/roles-help.css?v=3.10.35',
 './js/core/domain-read-policy.js?v=3.10.34',
 './js/core/service-auth.js?v=3.10.19',
  './js/modules/catalog-promotions-config.js?v=20261011-edit',
  './js/modules/distribuidora-sales-balance.js?v=3.11.11-directory',
  './js/modules/catalog-order-periods-config.js?v=1',
  './js/modules/public-catalog-requests.js?v=3.11.1-usd',
  './js/modules/public-catalog-share.js?v=3.11.1-usd',
  './js/core/data-readiness.js?v=3.11.7-scope',
  './js/modules/employee-cash-receipt.js?v=1',
  './js/modules/exterior-user-lists.js?v=3.11.11-directory',
  './',
  './index.html',
  './js/modules/paraguay-budget-margin.js?v=perf-3105',
  './css/app.css?v=3.10.33-final',
  './css/v3-preview.css?v=3.8.20-menu2',
  './js/app.js',
  './js/modules/budget-proposals.js?v=perf-31010',
  './js/modules/partial-invoices.js',
  './js/modules/surveys.js?v=3.11.5-keys',
  './css/surveys.css?v=1',
  './js/modules/search-filter-notice.js?v=perf-3105',
  './js/modules/comparacion-comercial.js?v=1',
  './js/modules/commercial-approval.js?v=3.9.29',
  './js/core/guarded-writes.js?v=3.9.24-server-check2',
  './js/core/session-assets.js?v=3.11.11-directory',
  './js/app.v3.11.13.js',
  './js/modules/navigation-back.js?v=perf-3105',
  './js/modules/product-url-import.js?v=3.9.15-dual-shipping',
  './js/modules/keyboard-actions.js',
  './js/modules/sidebar-search.js?v=3.8.20',
  './js/modules/provider-verification.js',
  './js/modules/paraguay-config.js',
  './js/core/version.js',
  './js/core/version.v3.11.13.js',
  './js/core/loading-indicator.js?v=3.9.0-wake1',
  './js/core/login.js',
  './js/core/access-control.js?v=3.10.32',
  './js/core/firebase.js?v=3.11.9-access',
  './js/modules/item-row-order.js?v=perf-3105',
  './js/core/data-query.js',
  './js/modules/notifications.js',
  './js/modules/push-notifications.js',
  './js/modules/offline-core.js',
  './js/modules/commercial-drafts.js?v=3.10.32-recovery',
  './js/modules/chat-access.js?v=3.11.11-directory',
  './js/modules/chat-presence.js?v=3.11.11',
  './js/modules/security-storage.js?v=3.11.11-directory',
  './js/modules/catalog-cart-review.js',
  './js/modules/ai-learning.js?v=perf-31010',
  './js/modules/budget-exterior.js?v=3.7.0',
  './js/modules/product-query-guard.js?v=3.6.19',
  './js/modules/business-break-even.js?v=perf-3105',
  './push-sw.js',
  './js/modules/private-finance-portal.js?v=3.11.12',
  './js/modules/private-finance-ui.js?v=3.11.12',
  './js/core/private-finance-model.js?v=3.11.12',
  './js/core/private-finance-pdf.js?v=3.11.12',
  './css/private-finance.css?v=3.11.12',
  './personal-finance.html',
  './js/core/commercial-ownership.js?v=3.11.13',
  './js/modules/commercial-document-controls.js?v=3.11.13',
  './js/core/error-monitor.js',
  './js/core/relation-compatibility.js',
  './js/modules/treasury.js',
  './js/modules/ot-data-sync.js?v=perf-31010',
  './js/modules/finance-details.js',
  './js/modules/ot-workflow.js',
  './js/modules/dashboard-permissions.js?v=perf-31010',
  './js/modules/sales-metrics.js',
  './js/modules/action-permissions.js?v=3.11.13',
  './js/modules/commissions.js?v=3.10.33-preview',
  './js/modules/image-paste-drop.js',
  './js/modules/quantity-wheel.js?v=2',
  './js/core/metrics-cache.js?v=perf-31010',
  './js/modules/ot-admin.js',
  './js/modules/dashboard-filters.js?v=perf-3105',
  './js/modules/activity-history.js',
  './js/modules/payroll-selector.js',
  './js/modules/configuration-mobile.js?v=3.11.0-keyboard',
  './js/modules/sales-dashboard.js?v=perf-3105',
  './js/modules/dashboard-ot-layout.js',
  './js/modules/executive-charts.js?v=perf-3105',
  './js/modules/dashboard-layout.js',
  './js/modules/dashboard-polish.js',
  './js/modules/pwa-install.js',
  './js/modules/payroll-duplicate-guard.js?v=perf-31010',
  './js/modules/payroll-legacy-migration.js?v=perf-31010',
  './js/modules/payroll.js',
  './js/modules/maintenance.js',
  './js/modules/refactor-health.js',
  './js/modules/resizable-tables.js?v=3.10.33',
  './js/modules/grid-default-order.js',
  './js/modules/dolar-month-chart.js?v=history-cursor-2',
  './js/modules/dolar-historico.js?v=history-pages-select',
  './js/modules/ops-hardening.js',
  './js/modules/v2-readiness.js',
  './js/modules/v2-audit.js',
  './js/modules/page-transition.js',
  './js/modules/resource-monitor.js',
  './js/modules/role-guard.js',
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
        keys.filter((key) => /^sisventas-v\d/.test(key) && key !== CACHE).map((key) => caches.delete(key)),
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
  // Datos/PDF privados nunca se escriben en Cache Storage ni usan fallback.
  if(event.request.headers?.has('Authorization') || url.pathname.startsWith('/privado/finanzas')) return;
  if (url.origin === 'https://www.gstatic.com' && url.pathname.indexOf('/firebasejs/') >= 0) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        // El SDK usa una versión exacta en la ruta: nunca cambia su contenido.
        const cached = await cache.match(event.request);
        if (cached) return cached;
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
        if(response.ok && !/no-store|private/i.test(response.headers.get('cache-control')||'')) caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const guardado = await caches.match(event.request, { ignoreSearch: true });
        if (guardado) return guardado;
        // El HTML solo recupera páginas: devolverlo como JavaScript rompe el arranque.
        if (event.request.mode === 'navigate') {
          const pagina = await caches.match('./index.html');
          if (pagina) return pagina;
        }
        return Response.error();
      }),
  );
});
