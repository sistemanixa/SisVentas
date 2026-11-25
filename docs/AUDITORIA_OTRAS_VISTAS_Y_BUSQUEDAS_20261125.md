# Auditoría adicional de vistas y overlay de cuatro búsquedas — 25/11/2026

Bloque posterior a `4063ef21`. No modifica la aplicación inmutable, índice, caché, CSS, servidor, reglas ni datos. El principal aplica `scripts/lib/list-search-feedback-overlay.cjs.apply(source)` al crear la siguiente aplicación desde la publicada v3.21.13 (`80cfc00bd002909cb22dd6496b829789716ae12b`). La transformación valida anclas únicas, rechaza una segunda aplicación y devuelve texto; no escribe archivos.

## Reproducciones adicionales y correcciones

1. Clientes: `buscarCliente` deja filas anteriores durante dos cuadros de animación y un timer. Se retiran visualmente al empezar, conservando altura; el token programado anterior continúa cancelado. Además `renderTablaClientes(undefined)` ahora toma el input visible, para que una actualización no elimine el filtro.
2. Productos: el timer de 120 ms mostraba filas anteriores aunque el campo decía Buscando. Se ocultan inmediatamente; se usa el estado común si está disponible y el render nuevo restaura visibilidad tanto con resultados como sin resultados.
3. Gastos: el timer de 140 ms conservaba filas sin indicación. Se ocultan conservando altura y se usa el título existente para mostrar Buscando, sin otra fila. El render restaura el título y muestra resultado vacío o error vigente; una excepción local no vuelve a exhibir datos del filtro anterior.
4. Proveedores: el filtro sólo ocultaba filas del DOM. Al recibir otro snapshot, el callback las recreaba todas sin volver a aplicar el input. Reproducción ficticia: buscar ALFA deja una fila; el mismo snapshot posterior mostraba ALFA y BETA con el input todavía ALFA. El callback ahora reaplica el valor visible, sin consultar nada adicional.

Son filtros locales: no se agrega ninguna llamada a Firebase, API ni almacenamiento. No se modifican los controles de autorización ni los callbacks de error de las fuentes. No se retira una caché correcta por el mero hecho de estar actualizándose.

## Auditoría de otras vistas activas (lectura acotada)

| Vista/fuente | Firma y barrera de vigencia | Espera/error | Resultado |
| --- | --- | --- | --- |
| Clientes | Cache de grupos/version; token `_clientesRenderProgramado` y página activa | Dos RAF+timer; primera carga específica; fuente readiness | Dos cuadros con filas de otro filtro; corregido por overlay |
| Productos | `prodData`; filtros texto/categoría/precio/uso/orden leídos del DOM; escucha de catálogo | Debounce120 ms; resultado local; primera carga readiness | Filas anteriores durante debounce; corregido. Refresh ya toma input actual |
| OT lista/detalle | Lista filtra `otData` sin consulta remota; detalle tiene token de apertura, UID/auth/db/rol/revisión/epoch/ruta | `verOT` oculta el panel anterior antes de esperar origen de venta; comprueba token después de await | No se reprodujo otra entidad vieja en esta lectura. `ot-data-sync` suma revisión, ID de OT y nodos de vista para callbacks tardíos |
| Historial de cliente | Identidad accountId+domicilio, actor/epoch, secuencia por solapa, cursor/revisión/generación | Limpia identidad al abrir; sustituye la región antes de await; error resetea/retira | No se halló el patrón adicional |
| Credenciales del historial | Contexto de cuenta/domicilio, epoch y secuencia de edición | Vacía rows/editor antes de GET; error deja mensaje, no otra entidad | No se halló el patrón adicional |
| Soporte/reclamos | Listener de colección; búsqueda/estado se aplican sin await al snapshot `SP_DATA` | Modal se repuebla sincrónicamente desde `SP_MODAL_KEY`; listener sólo refresca esa clave | No se halló cambio de filtro remoto fuera de orden. Error fuente mantiene último mismo contexto con readiness, no se certifica cobertura total del formulario |
| `SVPostventaDemand` | UID/auth/db/base/rol/revisión/ruta/epoch + `opening` e `isCurrent`; consulta de venta y resumen financiero puntual | Resuelve/verifica antes de navegar; assertCurrent después de cada await; 401/403 retira punto | No se halló otra entidad publicada tarde. Bypass `requirements=[]` sólo si el punto sigue vigente |
| Proveedores | Listener de colección y filtro local sobre DOM | Snapshot reconstruía filas sin reusar input | Bug reproducido y corregido |
| Gastos | Origen: auth/UID/rol/config de permisos/epoch/empleado; identidad del origen y snapshot; filtros/página firmados con JSON | Reemplaza datos por error/espera de fuente; filtro local140 ms | Bug de debounce corregido; barreras financieras/históricas intactas |
| Estadísticas/reportes/rentabilidad | `spec(page)` contiene período/rango/medios; identity UID/rol/revisión/epoch, auth/db, epoch por request | `ensure` retira métricas/tablas al comenzar; `current` exige firma exacta; error mantiene retirado | No se halló el patrón adicional |
| Notificaciones | Filtro local síncrono; preferencias remotas con identity/auth/notifSyncEpoch | Avisos de presupuestos pendientes se identifican; consumer cache fija actor/grants/permisos/epochs y generation/revision/sequence; denied retira | Snapshot del mismo contexto durante revalidación es legítimo; no se cambió |
| Readiness global | Generación de sesión y fuentes por dominio; no es una firma de filtro/entidad | Sólo conserva dashboard durante revalidación ventas/cobros si host acredita retención; error con datos previos puede convivir | No debe usarse sola para validar una búsqueda. Las secuencias/filtros son responsabilidad del host |
| Transición CSS | Clases `sv-page-transitioning` y `sv-data-pending` | Regla vieja `visibility:visible!important` anulaba el ocultamiento de readiness | Reproducción Chrome con CSS reales: sólo pending=hidden; ambas clases=visible. Corrección pertenece al principal, no al overlay |

La inspección confirma estos puntos concretos, no todos los destinos de todo el sistema. No se usaron datos reales, sesiones del usuario, navegación externa ni suite global.

## Verificación

- 8/8 pruebas unitarias de transformación, debounce, secuencia, error, filtros en refresh y cero lecturas nuevas. Sintaxis del resultado completo comprobada.
- 4/4 pruebas Chrome:390/768/1280 con funciones reales extraídas de la aplicación y DOM/datos ficticios, tabla oculta en el mismo evento input conservando altura, resultado nuevo y filtro de proveedor preservado; cero solicitudes de red. Cuarto caso verifica que la CSS corregida del principal no revele filas con ambas clases.
- Composición comprobada: overlay de 8 acciones `63e0b9de8c8636345d90d077edd489c8e7ddfe67`, seguido por este overlay, sobre app13 exacta: sintaxis y cuatro pruebas Chrome correctas.
- El test CSS usa `SV_OPERATION_FEEDBACK_CSS` explícito y se omite sin esa variable. Se probó con el archivo preparado del principal en `.local/system-actions-20261125/css/operation-feedback.css`; esto no acredita su despliegue.
- `SV_LIST_SEARCH_APP_SOURCE` permite repetir con la aplicación integrada final. Por defecto las pruebas del overlay usan app13 si existe, o la activa; las pruebas no sustituyen una recorrida completa de la aplicación integrada.
- Logs/reproducciones privados en `C:/SisVentas/tmp/stale-audit-*` y `stale-extra-*`, fuera de Git.

El principal debe integrar overlays/CSS, comprobar la nueva aplicación y ejecutar la puerta vigente antes de publicar. No se publicaron cambios desde este frente.
