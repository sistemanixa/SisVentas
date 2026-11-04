# Mis ventas mensual por creador en Pages existente

Referencia: `3d48939`. Entrega aislada: cambio sólo en `cotizador/commercial-pages-model.js`, test propio y patch de ese archivo. No se editaron host, HTTP, app, index, permisos ni el writer compartido de root. No hay raíz, proyección, endpoint o índice nuevos.

## Semántica comprobada en el app real

`ventaResponsableComercialReporte` toma el primer texto no vacío después de String/trim en este orden exacto: **creadaPor, creadoPor, usuario, createdBy**. Si no hay, toma el primer evento de creación con usuario válido y acción coincidente con el regex del helper, excluyendo Sistema en esa auditoría. No usa creadorOriginalNombre/Uid, owner, responsableNombre ni empleado/comisionado como reemplazo.

`renderDashAdministrativo` compara ese resultado con `currentUser || ''` por igualdad exacta y compara `(v.fecha || '').slice(0,7)` con el mes local actual. No normaliza fecha, no usa fechaOrden/ts y **no excluye anuladas**. El total es la cantidad de todas esas ventas visibles en el alcance autorizado, no el top5 global. El test extrae y ejecuta ambas funciones reales; no las sustituye por el modelo nuevo.

## Formato mínimo en los nodos existentes

La fila de venta de Pages añade:

- `creatorHash`: SHA256 de JSON.stringify del nombre exacto resuelto por el helper. JSON preserva diferencias de UTF-16, incluso surrogates aislados; no se recorta ni normaliza el nombre.
- `creatorMonth`: el prefijo crudo de fecha, sólo si puede coincidir con un YYYY-MM real, o null. Fechas como 04/11/2026, espacios iniciales, fechaOrden o un timestamp alternativo no crean coincidencias nuevas.
- `creatorDateInvalid`: identifica fechas truthy no textuales/no arrays que harían fallar el slice del renderer para ese creador. No se convierten silenciosamente en un conteo cero.

Los totales existentes `sv_commercial_pages/v1/totals/{scope}` añaden `creatorMonthsSchema:1`, `creatorMonthsRecords` y `creatorMonths[hash]={months:{YYYY-MM:n},invalidDates:n}`. Son contadores dentro del resumen actual, sin miembros, registros originales ni auditorías nuevas. creatorMonthsRecords certifica la suma y permite distinguir un mapa vacío legítimo de un mapa poblado que falta. Se cuentan anuladas antes del filtro económico existente.

Los contadores conservan el alcance all/u_uid que Pages ya autorizó y mantiene por owner. El **filtro dentro de ese alcance es creador textual**, no owner. Reasignar una venta mueve su alcance propio, pero no cambia quién fue su creador ni el contador global por ese creador.

`creatorMonthCount(meta,{creator,month})` devuelve sólo un entero. El llamador debe proporcionar el mismo nombre exacto que usa currentUser (sin trim/aliases adicionales), el mes y metadatos completos del alcance autorizado, con cobertura/generación/revisión comprobadas por el lector existente. La función no autoriza una petición ni inventa un scope vacío si falta metadata.

## Mantenimiento y compatibilidad

La evidencia se añade desde displayFields, que ya llama el fast path de metadatos de `commercial-pages-projections.js`. Por eso una corrección sólo de auditoría actualiza el creador sin descargar cobros. El camino completo de saleRow y el delta existente mantienen alta, cambio de creador/fecha cruda, reasignación, anulación y eliminación, en el mismo patch derivado.

Los metadatos antiguos sin marcador no se consideran un cero preparado. Continúan sirviendo/manteniendo las funciones anteriores de Pages; este contador queda no disponible hasta una preparación completa autorizada de Pages. Si falta evidencia de una fila bajo el marcador nuevo, o el contador no concuerda, se retira sólo esta capacidad (`creatorMonthsSchema:0`), sin bloquear ni fabricar una reparación del resto de los totales. No se ejecutó ninguna preparación sobre datos reales.

Si el helper de creador no puede interpretar un original, la capacidad queda incompleta; si sólo la fecha no permite evaluar el filtro, el error queda asociado al creador exacto. Otros creadores conservan su conteo verificable. Un cero sólo se devuelve con marcador y cardinalidad válidos, incluido el vacío certificado que RTDB puede podar.

El mapa no se propaga a collectionTotals ni a la selección de Cobranzas. Importes, impuestos, cobros, deuda, comisiones, fechas/orden existentes y criterios de cancelación monetarios siguen iguales. La nueva evidencia no cambia el campo author de presentación.

## Evidencia y merge

Primera caracterización roja: 11 FAIL porque la evidencia/API no existían y author no equivalía al helper. Pruebas nuevas finales: 13; junto con las 32 existentes de Pages: **45 PASS, 0 FAIL, 0 SKIP**. Se repitieron sobre copia congelada de 3d48939 con su projections real y el app real de referencia: mismo resultado. Incluye 501 ventas, todos los fallbacks de creador, coincidencia exacta de nombres, anuladas, fechas crudas atípicas, nulidad, scope/owner, Unicode, deltas, auditoría y metadatos incompletos. Cambiar sólo evidencia de creador deja exactamente iguales todos los campos/rutas anteriores a esta capacidad, incluidas las finanzas. No se alteraron expectativas de las pruebas existentes.

Logs privados: `tmp/sdk-proof/creator-month-red.log`, `creator-month-pages-focused.log`, `creator-month-root3d-focused.log`. Esta prueba es de funciones/modelos/puertos ficticios, no de UI montada ni despliegue. No se ejecutó puerta general ni se usaron datos reales.

Para merge por hunks: helpers/evidencia en displayFields; inicialización del resumen; creatorDelta dentro del delta por alcance; separación de collectionTotals; export de creatorMonthCount. Patch explícito: `docs/patches/commercial-pages-creator-month.patch`. No copiar commercial-pages-projections.js ni los módulos HTTP/host que otros editan.

Pendiente coordinado: decidir cómo el host/lector ya existente entrega este contador después de verificar cobertura; no integrar un total antiguo/owner/top5 como reemplazo. Las últimas cinco ventas personales siguen siendo otra necesidad del renderer y **no están certificadas por este contador**. Sin montaje, aviso de versión ni activación de producción en esta entrega.
