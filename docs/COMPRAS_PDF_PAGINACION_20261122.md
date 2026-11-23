# Conciliación PDF: filas completas

Fuente aislada inicial `c2b4f9b7`. Sólo cambia `js/core/print-layout.v1.js`; no altera importes, fuentes comerciales ni el método de impresión nativo.

El generador medía los cortes propios y luego `html2pdf` volvía a aplicar su pase CSS de saltos al clonar. Ese segundo pase añadía espacios y desplazaba las filas respecto de los recortes ya calculados. En la conciliación ficticia de 75 filas, FIC-27 quedaba partida y parcialmente tapada por la cabecera siguiente. Las capturas ahora desactivan exclusivamente ese pase redundante (`mode`, `before`, `after`, `avoid` vacíos). El plan medido conserva filas, límites, repetición de cabeceras y todas las páginas.

Verificación local:

- Botón **Descargar PDF** real con 6 y 75 renglones a 390/768/1280: seis casos PASS. Los PDF renderizados son idénticos entre los tres anchos; 6 renglones ocupa una página y 75 ocupa tres.
- Revisión visual completa del PDF largo: páginas con FIC-0–27, FIC-28–64 y FIC-65–74; última fila, totales y pie íntegros, sin cabecera sobre texto.
- 75 marcadores estrechos de prueba, sin cambiar altura de filas, medidos sobre los PNG renderizados del PDF descargado: todos conservan su altura y aparecen en una sola página. Se ignoran coincidencias aisladas de color de menos de 4 píxeles de JPEG/antialias, no segmentos reales de marcador. El módulo original reproduce rojo: FIC-27 dividida entre dos páginas. No se cambió una expectativa para aprobar el producto.
- 54 unitarias de impresión compartida, recibos, acta, distribuidor y ofertas PASS. Sintaxis y `git diff --check` PASS.
- Sin solicitudes externas ni lecturas/escrituras comerciales. El bundle `html2pdf 0.10.1` existente se sirve sólo a la página ficticia; no se instala ni descarga otra dependencia.

Nuevo ensayo reproducible: `test/browser/conciliation-pdf-pagination.cjs`. Requiere `NODE_PATH` de dependencias existentes, `CHROME_BIN` opcional, `SV_TEST_HTML2PDF_BUNDLE` local y Poppler (`PDFTOPPM_BIN` opcional). `SV_CONCILIATION_PDF_OUTPUT` dirige los artefactos privados. Puede elegirse otro módulo local mediante `SV_PRINT_LAYOUT_SOURCE` para contrastar una fuente histórica; no se reemplaza código de producción durante la prueba.

Evidencia privada fuera de Git: `C:/SisVentas/tmp/purchase-pdf-pagination-fixed-final/results.json`, los seis PDF naturales y sus PNG; control original en `C:/SisVentas/tmp/purchase-pdf-pagination-original-control`. La fuente de layout se verifica sin cambios antes/después de la corrida.

Límites: no es la puerta integral de SisVentas ni prueba todos los formularios de impresión. El ensayo independiente anterior `purchase-order-export.cjs` no quedó verde: su fixture omite `commercial-money.v1.js` y, al proveer esa dependencia real, exige CSV redondeado 123.46 mientras el producto conserva 123.456. No se modificaron ese producto ni sus expectativas; la evidencia de ese ensayo no se cuenta como aprobación de este bloque. No hubo publicación ni operación real.
