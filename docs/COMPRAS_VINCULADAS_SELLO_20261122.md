# Compras vinculadas: plan y sellos locales, todavía OFF

Base del frente: `8c48e583`. No modifica producción, reglas remotas, versión, UI ni rutas HTTP. El principal integra por separado los hooks mínimos del coordinador, conservando el contrato Stock de E y `queryPageFresh` central.

## Alcance implementado

El comando existente puede admitir fuentes vinculadas sólo con `linkedEnabled:true`, admisión de cohorte común verificada y coordinador con cuentas, historial e índice financiero preparado. Ambos indicadores siguen OFF por defecto. Lee la orden con permisos del operador; Venta, lista y otras órdenes referenciadas son fuentes internas del servidor, nunca se devuelven al operador. Valida sus vínculos y originales otra vez antes de confirmar.

El plan conserva autor, precios públicos, snapshots de presupuesto/proveedor y cantidades vendidas. El registro enlaza sólo su propia orden y reserva stock capturado en la preparación; una reserva previa requiere prueba de operación, no una casilla aislada. La recepción concilia el costo por renglón con el modelo canónico existente y registra inventario, orden y costo actual juntos. La cancelación afecta pendientes; no elimina recepciones históricas. Pagos, gastos/comisiones, movimientos de cuenta y trabajos pendientes quedan fuera del plan.

`Policy.begin` compara el RAW completo antes de cualquier proyección. `sealDerived` comprueba fuentes y resúmenes esperados, admite exclusivamente las derivadas internas conocidas y sella el patch final completo. La validación posterior no excluye prefijos técnicos: agregar, alterar o quitar una derivada invalida el sello. `getSourceAuthority(actor,lease,basePatch)` no hace IO; WeakMap, actor, lease, fence, digest de entrada, rol/revisión/permisos y hash completo vinculan la autoridad. Distingue RAW de derivado sellado.

La excepción de costo automático se limita a recepción tipada de su Venta fuente. No permite cambiar precios, cantidad vendida, identidad, autoría, pagos ni comisiones. La corrección humana conserva sus permisos `detalle` y `ventas.corregirCosto`.

`purchase-source-cost-protocol` propone el prefijo reservado `svPurchaseSourceCost`: sanea todo el prefijo entrante, emite versión cero por defecto y versión uno únicamente para recepción de Venta escrita con patch derivado sellado. El hook del store se entrega en un commit posterior separado: reserva cero en todo override y calcula autoridad para el PATCH final sin IO. El grant acotado por Venta y su revisión de B/root siguen pendientes. No hay ruta nueva ni acceso concedido en el padre `ventas`.

## Evidencia local ficticia

- 164/164 PASS: todos `purchase-inventory-*.test.cjs`, `sale-cost-correction.test.cjs` y `commission-generation.test.cjs`, antes de agregar el caso del protocolo reservado.
- 23/23 PASS adicionales focales: comando vinculado, protocolo reservado y política después de ese caso. Incluyen los casos anteriores relevantes, no son un total acumulable.
- 22/22 PASS focales posteriores con store REST real y transporte ficticio interceptado: la recepción sellada emite versión uno ligada al hash completo enviado; claims entrantes, campos desconocidos del prefijo y un escritor ordinario quedan en cero. No hubo conexión de red.
- Generador nativo `systemGenerate` ejecutado tras recepción/cancelación: trabajo completado reutilizado; trabajo pendiente con comisiones previas devuelve existente. Bases, porcentajes, pagos y trabajos se comparan íntegros antes/después y no cambian.
- Pruebas negativas de fuente concurrente, preparación incompleta, cobertura financiera alterada, permiso revocado, capacidad serializada, hash distinto y metadatos técnicos inyectados.
- Sintaxis de los archivos del bloque y `git diff --check` comprobados. Suite global a cargo del principal.

## Límites y próximo bloque

No prueba RTDB real con el grant SourceCost nuevo ni despliega reglas. La composición previa de siete casos del emulador corresponde al ingreso manual, no demuestra este nuevo grant vinculado. No crea órdenes nuevas: el comando lee una orden existente. Creación manual, preparación/listas, compras conjuntas, stock sin renglón de compra y cambios de cantidades que requieren replantear la preparación siguen pendientes; los casos ambiguos se rechazan sin escribir. Tampoco adapta todavía el backend existente de eliminación administrativa al mapping físico. No activar el corte SDK ni anunciar Compras terminado con este hito.
