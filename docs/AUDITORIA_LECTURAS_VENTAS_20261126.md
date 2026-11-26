# Inventario de lecturas de Ventas · 26/11/2026

Fuente revisada: rama codex/payment-flow-20261126, producto f2c4c870ff06f82f2fd4e2945da1b42a2cfa8d76; HEAD d0e8e866 sólo añade dos correcciones de fixtures. Index carga js/app.v3.21.19.js. Auditoría estática sin consultas a datos reales ni cambios funcionales.

## Resultado que se puede contar

Se analizaron mediante AST 874 archivos JavaScript de producto de js/, cotizador/ y cloud-functions/, sin errores de parseo. Se excluyeron node_modules, test, tmp, .local y 368 copias históricas de aplicación; esas copias no son 368 lectores ejecutándose. El criterio cuenta sitios de llamada, no líneas con la palabra ventas.

| Grupo verificable | Sitios |
|---|---:|
| Llamadas explícitas a fbCargarVentas | 3 |
| Llamadas comerciales con primer argumento literal ventas: request/onValue/refresh | 16 |
| Lecturas con ruta literal sisventas/ventas o FB_PATHS.ventas en el argumento | 30 |
| Total de sitios explícitos de esos tres grupos | 49 |

Distribución de los 49: 28 en scripts referenciados directamente por index; 2 en módulos frontend condicionales/no referenciados directamente; 19 en fuentes backend del repositorio. **No son 49 consultas al abrir una venta**, ni un total exhaustivo de accesos dinámicos. Los 16 comerciales incluyen refresh tras escrituras, que puede no transportar nada si no existe suscripción; las alternativas admin/usuario de un mismo detalle son excluyentes.

### Quién referencia al cargador principal

Hay 14 referencias de código al identificador fbCargarVentas fuera de su declaración: 8 dependencias de páginas (Historial cliente, Productos, Comisiones, Facturas, Detalle, Cuenta corriente, Cobranzas y Balance de compra), 2 mapas de inyección (formulario e inicio Dashboard), 1 callback de reanudación propio y 3 llamadas por eventos/reanudación. Además un wrapper lo identifica por nombre string en client-account-host.v1.js:96; ese wrapper no constituye otra consulta.

El mapa del formulario contiene el loader disponible, pero SVCommercialFormData.requirements('venta') selecciona sólo clientes, productos y empleados. fbCargarVentas también retorna al detectar la ruta venta. Por eso una referencia en el mapa **no significa que Nueva venta lea ventas anteriores**.

| Referencia | Función | Tipo |
| js/app.v3.21.19.js:6266 | svCargarDatosDePaginaActual | referencia; ver clasificación anterior |
| js/app.v3.21.19.js:6269 | svCargarDatosDePaginaActual | referencia; ver clasificación anterior |
| js/app.v3.21.19.js:6271 | svCargarDatosDePaginaActual | referencia; ver clasificación anterior |
| js/app.v3.21.19.js:6272 | svCargarDatosDePaginaActual | referencia; ver clasificación anterior |
| js/app.v3.21.19.js:6273 | svCargarDatosDePaginaActual | referencia; ver clasificación anterior |
| js/app.v3.21.19.js:6274 | svCargarDatosDePaginaActual | referencia; ver clasificación anterior |
| js/app.v3.21.19.js:6278 | svCargarDatosDePaginaActual | referencia; ver clasificación anterior |
| js/app.v3.21.19.js:6287 | svCargarDatosDePaginaActual | referencia; ver clasificación anterior |
| js/app.v3.21.19.js:6294 | svCargarDatosDePaginaActual | referencia; ver clasificación anterior |
| js/app.v3.21.19.js:6387 | svCargarInicioDashboardDemandado | referencia; ver clasificación anterior |
| js/app.v3.21.19.js:7184 | fbCargarVentas | referencia; ver clasificación anterior |
| js/core/commercial-ownership.js:80 | <callback> | referencia; ver clasificación anterior |
| js/modules/collections-indexed-host.v1.js:67 | resumeVisible | referencia; ver clasificación anterior |
| js/modules/sales-indexed-host.v1.js:104 | <callback> | referencia; ver clasificación anterior |

## Recorrido principal y prioridades

fbCargarVentas (app19:7179) verifica acceso/ruta, delega al host de páginas cuando corresponde y sólo después instala onValue comercial (7192). Ese onValue es una abstracción HTTP, no una escucha SDK directa. CommercialOwnership.refresh (js/core/commercial-ownership.js:40) comparte la solicitud en curso; onValue, regreso a primer plano y confirmación de escritura pueden activarlo. Conserva ETag pero un 304 no demuestra ahorro de lecturas del servidor.

1. **Revisar primero los consumidores del cargador completo:** Productos, Comisiones, Facturas, Cuenta corriente e inicio Dashboard. Determinar para cada rol/configuración si realmente consume la lista completa, o si el host indexado/proyección ya responde lo necesario. La presencia en un array permite invocarlo al entrar; no demuestra que deba descargarse todo. No se retiraron dependencias durante esta auditoría.
2. **Separar ficha y cobros:** la ficha usa un original puntual; el historial usa GET ?para=pagos con índice de pertenencia y puntos autorizados. No reconstruir todos los pagos/ventas ni introducir un POST. Los controles de frescura no deben duplicar la misma lectura dentro de una fase.
3. **Informes:** limitar período/índice y abrir originales sólo para las filas necesarias. salary-coverage y commercial-report ya tienen caminos acotados; medir cantidad efectiva de originales por informe, no asumir que una llamada readSale es un solo GET para todo el reporte.
4. **Mantenimiento:** maintenance.js:196 solicita la colección completa expresamente. Es una herramienta administrativa bajo acción del usuario; no convertirla en fuente habitual de navegación.
5. **Backend económico:** lecturas de PaymentCommands, generación de comisiones, proyecciones y validadores forman parte de guardar/cobrar y no deben eliminarse sólo por aparecer en el inventario. Distinguir captura original, comparación previa al commit y proyección derivada. sale-economics-validation.js:29 conserva dos lectores de colección que merecen medir alcance/configuración; este informe no acredita que ese módulo esté activo en producción.

## Sitios explícitos encontrados

| Archivo:línea | Función contenedora | Clase | Referencia index |
| js/app.v3.21.19.js:7192 | fbCargarVentas | commercial-call (window.SVCommercialOwnership.onValue) | directa |
| js/app.v3.21.19.js:7531 | <callback> | commercial-call (window.SVCommercialOwnership?.refresh) | directa |
| js/app.v3.21.19.js:10619 | _svCargaOperacion_confirmarEmisionFactura | explicit-source-read (window.fbGet) | directa |
| js/app.v3.21.19.js:34876 | eliminarVenta | explicit-source-read (window.fbGet) | directa |
| js/app.v3.21.19.js:48416 | _resultadoConversionPresupuestoExistente | explicit-source-read (window.fbGet) | directa |
| js/app.v3.21.19.js:48728 | _svCargaOperacion__convertirPresupuestoEnVentaAtomico | explicit-source-read (window.fbGet) | directa |
| js/app.v3.21.19.js:50917 | _svCargaOperacion_otGuardarCorreccionProductos | explicit-source-read (window.fbGet) | directa |
| js/core/commercial-ownership.js:80 | <callback> | loader-call (root.fbCargarVentas) | directa |
| js/core/commercial-report-read.v1.js:18 | readSale | explicit-source-read (get) | directa |
| js/core/commercial-report-read.v1.js:18 | readSale | commercial-call (r.SVCommercialOwnership.request) | directa |
| js/core/ot-sale-origin.v1.js:14 | readSale | commercial-call (r.SVCommercialOwnership.request) | directa |
| js/core/postventa-demand-proposal.js:15 | request | commercial-call (root.SVCommercialOwnership.request) | directa |
| js/core/salary-coverage-read.v1.js:24 | <callback> | explicit-source-read (get) | directa |
| js/core/sale-payment-history.v1.js:36 | <callback> | commercial-call (env.SVCommercialOwnership.request) | directa |
| js/core/sale-writer.v1.js:80 | commit | commercial-call (root.SVCommercialOwnership?.refresh) | directa |
| js/core/sale-writer.v1.js:89 | save | commercial-call (root.SVCommercialOwnership?.refresh) | directa |
| js/modules/client-account-host.v1.js:82 | openSale | commercial-call (root.SVCommercialOwnership.request) | directa |
| js/modules/collections-indexed-host.v1.js:41 | detailRead | commercial-call (root.SVCommercialOwnership.request) | directa |
| js/modules/collections-indexed-host.v1.js:67 | resumeVisible | loader-call (root.fbCargarVentas) | directa |
| js/modules/commercial-pages-host.v1.js:7 | detailRead | commercial-call (root.SVCommercialOwnership.request) | condicional/no directa |
| js/modules/commissions.js:175 | consultarVentaDetalleComision | commercial-call (window.SVCommercialOwnership.request) | directa |
| js/modules/maintenance.js:196 | mntAnalizarBase | explicit-source-read (mntGet) | directa |
| js/modules/purchase-orders.js:1397 | <callback> | explicit-source-read (read) | condicional/no directa |
| js/modules/sale-commission-assignment.js:96 | <callback> | commercial-call (root.SVCommercialOwnership.request) | directa |
| js/modules/sale-cost-editor.v1.js:9 | <callback> | commercial-call (r.SVCommercialOwnership?.refresh) | directa |
| js/modules/sales-indexed-host.v1.js:53 | detailRead | explicit-source-read (root.fbGet) | directa |
| js/modules/sales-indexed-host.v1.js:53 | detailRead | commercial-call (root.SVCommercialOwnership.request) | directa |
| js/modules/sales-indexed-host.v1.js:76 | detailRead | explicit-source-read (root.fbGet) | directa |
| js/modules/sales-indexed-host.v1.js:76 | detailRead | commercial-call (root.SVCommercialOwnership.request) | directa |
| js/modules/sales-indexed-host.v1.js:104 | <callback> | loader-call (root.fbCargarVentas) | directa |
| cotizador/client-account-documents.js:7 | load | explicit-source-read (read) | backend fuente |
| cotizador/client-account-projections.js:27 | augment | explicit-source-read (raw) | backend fuente |
| cotizador/client-account-projections.js:27 | augment | explicit-source-read (get) | backend fuente |
| cotizador/client-history-projections.js:27 | augment | explicit-source-read (raw) | backend fuente |
| cotizador/client-history-projections.js:30 | augment | explicit-source-read (raw) | backend fuente |
| cotizador/commercial-pages-projections.js:14 | augment | explicit-source-read (get) | backend fuente |
| cotizador/commercial-pages-projections.js:23 | augment | explicit-source-read (raw) | backend fuente |
| cotizador/commercial-pages-projections.js:23 | augment | explicit-source-read (get) | backend fuente |
| cotizador/commercial-pages-projections.js:30 | readSale | explicit-source-read (get) | backend fuente |
| cotizador/commercial-pages-projections.js:31 | augment | explicit-source-read (raw) | backend fuente |
| cotizador/commercial-pages-projections.js:49 | augment | explicit-source-read (raw) | backend fuente |
| cotizador/commission-generation.js:27 | load | explicit-source-read (read) | backend fuente |
| cotizador/ot-delete-command.js:34 | visible | explicit-source-read (store.readAsUser) | backend fuente |
| cotizador/payment-commands.js:72 | hydrate | explicit-source-read (store.read) | backend fuente |
| cotizador/payment-commands.js:78 | hydrate | explicit-source-read (store.read) | backend fuente |
| cotizador/purchase-order-delete.js:16 | plan | explicit-source-read (read) | backend fuente |
| cotizador/sale-economics-validation.js:29 | validate | explicit-source-read (raw) | backend fuente |
| cotizador/sale-economics-validation.js:29 | validate | explicit-source-read (get) | backend fuente |
| cotizador/sale-financial-dependencies-provider.js:6 | evidence | explicit-source-read (read) | backend fuente |

## Caminos dinámicos: límite deliberado del conteo

La búsqueda se completó con revisión de rutas construidas en variables, que el contador literal no puede equiparar honestamente a un número cerrado de consultas:

| Constructor/puerto | Lectura posible de Ventas | Condición |
|---|---|---|
| cotizador/commercial-ownership.js:151–171 | readCollection('sisventas/'+domain), list | dominio ventas; lista autorizada o consulta acotada según rol |
| cotizador/commercial-ownership.js:237–279 | assertRecord, selectedRecords, readAuthorizedRecordsByIds | original por clave; uno por id solicitado |
| cotizador/payment-snapshot.js:15–58 | readUser(path) con path construido en línea30 | original de cada venta y candidatos de pagos indexados; memo de petición |
| js/core/ot-sale-origin.v1.js:13–14 | read(path) para admin / request para usuario | una venta vinculada a OT, no colección |
| js/core/commercial-pages-reader.v1.js | page/searchSales/detailRead | proyecciones sv_commercial_pages; configuración/cobertura y originales puntuales |
| js/modules/purchase-orders.js:647 y consumidores read(path) | venta de origen de lista/orden | módulo condicional, separar lectura de escritura |
| Modelos/puertos genéricos de Guard, historial y proyecciones | sisventas+'/'+domain+'/'+key y scope.get(path) | dependen de patch/acción/flags; una referencia estática puede producir N puntos |

Cloud-functions se incluyó en los archivos analizados. Los forwarders de comisiones reaccionan a rutas de eventos de ventas/pagos: mencionar la ruta no equivale a descargar la colección; no fueron sumados como lectores literales falsos. offline-core.js:21 contiene ventas en la lista BLOCKED, por eso tampoco se contabilizó como lectura.

El backend del repositorio incluye código preparado y puede diferir del runtime nativo ensamblado. Las 19 coincidencias backend no certifican 19 accesos activos del servidor publicado. Para certificar la ejecución se necesita el manifiesto nativo y contadores por petición, sin sumar componentes preparados no montados.

## Circuito esperado

| Acción | Fuente mínima |
|---|---|
| Nueva venta | clientes/productos/directorio requeridos; número asignado sólo al guardar; cero historial de ventas |
| Listado/búsqueda | página acotada e índices; totales derivados separados; conservar filtros y cancelar respuesta vieja |
| Abrir detalle | un original autorizado, cobros por pertenencia indexada; adjuntos sólo al solicitarlos |
| Editar | original vigente y dependencias de esa venta; preservar capturas históricas |
| Cobrar/anular | comando coordinado, permisos frescos, originales/CAS/recibo; mismo id ante ACK incierto |
| Reporte | período/alcance explícitos y proyecciones; originales sólo cuando el cálculo lo requiere |

## Reproducción y límites

Repetir búsqueda inicial: rg -n 'fbCargarVentas' js/app.v3.21.19.js js/core js/modules; luego localizar SVCommercialOwnership.request/onValue/refresh con dominio literal ventas y lecturas con ruta sisventas/ventas o FB_PATHS.ventas. El inventario AST usado para el conteo filtra CallExpression/OptionalCallExpression y evita contar writes, comentarios, strings de BLOCKED y copias antiguas como consultas.

El contador explícito es una base de 49 sitios identificables, **no un total exacto de todas las consultas dinámicas ni medición de reposo**. No se ejecutaron formularios financieros ni se midió tráfico de todas las pantallas. Ninguna conclusión de eliminación de controles está autorizada por el mero conteo. Siguiente paso útil: medir una entrada real por consumidor del cargador completo y registrar GET/puntos/bytes/espera antes de cambiar su dependencia.
