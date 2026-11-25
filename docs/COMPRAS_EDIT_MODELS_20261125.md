# Modelos de edición Compras · entrega local 25/11/2026

Base del worktree: `37e1cbab93eb73b429f1997a28544a22436e4a95`, rama `codex/purchases-complete-20261125`. Modelos recuperados ya presentes sin seguimiento; se leyó el diff del WIP ajeno y se reprodujeron únicamente cambios de los tres archivos asignados. Sin commit, publicación, datos reales ni modificaciones del worktree antiguo.

## Archivos propios

- `cotizador/purchase-manual-edit-model.js`: full declaration de stock extra respaldada por `sourceStockList`/`sourceStockListKey` del servidor. Conserva origen, FK, snapshots y moneda; saldo pendiente por diferencia; historial anterior completo; CAS de fuente e inventarios; dependencias de proveedor/productos nuevos. Rechaza fuente incompleta, vínculos de venta, pendientes, identidades ambiguas y SKU nuevo sin `destination:'stock'`.
- `cotizador/purchase-linked-edit-model.js`: delega extras independientes al modelo anterior. Excedente explícito conserva la cantidad de venta previamente ordenada y separa fila stock. Para USD compara presupuesto con captura ARS y un cambio de proveedor utiliza esa captura ARS, sin copiar costo base USD a Sale/List. Conserva PVP de venta/IVA/pagos/comisiones.
- `cotizador/purchase-joint-order-plan.js`: full declaration de extra conjunto utiliza orden ORIGINAL y lista conjunta ORIGINAL en el modelo de stock, sin falsificar origen manual. Restaura FK y precondición original; recepción posterior conserva el circuito existente.
- Pruebas correspondientes: `test/purchase-manual-edit-model.test.cjs`, `test/purchase-linked-edit-model.test.cjs`, `test/purchase-joint-order-plan.test.cjs`.

## Integración para main

Contrato anterior de declaración, ampliado abajo: `{providerKey,currency,date,items:[{productKey,quantity,unitCost,publicPrice,sourceIndex?,destination?}]}`. `publicPrice` es captura ARS, incluso en orden USD; `unitCost` conserva moneda de orden. Para SKU nuevo en stock ligado se exige `destination:'stock'`. `sourceIndex` identifica fila original; no autoriza reemplazar SKU. Stock standalone con `listaMaterialesId` sigue llegando a LinkedEdit desde el wrapper vigente y éste delega con `list` como fuente original. Joint.build ya entrega fuente original explícitamente. Fuente e inventarios deben permanecer cubiertos por CAS/lectura fresca de Policy; estos modelos puros no otorgan autoridad.

## Verificación

202 PASS / 0 FAIL / 0 SKIP al ejecutar conjuntamente:

`node --test test/purchase-manual-edit-model.test.cjs test/purchase-linked-edit-model.test.cjs test/purchase-joint-order-plan.test.cjs test/purchase-order-edit-plan.test.cjs test/purchase-inventory-model.test.cjs test/purchase-receipt-fx.test.cjs test/purchase-inventory-linked-plan.test.cjs`

Sintaxis de los tres modelos y `git diff --check` correctos. Este último no inspecciona archivos sin seguimiento; main debe revisar su staging explícito. Sólo pruebas de modelos ficticios; no prueba Gateway/Policy/Guard/emulador/publicación ni suite global. Worktree compartido contiene cambios ajenos frontend: no se tocaron ni atribuyen a este bloque.

## Límites que main debe cerrar

- Modelos admiten cambio USD explícito; falta integrar whitelist nueva en main/E/UI, fuera de este bloque.
- Varias órdenes en la misma línea permiten cabecera y cambios sin recotización de venta; sólo costo compartido ambiguo o aumento que excede necesidad ya cubierta requiere REVIEW. No cambia capturas económicas de Sale/List en un cambio de proveedor compartido.
- Stock con varias filas históricas del mismo SKU se rechaza por ambigüedad en modelo de stock; no se fusionan capturas. Stock nuevo requiere producto y referencia de inventario ya resueltos, no simula inventario ausente.
- No se migraron campos monetarios históricos ausentes ni se convirtieron PVP anteriores por suposición. Fuente stock admite PVP pendiente sólo cuando estaba marcado explícitamente; la declaración provee captura numérica nueva.


## Ampliación FX implementada · sustituye límite USD anterior

Input nuevo único: `declaration.exchangeRate?: number`, ARS por USD. Estrictamente finito, mayor que 0 y máximo 1e9; sólo moneda USD. Propiedad presente con undefined/null/boolean/string/NaN/infinito/0/negativo es inválida. ARS rechaza incluso 1. Obligatoria para fila USD nueva o cambio de unitCost respecto al original. Sin default, consulta de cotización ni FX inferida. Quote válida sin cambio de costo NO recotiza filas conservadas.

Output de fila USD nueva/repreciada:

- costoUnitario y costoUnitarioPresupuestado: base USD nueva; subtotal/total/monto siguen USD.
- costoUnitarioPresupuestadoARS: unitCost * exchangeRate, multiplicación decimal sin redondeo visual.
- presupuestoCompraEdicion: {moneda:'USD',costoUnitarioUSD,costoUnitarioARS,cotizacion,operationId,ts,uid,usuario}. Tiempo e identidad son del servidor.
- edicionesCompra[id].cotizacionEdicion: {moneda:'USD',cotizacion}, con autor/tiempo ya presentes en ese registro. anterior.items conserva originales completos, incluidas anteriores capturas FX.

No se modifica la captura histórica preparacionCapturada/compraExteriorAplicada/monedaCompra/cotizacionCompra, ni PVP de Sale/IVA/pagos/comisiones. publicPrice del DTO sigue ARS. Para Sale/List, el presupuesto actual costoCompraUnitario/costoUnitario usa nuevo ARS derivado; Order conserva USD. Sólo se actualizan costos autorizados, total de costos y margen. Header/qty sin cambio de costo conserva presupuestoCompraEdicion y costoUnitarioPresupuestadoARS originales, incluida su ausencia legacy. Joint transmite declaración sin default FX.

Main/E/UI: ampliar whitelist de declaration para exchangeRate y validar antes de Policy. Modelos exportan plan como antes; Manual exporta además editFX(order,body,reject?) como helper puro usado por Linked, sin IO/autoridad. No se tocaron wrappers/Policy/wire ni se acredita integración HTTP de este campo.

29 pruebas adicionales: quote inválida/omitida, límite y overflow, 2.125 USD *1234.5=2623.3125 ARS, roundtrip sin quote nueva, compra conjunta USD, recepción con cotización 1250 diferente sin reescribir presupuesto. Total final 202 PASS/0 FAIL/0 SKIP sobre los siete archivos de prueba ya indicados; sintaxis tres modelos y diff-check correctos. Sin commit.


Ajuste final de órdenes compartidas: 3 pruebas más (202 total). Cabecera proveedor/fecha y reducción propia de cantidad pasan, preservando Sale/List y reservas ajenas. Reprecio de línea compartida sigue REVIEW; aumento de destino venta suma cobertura de otras órdenes y sólo se permite dentro de necesidad. No se rechaza por mera existencia de otra OC.
