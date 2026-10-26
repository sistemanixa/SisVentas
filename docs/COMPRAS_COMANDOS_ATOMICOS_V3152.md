# Compras: confirmaciones atómicas preparadas para v3.15.2

Estado: candidata local, sin cambios productivos ni operaciones reales de prueba. Este bloque necesita el cierre coordinado de escritores y reglas de Órdenes, Listas de materiales e Inventario operativo antes de activarse.

## Problema y comportamiento

Antes, registrar una recepción modificaba inventario, después costos de venta y finalmente la orden; una falla intermedia dejaba efectos parciales. Conciliar guardaba la orden antes de recalcular la venta. Eliminar ejecutaba efectos de inventario y venta mediante `Promise.all`, por lo que una validación tardía podía llegar después de otra escritura.

Los tres comandos reconstruyen y confirman esos efectos en el mismo PATCH protegido. El navegador envía la intención de compra, nunca un costo total, margen, ganancia o copia de la venta. Una ambigüedad de renglones, cambio de permisos o conflicto conserva todas las fuentes.

## Contrato

- Factory: `createPurchaseSaleCostCommands({authorize, db, guard, now?})` en `cotizador/purchase-sale-cost-commands.js`.
- POST: `/laboral/compras/comando`; recurso cliente `SVLaborWrites.command('compras', fields)`.
- Campos comunes: `id`, `action`, `orderKey`, `expectedOrderHash`. El hash corresponde a la orden autorizada, omitiendo únicamente su `fbKey` local; nunca a una venta privada.
- `receipt`: `movements: [{index, qty, costoUnitarioReal, proveedorKey}]`, o `receiptOperation` para completar una recepción pendiente existente. No se combinan ambas formas.
- `reconcile`: `changes: [{index, costoUnitarioReal, proveedorKey}]` para todos los materiales ya recibidos. Son datos legítimos de la compra; cantidades y venta de destino se obtienen del original.
- `revert`: sin datos financieros adicionales. Revierte inventario, aportes y vínculos y elimina la orden en la misma confirmación.
- Acuse: `{ok:true, committed:true, action, orderKey}`; eliminación suma `deleted:true`. No devuelve la venta, ledger ni costos privados. La recuperación estándar puede confirmar sin detalle; la interfaz no inventa importes o cantidades.

Se conserva la autoridad USER del guard, identidad y reset actuales, módulo Órdenes y el predicado original de escritura de la venta: módulo Nueva venta y responsable exacto, salvo administrador. No se exige `verMargen`, ni se usa modo servidor para ampliar acceso. Las lecturas de órdenes, listas, proveedores e inventario se autorizan con la identidad real; los originales de venta quedan internos. Se vuelven a verificar permisos y cada fuente antes de confirmar.

La matriz de propiedad conserva la expresión USER de las reglas base626817: administrativo propio permitido, sin responsable o ajeno denegado; administrador permitido en los tres casos. Su evaluación exacta con snapshots ficticios queda en evidencia privada; no equivale a compilación, emulador o regla remota aplicada.

## Referencias y costos históricos

Las órdenes nuevas conservan `saleItemIndex` desde la referencia de línea de la preparación. Un origen sin índice sólo se resuelve si existe una coincidencia única; dos productos iguales nunca se asignan por el primer SKU encontrado. Dos claves canónicas contradictorias se rechazan aunque compartan código e índice; el fallback por código exige que falte una clave y que la coincidencia sea única. Se conservan unidades, fracciones, notas, autoría, otros pedidos y campos ajenos. Se mantiene la finalización canónica de los contadores del inventario; lotes, variantes y metadatos no se sustituyen.

El ledger privado `venta.compraCostosAplicados` guarda base y contribuciones por orden. Una recepción acumula su aporte; conciliar sustituye el aporte de esa orden; eliminar retira únicamente ese aporte y conserva las otras compras. `costoUnitarioAntesPreparacion`, pagos y configuración original de comisión se conservan. El DTO comercial y el acuse omiten el ledger.

Para un registro anterior sin ledger se consultan sólo sus `ordenesCompraIds` explícitas (máximo128), nunca la colección completa. Se exige que todas las órdenes, cantidades, importes, recibos y costo histórico permitan demostrar el estado actual. Si falta una prueba o existen duplicados ambiguos, se rechaza con revisión identificable, sin inventar contribuciones ni modificar parcialmente. Una recepción pendiente conserva fecha, instante y autor originales; la confirmación actual mantiene su propia auditoría.

## Consultas y recuperación

No se agrega un sondeo, servicio, reloj o escucha. Sólo una acción del usuario inicia el comando. Todas las lecturas son puntuales y acotadas por la orden, inventario y referencias explícitas. La ausencia de solicitudes de esta fixture no demuestra reposo productivo ni permite deducir una factura.

El guard USER existente cubre recibo, acuse perdido y `resolve`: una repetición idéntica recupera el acuse sin segundo PATCH; un tombstone anterior impide que una solicitud tardía aplique efectos. No necesita ampliar la allowlist de comandos financieros.

Códigos409/503 de rechazo previo: `SV_PURCHASE_AMBIGUOUS`, `SV_PURCHASE_BASE`, `SV_PURCHASE_INVENTORY`, `SV_PURCHASE_LEDGER`, `SV_PURCHASE_LEGACY`, `SV_PURCHASE_LINE`, `SV_PURCHASE_OPERATION`, `SV_PURCHASE_ORDER`, `SV_PURCHASE_PENDING`, `SV_PURCHASE_PROVIDER`, `SV_PURCHASE_QUANTITY`, `SV_PURCHASE_RECEIPT`, `SV_PURCHASE_RECONCILIATION`, `SV_PURCHASE_UNREADY`. Los estados400/403/405/413 conservan sus rechazos terminales. Un error de transporte o confirmación incierta no se convierte en rechazo definitivo inventado.

## Verificación y límites

- 125 pruebas focales PASS, sin skips: 67 del servidor, 15 de cliente y 43 de regresiones de compras, exterior, compras conjuntas, exportación y comisión original. Incluyen el guard real con almacenamiento ficticio, concurrencia, pausa, recuperación, fuentes retiradas y negativas de permisos.
- 12 capturas aisladas en 320/390/768/1280 con módulo y CSS reales: estado normal, procesamiento y error. El botón deshabilitado impide doble envío y Enter no duplica el comando; Cancelar no elimina. Cero solicitudes externas y cero errores en la corrida final. El primer intento de la fixture falló por un cierre de script al incrustar la fuente; otra iteración usaba un selector de texto que cambiaba durante el progreso. Esos fallos no afectaron código productivo.
- El retiro de sesión, pantalla, visibilidad u orden impide que un acuse tardío cierre o pinte una ficha posterior; no cancela una escritura ya iniciada. La actividad del botón se libera tras éxito o error.
- Sintaxis de cliente y servidor comprobada. No se ejecutó SDK real, emulador/JAR, infraestructura, navegación productiva ni escrituras financieras reales.
- La QA visual es del componente aislado; no acredita el arranque completo, todos los formularios ni el comportamiento de la pila global de diálogos. El layout histórico de tabla y su desplazamiento interno no se rediseñan en este bloque.
- Las reglas de los tres nuevos dominios, el despliegue y el drenaje de escritores viejos continúan a cargo del cierre general. No activar el endpoint ni cerrar lecturas originales por la existencia de estos archivos o pruebas aisladas.
