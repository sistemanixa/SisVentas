# OT187: incidente posterior de rendición y unidades

## Alcance

Investigación y reproducción local posteriores a publicar frontend18. No hay
autorización de reintento real ni de publicación adicional. Servidor, reglas,
cantidades, stock, pagos, comisiones y OT real no se modificaron.

## Evidencia acotada del intento

Lecturas puntuales originales/resumen y productos/inventario vinculado, sin
descargar historiales. Se conservan sólo en evidencia privada. OT y resumen
siguen en revisión6, con instalación0 y rendiciónfalse. No se encontró recibo de
consumo para las identidades deterministas de esas filas. El primer producto
físico no tiene registro de inventario operativo; otra fila física tampoco.
Esto permite reproducir el mensaje de confirmación fallida, pero no acredita
por sí solo el stock físico de oficina ni todos los efectos históricos de un
intento sin traza temporal previa. No se consultaron recibos ajenos ni se
dedujo un resultado a partir de un guard actualmente vacío.

El mensaje procede de `SVOTStock.sync`: callback sin inventario devuelve null,
sin marcar consumo aplicado. La comprobación final rechaza la confirmación.
El circuito prepara capacidad OT, procesa consumos por fila secuencialmente y
recién después guarda rendición/OT mediante el servidor. No es evidencia de
permiso denegado ni de un despliegue incompatible; los módulos de consumo y el
servidor se conservaron en la publicación18.

## Reproducción con componentes reales y datos ficticios

`ot-rendition-stock-sequence-characterization.test.cjs` ejecuta el handler real
Todo instalado, planificador stock, adaptador operativo y resumen; sólo Auth,
SDK y transporte son ficticios:

- Falta primer inventario: mismo mensaje, cero commits de stock/OT.
- Falta inventario posterior: un recibo/consumo anterior queda confirmado y la
  OT no cambia. **Defecto de atomicidad reproducido, todavía sin corregir.**
- Repetir ese fallo ficticio no duplica el primer consumo; recuperar su ACK
  tampoco convierte el conjunto en una operación atómica.
- Revocar permiso durante confirmación no inicia preparación ni stock.

36casos stock/precisión/caracterizaciónPASS. Son pruebas de caracterización:
que pasen no significa que el defecto de atomicidad esté solucionado. No se
reintentó el caso real. La salida segura pendiente es un comando conjunto
autorizado con stock, OT, resúmenes y recibo confirmados en un solo corte,
manteniendo CAS, permisos y recuperación. Comprobar disponibilidad de todas
las filas antes ayuda al mensaje, pero no sustituye atomicidad ante cambios
concurrentes. No completar inventario con cantidades deducidas del remito.

## Corrección local de presentación solicitada

Cantidad y unidad se muestran juntas. Resumen de materiales, panel de custodia,
indicador global y aviso de entrega separan las unidades de medida: por ejemplo
305metros +9unidades, nunca314objetos. kg/litros permanecen separados. La unidad
explícita de fila se conserva; si falta se usa la del producto. Sin metadata se
separa por producto como «sin unidad confirmada». Fraccionabilidad o contenido
de una presentación no se usan para adivinar metros ni multiplicar cantidades.

Llegada tardía de unidad forma parte de la firma del render; el evento existente
actualiza presentación sin cambiar paso del wizard. Evento idéntico conserva
DOM, sin consultas periódicas ni escrituras. Se mantienen los totales numéricos
internos anteriores para validaciones, sin exponer su suma heterogénea como una
cantidad física única.

54focalesPASS y4ChromeHTMLcompletoPASS en390/1280, con heterogeneidad, catálogo
tardío/desconocido, fraccionablekg y ausencia de mutación/POSToperación. Falta
puerta completa congelada de este nuevo delta; la puerta de d671090b pertenece
a la publicación anterior. Capturas y lecturas privadas fuera de Git.
