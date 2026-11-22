# Comando de Compras OFF: orden e inventario en el mismo commit

Incremento sobre `caa40224`, dependiente del contrato firmado común de B
`a0bbf71f60f8a4412057eef2428b3a4fc5ffa905` y del resolver dirigido de E
`01347ba1c269fed21d015ca4253832fdf3708fd8`. Sin ruta HTTP, publicación, flags
aplicados, UI de Compras conectada ni incorporación del comando a Docker.

## Ingreso y autoridad

`purchase-inventory-command.create` recibe authorize, store, guard,
resolveReference, assertAdmission y queryPage exclusivamente internos.
enabled es false por defecto. execute recibe sólo id, kind cerrado,
orderKey, expectedHash, expectedRevision y cantidades/recepciones de renglones
existentes. Rechaza patch, callback, módulo, permiso, inventario o snapshot cliente.

Siempre usa la autoridad aprobada ordenes.editar, no Stock ni permiso de venta.
Repite Auth revocable, uid real, rol activo, módulo, bloqueos, acción, resets,
revisión y digest. Autoriza también antes de recuperar un recibo confirmado.
El callback assertAdmission verifica la firma/cohorte común de Stock/Compras/OT/UI
en fases frescas; no hay booleano independiente purchaseInventorySdkClosed.
La prueba utiliza el verificador Ed25519 real de B con llaves efímeras ficticias.

## Alcance comercial explícito

Implementa register/edit/cancel/receive para órdenes manuales no vinculadas.
Orden e inventario físico se guardan juntos y el guard agrega recibo, revisión
operacional y resúmenes exactos. Mantiene autoría, proveedor, precios públicos,
costos unitarios pactados y campos desconocidos. Editar sólo cambia cantidades
de renglones existentes y sus subtotales/totales coherentes. No admite editar
cantidades recibidas ni recalcular totales con extras ambiguos.

Recibir conserva el costo presupuestado, acumula cantidad/costo real, costo medio,
proveedor original, historial de recepción, total real/presupuestado y diferencia;
para general registra la referencia de costo de ESA recepción sin redondear origen.
Cancelar sólo retira pendientes: conserva recibidos, reservas y recibos anteriores.
El registro previo de inventario impide repetir un alta con otro operationId.

Si hay venta, lista/preparación, compra conjunta o referencia comercial enlazada,
rechaza explícitamente sin escribir. No hay recepción parcial de inventario antes
de guardar costos de venta, ni se finge completar preparación/confirmación/cierre.
Esos comandos futuros conservarán balancecompra Y ordenes según contrato.
Eliminación continúa con ordenes.eliminar y su circuito propio, sin modificarse.

## Historia y originales

El original se lee como usuario mediante scope.getAsUser y requiere hash completo
Y revisión esperada. Un estado inventarioCompra schema1 pending/revision0 debe
haber sido preparado por servidor; no se deduce del silencio de un registro viejo.
Órdenes antiguas sin evidencia explícita requieren conciliación; no migración automática.

La identidad por renglón conserva productKey, inventoryKey, receiptIdentityKey y
operación respaldada en el ledger completo. El comando vuelve a comprobarla
antes de cualquier cambio. Múltiples renglones conservan evidencia de su propia
operación, sin reidentificar recibos ni asumir que todos cambiaron juntos.

El adaptador envía al núcleo E el documento completo de servidor, path, selector
y hash. identifyOriginal lee mappings ANTES de catálogo, lee el ledger físico
entero y verifica originales de historia de compra. confirmed exige identidad y
operación respaldadas; absent requiere registro aún no realizado y ausencia de
señales relevantes en orden/renglón/ledger. No toma history del body ni fabrica
un receiptIdentityKey provisional para absent.

No se usa fake sv_stock_reference_config/index para cubrir catálogo/inventario.
El resolver dirigido registra lecturas, igualdad y rangos. El adaptador conserva
el resultado/readSet entero y repite resolución con readFresh/queryFresh y
queryPageFresh; pierde cierre si falta el cuarto puerto. No inventa su protocolo.

## Cantidades parciales heredadas

La transacción antigua de Compras y OT-consumption trataban acumuladores ausentes
como cero. Se admite cero estructural sólo para enCompra y reservado ausentes,
usando Money sin redondeo y preservando campos ajenos ausentes. Si existen
asignaciones/recibos que respaldan una reserva, un global reservado ausente exige
revisión. Valores explícitos inválidos/null no se convierten en cero.

La cantidad general ausente permanece ambigua según el contrato de conteo de
oficina: recepción/reserva la rechazan con motivo explícito. Registrar pendientes
no la completa ni inventa un conteo. Inventario inexistente nunca crea otra rama;
costos/precios desconocidos nunca se completan con cero ni catálogo actual.

## Evidencia y límites de este incremento

113 PASS, 0 FAIL, 0 SKIP: nuevo comando (22), historia (8), modelos/puertos,
admisión firmada, política/guard y regresiones de eliminación. Incluye ACK perdido
con un solo efecto, ID/cuerpo distintos, Auth/permiso revocados, mapping y originales
concurrentes, fuente/revisión obsoletas, linked-source bloqueada sin cambios y
registros parciales/costos desconocidos. Un rojo inicial detectó Auth revocada
durante el check final; se agregó una última autorización antes de confirmar.

Dos composiciones con núcleo E01347 confirmado pasan en memoria: rangos frescos,
phantom de catálogo, recibo sin original rechazado y register→receive→replay con
guard real. El caso de identidad histórica usa recibo/auditoría ficticios del
fixture canónico de E; no acredita instalación física ni datos históricos reales.

La composición antigua E96 con índice ficticio es sólo evidencia histórica,
NO aceptación actual. La prueba REST/emulador final debe usar store.queryPage
real y los índices dirigidos que B prepara, más el guard root7f1. No declarar
cerrada esa composición por los positivos anteriores. El SDK-cut se entrega
en incremento separado, con el mismo activationPins firmado de B.

No se modifica producción ni una comisión/cobro/venta real. No se ejecutó suite
general: corresponde al coordinador. Logs privados purchase-*-20261122*.log en tmp.
