# Compras SDK sin inventarioCompra: compatibilidad pendiente

Fuente única: `02f7693b` (checkout aislado). Datos exclusivamente ficticios.
No se consultó ni modificó producción, instalaciones, Rules o configuración.
Este bloque caracteriza el código: no habilita el writer ni migra órdenes.

## Resultado por operación

La fixture `oldOrder` es un borrador manual ficticio sin la propiedad
`inventarioCompra`, con cantidades y precios capturados de precisión completa.
Tiene una identidad producto/inventario asociada genuinamente en la fixture.
Se prueban tanto un ledger sin traza de esa orden como otro con operación
`compra_oldOrder`; el saldo agregado permanece idéntico.

| Operación | Comando actual | Segunda barrera / alcance mínimo posible |
|---|---|---|
| Encabezado fecha/proveedor | 409 `SV_PURCHASE_HISTORY_REVIEW`, antes del plan | El modelo puro de header escribe sólo orden y auditoría, conserva filas/precios y no añade marcador. Es candidato a una excepción estrecha y autorizada; **no está habilitado en el comando**. No equivale a full declaration ni edición de costos vinculados. |
| Cantidad | Mismo 409, cero PATCH | `purchase-inventory-order-plan` requiere schema/revisión, registro y references respaldadas. La cantidad modifica `enCompra`; no se puede inferir su contribución desde el saldo agregado. |
| Recepción | Mismo 409, cero PATCH | Requiere registro previo, respaldo por fila y costo/FX original suficiente. No basta conocer disponible actual para saber cuánto ya se aplicó. |
| Borrado typed | Mismo 409, cero PATCH | Además exige borrador independiente manual/extra_stock con registro typed completo. Legacy o vinculada no se vuelve eliminable añadiendo JSON. Conserva el endpoint review anterior cuando el nuevo host está OFF. |

No se reinterpretan órdenes recibidas ni se amplía su borrado. Para vinculadas,
cancelación trazable sigue siendo la alternativa aprobada; su compatibilidad
clásica también necesita revisar las mismas fuentes y registro, no se acredita
por mostrar el botón. Cambiar proveedor/costo mediante declaración completa puede
afectar Sale/List y no se debe presentar como una excepción de header inocua.

## Causa exacta y por qué no basta relajar un condicional

`purchase-inventory-command` y `purchase-typed-delete-command` resuelven todos los
renglones mediante `purchase-inventory-reference-port` antes de emitir el plan.
Este invoca `purchase-inventory-history.identifyOriginal`. La rama sin referencia
exige `registered === false` y `revision === 0` **explícitos en el original**.
Una propiedad ausente da `undefined`; por eso falla aun con ledger limpio.

Aceptar ausencia como false no completa qty/receipt: el siguiente modelo exige
`schema:1`, `registered:true`, revisión y una referencia por fila con operationId
existente en el ledger. Tampoco completa el borrado, cuya política requiere
registro typed real y ausencia de historia/fuentes incompatibles.

La fixture contrasta explícitamente dos originales distintos: ausencia del objeto
y `{schema:1, registered:false, revision:0}`. No aplica esa transformación como
migración. Aun el segundo original se rechaza ante una operación previa,
recepción de orden o cantidad recibida por fila.

## Bloqueo explícito de readiness necesario antes del corte

La prueba demuestra que **el host actual puede anunciar ready:true y ambos
commands.orderInventory/orderDelete:true con oldOrder presente**. Su readiness no
lee órdenes: verifica dependencias, admisión, numeración, proyecciones y el fence
de Stock. `sv_office_stock_order_fence.invalidCount` cuenta ledgers con cantidades
inválidas; NO cuenta órdenes clásicas sin metadata. Un cero no acredita este cierre.

Recomendación inmediata para Root: mantener sin instalar/activar la cohorte de
Compras y sin declarar cerrados `sdk-purchase-orders`/`backend-purchase` en el
contrato de instalación mientras falta esta compatibilidad. No poner installed
false si ya existe instalación; el cliente correctamente lo trataría como una
regresión. No permitir fallback SDK después de un error o de installed:true.

Si Root necesita un bloqueo explícito en código de capabilities durante este
cierre, usar un motivo servidor fijo `classic-orders-compatibility` en
`purchase-command-host.dependencies()` hasta implementar y verificar el circuito.
Así readiness devuelve ready:false, todas las commands:false, y handle falla
también por dependencies. No añadir un booleano cliente, un nuevo namespace de
configuración ni un callback que se autodeclare prueba. El cambio de producto
queda propuesto aquí, **no aplicado**: el bloqueo no repara órdenes ni habilita
un fallback; tampoco se debe instalar primero para descubrir este faltante.

El capability público actual sólo tiene el booleano global orderInventory, no
una decisión por orden/kind. Un header-only que llegara a completarse no permite
anunciar qty/receipt compatibles por extensión. Evitar un scan completo por cada
consulta de capabilities; la decisión de corte necesita evidencia previa real,
no consultas periódicas nuevas ni un contador inventado.

## Circuito mínimo seguro y conciliación condicionada

1. **Encabezado estrecho:** para borrador/enviada sin recepción ni pendientes,
   evaluar un camino interno antes de la resolución de inventario que reutilice
   el plan header-only y la Policy genuina de edición, con CAS de orden completa,
   proveedor original activo si cambia, permisos/admisión fresh y proyecciones
   actuales. No tocar items, moneda, precios, cantidades, stock ni
   inventarioCompra. Verificar Guard/Store/Rules y ACK perdido antes de habilitarlo.
   Este bloque sólo prueba la posibilidad del modelo y la barrera actual.
2. **Qty/receipt:** conciliación metadata-only exclusivamente si fuentes originales
   completas y ledger permiten demostrar identidad P/J/R por fila, operación
   original atribuible a esa orden, cantidades aplicadas/restantes y coherencia de
   recepciones/costos. CAS y relectura fresh de todas esas fuentes en el mismo
   commit. No agregar operaciones de stock ni retocar general/enCompra/reservado.
   Si no hay prueba suficiente: REVIEW identificable, nunca registered:true por
   defecto ni revision/operationId inventados.
3. **Borrado:** no convertir una clásica en typed eliminable por metadata inferida.
   Mantener el alcance previo review y la clasificación aprobada; cualquier caso
   adicional requiere el plan completo de fuentes, no sólo inventarioCompra.

El alta manual SDK incrementa enCompra sin recibo por orden y la edición SDK
aplica diferencias sin conservar necesariamente un recibo con cantidades. Las
operaciones `compra_<key>`/`cancel_<key>` existentes guardan timestamps; no capturan
por sí solas cantidades ni hash de los renglones originales. Diferentes historias
pueden producir el mismo saldo actual. Una recepción identificada es evidencia
parcial útil, no prueba automática de todo el alta y las ediciones anteriores.
No reconstruir ARS de USD histórico con cotización actual. Si evidencia real no
alcanza, una conciliación sólo metadata es imposible para ese caso y se conserva.

## Evidencia

`test/purchase-classic-compatibility.test.cjs`: **14 PASS**, cero fallos u omisiones.
Ocho casos comando con Guard/Store REST reales interceptados (4 operaciones ×
2 historias), cinco contrastes/modelos (incluyen validación de señales), más un
caso readiness con dependencias de sólo lectura como las
fixtures existentes del host. No se emite PATCH comercial, marcador o recibo.
La prueba readiness no ejecuta un Guard falso como autoridad: su run está
prohibido; las ocho pruebas de rechazo usan el Guard genuino.

Log local no versionado:
`C:/SisVentas/tmp/purchase-classic-compatibility-20261125.log`.
Corrida conjunta con `purchase-command-host.test.cjs`: 27 PASS; incluye los 14
anteriores, no se suman como pruebas distintas. Syntax/diff-check PASS.
No acredita acceso a datos reales, Rules remotas, emulador, cierre del circuito
legacy ni aptitud para activar/publicar la cohorte.
