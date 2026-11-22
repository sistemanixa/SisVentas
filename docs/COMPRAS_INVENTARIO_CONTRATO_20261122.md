# Inventario de Compras: primera capa local, sin integración activa

Base `8fae41a3`, rama aislada `codex/audit-20261122-purchase-inventory`.
Propiedad exclusiva: Compras. No se editan core de referencia/vínculo de E,
Stock backend, OT, guard, store, reglas, flags ni frontend activo en este bloque.

## Inventario observado y permisos que no deben equipararse

| Circuito actual | Función / efecto | Autoridad observada |
| --- | --- | --- |
| Preparación | `reserveDeclaredExisting`, reserva por venta/lista y descuento general | Preparación de Compras; no es conteo Stock. |
| Confirmación planificada | `finishPlannedPurchase`, reserva existente y alta de enCompra | `confirmPlannedPurchase` exige balancecompra Y ordenes; conservar conjunción. |
| Orden manual | `saveManualOrder`, alta de enCompra | Flujo de Órdenes; no sustituir por balancecompra ni stock.ajustar. |
| Edición | `saveManualOrderV2`, oldPending/newPending y deltas de enCompra | No admite órdenes recibidas; comprobar autoridad de escritura del servidor, no sólo botón. |
| Cancelación | `changeOrderStatus`, resta pendientes con operación cancel_<orden> | Conserva recibidos y destino; requiere contrato específico de Órdenes. |
| Recepción | `registerReceipt`, reserva/general, costo real, orden y venta | Debe incluir originales y costos de venta/orden en el mismo commit, no sólo inventario. |
| Eliminación | `purchase-order-delete.handle/plan`, inventario+orden+vínculos+costos | Acción existente ordenes.eliminar; no reemplazar por acción genérica. |
| Devolución OT / sobrante | `receiveOTReturns`, `releaseOTLeftovers` | Son semántica OT; coordinar con D, no invocar autoridad de Compras para eludirla. |
| Conteo legado | `js/modules/inventory-count.js`, save con restTransaction | UI exige admin + ordenes y sin impersonación; incluir en cierre SDK posterior, no confundir con oficina Stock. |

`transactionInventory` sirve de embudo técnico en `purchase-orders.js`, pero su
callback recibe una rama por producto/código sin consultar asociación. El SDK
actual conserva su recorrido cuando mapping está ausente/OFF. No basta envolver
ese callback y cambiar la clave: recepción, edición, cancelación y generación
hoy incluyen documentos comerciales y pasos separados fuera de él.

La configuración de lectura `domain-read-policy` admite ordenes/balancecompra;
eso no acredita escritura ni autoriza convertir un permiso en equivalente al otro.
La autoridad RTDB de inventario es distinta del control de UI y debe conservarse
como límite adicional. Falta acordar una matriz typed de escritura con revisión,
digest y roles reales para cada operación.

## Modelos y puertos nuevos, no conectados

- `purchase-inventory-model`: pending register/edit/cancel, recepción y reserva
  de existencias. Deriva cantidades desde orden original y movimientos tipados;
  jamás acepta un patch cliente. Es modelo puro de la parte inventario, no un
  comando comercial completo ni una autorización.
- Conserva todos los campos ajenos, costos originales y precios pactados.
  Usa cantidades exactas del módulo Money sin redondear importes de origen.
  Recibir para venta cambia sólo su asignación; recibir general conserva costo
  real de esa recepción. Ningún recibo OT se reidentifica ni reescribe.
- Exige inventario físico existente y tres identidades separadas. No crea rama
  canónica alternativa. Rechaza saldos insuficientes en vez de recortarlos a cero.
  IDs previos en ledger requieren recuperar recibo, no suponer que otro cuerpo
  ya se aplicó. La recuperación/idempotencia definitiva pertenece al guard.
- `purchase-inventory-reference-port`: callback interno
  `resolveReference(original, {read,query})`; conserva el resultado opaco completo
  y lo compara al resolver nuevamente con puertos frescos. No inventa revisiones
  compatibles ni importa el WIP de E. El adaptador exacto de `original` debe
  acordarse con E antes de conectar. Recibe renglones/documentos originales
  del servidor con `source` y `rowKey`; nunca un producto de catálogo resuelto
  antes de consultar mapping. Conserva y revalida resultado opaco por renglón,
  incluso cuando varios comparten identidad física.
- `purchase-inventory-admission`: OFF o mapping ausente selecciona legacy;
  mapping activo exige verificador interno de barrera catálogo, bloqueo SDK
  antiguo posterior al lease y escritor Compras preparado. Falta cualquiera:
  503 sin fallback. Es selector puro; no habilita flags ni ejecuta escrituras.

## Autoridad propuesta, aún no agregada al guard

No usar stock.ajustar. Tampoco agregar compras.inventario como permiso genérico
que permita elegir módulo/acción desde el cliente. Propuesta al coordinador:
derivar tipo→acción/módulos en gateway trusted, mantener ordenes.eliminar y
definir por separado preparación (incluida conjunción balancecompra+ordenes
cuando corresponda) y recepción/edición/cancelación de Órdenes. Cualquier entrada
nueva del guard y hook de store deben ir en parche separado con prueba real.

La futura política typed debe ligar WeakMap/actor/lease/transportDigest, tipo y
fuentes exactas, permitir sólo patch comercial completo calculado internamente
y sus proyecciones verificadas, revalidar rol, revisión Y digest al commit.
No entregar una capacidad que valide exclusivamente el inventario mientras
orden/venta se guardan por fuera. No hay política, API ni claim nuevo activo
en este primer bloque.

## Pruebas y siguiente paso

52 PASS, 0 FAIL, 0 SKIP: modelos/puertos nuevos y regresiones de modelo/comando
existentes de eliminación. Datos ficticios; incluye ramas físicas distintas,
fracciones, preservación de originales/ledgers, colisiones, duplicados y faltantes.
No es validación de un ingreso nuevo con guard/store/emulador: todavía no existe.

Siguiente: acordar forma de original/callback y matriz de autoridad con E y
coordinador; después construir política/puerto typed OFF, patch comercial completo
y pruebas de guard real, ACK incierto, concurrencia y SDK posterior al corte.
Devoluciones/consumo OT y conteo legado deben entrar al inventario de cierre,
sin pisar los módulos de sus dueños. La barrera local de catálogo por sí sola no
bloquea SDK antiguo después del lease y no autoriza una activación parcial.

Sin producción, operaciones reales, despliegue, reglas remotas ni suite general.
