# Materiales OT y stock · v3.15.14

Publicación autorizada el 27/10/2026. No se migran ni corrigen registros reales como prueba.

## Circuito

Un nuevo adicional físico nace entregado e instalado. Conserva destino comercial,
cantidad, precio y autor. El primer guardado conserva explícitamente stockPendiente
hasta completar la transacción del producto y confirmar su referencia en la OT.
Si falta stock o falla la confirmación, aparece Completar stock del adicional:
el carrito se limpia después de guardar venta/OT, evitando crear otra venta para
resolver stock. Servicios y mano de obra no consumen inventario.

Cada renglón tiene referencia SHA-256 y revisión. La transacción del producto
compara cantidad anterior, revisión y objetivo; repetir el mismo intento no
consume nuevamente. Un intento viejo o distinto se rechaza. No usa reservas de
otras ventas. Adicional nuevo usa general disponible, sin gastar la reserva del
original del mismo código. El reservado propio de un adicional corregido puede
reutilizarse. Al reducir instalación, vuelve a reserva propia; depósito debe
confirmar recepción antes de disponer del material en general.

La reserva original pasa a consumido. Ante faltante verificado, el intento falla
sin fabricar stock ni consumir una reserva ajena. Históricos ya instalados sin
consumo comprobable requieren revisar el inventario; no se reconstruyen por suposición.

## Corrección de OT cerrada

Administrador con ot.corregirMateriales y ot.rendirMateriales habilita Corregir
materiales incluso si la rendición figura completa. Puede volver a rendir con
excepciones; conserva estado cerrado, auditoría, cobros y datos comerciales.
Otros roles no reciben esta habilitación. Las devoluciones recibidas previamente
se excluyen del cálculo instalado. No se alteran reglas, roles ni permisos.

## Recuperación y límites

Stock y OT siguen siendo dos confirmaciones. Si se confirma inventario y falla
el guardado OT, repetir la misma rendición completa su referencia sin volver a
consumir. No se anuncia éxito cuando falta confirmar la rendición. Un cambio
concurrente incompatible se rechaza; no se ofrece transacción atómica entre
venta, OT y todos los productos. No se ejecuta conciliación por reloj ni al abrir.
La corrección de registros previos exige acción explícita; esta publicación no
instala ni descuenta automáticamente los adicionales históricos.

## Pruebas

Modelos y runtime real con Firebase en memoria: reservas ajenas, faltantes,
repetición, revisión, corrección/reinstalación, histórico ambiguo, nueva venta,
stock pendiente, fallo de guardado y recuperación, permisos y OT cerrada.
UI aislada en 390/768/1280 con módulos reales, toda solicitud externa bloqueada.
No se enviaron mensajes ni se guardaron operaciones reales. Evidencia privada:
C:/SisVentas/tmp/ot31514-release. La publicación sólo actualiza Hosting.

Validación final: 6.198 PASS, 27 opt-in, 0 fallos; 38 casos específicos PASS.
Recepciones con recibo también son idempotentes y el cierre conserva la reserva
de devoluciones pendientes hasta su recepción. Caches frías y ausencia de registro
de inventario comprobadas sin anunciar consumos inexistentes.
