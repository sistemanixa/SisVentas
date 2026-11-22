# Revisión OT del contrato de vínculos Stock

Revisión de sólo lectura del contrato `docs/STOCK_VINCULO_CONTRATO_20261122.md` en `60cf871c1fe21ea386a24942afeb8ae8a8879ba5`, realizada el 22/11/2026. Código contrastado: base `060c77f8` del frente D; no se evaluó ni modificó el WIP de E. Este informe no afirma que los consumidores propuestos estén implementados o habilitados.

Responsabilidades acordadas: E implementa el contrato y sus consumidores; A revisa guard y SDK. D entrega esta revisión documental. Sin cambios funcionales, datos reales, reglas, permisos, despliegues ni nueva suite.

## Tres identidades que no deben confundirse

| Identidad | Uso |
| --- | --- |
| Producto canónico | Catálogo, clasificación física/servicio y referencias comerciales nuevas. |
| Clave física del inventario | Ruta que contiene saldos, asignaciones y ledger que se debe leer y actualizar. |
| Identidad histórica usada al emitir el recibo | Reconocer el recibo, sus firmas y el replay original. No sustituirla automáticamente por la clave canónica ni por la ruta física actual. |

El resolver puede devolver las identidades separadas junto con la revisión y la evidencia del mapping. Esto no exige reescribir documentos antiguos ni introducir un campo inferido en sus registros. Si el origen histórico no se puede acreditar inequívocamente, se bloquea con un motivo identificable; no se escoge un candidato ni se genera otro recibo.

### Evidencia puntual ya obtenida

En `cotizador/ot-physical-confirmation-model.js`, `confirm` construye la identidad con OT, fila, producto y asignación; el hash de firma incluye además tipo de acción, cantidades y actor. En `cotizador/ot-material-state.js`, `legacyReceiptIdentity` incluye OT, fila numérica, producto, destino, venta destino y fecha de agregado.

Una reproducción pura en memoria confirmó una entrega ficticia con producto `oldCode`. Repetir el mismo identificador y recibo pasando ahora `canonical` produjo «El intento ya corresponde a otra confirmación». Repetir con la identidad original devolvió `replayed:true`, el mismo recibo y el inventario idéntico. No se guardó nada ni se modificó el planificador. Esto acredita la sensibilidad de esa firma al cambio de identidad, no una prueba del futuro resolver de E.

## Qué se conserva y qué puede evolucionar

La asociación, por sí sola, conserva byte a byte todo el inventario físico, incluidos costos, saldos, asignaciones, rendiciones, confirmaciones, regularizaciones y conteos. También conserva OT, firmas documentales y remitos anteriores.

Permanecen congelados los identificadores históricos de `stockRegistro`, OT, fila, asignación/venta y destino, el origen usado para emitir la identidad, los registros anteriores de `confirmacionesOT`/`regularizacionesOT`, sus firmas y los recibos/digests de operación. Un remito ya emitido conserva sus ítems, producto/código, cantidades, fechas y firmas.

No confundir esa conservación con inmovilizar para siempre el estado de `rendicionesOT`: su revisión, cantidad instalada, origen de consumo, reserva pendiente y unidades recibidas evolucionan por las acciones físicas normales autorizadas. La asociación no cambia esos valores; la instalación, corrección o devolución posterior sí puede hacerlo conforme al ledger original y sin repetir efectos.

## Matriz mínima para la implementación

Notación: L asociación; D entrega; I instalación; C corrección de rendición; R recepción de devolución. Cada intención nueva tiene su identificador propio; el replay conserva el identificador y payload originales.

| Orden | Resultado obligatorio |
| --- | --- |
| L → D → I | Entrega e instalación usan el mismo inventario físico; un consumo por cantidad instalada. |
| D → L → I | La instalación encuentra el recibo emitido antes del vínculo, preserva el remito y consume una vez en el ledger original. |
| D → I → L | La asociación conserva todo el inventario; no vuelve a consumir ni regularizar. |
| D → L → R | Sólo se reciben cantidades clasificadas como devolución pendiente y respaldadas por su reserva/recibo original. |
| D → I → C → L → R | La corrección libera según el origen registrado; la recepción devuelve a General una sola vez. |
| D → I → L → C → R | Mismo efecto físico y mismas protecciones que el orden anterior; L no es una corrección de stock. |
| D → R → L → I, sin otra D | Rechazar instalación de unidades ya devueltas; no recrear entrega o reserva por inferencia. |
| D con ACK perdido → L → consulta/replay de D | Resolver la operación original confirmada sin otro remito, consumo o regularización. No reinterpretar su identidad por el vínculo nuevo. |
| Operación física concurrente con L | Exclusión compartida y revalidación de fuentes: una preparación obsoleta se rechaza o recarga; nunca dos inventarios para una misma existencia. |

En todos los órdenes, verificar saldos globales y por asignación, reservas ajenas, recibos, remitos y conservación de importes/documentos comerciales. Un resultado incierto no se convierte en éxito o rechazo definitivo sin verificar el intento.

## Ajustes mínimos concretos a coordinar

1. **Resolver separado y compatible.** Añadir la referencia compuesta sin hacer pasar `inventoryKey` por `productKey`. Mantener el retorno string de `State.resolveProduct` o adaptar explícitamente todos sus consumidores. Catálogo e identidad histórica requieren evidencia propia.
2. **Devoluciones también.** `ot-lifecycle.js`, rama `kind==='return'`, construye directamente `sisventas/inventario_operativo/<producto>` a partir de `products[...]._key`; no pasa por `resolveProduct`. Debe usar la misma referencia física verificada, conservando la asignación original. Actualizar sólo entrega/custody deja esta ruta divergente.
3. **Hash y recibo previos.** La elección de recibo en lifecycle y `State.legacyReceiptIdentity` no deben recalcular con una clave nueva un movimiento ya emitido. Usar `stockRegistro` y el origen autoritativo acreditado; ambiguo implica rechazo, no otro recibo. Tampoco reescribir remitos para acomodar el mapping.
4. **Custodia de otras OT.** Los filtros de relacionados y cálculos `heldByOthers` en lifecycle y `ot-delivery-model` deben agrupar por inventario físico más asignación. Una fila antigua con otro alias no puede quedar fuera por comparar `productoKey` o código antes de resolver. Conservar la cobertura de originales y las reservas de otras ventas.
5. **Validación de commit.** `ot-delivery-commit-protocol` vuelve a llamar a `State.resolveProduct` y `State.verifyReceipt`, y agrupa validaciones por producto. La preparación del comando y la validación del store deben resolver coherentemente la misma existencia y el mismo recibo. No relajar guard, claims o validación genérica para hacer pasar un mapping; si hace falta ampliar ese alcance, coordinarlo con A y el integrador.
6. **Revalidación y replay.** Fijar mapping directo/inverso, aliases, catálogo e inventario bajo la exclusión común y revalidarlos antes del commit. La consulta/replay de una operación ya confirmada debe conservar su identidad y efecto originales. Una operación nueva usa la asociación vigente y verificada, sin sustituir asignaciones por venta ni permisos.
7. **Consumidores heredados.** `ot-stock-consumption-model.sync` y el conteo desde OT requieren el mismo contrato o un bloqueo explícito antes del corte. Dejar un escritor anterior activo permite volver a abrir la rama física equivocada.

## Límites y continuidad

La matriz es un conjunto de condiciones de aceptación para el trabajo de E, no una matriz ejecutada contra su WIP. La única reproducción adicional fue el planificador puro descrito arriba. No hubo consultas remotas, navegación del usuario, operaciones reales, archivos de respaldo, cambios de código ni nueva suite. Esta entrega documental no habilita un corte ni reemplaza las pruebas integradas posteriores.
