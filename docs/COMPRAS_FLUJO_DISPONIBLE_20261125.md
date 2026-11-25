# Compras: disponibilidad física y trazas nuevas

Decisión humana confirmada por coordinación el 25/11/2026: preparar o vincular no inmoviliza existencias; recibir suma al disponible una vez, también para ventas vinculadas y recepciones parciales. La entrega física al técnico descuenta una vez; instalar no vuelve a descontar; devolver repone sólo lo efectivamente descontado. El saldo histórico no se reconstruye ni se recalcula.

## Recepción nueva

`purchase-inventory-model.planReceiptInventory` reduce `enCompra` y suma la cantidad recibida completa a `general`. Conserva los saldos `reservado`, `consumido`, rendiciones y asignaciones previas. Para unidades destinadas a venta añade únicamente `asignaciones[saleKey].recepcionesCompra[operationId] = {schema:2, orderKey, cantidad, ts}`. No convierte esa traza en reserva física.

Cada evento nuevo de `Order.recepciones` lleva `inventoryFlowVersion:2`. Los eventos anteriores se copian íntegros, sin etiquetarlos retroactivamente. `operaciones` y las precondiciones originales impiden aplicar dos veces una recepción; el recibo compartido resuelve la repetición del comando.

La referencia de costo del stock usa todas las unidades efectivamente recibidas, incluidas las vinculadas a venta. En USD conserva la base original y la cotización explícita de esa recepción; su valoración ARS es independiente. Conciliar costos no mueve existencias.

## Vínculo de existencias

`planExistingReservation` conserva el nombre público interno, pero requiere `listKey` y escribe `asignaciones[saleKey].planesCompra[listKey] = {schema:2,cantidad,operationId,ts}`. Comprueba disponibilidad sin restarla. Conserva cualquier reserva histórica y rechaza sustituir un vínculo ya existente. Las listas y generación deben consumir este contrato y guardar `vinculosInventario` descriptivos con CAS; su adaptación se entrega separada.

## Evidencia y límites

37 pruebas focales del modelo de inventario y FX: parciales vinculadas, repetición, preservación de reservas antiguas, stock y venta del mismo producto, cantidades fraccionarias, valoración USD/ARS y marcado exclusivo de eventos nuevos. Log local `tmp/purchase-receipt-v2-20261125.log`.

Estas pruebas puras no acreditan emulador, Rules remotas, entrega OT ni publicación. Los resultados anteriores con recepción a reservado no acreditan el nuevo circuito. Host continúa desactivado hasta completar y verificar composición, listas, UI y entrega física.
