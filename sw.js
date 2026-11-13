/* SisVentas NIXA - Service Worker v3.9.10
   Estrategia: red primero con cache de respaldo. */
const CACHE = 'sisventas-v3.20.6';
const SHELL = [
  './css/office-stock.css?v=3.20.4',
  './js/core/office-stock-adjustment.js?v=3.19.19',
  './js/modules/office-stock.js?v=3.20.4',
  './js/modules/office-stock-adapter.js?v=3.20.4',
  './js/modules/office-stock-host.js?v=3.19.19',
  './js/core/budget-presentation-model.v1.js?v=3.20.6',
  './js/modules/project-presentation-trial.js?v=3.20.6',
  './css/project-presentation-trial.css?v=3.20.6',
  './js/core/dashboard-activity-instant.v1.js?v=3.19.3',
  './js/core/dashboard-activity-model.v2.js?v=3.19.3',
  './js/core/dashboard-budget-notice-legacy-proposal.js?v=3.19.3',
  './js/core/dashboard-budget-notice-model-proposal.js?v=3.19.3',
  './js/core/dashboard-budget-transport-plan-proposal.js?v=3.19.3',
  './js/core/dashboard-host-context-proposal.js?v=3.19.3',
  './js/core/dashboard-budget-fresh-rtdb-proposal.js?v=3.19.3',
  './js/core/dashboard-budget-sdk-proposal.js?v=3.19.3',
  './js/core/dashboard-activity-aggregate-proposal.js?v=3.19.3',
  './js/core/dashboard-budget-month-port-proposal.js?v=3.19.3',
  './js/core/dashboard-http-ports-proposal.js?v=3.19.3',
  './js/core/dashboard-budget-source-proposal.js?v=3.19.3',
  './js/core/dashboard-budget-notice-adapter-proposal.js?v=3.19.3',
  './js/core/dashboard-budget-notice-consumer-proposal.js?v=3.19.3',
  './js/core/dashboard-budget-notice-detail-proposal.js?v=3.19.3',
  './js/modules/dashboard-budget-host.v1.js?v=3.19.3',
  './js/modules/dashboard-activity-host.v1.js?v=3.19.3',
  './js/core/purchase-order-links.v1.js?v=3.18.4',
  './js/core/ot-sale-origin.v1.js?v=3.18.13',
  './js/core/commercial-report-read.v1.js?v=3.19.0',
  './js/modules/commercial-report-host.v1.js?v=3.19.0',
  './js/core/chat-text.v1.js?v=3.18.4',
  './js/core/expense-filter-labels.v1.js?v=3.18.4',
  './js/core/sales-search-model.v1.js?v=3.18.4',
  './js/core/collection-search-model.v1.js?v=3.18.13',
  './js/modules/collections-indexed-host.v1.js?v=3.19.6',
  './js/core/client-account-mode.v1.js?v=3.18.20',
  './js/core/client-account-reader.v1.js?v=3.18.14',
  './js/modules/client-account-host.v1.js?v=3.19.0',
  './js/modules/client-account-legacy-reconcile.v1.js?v=3.19.11',
  './js/core/commercial-pages-reader.v1.js?v=3.19.6',
  './js/core/payment-actor-names.v1.js?v=3.18.4',
  './js/modules/payment-actor-labels.v1.js?v=3.18.4',
  './js/modules/sales-indexed-host.v1.js?v=3.19.18',
  './js/modules/ot-lifecycle.js?v=3.19.3',
  './js/modules/ot-delivery-selection.v1.js?v=3.19.3',
  './js/modules/ot-acta-correction.js?v=3.17.13',
  './js/core/commercial-money.v1.js?v=3.17.7',
  './js/core/stock-purchase-costs.v1.js?v=3.17.7',
  './js/core/chat-search.js?v=3.17.7',
  './js/core/purchase-receipt-costs.v1.js?v=3.17.7',
  './js/core/record-list-model.js?v=3.17.7',
  './js/core/record-lists.js?v=3.17.7',
  './js/core/operational-read-model.js?v=3.17.7',
  './js/core/operational-writes.js?v=3.19.3',
  './js/core/chat-header-model.js?v=3.17.7',
  './js/core/chat-read-model.js?v=3.17.7',
  './js/core/chat-history.js?v=3.17.7',
  './js/core/sale-cost-correction.v1.js?v=3.16.11',
  './js/modules/sale-cost-editor.v1.js?v=3.17.7',
  './js/core/sale-costs.v1.js?v=3.18.4',
  './js/core/budget-conversion-costs.v1.js?v=3.16.11',
  './js/core/sale-writer.v1.js?v=3.16.18',
  './js/core/expense-state.v1.js?v=3.20.4',
  './js/core/salary-coverage-model.v1.js?v=3.20.4',
  './js/core/salary-coverage-read.v1.js?v=3.19.0',
  './js/modules/salary-coverage.v1.js?v=3.20.4',
  './js/modules/document-pdf-preview.v1.mjs',
  './js/core/inventory-count-model.v1.js?v=3.16.11',
  './js/modules/inventory-count.js?v=3.16.11',
  './css/chat-directs.v1.css?v=3.15.13',
  './css/ot-search.v1.css?v=3.15.13',
  './js/core/dashboard-startup-demand.v1.js?v=3.15.1',
  './js/core/print-layout.v1.js',
  './js/modules/purchase-order-search.v1.js',
  './js/core/purchase-order-export.v1.js?v=3.17.7',
  './js/core/dashboard-personal-hours.v1.js',
  './js/core/commission-presentation.v1.js?v=3.14.20',
  './js/core/dashboard-personal-notices.v1.js?v=3.14.20',
  './js/modules/dashboard-personal-notices.js?v=3.14.20',
  './css/dashboard-personal-notices.css?v=3.14.11',
  './css/payroll.css?v=3.14.7',
  './js/modules/bonus-concepts.js?v=3.14.6',
  './js/modules/bonus-grant.js?v=3.14.6',
  './js/core/bonus-quantity-model.js?v=3.14.6',
  './css/bonus-grant.css?v=3.14.6',
  './css/budget-presentation.css?v=3.13.19',
  './js/core/budget-presentation-model.js?v=3.13.19',
  './js/modules/budget-presentation-view.js?v=3.13.19',
  './js/modules/budget-presentation.js?v=3.13.19',
  './css/dashboard-privacy.css?v=3.14.5',
  './js/modules/dashboard-privacy.js?v=3.14.5',
  './js/core/foreground-session.js?v=3.13.2',
  './js/core/session-recovery.js?v=3.12.8-local-server',
  './js/core/permission-index.js?v=3.11.11',
  './js/core/user-directory.js?v=3.13.2-single-flight',
  './js/core/chat-security.js?v=3.11.11',
  './css/projects.css?v=3.18.4',
  './css/product-code-search.css?v=3.12.16',
  './js/modules/product-code-search.js?v=3.12.3',
  './js/modules/catalog-product-picker.js?v=3.12.3',
  './css/catalog-product-picker.css?v=3.12.3',
  './js/core/projects-model.js?v=3.18.4',
  './js/modules/projects.js?v=3.18.4',
  './js/core/public-catalog-entry.js?v=3.11.8-catalog-entry',
  './css/user-access.css?v=3.11.9',
  './js/core/user-access.js?v=3.12.3',
  './js/core/distribuidora-money.js?v=3.11.1',
  './css/surface-scroll.css?v=3.12.12-menu',
  './css/responsive-forms.css?v=3.12.11',
  './css/cuenta-corriente.css?v=3.12.13',
  './js/modules/roles-help.js?v=3.10.35',
  './css/roles-help.css?v=3.10.35',
  './js/core/domain-read-policy.js?v=3.10.34',
  './js/core/service-auth.js?v=3.12.20',
  './js/modules/catalog-promotions-config.js?v=3.13.3-context',
  './js/modules/distribuidora-sales-balance.js?v=3.13.19-insurance',
  './js/modules/serial-camera-scanner.js?v=3.12.10-encuadre',
  './js/vendor/zxing/zxing-browser-0.1.5.min.js',
  './js/modules/distributor-documents.js?v=3.14.16-print',
  './js/modules/catalog-order-periods-config.js?v=1',
  './js/modules/public-catalog-requests.js?v=3.11.1-usd',
  './js/modules/public-catalog-share.js?v=3.11.1-usd',
  './js/core/data-readiness.js?v=3.19.18',
  './js/modules/employee-cash-receipt.js?v=3.19.15',
  './js/modules/exterior-user-lists.js?v=3.11.11-directory',
  './',
  './index.html',
  './js/modules/paraguay-budget-margin.js?v=3.12.20',
  './css/app.css?v=3.18.4',
  './css/loading-status.css?v=3.19.0',
  './css/v3-preview.css?v=3.8.20-menu2',
  './js/app.js',
  './js/modules/budget-proposals.js?v=perf-31010',
  './js/modules/partial-invoices.js?v=1',
  './js/core/survey-summaries.v1.js?v=3.17.7',
  './js/modules/surveys.js?v=3.17.7',
  './css/surveys.css?v=3.17.7',
  './js/modules/search-filter-notice.js?v=3.18.4',
  './js/modules/comparacion-comercial.js?v=1',
  './js/modules/commercial-approval.js?v=3.9.29',
  './js/core/provider-writes.js?v=3.17.7',
  './js/core/guarded-writes.js?v=3.18.4',
  './js/core/session-assets.js?v=3.20.4',
  './js/core/ot-personal-scope.js?v=3.14.0',
  './js/app.v3.20.6.js',
  './js/core/activity-period.v1.js',
  './js/core/dashboard-account-source.v1.js?v=3.14.19',
  './js/modules/navigation-back.js?v=3.10.20-home',
  './js/modules/product-url-import.js?v=3.10.29-shipping-usd',
  './js/modules/keyboard-actions.js?v=3.14.3-sale-keyboard',
  './js/modules/sidebar-search.js?v=3.8.20',
  './js/modules/provider-verification.js?v=3.9.3',
  './js/modules/paraguay-config.js?v=3.17.7',
  './js/core/version.js',
  './js/core/version.v3.20.6.js',
  './js/core/loading-indicator.js?v=3.9.0-wake1',
  './js/core/login.js?v=2.0.154',
  './js/core/access-control.js?v=3.10.32',
  './js/core/labor-write-recovery.js?v=3.19.19',
  './js/core/labor-writes.js?v=3.19.3',
  './js/core/bonus-payment-model.v1.js?v=3.18.4',
  './js/core/bonus-payment.v1.js?v=3.18.4',
  './js/core/financial-commands.js?v=3.20.1',
  './js/core/firebase.js?v=3.17.12',
  './js/modules/item-row-order.js?v=perf-3105',
  './js/core/data-query.js?v=3.14.18',
  './js/modules/notifications.js?v=3.12.20',
  './js/modules/push-notifications.js?v=1.0.0',
  './js/modules/offline-core.js?v=3.12.20',
  './js/modules/commercial-drafts.js?v=3.19.0',
  './js/modules/chat-access.js?v=3.17.7',
  './js/modules/chat-presence.v2.js?v=3.16.11',
  './js/modules/chat-direct-contacts.v1.js?v=3.16.11',
  './js/modules/security-storage.js?v=3.13.2-foreground',
  './js/modules/catalog-cart-review.js?v=1',
  './js/modules/ai-learning.js?v=3.10.19-auth',
  './js/modules/budget-exterior.js?v=3.8.1',
  './js/modules/product-query-guard.js?v=3.6.17',
  './js/modules/business-break-even.js?v=3.18.4',
  './push-sw.js',
  './js/modules/private-finance-portal.js?v=3.14.3-cycle',
  './js/modules/private-finance-ui.js?v=3.14.4-plan-axis',
  './js/core/private-finance-model.js?v=3.14.3-cycle',
  './js/core/private-finance-pdf.js?v=3.14.3-cycle',
  './js/core/private-finance-import-queue.js?v=3.12.6',
  './css/private-finance.css?v=3.14.3-cycle',
  './personal-finance.html?v=3.14.3-cycle',
  './js/core/product-ranking.js?v=3.12.17',
  './css/product-ranking.css?v=3.12.17',
  './js/modules/product-ranking-dialog.js?v=3.12.17',
  './js/core/connection-monitor.js?v=3.17.0',
  './js/core/commercial-ownership.js?v=3.19.6',
  './js/core/postventa-demand-proposal.js?v=3.19.18',
  './js/modules/commercial-document-controls.js?v=3.12.15',
  './js/core/commission-generation.js?v=3.16.11',
  './js/core/error-monitor.js?v=3.12.0-text',
  './js/core/relation-compatibility.js?v=2.0.154',
  './js/modules/treasury.js?v=3.14.20',
  './js/modules/ot-data-sync.js?v=3.13.3-context',
  './js/modules/finance-details.js?v=3.14.20',
  './js/modules/ot-workflow.js?v=3.19.18',
  './js/modules/dashboard-permissions.js?v=perf-31010',
  './js/modules/sales-metrics.js?v=2.0.289',
  './js/modules/action-permissions.js?v=3.16.18',
  './js/modules/commissions.js?v=3.19.18',
  './js/modules/image-paste-drop.js?v=2',
  './js/modules/quantity-wheel.js?v=2',
  './js/core/metrics-cache.js?v=perf-31010',
  './js/modules/ot-admin.js?v=3.3.17',
  './js/modules/dashboard-filters.js?v=3.17.12',
  './js/modules/activity-history.js?v=3.3.17',
  './js/core/payroll-source-snapshot.js?v=3.14.7',
  './js/core/payroll-legacy-sac-model.js?v=3.14.7',
  './js/modules/payroll-selector.js?v=3.14.7',
  './js/modules/configuration-mobile.js?v=3.11.0-keyboard-v3.14.19',
  './js/modules/sales-dashboard.js?v=3.17.12',
  './js/modules/dashboard-ot-layout.js?v=2.0.154',
  './js/modules/executive-charts.js?v=3.18.4',
  './js/modules/dashboard-layout.js?v=2.0.154',
  './js/modules/dashboard-polish.js?v=3.3.17',
  './js/modules/pwa-install.js?v=3.12.19-acciones',
  './js/modules/payroll-duplicate-guard.js?v=perf-31010',
  './js/modules/payroll-legacy-migration.js?v=history-20261022',
  './js/modules/payroll.js?v=3.17.17',
  './js/modules/payroll-legacy-sac.js?v=3.14.7',
  './js/modules/payroll-pending-review.js?v=3.14.7',
  './js/modules/maintenance.js?v=3.14.7',
  './js/modules/refactor-health.js?v=3.18.4',
  './js/modules/resizable-tables.js?v=3.18.13',
  './js/modules/grid-default-order.js?v=rendimiento-1',
  './js/core/dollar-history-scope.v1.js?v=3.14.18',
  './js/modules/dolar-month-chart.js?v=3.14.18-period',
  './js/modules/dolar-historico.js?v=3.14.18-period',
  './js/core/dollar-refresh.v1.js?v=3.16.16',
  './js/modules/ops-hardening.js?v=2.3.2-maintenance-guided-1',
  './js/modules/v2-readiness.js?v=2.0.154',
  './js/modules/v2-audit.js?v=2.0.399-audit1',
  './js/modules/page-transition.js?v=2.0.226',
  './js/modules/resource-monitor.js?v=3.3.17',
  './js/modules/role-guard.js?v=3.3.17',
  './js/modules/ot-material-rows.v1.js',
  './js/modules/ot-stock-consumption.v1.js?v=3.19.3',
  './js/modules/ot-office-count.js?v=3.16.17',
  './js/modules/ot-material-custody.js?v=3.20.5',
  './js/modules/release-tour.js?v=2.0.161',
  './js/modules/v3-launch.js',
  './js/modules/v3-visual-preview.js?v=3.0.6',
  './manifest.webmanifest',
  './nixa-icon-192.png',
  './nixa-icon-512.png',
  './js/core/commercial-form-data.v1.js?v=1',
  './js/core/manual-delivery-writer.v1.js?v=1',
  './js/modules/release-permissions.js?v=1',
  './js/core/sale-budget-transition.v1.js?v=1',
  './js/core/sale-return-capability.v1.js?v=1',
  './js/modules/ai-dictation.js?v=1',
  './js/core/image-attachment-standard.js?v=3.17.7',
  './js/v3/identity-index.js?v=3.0.0-shadow-v279',
  './js/v3/data-lifecycle.js?v=3.0.0-shadow-v279',
  './js/v3/domain-store.js?v=3.0.0-shadow-v279',
  './js/v3/product-provider-read-model.js?v=3.0.0-shadow-v279',
  './js/v3/record-repository.js?v=3.0.0-shadow-v279',
  './js/v3/attachment-task.js?v=3.0.0-shadow-v279',
  './js/v3/budget-read-model.js?v=3.19.0',
  './js/v3/sales-read-model.js?v=3.19.18',
  './js/v3/ot-read-model.js?v=3.0.0-shadow-v279',
  './js/v3/journey-audit.js?v=3.0.0-shadow-v279',
  './js/v3/migration-audit.js?v=3.0.0-shadow-v279',
  './js/v3/legacy-snapshot.js?v=3.0.0-shadow-v279',
  './js/v3/shadow-comparison.js?v=3.0.0-shadow-v279',
  './js/v3/feature-gates.js?v=3.0.0-shadow-v279',
  './js/v3-shadow-runtime.js?v=3.0.0-shadow-v279',
  './js/v3/app-bridge.js?v=3.0.0-shadow-v279',
  './js/v3/firebase-record-adapter.js?v=3.17.7',
  './js/v3/budget-integration.js?v=3.0.0-shadow-v279',
  './js/v3/sales-integration.js?v=3.0.0-shadow-v279',
  './js/v3/ot-integration.js?v=3.0.0-shadow-v279',
  './js/v3/product-provider-integration.js?v=3.0.0-shadow-v279',
  './js/modules/garantia-circuito.js?v=3.19.18-ot',
  './js/modules/performance-diagnostics.js?v=1',
  './js/catalog-promotions.js?v=20261011-edit',
  './js/core/client-history-audience.v1.js',
  './js/core/client-history-service-reader.v1.js',
  './js/modules/client-history-host.v1.js',
  './js/core/client-history-timeline-reader.v1.js',
  './js/core/client-history-credentials-context.v1.js',
  './js/modules/client-history-credentials-host.v1.js',
  './js/modules/client-history-original-actions.v1.js',
  './js/modules/client-history-bootstrap.v1.js?v=3.19.1'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      // La caché offline es opcional: un almacenamiento lleno/bloqueado no
      // debe impedir que una reparación online sustituya el worker anterior.
      .catch((error) => {
        if (!['QuotaExceededError','SecurityError','InvalidStateError','UnknownError','NotAllowedError'].includes(error?.name)) throw error;
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => /^sisventas-v\d/.test(key) && key !== CACHE).map((key) => caches.delete(key)),
      ))
      .catch(() => {})
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if(url.origin===self.location.origin&&url.pathname==='/manifest.webmanifest'&&url.searchParams.has('sv_connection_probe'))return;
  // Datos/PDF privados nunca se escriben en Cache Storage ni usan fallback.
  if(event.request.headers?.has('Authorization') || url.pathname.startsWith('/privado/finanzas')) return;
  if (url.origin === 'https://www.gstatic.com' && url.pathname.indexOf('/firebasejs/') >= 0) {
    event.respondWith(
      (async () => {
        let cache;
        try { cache = await caches.open(CACHE); } catch (_error) {}
        // El SDK usa una versión exacta en la ruta: nunca cambia su contenido.
        let cached;
        try { cached = await cache?.match(event.request); } catch (_error) {}
        if (cached) return cached;
        try {
          const response = await fetch(new Request(event.request, { cache: 'no-store' }));
          if (response.ok && cache) {
            try { await cache.put(event.request, response.clone()); } catch (_error) {}
          }
          return response;
        } catch (_error) {
          return Response.error();
        }
      })(),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Los PDF generados en el cliente se guardan unos minutos en Cache Storage
  // y se sirven por una URL normal del propio origen. Esto evita que Chromium
  // bloquee las descargas iniciadas desde una vista previa blob:.
  if (url.pathname.indexOf('/__sisventas_pdf__/') === 0) {
    event.respondWith(
      caches.match(event.request).catch(() => undefined).then((response) => (
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
        if(response.ok && !/no-store|private/i.test(response.headers.get('cache-control')||'')) {
          const saved = caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
          if(event.waitUntil) event.waitUntil(saved);
        }
        return response;
      })
      .catch(async () => {
        // Un módulo con ?v= nuevo nunca se reemplaza por otro con ?v= antiguo.
        const guardado = await caches.match(event.request, { ignoreSearch: event.request.mode === 'navigate' }).catch(() => undefined);
        if (guardado) return guardado;
        // El HTML solo recupera páginas: devolverlo como JavaScript rompe el arranque.
        if (event.request.mode === 'navigate') {
          const pagina = await caches.match('./index.html').catch(() => undefined);
          if (pagina) return pagina;
        }
        return Response.error();
      }),
  );
});
