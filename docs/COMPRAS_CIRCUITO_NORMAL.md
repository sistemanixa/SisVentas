# Compras: borradores y anulaciones

El circuito permanente reemplaza la habilitación temporal de un registro particular. No depende de fecha límite, lista de órdenes aprobadas manualmente ni capturas guardadas en variables de entorno.

- Eliminar borrador exige el original actual, ausencia de recepción y operaciones pendientes, permiso vigente y existencia de sus materiales/vínculos declarados. Retira sólo el pendiente de compra; conserva stock físico y reservas.
- Anular una recepción conserva la orden, sus ítems y comprobantes originales, marca la anulación con usuario/operación/fecha y revierte stock recibido y pendiente. No elimina pagos ni genera devoluciones monetarias. Si falta stock disponible o la atribución de costos/reservas no es inequívoca, rechaza sin cambios y muestra qué debe revisarse.
- Los cambios de stock, vínculos, costos aplicables, proyecciones y recibo se confirman juntos con los mecanismos existentes. Reintentos y recuperación de confirmación no vuelven a descontar stock. El cuerpo de anulación identifica esa operación explícitamente y conserva el protocolo de digest del recibo.

Ambas acciones requieren el permiso destructivo vigente de Compras (`ordenes.eliminar`), validado también por servidor y reglas. La anulación tiene su comando y confirmación propios. No se amplían reglas ni accesos. Ningún original productivo se elimina o anula como prueba.

Rendimiento: se retiran las dos lecturas completas de órdenes y su comparación contra una captura previa. Los originales puntuales independientes se leen en lotes limitados, manteniendo las fases inicial y final. La consulta de disponibilidad no descarga las reglas completas; todo comando que escribe sigue comprobándolas. No se introducen cachés entre usuarios ni consultas por reloj. Los tiempos de autenticación, reglas y comando pueden registrarse únicamente como fase y milisegundos, sin identificadores, contenido ni tokens.

El intento legítimo anterior observado por metadatos HTTP tardó 7,34 segundos y respondió 200. No existen tiempos internos de ese intento para atribuir con exactitud cada segundo; no se repite una operación real para medir ni se promete latencia productiva a partir de fixtures.

Validación en curso: política/modelos, paquete nativo con reversa íntegra de cores, REST emulador con reglas vigentes y componentes reales en Chrome a 390/1280. La prueba del componente no equivale al arranque completo de todas las áreas del índice. Los intentos iniciales de reutilizar la fixture comercial completa fallaron por datos de Compras no preparados; no se retiraron controles del producto para acomodarlos. Estado de publicación y puerta global se registran en CONTEXTO_ACTUAL al cerrar.
