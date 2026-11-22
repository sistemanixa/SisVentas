# Barrera común: bloqueo confirmado y camino mínimo

Complementa85c28d54; no habilita el plan ni modifica consumidores, guard, claims o permisos. La política actual de Stock sólo cubre conteo inventario/resumen. La revisión de hooks de A está pendiente del coordinador.

## Dos carreras de fuente actual

office-stock-link-sdk-race.test.cjs extrae y ejecuta transactionInventory y safeKey del archivo actual purchase-orders.js, con SDK ficticio. Primera carrera: tras calcular el plan de asociación/CAS, la transacción SDK cambia el inventario físico sin adquirir guard. El hash actual ya difiere y el patch calculado no puede garantizar exclusión. Una relectura final por sí sola sigue dejando una ventana entre ese GET y el commit si SDK permanece habilitado.

Segunda carrera: aun con mapping canonical→legacy ya presente, la transacción SDK de Compras escribe canonical y crea un segundo inventario; legacy y su historial permanecen intactos, pero los circuitos divergen. Esto demuestra que idempotencia de la asociación no basta para conservar la interpretación de stock.

## Camino mínimo compatible: ingreso único por comando de dominio

Conservar lease/fence/CAS/recibos genéricos existentes sin ampliarlos. Migrar únicamente las mutaciones de inventario de Compras a comandos explícitos coordinados por servidor, antes de activar asociaciones. No enviar funciones mutate ni patches arbitrarios desde navegador, ni interceptar fbRunTransaction globalmente. Los callbacks actuales deben convertirse en operaciones tipadas con validación de cantidades/venta/orden/recepción y claves de idempotencia existentes en operaciones/asignaciones. Un endpoint genérico para ejecutar callbacks o escribir rutas no es aceptable.

Inventariar y portar todos los llamadores de transactionInventory: reserva de existente, confirmación/creación de compra y enCompra, desagrupación/cancelación, recepción de orden, devoluciones y reconciliación de pendientes. Hay operaciones documentales de Compras que se hacen por otras transacciones SDK (listas/órdenes): cada comando que dependa de esos estados debe leerlos y revalidarlos bajo el protocolo común, no sólo mover el último delta de stock. Si se requiere cambiar atomicidad de listas/órdenes además del inventario, declarar esa migración expresamente y ampliarla con autorización del coordinador.

El comando de asociación y todos los comandos de inventario resuelven productKey/inventoryKey y ambas direcciones del mapping dentro de la misma exclusión. El reintento conserva identidad de recibos/operaciones anteriores, no deriva otra clave de operación a partir del inventario físico. Cambios concurrentes de mapping/catálogo/propietarios/permisos/inventario bloquean el cálculo y obligan a reintentar desde una lectura consistente.

## Validadores locales propuestos

1. Política específica de asociación: comparación exacta con el plan emitido en servidor; sólo3rutas propias de vínculo. Niega cualquier patch de cantidades/costos/historial y revalida autorización actual. No reutilizar capacidad de conteo ni inventar una operación que el store no examine.
2. Política específica de cada comando de Compras: lista cerrada de rutas por producto/documento verificados, delta producido por modelo puro y revisión esperada. Conservar permisos actuales por módulo/acción y las reglas existentes de destinos; no convertir permisos de Stock en autoridad de compra.
3. Propuesta de reglas de corte (a preparar con A): impedir mutaciones SDK antiguas de los ledgers involucrados después de habilitar el ingreso coordinado, mediante el mecanismo de autoridad que ya exista. No agregar claims genéricos ni ampliar un permiso padre como atajo. Si un padre concede escritura, un veto en un hijo no la revoca: revisar reglas efectivas/ancestros antes de afirmar que la barrera existe.
4. Emulador con reglas candidatas completas y fixtures: SDK legado denegado, escritor coordinado permitido sólo para actor/rutas/revisiones vigentes, asociación autorizada en lease correcto, cero cambios ajenos y dos competidores. No instalar Java: usar jbr existente. Preparar candidatos; nunca aplicar remotos desde este frente.

Las reglas locales propuestas no están implementadas ni ensayadas todavía: faltan el contrato de hooks del store y la política acordada. No crear un campo lock/version en mapping mientras SDK pueda ignorarlo; tampoco dos locks independientes que nunca se excluyen entre sí.

## Condición de activación y entrega

UI de reparación permanece sin guardado. El corte sólo puede prepararse cuando todos los escritores hayan ingresado al protocolo común y el emulador pruebe ambas ordenaciones de asociación vs recepción/reserva/entrega/rendición, respuesta perdida/reintento, revocación y rechazo de SDK antiguo, con comparación profunda de inventarios y recibos. Es una migración de escritura de inventario de Compras y consumidores físicos, no una corrección cosmética.

Este incremento sólo entrega las dos pruebas reproducibles del riesgo y la propuesta concreta de ingreso/validación. Sigue en espera del informe de A antes de cambiar store/políticas o consumidores. Ningún registro comercial ni servicio real fue utilizado.
