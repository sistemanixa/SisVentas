# Descriptor de integración OT · cuatro familias

Las salidas literales de token() son autoridad privada de servidor; no aceptar JSON/claims del cliente. Root debe sanear prefijos y emitir defaults Version0, bitsfalse, clavesnull antes de Object.assign de políticas genuinas. Todas requieren UID autenticado=actorUid, mode commit usuario, opId/digest/fence iguales al guard vivo y rol/permiso/revisión/config actuales. Ningún parentgrant RTDB general; condicionar el ancestro que realmente otorga SDK. Actor.operation, svOTDeliveryUnchanged o svOTPhysicalUnchanged por sí solos NO son autoridad.

## Lifecycle

Policy ot-lifecycle-policy.token(actor,lease): svOTLifecycleVersion, svOTLifecycleOTKey, svOTLifecycleSaleKey, svOTLifecycleKind, svOTLifecycleRole, svOTLifecyclePermissionRevision. Kinds close/custody/return/stockrepair/delivery/release. No emite Generation/Fence propios: conserva bindings comunes mode/fence/opId/digest/actorUid y configuración/attestation/proyección verificadas existentes. Close exige editar vigente (false explícito deniega; vendedor defaultdenegado, true explícito admite; técnicos asignados frescos). Delivery/release administración+entregarMateriales; return entregarMateriales; custody rendirMateriales; stockrepair ajustarStockOficina. Root/B conservar restricciones reales y código actual, no reconstruirlo desdebase37.

## Inventory

Policy ot-inventory-policy.token: svOTInventoryVersion, svOTInventoryOTKey, svOTInventoryKind, svOTInventoryRole, svOTInventoryPermissionRevision, svOTInventoryGeneration, svOTInventoryFence. Kinds consume/release/return/close/delivery. Sólo original completo con ventaFbKey/ventaId/venta exactamente undefined/null/''. Linked consume/return delegan wire original a Life genuino, linkedrelease usa Life.release. No venta simulada. Consume=rendirMateriales; delivery/release=entregarMateriales administración; return=entregarMateriales; close=editar. Mapped exige coreadmission y puertos reales. No campo cliente de modo autoriza escritura.

## Count

Policy ot-office-count-policy.token: svOTCountVersion, svOTCountOTKey, svOTCountProductKey(P), svOTCountInventoryKey(J), svOTCountRole, svOTCountPermissionRevision, svOTCountGeneration, svOTCountFence. No Kind arbitrario. Capacidad WeakSet ligada a UID/op/original; sello exacto posterior. Antes de planJ/Generation sonnull y NO admiten negocio. Gen sólo desde activation verificada por resolver mapped con readsetfresh. Legacy no certifica mapped. Exigir acción ajustarStockOficina, cfg obligatorio, revisión, reset y técnicoasignado frescos. Countcerrado puede portar ADEMÁS Life.stockrepair genuino para sus dos leafs venta estadoInst/audit; no inventa Life en abierto/sinventa. Recibo immutable guarda J para replay autorizado.

## Metadata (incluye alta/relaciones, sin quinta familia)

MetadataPolicy.token/validate delegan sólo a Struct privado genuino cuando corresponde. Salida común svOTMetadataVersion, OTKey, Kind, Role, PermissionRevision, Generation, Fence, Administrative BOOL, Editing BOOL, Creating BOOL. Normal: details Admin=true/Editing=false/Creating=false; demás Editing=true/Admin=false/Creating=false; batchOR exacto de tipos sellados. Alta kindcreate: Creatingtrue/Adminfalse/Editingfalse, exige crear. Relaciones assignment/client/sale/additionalSales/claim: Admintrue/Editingfalse/Creatingfalse, exige editarDatosAdministrativos. Todos los bits requeridos se verifican AND; no OR que permita recuperar un permiso revocado.

Para Struct SOLO después de sellar plan: svOTMetadataSaleKey y svOTMetadataClaimKey son NEW keys derivadas del patch real; svOTMetadataPreviousSaleKey/PreviousClaimKey proceden del OT ORIGINAL sellado. Null cuando no existen/no se escriben. No retarget silencioso de Sale/Claim existentes; referencia contradictoria o historia ambigua rechaza. NO emitir ni confiar en flags cliente. Metadata ordinaria deja estas clavesnull en defaults Root.

Alta OT+counter ordenTrabajo+FKs usa mismo endpoint GET/POST /ot/metadata (Root despacha MetadataPolicy.structureKinds al handler createOTStructure). Misma config sv_ot_metadata_config, alta además numberingFloor servidor+counter válido+índiceOT certificado. Body create nootKey/hashcliente; llave determinística UID/op y número servidor. Body relaciones id/kind/otKey/expectedOTHash/changes. Source completo leído con usuario y preservado: Sale FK leafs otId/otNumero/otGenerada/reclamoKey/reclamoFbKey/reclamoId; Claim FK leafs otKey/otFbKey/otId/otNumero/ventaKey/ventaFbKey/ventaId. Únicamente esos leafs más OT/counter y proyecciones exactas; ningún campo monetario. Sin venta ficticia; precios de original Sale se conservan exactos, snapshot links existente no se recalcula.

## Source validators Guard/Order · invocación exacta

1. ot-stock-source-authority.isBound(actor): await validate({actor,lease,patch,readFresh,operationalSummaries,now}). Sólo Life/Inventory genuinos+patch original completo sellado, fuentes actuales y proyecciones nativas exactas; recibe patch final con guardnull/recibo propio. Clones/patch alterado niegan.
2. ot-office-count-policy.isBound(actor): await validate con mismo shape. CapCount genuina+OT/J originales, eventual Sale.sóloestadoInst/audit, perfil/config/lease. No callbacktrue por operación.
3. MetadataPolicy.structureIsBound(actor): await validateStructureSource con mismo shape. Snapshotoriginales completos (OT, Sale, Claim, client/product/employee/counter/config leídos), reconstruye RecordList OT/Claim, compara PATCH ENTERO y niega extras de negocio. Precios/total/items de Sale no se escriben ni rederivan. validatePatch es sólo igualdad RAW estricta; para parche proyectado usar SIEMPRE async validateStructureSource.

ReadFresh y lease son los reales del guard. Proyectores adicionales conservan su propia validación; whitelist técnica no otorga fuentes de negocio. Root hace Store/defaults/sanitize/runtime/Docker/Rules y mantiene versiónreal+paralelismo+summaryDigest capturados. No montar parcialmente WholeOT antes de migrar callers restantes.

## Entrega futura v2 y pendientes reales

Código funcional en ot-warehouse-receipt/stock y consumidores D; 7 integración con Guard/REST Store y 4 Chrome390/1280 (linked+standalone) pasan. Nuevos recibos warehouse.schema2 capturan por operación quantity/debitedGeneral/debitedReserve/shortage y devueltos con/sin crédito. Prueba parcial devuelve máximorespaldo realmente descontado que siga en custodia; instalado real no puede acreditarse mediante devolución de faltante. Instalar no baja General otra vez. Legacy v1 no se retaga/recalcula; v1 seleccionado para conversión v2 requiere revisión individual.

Handshake DTO: changes.confirmacionStock={sourceHash,rows:[{index,cantidad,descontadoGeneral,descontadoReserva,faltante}]}. No flag de autoridad: rol/permiso/CAS/genuinecap se comprueban siempre. Falta confirmación o source cambió→409 código SV_OT_SHORTAGE_CONFIRMATION_REQUIRED / SV_OT_DELIVERY_QUOTE_CHANGED, svLaborAttemptedfalse y deliveryQuote del modelo. Root usa Warehouse.errorDetails(error) (sólo warning de modelo privado) para serializar DTO. Cliente muestra segunda confirmación; Cancelar0 efectos; nuevo intento con cantidades exactas; carrera últimaunidad invalida quote. No SDKfallback.

Linked usa versiónSERVIDOR sv_labor_config.otWarehouseVersion2, con attestation/closure/cfg fresca; no habilitar por bandera cliente ni antes de cierre completo. Nuevo standalone delivery ya usa v2. Root debe incluir nuevos módulos en composición y validar código/modelos con SourceC/Rules; no publicar módulosbase37 sobre runtime16. Life/Delivery candidato preserva activation/protocol/authority paralelos y summaryDigest de imagen; falta composición final de imagen con TODOS los módulos curados.

Faltantes para corte final: wiring app/Store/Rules/runtime del coordinador; SVSaleWriter.related de materiales+ventasAdicionales y resolución Soporte reclamoCambios requieren adapters tipados de sus escritores existentes, no genericMetadata; cierre de todos esos callers antesWholeOT. Warehouse V2 no modifica campos OC/A, ni retaga asignacionesCompra legacy. No claim de producción/gatecompleta. Sin publicación individual ni datos reales.
