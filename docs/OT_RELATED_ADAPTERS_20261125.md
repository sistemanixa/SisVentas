# Adaptadores puros para llamadores OT

`js/modules/ot-related-adapters.js` exporta CommonJS y `window.SVOTRelatedAdapters`. Sin SDK, red, flags ni capacidades emitidas por el cliente. El servidor puede importar exactamente el mismo módulo. **Los planes no autorizan escrituras**: el escritor anfitrión debe autenticar, leer originales completos autorizados, comprobar permisos vigentes/asignación, CAS y validar el parche completo antes del commit.

## Venta adicional

`additionalSale({ot,otKey,sale,saleKey,actor:{uid,name},at})` recibe originales y la venta ya validada por el escritor financiero. Devuelve `{related,materiales,audit,entry,requires,physicalDelivery:false}`. `related` contiene exclusivamente `OT/materiales`, `OT/audit`, `OT/ventasAdicionales/saleKey`; no contiene dinero de Venta, inventario ni notificación.

Wrapper mínimo del carrito: construir la venta con SVSaleWriter.prepare; pasarla a este adaptador en lugar de `otMaterialesConAdicionales`; añadir la notificación mediante su autorización nativa existente; pasar related a SVSaleWriter.commit. El servidor debe volver a derivar/validar el plan contra el OT original y la venta efectivamente aprobada, nunca confiar en related cliente. Requerimiento OT: **corregirMateriales**, no editar ni editarDatosAdministrativos por sustitución. La autorización financiera continúa independiente. El evento debe usar actor y fecha ligados al comando servidor; el cliente no establece auditoría confiable.

Las filas nuevas se agregan sin mezclar con las históricas: entregada/instalada cero, custodia falsa, sin stockPendiente ni recibo inventado. Conservar precios y subtotales acordados sin redondeo/reprecio. No llamar otCustodiaCompletarStock como efecto de este plan: no existe entrega física aún. Repetición con el mismo saleKey se rechaza como nuevo plan; la recuperación idempotente corresponde al recibo del escritor.

Inventory standalone ahora resuelve destinoVenta nueva mediante `ot-standalone-destinations` privado: índice ventasAdicionales del original completo + destino de fila + Sale RAW leído como usuario + FK otId/otNumero + cliente y displayId exactos. Conserva los tres campos principales de venta ausentes; no genera venta ficticia. La corrección de cantidades/precios de una venta original no es este contrato: mantiene su autorización financiera y revisión física propia. No habilitar WholeOT por montar sólo este helper.

## Soporte con reclamoCambios

`supportChanges({claim,claimKey,ot?,otKey?,sale?,saleKey?,reclamoCambios,actor:{uid,name},at})` devuelve `{changes,requires:{support:'resolver',otRelation},structure}`. Rechaza campos fuera de la lista cerrada de estados/resolución y referencias. Ignora el historial y timestamps enviados como evidencia; reconstruye un único evento desde el historial original, actor y hora servidor. Comprueba identidad, cliente y referencias ya presentes. No acepta claves nuevas dentro de reclamoCambios como autoridad.

`structure` es null sin OT; con OT es `{otKey,kind:'claim',changes:{reclamoFbKey,ventaFbKey?}}`, para el plan Structure existente. Es una descripción para composición **en una sola transacción**, no una orden de hacer dos commits. Los FK recíprocos y la proyección completa de Reclamo siguen siendo derivados/validados por Structure sobre originales completos. No reutilizar Metadata para permitir estados/historial de Soporte: su autorización resolver permanece independiente. Sin OT debe usarse el escritor Soporte/Venta existente; no emitir cap OT falsa.

El wrapper raíz debe proporcionar originales autorizados, construir ambos planes bajo la misma lease y comprobar su parche completo/CAS. No ampliar GenericGateway a cambios OT genéricos. Un helper ausente o error no autoriza fallback SDK cuando la cohorte está instalada. No se añadieron familias ni grants para estos adaptadores.

## Count / Reclamo / notas

`ot-physical-write-policy.claims` acepta Count únicamente con `Count.token`, `Count.isBound` y revalidación asíncrona `Count.validate` sobre **todo** el parche y originales/permisos frescos. Pasar `operationalSummaries:true` cuando el commit incluye esas proyecciones; el valor determina qué proyecciones servidor se reconstruyen, no omite la validación. Un grant booleano cliente no sirve.

Structure sólo modifica Reclamos en `create` y `claim`. El grant de proyección completa debe quedar limitado al ClaimKey sellado, Kind exacto, fence/revisión/generación y permisos vigentes, después de validar el parche íntegro con validateStructureSource. Otros tipos Metadata/Structure no reciben ese grant.

La ruta optimizada `SVLaborWrites.writeOTNote` del activo16 se conserva: no se cambia aquí por una lectura SDK de OT ni por un guardado completo Metadata. El gateway raíz debe mantener su escritor de nota tipado estricto y CAS/actor servidor; no hay cambios a ese archivo compartido desde este frente.

## Entrega standalone de adicionales

No cambia endpoints, DTO ni familias/claims. El controlador carga cada venta destino del original con getAsUser y la vuelve a comprobar con readFreshAsUser antes del commit. `ot-standalone-destinations.bind` requiere Inventory genuino + lease/op/digest + hash completo original. Su prueba privada liga copias de ventas al actor/lease; allocation sólo puede resolver identidades originales de fila. No se aceptan JWT flags, capacidad clonada, destino retargeteado, venta ajena, ausente o resumen. Los snapshots comerciales permanecen iguales.

El mapa heldByOthers usa `[inventoryKey,allocation]`, incluso cuando varias filas comparten producto/J: la reserva de OT base no se confunde con custodia de la venta extra. Recibo físico conserva `venta=extraSaleKey` y el hash de recibo por OT/fila/R/destino. State verifica el mismo destino en historia y rendición; consume/return/release/close transportan el contexto servidor original. P/J/R siguen separados y sólo se escribe J.

SourceAuthority admite las ventas originales **sólo como evidencia de lectura** sellada y las verifica frescas. Su whitelist de patch continúa negando cualquier escritura financiera/estado/audit de esa venta en familia Inventory. No requiere broadgrant sobre Venta ni claims nuevos. Empaquetar el nuevo `cotizador/ot-standalone-destinations.js` junto con los módulos consumidores: falta de módulo no equivale a OFF.

Pruebas nuevas: seis de recorrido standalone adicional (shortage explícito, cancelación de preview sin efectos, instalación sin segundo débito, retorno limitado, replay, fuente/capacidad adulterada, cambio durante fase fresca y separación de reservas base/extra) y una composición adicional con núcleo E firmado P/J/R distintos. Las nueve composiciones E existentes pasan; 60 regresiones focales Inventory/close/Source/Physical verdes, siete Warehouse v2 verdes. No Chrome ni puerta global nueva.

Evidencia local ficticia: 7 pruebas del adaptador (incluido uso browser sin SDK y todos los estados cerrados de Lifecycle), 19 de Physical con Count genuino, clonación, adulteración y revocación. Sin prueba Chrome adicional, flags remotos, datos reales ni publicación individual.
