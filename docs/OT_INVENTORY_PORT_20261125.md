# Port Inventory/State sobre base15

Restaurados sólo consumidores OT y capacidades estables0a; no OfficeStock/E ni shared Guard/Store/runtime ni aplicación activa. State vuelve a exponer referenceOperation, withReferencePort, bindReferenceLease, resolveStockReference, originalReference y contexto standalone en verifyReceipt. Se mantiene close editar de d55 y optimización medida ad034032. Registros originales sin venta exigen los tres campos ventaFbKey/ventaId/venta exactamente vacíos.

Composición P/J/R probada con núcleos E80148c2e y contrato B b611c106 exportados por Git/hash a tmp, sin depender de WIP:20PASS en fixtures firmados consume/return/release y linked wire. Conjunto Inventory/Lifecycle/Metadata/Count/physical-close:204PASS,2SKIP condicionales,0FAIL. Fuente Lifecycle+Guard/RESTStore validada directa:3PASS, incluido patch adulterado y flags falsos. No acredita Order ON remoto.

Hook root: require(ot-stock-source-authority).isBound(actor) identifica sello privado; await validate({actor,lease,patch,readFresh,operationalSummaries,now}) acepta sólo plan original post-modelo más proyecciones nativas exactas y recibo propio. Sello instalado en Life/Delivery/Inventory. Count tiene módulo separado ot-office-count-policy y mismo contrato, c02c988c. Nunca permitir por operation string o boolean cliente. Los módulos de autoridad no montan hooks compartidos.

Rutas Inventory GET /ot/inventario/disponible y POST /ot/inventario. POST exacto {id,otKey,expectedOTHash,kind,changes}; consume/release/return/close. isInstalled debe ser puerto servidor conservador fresco, jamás flag cliente. mapped exige resolver y createReferencePhase reales. El mismo Lifecycle debe pasarse para wire linked y recibo exacto. Metadata sigue separado. Helpers deben cargarse al integrar app; missing/403/503/ACK incierto no admite SDK fallback.

Pendientes: primera entrega standalone, alta y relaciones tipadas, integración SourcesC/Rules/Store, composición completa ON, Chrome390/1280 y puerta final. Sin publicación ni datos reales.
