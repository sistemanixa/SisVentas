# Clasificación individual de la puerta QA histórica

Fuente de producto 05be68ac4cbc92feb0318b849449d80bb4a48a9e; QA c84924496ab904817d3b1a0d3b9f36c547093188. No se repitió la suite global ni se modificó producto.

Log original privado `historical-chain-current-gate.private.log`, SHA256 `6808f9bb23550070d379106a325c8435686e934693032ab824f361970f2baeaf`: 9397 casos, 9287PASS, 81FAIL, 29SKIP, exit1.

65 fallos tienen MODULE_NOT_FOUND/playwright, verificado en el detalle o stack de carga de cada archivo. Doce tienen Permission denied al inicializar Git en temporales. Uno muestra EACCES loopback directamente. Tres ocultan el transporte en 503 o estado Sin conexión: se reprodujeron focalmente con fetch instrumentado que sólo permite loopback, sin cambiar assertions, con EACCES en ambos Node22.23.4 y Node24.17.0. Esta reproducción apoya la clasificación; no agrega una causa que el log original no registró. No se ejecutaron con permisos ampliados ni se acredita que pasarían al levantarlos.

## Entorno y repetición preparada

Comprobado por ejecución de `--version`: `C:/SisVentas/tmp/node22-portable-20261104/node.exe` es v22.23.4. El Node por defecto es v24.17.0; no se infiere su versión del PATH. Con `NODE_PATH=C:/SisVentas/cotizador/node_modules`, `require.resolve('playwright')` resuelve `C:/SisVentas/cotizador/node_modules/playwright/index.js`. Chrome instalado existe en `C:/Program Files/Google/Chrome/Application/chrome.exe`, ProductVersion156.0.8078.80. No se lanzó Chrome ni se abrió ventana. La ruta que devuelve chromium.executablePath() corresponde a otro caché y no prueba que ese binario exista; para UI futura usar SV_TEST_CHROME con el Chrome instalado, cuando esté autorizada.

Dependencias Git: aplicar primero `1d02878c80b8fd9a8d72a20a9bbe1b09b60d9137`, después `c84924496ab904817d3b1a0d3b9f36c547093188` sobre la fuente conjunta compatible. Ambos contienen sólo QA/documentación y parten de05be. Esta clasificación documental es posterior y no es dependencia ejecutable. La fuente conjunta todavía debe ser indicada y fijada; no se ejecutó ni se le atribuye un resultado.

Archivos propios imprescindibles: `scripts/test-historical-reference.cjs`; `test/historical-reference-complete-chain.integration.cjs`; `test/historical-reference-volume.integration.cjs`; `test/fixtures/historical-reference-profile.json`; `test/helpers/historical-reference-chain.cjs`; `test/helpers/historical-reference-volume.cjs`; `test/helpers/historical-reference-network-deny.cjs`. Reutilizan los helpers existentes `labor-ui-flow.cjs`, `coordinated-backend.cjs`, `active-app.js` y los módulos reales de la fuente conjunta. No necesitan exportaciones privadas, emuladores, Firebase real, credenciales ni Playwright para estas etapas Node. El perfil público es histórico; eliminar cualquier override privado antes de la repetición canónica.

Desde la raíz de la fuente conjunta, una vez recibido y verificado su SHA completo, comando preparado (aún no ejecutado allí):

```powershell
$expectedSource = '<SHA_COMPLETO_CONJUNTO_PENDIENTE>'
if ((git rev-parse HEAD) -ne $expectedSource) { throw 'Fuente distinta de la acordada' }
if (git status --porcelain) { throw 'Revisar cambios locales antes de repetir' }
$env:NODE_PATH = 'C:/SisVentas/cotizador/node_modules'
$env:SV_TEST_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
Remove-Item Env:SV_SYNTHETIC_CAPACITY_JSON -ErrorAction SilentlyContinue
& 'C:/SisVentas/tmp/node22-portable-20261104/node.exe' scripts/test-historical-reference.cjs --stage volume,complete-chain
if ($LASTEXITCODE -ne 0) { throw 'La cadena sintética no aprobó' }
```

El runner usa process.execPath en hijos, por lo que ambas etapas conservan Node22 y el bloqueo de red. Ejecuta tres casos, en dos fixtures separados: el caso complete-chain contiene por sí mismo toda la cadena en un solo estado; volume cubre determinismo/consulta/cobro adicionales. No sumar los fixtures como una cadena única más extensa. Esta preparación no repite la suite general y no mide UI/latencia.

|N|Lote|Prueba (archivo:línea)|Causa observada|
|---:|---:|---|---|
|1|1|test/audit-completion-ui.test.cjs:1 — test\audit-completion-ui.test.cjs|missing-playwright|
|2|1|test/chat-purchase-audit-ui.test.cjs:1 — test\chat-purchase-audit-ui.test.cjs|missing-playwright|
|3|1|test/chat-text-layout.test.cjs:1 — test\chat-text-layout.test.cjs|missing-playwright|
|4|1|test/client-account-native-ui.test.cjs:1 — test\client-account-native-ui.test.cjs|missing-playwright|
|5|1|test/client-history-bootstrap-native.test.cjs:1 — test\client-history-bootstrap-native.test.cjs|missing-playwright|
|6|1|test/client-history-budget-intent-native.test.cjs:1 — test\client-history-budget-intent-native.test.cjs|missing-playwright|
|7|1|test/client-history-credentials-native.test.cjs:1 — test\client-history-credentials-native.test.cjs|missing-playwright|
|8|1|test/client-history-host-native.test.cjs:1 — test\client-history-host-native.test.cjs|missing-playwright|
|9|1|test/client-history-original-actions-native.test.cjs:1 — test\client-history-original-actions-native.test.cjs|missing-playwright|
|10|1|test/collections-indexed-native-ui.test.cjs:1 — test\collections-indexed-native-ui.test.cjs|missing-playwright|
|11|1|test/commercial-admission-paused.test.cjs:50 — real module bootstrap binds mandatory admission from revision flag and Docker includes helper|missing-playwright|
|12|1|test/commercial-admission-readonly.test.cjs:25 — paused actual bootstrap and real H7 access/query/client adapters read capabilities, history and identity without guard or commits|missing-playwright|
|13|1|test/commercial-admission-readonly.test.cjs:26 — paused read exceptions preserve real freshAuth, inactive, reset, view-as and strict body denials|missing-playwright|
|14|1|test/commercial-admission-readonly.test.cjs:27 — history config, permission and coverage gates remain enforced under admission pause|missing-playwright|
|15|1|test/commercial-admission-readonly.test.cjs:28 — account preparation, sibling mutations and trailing slash never enter services while paused|missing-playwright|
|16|1|test/commercial-audit-ui.test.cjs:1 — test\commercial-audit-ui.test.cjs|missing-playwright|
|17|1|test/commercial-collection-reader.test.cjs:105 — integración HTTP loopback usa If-None-Match, conserva importes y detecta cambios en la siguiente acción|loopback-reproduced-eacces|
|18|1|test/commercial-collection-reader.test.cjs:114 — timeout de un GET falla cerrado y no reutiliza la copia anterior|loopback-reproduced-eacces|
|19|1|test/commercial-delete-native.test.cjs:1 — test\commercial-delete-native.test.cjs|missing-playwright|
|20|1|test/commercial-draft-transport-restart-native.test.cjs:1 — test\commercial-draft-transport-restart-native.test.cjs|missing-playwright|
|21|1|test/commercial-full-app-native.test.cjs:1 — test\commercial-full-app-native.test.cjs|missing-playwright|
|22|1|test/commercial-pages-ui.test.cjs:1 — test\commercial-pages-ui.test.cjs|missing-playwright|
|23|1|test/commercial-prepare-ui.test.cjs:1 — test\commercial-prepare-ui.test.cjs|missing-playwright|
|24|1|test/commercial-product-photo-navigation-native.test.cjs:1 — test\commercial-product-photo-navigation-native.test.cjs|missing-playwright|
|25|1|test/commercial-related-benchmark-dry-run.test.cjs:11 — benchmark verifies clean reviewed SHA and ignored output using a disposable repository|sandbox-git-temp|
|26|1|test/commercial-report-host-dom-native.test.cjs:1 — test\commercial-report-host-dom-native.test.cjs|missing-playwright|
|27|1|test/commercial-report-ui.test.cjs:1 — test\commercial-report-ui.test.cjs|missing-playwright|
|28|1|test/commercial-return-navigation-native.test.cjs:1 — test\commercial-return-navigation-native.test.cjs|missing-playwright|
|29|1|test/commercial-sparse-and-source-order-native.test.cjs:1 — test\commercial-sparse-and-source-order-native.test.cjs|missing-playwright|
|30|1|test/commission-event-http.test.cjs:14 — ruta HTTP real rechaza anónimo y token incorrecto sin escribir trabajo ni finanzas|missing-playwright|
|31|1|test/commission-event-http.test.cjs:15 — ruta HTTP con entrega autenticada genera una sola comisión canónica y conserva el segundo envío|missing-playwright|
|32|1|test/commission-public-response.test.cjs:57 — actual HTTP route revisar redacts for admin after authorization|missing-playwright|
|33|1|test/commission-public-response.test.cjs:57 — actual HTTP route generar redacts for admin after authorization|missing-playwright|
|34|1|test/commission-public-response.test.cjs:57 — actual HTTP route revisar redacts for administrativo after authorization|missing-playwright|
|35|1|test/commission-public-response.test.cjs:57 — actual HTTP route generar redacts for administrativo after authorization|missing-playwright|
|36|1|test/commission-public-response.test.cjs:57 — actual HTTP route revisar redacts for vendedor after authorization|missing-playwright|
|37|1|test/commission-public-response.test.cjs:57 — actual HTTP route generar redacts for vendedor after authorization|missing-playwright|
|38|1|test/commission-public-response.test.cjs:57 — actual HTTP route revisar redacts for tecnico_vendedor after authorization|missing-playwright|
|39|1|test/commission-public-response.test.cjs:57 — actual HTTP route generar redacts for tecnico_vendedor after authorization|missing-playwright|
|40|1|test/commission-public-response.test.cjs:57 — actual HTTP route revisar redacts for tecnico after authorization|missing-playwright|
|41|1|test/commission-public-response.test.cjs:57 — actual HTTP route generar redacts for tecnico after authorization|missing-playwright|
|42|1|test/commission-public-response.test.cjs:60 — actual generation HTTP errors preserve 409 busy distinction and hide unknown error payload|missing-playwright|
|43|1|test/commission-public-response.test.cjs:64 — actual HTTP method guard does not call authorization or generation|missing-playwright|
|44|2|test/connection-transport-cycle.test.cjs:6 — dos cortes reales de transporte loopback conservan datos y recuperan Ventas/Presupuestos con304 y luego cambios|loopback-reproduced-eacces|
|45|2|test/dashboard-backend-mount.test.cjs:29 — actual index boots with flags false and routes refuse reads without Auth/DB/guard work|missing-playwright|
|46|2|test/dashboard-backend-mount.test.cjs:39 — five actual GET routes read prepared DTOs through existing current Auth without writes|missing-playwright|
|47|2|test/dashboard-backend-mount.test.cjs:45 — mounted readers reject inactive identity and corrupt coverage without invoking a guard|missing-playwright|
|48|2|test/dashboard-backend-mount.test.cjs:48 — mounted readers enforce current Dashboard grants on all five routes without guard writes|missing-playwright|
|49|2|test/dashboard-backend-mount.test.cjs:54 — Docker COPY payload alone boots actual index false/true without ../js dependencies|missing-playwright|
|50|2|test/dashboard-readiness-native.test.cjs:1 — test\dashboard-readiness-native.test.cjs|missing-playwright|
|51|2|test/dashboard-warm-presentation.test.cjs:1 — test\dashboard-warm-presentation.test.cjs|missing-playwright|
|52|2|test/document-images-native.test.cjs:1 — test\document-images-native.test.cjs|missing-playwright|
|53|2|test/expense-card-filter-notice.test.cjs:1 — test\expense-card-filter-notice.test.cjs|missing-playwright|
|54|2|test/expense-save-native-ui.test.cjs:1 — test\expense-save-native-ui.test.cjs|missing-playwright|
|55|2|test/exterior-confirmed-ui.test.cjs:1 — test\exterior-confirmed-ui.test.cjs|missing-playwright|
|56|2|test/exterior-product-sheet-scroll.test.cjs:1 — test\exterior-product-sheet-scroll.test.cjs|missing-playwright|
|57|2|test/grid-data-ready-visibility.test.cjs:1 — test\grid-data-ready-visibility.test.cjs|missing-playwright|
|58|3|test/ot-acta-correction-ui.test.cjs:1 — test\ot-acta-correction-ui.test.cjs|missing-playwright|
|59|3|test/ot-delivery-display-precision-native.test.cjs:1 — test\ot-delivery-display-precision-native.test.cjs|missing-playwright|
|60|3|test/ot-delivery-selection-native.test.cjs:1 — test\ot-delivery-selection-native.test.cjs|missing-playwright|
|61|3|test/ot-detail-opening-native.test.cjs:1 — test\ot-detail-opening-native.test.cjs|missing-playwright|
|62|3|test/ot-office-count-ui.test.cjs:1 — test\ot-office-count-ui.test.cjs|missing-playwright|
|63|3|test/payment-actor-history-ui.test.cjs:1 — test\payment-actor-history-ui.test.cjs|missing-playwright|
|64|4|test/purchase-local-reference-on-add-ui.test.cjs:1 — test\purchase-local-reference-on-add-ui.test.cjs|missing-playwright|
|65|4|test/purchase-savings-tooltip-ui.test.cjs:1 — test\purchase-savings-tooltip-ui.test.cjs|missing-playwright|
|66|4|test/sale-delete-runtime.test.cjs:10 — full runtime REST store, real gateway and local HTTP dispatch preserve routes and private receipts|sandbox-loopback|
|67|4|test/sale-detail-opening-native.test.cjs:1 — test\sale-detail-opening-native.test.cjs|missing-playwright|
|68|4|test/sale-return-native-ui.test.cjs:1 — test\sale-return-native-ui.test.cjs|missing-playwright|
|69|4|test/sales-drafts-readiness-native.test.cjs:1 — test\sales-drafts-readiness-native.test.cjs|missing-playwright|
|70|4|test/sales-indexed-native-ui.test.cjs:1 — test\sales-indexed-native-ui.test.cjs|missing-playwright|
|71|4|test/stage-guarded-invoice-function.test.cjs:40 — dry-run inventaría sólo deploy y cierre transitivo, sin crear destino ni ejecutar función|sandbox-git-temp|
|72|4|test/stage-guarded-invoice-function.test.cjs:46 — apply copia blobs revisados, manifiestos reproducibles y dependencias cargables sin el checkout|sandbox-git-temp|
|73|4|test/stage-guarded-invoice-function.test.cjs:54 — rechaza SHA abreviado/distinto y checkout dirty, incluso cambios fuera del alcance y archivos no tracked|sandbox-git-temp|
|74|4|test/stage-guarded-invoice-function.test.cjs:59 — ignorados node_modules y .env nunca se inventarían ni leen|sandbox-git-temp|
|75|4|test/stage-guarded-invoice-function.test.cjs:63 — destino requiere tmp privado fuera del checkout y un directorio nuevo/vacío|sandbox-git-temp|
|76|4|test/stage-guarded-invoice-function.test.cjs:68 — el destino dentro de otro Git exige exclusión completa y rechaza archivos tracked|sandbox-git-temp|
|77|4|test/stage-guarded-invoice-function.test.cjs:74 — fuente con symlink tracked y destino junction no se atraviesan|sandbox-git-temp|
|78|4|test/stage-guarded-invoice-function.test.cjs:89 — una dependencia local ausente, fuera del paquete, secreta o npm no declarada falla antes de escribir|sandbox-git-temp|
|79|4|test/stage-guarded-invoice-function.test.cjs:94 — closure laboral no escapa de cotizador y no acepta una función sin guard o lock incoherente|sandbox-git-temp|
|80|4|test/stage-guarded-invoice-function.test.cjs:99 — CLI por defecto sólo imprime plan y no instala, autentica ni despliega|sandbox-git-temp|
|81|4|test/stage-guarded-invoice-function.test.cjs:104 — los módulos reales actuales de función y labor forman un paquete autónomo sin npm adicional|sandbox-git-temp|
