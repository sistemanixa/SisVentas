# Repetición de Compras sobre core del principal

Los tests seleccionan mediante variables explícitas una copia local del core del principal. Guard/Store/Policy/E/Numbering y las clases privadas usan la misma fuente; sólo las fixtures comerciales ficticias se construyen en este frente. No se copian Guard/Store históricos ni se reemplazan callbacks de autorización productiva.

Resultados sobre finish-pending-20261125 con hooks nativos del principal:

- purchase-actions: 16 PASS, incluidas preparación/cancelación, conciliación USD, grupo/desgrupo, cierre, creación y cambios de permisos/fuentes.
- joint command: 5 PASS, recepción de venta/extra, recibir→conciliar→cancelar de ambos, y edición USD conjunta con base USD/captura ARS y comisiones pagadas conservadas.
- list reserve + generation modes: 15 PASS, reserva conjunta en una rama física, ACK perdido, single/joint/stock, numeración atómica y conflictos.
- initial command: 4 PASS, inventario original null con prueba privada genuina, reserva de número y pendiente una sola vez, phantom que aborta e inicialización de compra Stock sin venta/conteo inventados.
- manual-create-core: 10 PASS tras conectar OrderC del principal. E genuino + Guard + Store REST real, transporte HTTP ficticio interceptado; Financial/History y OrderProjection activados en el caso específico. La aserción usa svStockOrderWriterVersion del contrato B real; no se cambió para aprobar.

Las cuatro primeras familias usan almacén coordinado de memoria; la última usa el Store REST con transporte interceptado. Ninguna acredita por sí sola Rules RTDB o emulador. Las fuentes del principal cambiaron durante la integración; esto es evidencia focal de composición, no puerta congelada ni permiso de publicar.

Variables para repetir apuntando a una copia local revisada:

- SV_PURCHASE_ACTION_CORE_SOURCE
- SV_PURCHASE_JOINT_CORE_SOURCE
- SV_PURCHASE_RESERVE_CORE_SOURCE
- SV_PURCHASE_GENERATION_CORE_SOURCE
- SV_PURCHASE_INITIAL_CORE_SOURCE
- SV_PURCHASE_CREATE_CORE_SOURCE

Default de cada test: su propio checkout. Son rutas de prueba, nunca campos aceptados por las API. Logs privados en C:/SisVentas/tmp/purchase-*-root-20261125.log y purchase-manual-core-root-OrderON-20261125.log. SourceCost V2 y las familias privadas sólo proceden de capacidades genuinas; se conservan los negativos. El primer pase manual dejó un fallo OrderC real antes del hook, registrado y no omitido.

Siguiente paso del principal/B/E: emulador con reglas nativas/Numbering/SourceCostV2, fuentes congeladas, wiring de rutas/capacidades, activos y puerta integral. Ningún dato real, reglas remotas o producción fue modificado por este frente.
