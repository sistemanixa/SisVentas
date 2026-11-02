# Gastos: pagos, historial y recurrentes

## Estado

Candidata local v3.17.17. No activada en Cotizador ni publicada en Hosting.
No se modificaron gastos, pagos, cuentas, comisiones, stock ni reglas reales.
No requiere migrar los históricos para habilitar el circuito nuevo.

## Circuito

La confirmación individual y la múltiple pasan por el mismo comando
`POST /laboral/gastos/pagar`. Conserva `gastos.administrar` y `gastos.pagar`,
lectura del gasto como el usuario, comprobación de versión, saldo, aprobación,
sesión, escritura atómica e identificador de operación recuperable.

El navegador no descarga cuentas privadas para pagar. El servidor resuelve
únicamente movimientos identificados por un vínculo explícito o por una clave
canónica comprobable: gasto directo de alta administrativa o sueldo mensual.
Exige vínculo inverso, empleado, tipo, importe, período e historial coherentes.
Una referencia ausente o contradictoria se rechaza; no se inventan movimientos.
Los gastos directos sin movimiento y los periódicos de empleado conservan esa
forma de registro. No se hace una búsqueda por nombres ni un recorrido de cuentas.

Las rutas anteriores de bonificaciones y reembolsos siguen disponibles para
clientes anteriores, con sus restricciones anteriores. No se ampliaron permisos
de RTDB ni de roles. La nueva web debe publicarse después de activar el servidor.

`POST /laboral/gastos/corregir-pago` exige `gastos.administrar` y
`gastos.corregirPago`, independientemente de poder pagar. Conserva la clave del
pago histórico, el saldo legado, los adjuntos anteriores, el motivo y una auditoría
del antes/después. La anulación no borra el pago. Se comprueba el mismo vínculo
exacto y se rechaza afectar un adelanto ya compensado. Un conflicto pide reabrir
el historial; no sobreescribe un pago agregado por otra sesión.

## Comprobantes y filtros

El adjunto original del gasto no se copia a un pago. Historial ofrece
«Comprobante del gasto» por separado y dice «Sin comprobante del pago» cuando
falta ese documento. Se conserva la carga puntual y autorizada de adjuntos.

Se retiró la sustitución del filtro de Gastos desde `payroll.js`. La aplicación
activa conserva el único filtro de categoría, empleado, estado, período y KPI.
«Pagado este mes» identifica la métrica de egresos efectivos. Un gasto de otro
mes con un pago en el mes consultado puede aparecer en ese filtro; su categoría
y fecha original siguen intactas. La cobertura salarial mantiene su criterio
de período original, distinto del egreso por fecha de pago.

## Recurrentes

La plantilla queda intacta. El nuevo gasto no hereda `_svListRevision`,
`_svListOperation`, marcadores de resumen, pagos, fecha de pago, comprobante,
bandera de adjunto ni reembolso anterior. Recibe una revisión propia del índice.
Su fecha de imputación y mes, si la plantilla los tenía, corresponden al nuevo
período. Se conserva importe, categoría y regla de vencimiento de la plantilla.

Se reprodujo con datos ficticios el rechazo de la revisión heredada y se probó
la solución con las proyecciones de listados activas. Preparar no escribe;
confirmar crea sólo destinos libres. Repetir, cancelar, cambiar una regla,
perder permiso o recibir una escritura concurrente no duplica gastos.

## Validación y límites

Pruebas ficticias de pagos parciales/finales, lotes mixtos, arrays históricos,
saldo legado, respuestas perdidas, versiones, permisos, bajas administrativas,
correcciones, anulaciones, sueldos recién liquidados y recurrentes. Las pruebas
conservan sueldo bruto, adelantos, clasificación, período, ganancias de productos
y mano de obra, y comprueban que no se sumen dos veces gastos y pagos.

Los tests anteriores que inyectaban una carrera en el comando genérico ahora la
inyectan en el comando de pago. Los conflictos se rechazan antes de reintentar
con datos actualizados. No se retiraron los casos de regresión financieros.

La vista local aislada utiliza componentes activos y servidor de memoria con
datos ficticios. No equivale a registrar un pago en la sesión real de Yanina.
No se provocó un pago real para validar la candidata. Al activar, corresponde
verificar entrega de activos, rutas autenticadas, configuración y lectura de
sesión; el pago legítimo lo confirma el usuario una sola vez.

Este bloque no migra ni rediseña todas las altas/ediciones de Gastos y Mi cuenta,
ni cierra los pendientes ajenos de búsqueda indexada de Ventas. No agrega tareas
por reloj, servicios o dependencias. Evidencia privada y ejecución local fuera
de Git en `tmp/gastos-unificado31717`.
