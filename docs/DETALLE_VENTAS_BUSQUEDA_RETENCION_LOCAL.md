# Detalle de ventas: retención de búsqueda · propuesta local

Base: `05be68ac4cbc92feb0318b849449d80bb4a48a9e`. Rama aislada `codex/detalle-ventas-busqueda-retencion`. Sin integración de otros componentes, push, publicación ni operaciones con datos reales.

## Comportamiento

- Al escribir, filtra sin IO las filas de la página verificada usando el modelo canónico de búsqueda. Identifica los resultados como provisorios. Si no encuentra coincidencias locales conserva la página y aclara el límite local; no afirma un resultado histórico vacío.
- Conserva el debounce de 120 ms de la aplicación activa. Cancela lógicamente el lector anterior en cada intención nueva; el SDK GET no ofrece cancelación física de una transferencia ya enviada. Una respuesta retirada no publica filas ni resultados financieros.
- La solicitud y la página publicada tienen estados separados. Un repintado durante la búsqueda conserva las filas. La paginación queda deshabilitada durante una vista provisoria y vuelve a habilitarse al publicar el resultado.
- Mantiene el máximo de 50 filas y los límites existentes de cada consulta. Una página histórica definitivamente vacía mantiene su continuación; la retención no sustituye ese resultado definitivo.
- Las consultas de una página ya verificada usan preparación propia (`sales-query`), sin volver a certificar ni invalidar los totales financieros. Reutilizan metadatos sólo para el mismo actor, revisión y generación. Las consultas cortas se resuelven localmente y explican el mínimo de tres caracteres para el historial.
- Un error transitorio reconocido conserva la página y los importes con aviso de reintento. Permisos denegados, sesión/rol/permisos distintos, cobertura inválida o cambio de revisión retiran la presentación. El desfase entre un GET de cobertura nuevo y su listener no puede dejar Readiness listo sin finanzas verificadas.
- Una escritura confirmada o actualización explícita invalida el listado; una venta ficticia eliminada no queda visible por la retención. Los errores iniciales de Dashboard conservan su presentación de error.

## Evidencia y límites

Se usan el lector, host y motor Readiness reales. Las pruebas unitarias tienen DOM mínimo y no ejecutan su pintado RAF; las pruebas de HTML completo verifican el pintado real con MutationObserver, respuestas retenidas y navegador a 1280 y 390 px.

El fixture de navegador contiene 1120 ventas: 320 actuales y 800 históricas. Consulta pendiente `Cliente`, sustitución por `V-FIXTURE-0` con respuesta anterior liberada y esperada hasta finalizar, y búsqueda `Antigua` que devuelve una primera página de 50 claves históricas. Las trazas guardan cada spec y las lecturas HTTP con bytes/límite. Verifican importes estables, ausencia de vaciado transitorio o bloqueo de primer plano, cero lecturas raíz Ventas/Pagos, límites de 50 y estado ficticio sin cambios. No equivalen a recorrer todas las páginas históricas ni a probar todos los formularios financieros.

Se comparan los bytes HTTP del host con el archivo local por SHA-256. Las capturas oscuras de escritorio y móvil corresponden al fixture; recursos externos permanecen bloqueados. Artefactos y logs se conservan sólo en `tmp/` ignorado del checkout, incluidos los rojos. No se cambian expectativas históricas para aprobar.

La prueba inicial de tres casos dio 0 PASS/3 FAIL. La primera puerta completa dio 9546 casos, 9509 PASS, 6 FAIL y 31 SKIP: eliminación (2), error Dashboard (2) y envío síncrono de búsqueda (2). Esas regresiones se corrigieron y se contrastaron sin relajar sus expectativas. La segunda puerta dio 9548 casos, 9517 PASS, 0 FAIL y 31 SKIP antes del ajuste adicional de cobertura/paginador. No atribuirla a la fuente posterior.

Validación final de la fuente: 73 focales de lector/host PASS y 25 recorridos de navegador PASS, sin omisiones. Syntax check de los dos módulos y tres archivos de pruebas PASS; diff check PASS.

La puerta vigente final dio **9551 casos, 9519 PASS, 1 FAIL, 31 SKIP y exit 1**. El único fallo fue el umbral de 1500 ms de “50.000 consultas sobre 10.000 ventas permanecen indexadas”, en test/v3-core.test.js (1829,7 ms). Al ejecutar ese archivo aislado dio 34 PASS/1 FAIL (2436,8 ms). Un archivo de Git de la base 05be68ac, incluyendo ese test y js/v3, también dio 34 PASS/1 FAIL (su subtest duró 1684,6 ms). Ese test no importa los dos módulos modificados y sus fuentes no cambiaron. Esto reproduce el límite también en la base; no prueba una causa de carga del equipo. No se modificó el umbral ni el núcleo y no se presenta la puerta final como verde. La integración debe volver a contrastar ese límite antes de publicar.

## Integración pendiente

Ésta es una propuesta de fuente en los módulos v1 existentes. No se modificaron `index.html`, aplicación activa, versión ni Service Worker, ni el paquete 3.19.4 congelado. Las referencias actuales son `sales-indexed-host.v1.js?v=3.19.1` y `commercial-pages-reader.v1.js?v=3.19.0`, también presentes en SHELL.

Antes de mostrarla al usuario, la integración debe asignar URLs inmutables nuevas y mantener coherentes índice, versión, SHELL/caché y Novedades. Debe probar el upgrade con SW real y verificar los bytes servidos/cargados. El navegador de estas pruebas bloquea SW: no demuestra que una pestaña existente cargó el cambio, ni atribuye a caché el fallo observado. No se recargó la ventana del usuario ni se tocó el servidor root 8765. Producción y Firebase reales permanecen fuera de esta entrega local.

## Binding de fuente y evidencia privada

Fuente funcional congelada para la última puerta (SHA-256 de bytes del checkout):

- `js/modules/sales-indexed-host.v1.js`: `62c81cbb54eabb5b767fab6e790363502b808e68af0c56786bf98186636e6dab`.
- `js/core/commercial-pages-reader.v1.js`: `fe9dbd1d506b2f510c19fddfd98f61e176a1c01739052af6c5c58124c64ff6bd`.

Logs de este checkout: `tmp/search-retention-current-gate.private.log` (primer rojo), `tmp/search-retention-current-gate-final.private.log` (segunda puerta previa al último ajuste) y `tmp/search-retention-current-gate-security.private.log` (puerta de fuente final). Focales finales: `tmp/search-retention-unit-security.private.log` (73 PASS) y `tmp/search-retention-regression-security.private.log` (25 PASS). Los nombres privados no son artefactos versionados ni certificados de producción.

Capturas y specs ficticias en `tmp/search-retention/search-{1280,390}.{png,json}`. Inspección adicional de filas y scroll móvil en `mobile-scroll.png` y `mobile-scroll.json`: 50 filas históricas, Readiness listo sin errores y ancho del documento 390 px sin desborde horizontal. El desplazamiento vertical pertenece a la página normal; no se presenta como prueba de scroll de modales ni de todos los formularios.

Contraste temporal de base: tmp/search-retention-v3-core-isolated.private.log y tmp/search-retention-v3-core-base.private.log, conservados rojos. Archivo base extraído de Git en tmp/search-retention-base-core (ignorado); no se alteró el checkout base ni otra rama.
