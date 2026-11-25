# Entrega UI Compras · 25/11/2026

Slice de UI en `codex/purchases-complete-20261125`, integrado mediante merge de tres vías desde el ancestro 060c77f8 y UI59781fce/8308c7fc sobre la base publicada37e1cbab. No se reemplazaron archivos enteros sin comparar; se conserva el borrado revisado publicado y sus vínculos concurrentes.

Archivos de producción propios: `js/modules/purchase-orders.js`, `js/modules/purchase-command-adapter.v1.js`, `js/modules/purchase-command-form.v1.js` (recuperación autorizada explícitamente), `js/modules/exterior-preparation.js` (dos ajustes de cabecera responsive; sin cambiar cálculo). Pruebas nuevas propias: `test/browser/purchase-command-ui.cjs`, `test/purchase-edit-destination.test.cjs`, `test/purchase-ui-contract-current.test.cjs`, `test/purchase-preparation-v5-ui.test.cjs`. No se editaron backend, Guard, Store, runtime, Docker, index, SW ni activos inmutables. No stage/commit propio: el coordinador hará stage explícito del slice en este worktree compartido; los commits backend concurrentes no son una entrega UI.

## Contratos implementados

- Alta, edición parcial/cabecera/declaración, recepción, cancelación, enviada y conciliación usan rutas tipadas. Las 13 acciones de `purchase-route-contract.specs` tienen contraste de ruta/campos con el adaptador; el nombre UI `listPreparationCancel` corresponde a backend `listCancelPreparation`, misma ruta `/compras/listas/cancelar-preparacion`.
- CAS de inventario envía `_svReadRevision ?? 0` del original RAW completo, NO `inventarioCompra.revision`. Hash conserva todos los campos persistidos. Historial de inventario es independiente de revisión del documento.
- Nuevos SKU y excedentes de órdenes vinculadas requieren selección Stock explícita. `sourceIndex` conserva el índice original tras quitar filas. Se informa el desglose venta/Stock antes de guardar; no se amplía una venta desde la OC.
- FullEdit conserva moneda original; costo USD y PVP ARS se editan por separado. `declaration.exchangeRate` es número explícito >0 y <=1e9, sólo cuando cambia costo USD o se agrega SKU. Campo `oc-edit-exchange-rate` separado del campo de recepción; no se precarga FX actual ni se reconstruye historia. SKU nuevo en orden USD empieza con costo vacío, sin copiar un precio ARS de catálogo al campo USD. Cantidad/cabecera sin repricing omite la cotización y conserva capturas.
- Recepción/conciliación USD usa `exchangeRate` exterior a declaration con confirmación explícita, base USD intacta y costo ARS separado por backend. No corrige una recepción histórica ambigua usando FX actual.
- Preparación envía decisiones, preferencias y desglose de gastos en whitelist; no manda resultados, baseline/revenue, autor ni timestamps. Sólo comprobante nuevo, máximo un documento de2MiB validado por backend; cuerpo preparar3MiB, guardar512KiB, crear/inventario64KiB y demás16KiB.
- OFF requiere capacidad real explícita. Instalado/no listo, error de red, capability inválida o cambio de generación nunca habilita SDK. El borrado publicado conserva su transporte seguro `SVFinancialCommands` cuando no están cargados los helpers nuevos; no es un fallback SDK y un fallo de capability no cae en ese transporte.
- Recovery usa `SVLaborWriteRecovery`, hash WIRE y `/laboral/operacion`: journal conservado hasta recibo definitivo, sin replay del POST. El formulario queda bloqueado hasta confirmación y conserva borrador/contexto en error. Foco inicial sin temporizador que robe una edición rápida; al editar se oculta el buscador que antes tapaba Quitar.

## Evidencia y límites

52 pruebas focales UI/adapter/form/CAS/contratos/OT/v5 PASS; 74 regresiones de funciones publicadas PASS (exportaciones, borrado revisado con otras OC, vínculos, ahorro, costos y margen). Sintaxis de los cuatro módulos y diff-check del slice PASS. Una corrida inicial de regresiones falló por helper nuevo exigido al borrado publicado y dos casos se corrigieron conservando transporte genuino; una prueba visual adicional no pudo cargar Playwright sin NODE_PATH y no se cuenta como PASS.

Chrome real headless, HTTPloopback exclusivamente ficticio, red externa bloqueada, módulos reales de UI/Recovery: 31 recorridos por cada390/768/1280. Incluye alta, bloqueo por capability no lista, ACK perdido/consulta sin reenvío, edición vinculada y sourceIndex, USDqty/header/costo con FX explícito, recepción/conciliación, enviada/cancelación/delete, preparación v6, guardar decisiones, renombrar, grupos/desagrupar, cierre, preparar->generar y cancelar preparación. Cero escrituras SDK. Capturas ficticias privadas en `tmp/purchase-ui-final-20261125`, fuera de Git. Revisión visual de captura móvil Stock y manual tablet: cabeceras opacas y campos dentro del ancho. Los iconos no se descargan en el fixture aislado.

El servidor HTTP de esta prueba confirma/recupera recibos ficticios: NO prueba ejecución real de todos los modelos, Financial/History/SourceCost, emulador RTDB ni despliegue. ListReserve/listStock/listCreate/legacy tienen contraste de adaptador/contrato; no atribuirles un recorrido nativo exhaustivo si no está en el script. Preparación v5 inequívoca abre revisión separada en v6; requiere confirmar decisiones antes de guardar y envía applyCosts:false. Los ambiguos se rechazan con motivo, sin SDK ni POST. Los confirmados/cerrados conservan su visor histórico congelado. Nuevas autoridades/capturas ambiguas se resuelven en backend, no mediante fallback UI.

Root debe cargar adapter y form antes de purchase-orders en los activos reales y ejecutar composición backend/guard/store/rules/emulador y puerta vigente final sobre su SHA; confirmar whitelist anidada `declaration.exchangeRate`. No se ejecutó suite global en este frente compartido ni se publicó. No se abrió la sesión real del usuario ni se modificaron datos reales.

## Inventario literal de escritores SDK que permanecen (sólo ramas OFF)

Líneas de `js/modules/purchase-orders.js` de esta entrega; no son autores nuevos autorizados por la UI instalada. Se mantienen para no cortar instalaciones OFF reales. Cualquier excepción de capability/transport sube al aviso y NO entra en estas ramas.

| Líneas / función | Escritor o nodo | Entrada que decide modo antes del escritor |
|---|---|---|
| 498 `push`,503 `update`,508 `remove` | fbPush/fbUpdate/fbRemove a la ruta recibida | wrappers con `guardLegacyPurchaseWrite`; además cada entrada semántica consulta su capacidad |
| 557 `createListFromSale`;530/560 actualización posterior | fbRunTransaction listas_materiales y update venta.listaMaterialesId | listCreate |
| 725/739 `savePreparationAndSaleCosts` | SVGuardedWrites.restTransaction lista/ventas/listas hijas, incluyendo aplicación/reanudación | listPreparation; v5 ambiguo bajo installed se rechaza sin mutar; inequívoco guarda decisiones v6 sin aplicar costos |
| 1092 `transactionInventory` | fbRunTransaction inventario_operativo/productKey | guardLegacyPurchaseWrite; usado sólo después de OFF del flujo correspondiente |
| 1167 `confirmPlannedPurchase` | fbRunTransaction lista.compraConfirmacion/simulador | listGenerate |
| 1181 `reconcilePlannedPurchase` | fbRunTransaction órdenes que devuelve current; sigue siendo transacción SDK aunque parezca lectura | listClose |
| 1200 `finishPlannedPurchase` y updates siguientes | fbRunTransaction órdenes; transactionInventory; updates listas/ventas/vínculos | listGenerate, también en reanudación |
| 1516 `cancelExteriorPreparationScoped` | SVGuardedWrites.restTransaction lista/ventas/listas hijas | listPreparationCancel |
| 1615 callback `ocRenombrarCompra` | SVGuardedWrites.restTransaction nombreLista | listRename |
| 1744 callback `ocNuevaCompraConjunta` | SVOperationalWrites.multi listas_materiales | listGroup |
| 1759 `ungroupJointPurchase` | SVOperationalWrites.multi conjunta/hijas/stock | listUngroup |
| 1777 callback `ocNuevaCompraStock` | push lista stock | listStock |
| 1908 `changeOrderStatus` | fbRunTransaction orden; transactionInventory y update cancelación | orderInventory para cancel; orderState para enviada |
| 1917 `syncSalePurchaseCosts` | fbRunTransaction venta.items/costos | sólo invocado desde finishReceipt tras OFF; conciliación tiene su propia transacción de costos |
| 1985/1986 `saveActiveReconciliation` | fbRunTransaction orden y sincronización costos venta | orderReconcile |
| 2082/2098 `finishReceipt` | fbRunTransaction orden; transactionInventory; syncSalePurchaseCosts y listas | orderInventory |
| 2151–2154 `saveManualOrder` | push orden y transactionInventory | manualCreate |
| 2344–2347 `saveManualOrderV2` | transactionInventory y update orden | orderInventory; edición económica USD OFF rechazada |
| 2471+ `migrateLegacy` | push orden y update legacy.migradaA | legacyImport |
| 2479+ `syncOTConsumption`,2488+ `releaseOTLeftovers`,2518+ `receiveOTReturns` | SVOTStock.sync / transactionInventory de compatibilidad | exclusivamente `{installed:false}` de `SVOTInventory`; helper ausente/ACK incompleto/error NO es OFF |

`syncListItemsWithSale` es mutador en memoria; sus persistencias ocurren en createListFromSale/listGroup arriba. `exterior-preparation.js` no escribe Firebase: usa ctx.save/ctx.confirm y deja guardar en el controlador tipado. Los falsos positivos707/1086/1912 sólo comprueban existencia de API;717/736/1509 sólo referencian equal. No se cuentan como escritores.

## Matriz capability -> endpoint/acción backend

| Capability UI | Ruta | Backend |
|---|---|---|
| manualCreate | /compras/ordenes/crear | manual create, kind interno register |
| orderInventory | /compras/ordenes/inventario | kind wire register/edit/receive/cancel; UI usa edit/receive/cancel |
| listGenerate | /compras/listas/generar | generation, kind interno generate |
| orderDelete | /compras/ordenes/eliminar | endpoint existente FinancialCommands; conservar revisión publicada |
| listCreate | /compras/listas/crear | purchase-list-create/create |
| listStock | /compras/listas/stock | purchase-list-stock/stock |
| listSave | /compras/listas/guardar | purchase-list-save/save |
| listReserve | /compras/listas/reservar | purchase-list-reserve/reserve |
| listGroup | /compras/listas/agrupar | purchase-list-group/group |
| listUngroup | /compras/listas/desagrupar | purchase-list-ungroup/ungroup |
| listClose | /compras/listas/cerrar | purchase-list-close/close |
| listRename | /compras/listas/renombrar | purchase-list-rename/rename |
| listPreparation | /compras/listas/preparar | purchase-preparation-save/prepare |
| listPreparationCancel | /compras/listas/cancelar-preparacion | purchase-preparation-cancel/cancel; export backend listCancelPreparation |
| orderState | /compras/ordenes/estado | purchase-order-status/status |
| orderReconcile | /compras/ordenes/conciliar | purchase-order-reconcile/reconcile |
| legacyImport | /compras/legacy/importar | purchase-legacy-import/import |

No hay capability inventada ni callbacks UI que otorguen autoridad. La matriz es contrato requerido por el cliente; la presencia de rutas/ready/claims en runtime la verifica Root. Si falta cualquiera bajo installed, la operación se bloquea con el borrador intacto. La acción nativa reservada no está ejercitada en el Chrome de31; sí tiene prueba de contrato/adaptador y backend debe ejecutar el plan atómico real. No atribuir a esta matriz habilitación, reglas remotas ni corte aplicado.

### Cierre v5 y límites finales

El helper puro reviewLegacyPreparation vive en exterior-preparation (sin nuevo activo). Clona decisiones, exige reparto value y shippingMode insured/uninsured inequívocos y correspondencia exacta de filas. Rechaza manual/quantity, expenseExcluded, método contradictorio y envíos porcentuales o bases no equivalentes. Alias documentado del propio formulario v5: si no existe payment, remote corresponde USDT y onsite corresponde USD; sin elección explícita o con elecciones contradictorias requiere revisión. No se infiere relación USDT/USD1:1: cotizaciones ausentes quedan vacías. Las cotizaciones capturadas se muestran como manuales para impedir actualización automática. No completa precios desde catálogo en esta revisión.

La apertura mantiene RAW/hash originales; checkbox Revisé estas decisiones habilita Guardar preparación revisada. Este guardado envía decisiones v6 y applyCosts:false, sin result ni estampas de aplicación de costos anteriores. Confirmar compra o aplicar costos son acciones explícitas distintas. Native v5 a390/768/1280 prueba abrir->revisar->guardar->ACKperdido->consultar sin replay, más manual/excluded sin editor ni commit. Cero SDK. No acredita backend/rules/Guard/Store; Root integra esos contratos. Evidencia ficticia final tmp/purchase-ui-v5-final-20261125 fuera de Git.

52 focales PASS y24 pruebas puras exteriores PASS. Las74 regresiones publicadas PASS corresponden al cierre anterior, antes de este cambio acotado de v5. Otra corrida adicional de6archivos exteriores dejó fallos en fixtures antiguos que extraen funciones sin inyectar commands(): exterior-apply-scoped, exterior-cancel-preparation y exterior-preparation-flow. exterior-confirmed-ui no cargó playwright sin NODE_PATH. No se modificaron esos fixtures ni se declara verde la puerta completa; Root debe resolverlos/verificarlos en la composición final. El navegador dedicado sí ejecuta los módulos enteros y Recovery real contra servidor ficticio.

Slice final NUEVE archivos: cuatro módulos, cuatro pruebas UI (browser/purchase-command-ui, purchase-edit-destination, purchase-ui-contract-current, purchase-preparation-v5-ui) y esta documentación. Sin stage/commit propio. Código congelado para Root; no más cambios UI después de liberación.

### Identidad final de los cuatro módulos verificados

- `js/modules/purchase-orders.js`: SHA256 `1dcaa5e99977f935b18d8e10af76b32b23655c4d2ea8bafd869d2c6ca79d01db`.
- `js/modules/purchase-command-adapter.v1.js`: SHA256 `02041b48efef7ae42b76ac8f887a7f27b2d51422d329fe8b01907f95ff6bec0f`.
- `js/modules/purchase-command-form.v1.js`: SHA256 `04f92ffa975e4adb468d794fe6402fe43c321c5f35980797c623837b7cd92764`.
- `js/modules/exterior-preparation.js`: SHA256 `19a84346afa6cd29e7f9c2a6778c2c6e9df5e333b54513a7dcfb8232e6efd7fd`.
