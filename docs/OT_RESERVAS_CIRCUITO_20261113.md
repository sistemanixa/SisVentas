# OT: entrega e instalación con reservas antiguas

## Estado

Candidata aislada sobre `c518caca9476548bd8542ef9cc4f488aa4989e58`; todavía no publicada. La integración y publicación pertenecen al coordinador principal. No se reintentaron entregas, instalaciones ni cierres reales para probar.

## Causa y corrección

La lectura puntual de las dos OT reportadas y de sus inventarios referidos mostró diferencias entre el contador global reservado y las asignaciones. El servidor rechazaba tanto una entrega nueva con diferencia ajena como una instalación con reserva propia parcialmente sin respaldo. La recuperación del cliente ocultaba después la causa original.

Los casos equivalentes ficticios reproducen el rechazo en la base exacta del servidor. La corrección usa sólo reserva respaldada y General para el delta físico autorizado. Retira únicamente la reserva propia sin respaldo correspondiente a lo efectivamente instalado; conserva las asignaciones ajenas y documenta la diferencia. No iguala globales mediante un barrido ni modifica históricos al consultar.

El validador reconstruye el resultado desde originales y custodia relacionada comprobada, sin confiar en marcas de auditoría del cliente. La consulta de custodia se limita al índice certificado y los originales relevantes, con caché por comando. Se mantienen permisos, revisión, comprobaciones antes del commit y operación atómica OT/inventario/remito. No se amplían reglas ni permisos.

La interfaz conserva en memoria la causa OT HTTP409 y sólo la devuelve tras un rechazo autoritativo consultado; no reenvía automáticamente. Todo instalado y Excepciones comparten el estado canónico de los botones y avisan si la acción no está disponible.

## Evidencia

- Cinco casos de ruta nuevos fallan antes con el rechazo de conciliación y pasan después sobre una copia exacta del runtime reconstruido con únicamente el parche OT: instalación, replay y cierre en ambos roles; entrega, replay y posterior instalación con un único remito; rechazo atómico del commit.
- Grupo nativo de servidor: 80/80 aprobados, incluyendo fuentes de consumo, reserva propia, custodia ajena, recibos, alteraciones y cierre sin cambiar firma o finanzas.
- Navegador aislado: 9/9 aprobados en 390, 768 y 1280 píxeles, con entrega/instalación, indicador central, cancelación y replay. Recuperación: 23 pruebas unitarias y 3 de navegador aprobadas. Interfaz de custodia: 64 pruebas específicas aprobadas.
- Sintaxis de los módulos y `git diff --check` correctos. La suite completa y la publicación conjunta deben acreditarse en la integración, distinguiendo los fallos previos del repositorio heterogéneo.

La inspección de escritores actuales no demuestra qué actualización histórica produjo las diferencias reales. Los caminos normales revisados actualizan ambos contadores por el mismo delta. Se identificó un fallback antiguo de guardado OT y stock separado; el coordinador lo retira del camino de escritura en la nueva aplicación. No atribuir una fecha o autor sin evidencia.

## Pendiente externo

Integrar sobre la versión vigente, ejecutar la puerta conjunta y publicar cliente y servidor corregidos. Verificar los activos reales y el runtime desplegado antes de anunciar disponibilidad. Las OT reales permanecen sin nuevas operaciones de prueba; la publicación no instala materiales ni firma/cierra órdenes automáticamente.
