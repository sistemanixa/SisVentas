# Contrato final Materials y Soporte para integración raíz

Sin nuevas familias ni rutas. Antecedentes ya entregados: 5a47a6e1 cierra adicionales standalone (destino Sale real por fila, sin venta principal ficticia); 7120bdca quita SDK GET original redundante de Metadata cuando el hash RAW coincide. Este bloque incorpora los dos llamadores restantes.

## Materials: venta original y nueva

Modelo único en `js/modules/ot-related-adapters.js` (UMD/CommonJS):

- `existingSale({ot,otKey,originalSale,sale,saleKey,actor:{uid,name},at})`: originales completos y Sale final del escritor financiero. Devuelve `{related,materiales,audit,requires,physicalDelivery:false}`. Delta de cantidades por código entre Sale original/final: aumenta con nuevas filas pendientes; reduce exclusivamente filas sin evidencia física. Conserva filas con recibo y sus índices. Si quitar una fila pendiente desplazaría un recibo posterior, conserva esa posición con cantidad/subtotal cero y precio intacto. Reducir por debajo de historia física exige rendición/devolución, con mensaje concreto; no borra la historia. Las filas de venta extra no se alteran.
- `additionalSale(...)`: ya existente, crea nuevas filas pendientes para venta nueva. Ninguno de los dos simula entrega/instalación ni llama CompletarStock como consecuencia comercial. Precios/costos del registro de venta siguen bajo SVSaleWriter; el modelo conserva snapshots OT anteriores.

Ambos se componen mediante `cotizador/ot-material-edit-policy.js` exportado también como `MetadataPolicy.materials`:

`attach({actor,lease,profile,cfg,config,ot,otKey,originalSale,sale,saleKey,patch,at,name,mode:'existing'|'additional'})`.

El gateway raíz registra `PURPOSE='ot-materials'`, **kind atomic**, conserva su actor nativo (no cambia operation), sus permisos/modelo financieros y original readAsUser/CAS/reset/asignación. Una vez validado el registro financiero final, reconstruye el modelo puro con actor/fecha servidor, reemplaza exclusivamente las hojas OT por plan.related y llama attach con ese patch nativo exacto y los mismos at/name. Attach exige expectedHashes de OT y Sale originales, verifica que el resultado exacto del patch Sale sea el Sale recibido, las hojas OT iguales al modelo y Physical.projection intacta. Deniega inventario y otros dominios. Nueva Sale usa originalSale:null y expectedHashes de null. La notificación adicional sólo conserva su autoridad nativa; Metadata no la autoriza.

En SourceProtocol/Store registrar `materials.isBound(actor)` → `await materials.validateSource({actor,lease,patch,readFresh,operationalSummaries,now})` **antes** de emitir claims. No usar purpose/operation/claims como prueba. Se valida todo el patch sellado, OT/Sale/config originales frescos, perfil/permiso vigente, lease/fence/recibo y proyección RecordList OT exacta. Validar por separado los projectores/finanzas existentes; este permiso sólo autoriza OT. Metadata.token/validate ya reconocen la prueba privada, también con host operation legacy-atomic.

Descriptor para B dentro de Metadata:

`svOTMetadataVersion:1, Kind:'materials', OTKey, Role, PermissionRevision, Generation, Fence`, con `Creating:false, Administrative:false, Editing:false`. **No se emite cuarto bit MaterialEditing.** Kind materials es excepción cerrada al requisito de alguno de los tres bits: exige current `ot.corregirMateriales` y módulo ordentrabajo activo, configuración/revisión/fence/generación exactas y PhysicalUnchanged true. Defaults de corregirMateriales coinciden con action-permissions: admin/administrativo/vendedor; false explícito deniega. Otros Kind no obtienen esta excepción. No emitir grant nuevo sobre dinero de Sale. No está expuesto en POST /ot/metadata: es composición privada del gateway financiero actual.

## Structure.claim y estado de Soporte en un commit

POST /ot/metadata existente, kind claim. `changes={reclamoFbKey,ventaFbKey?,expectedClaimHash,supportState}`. supportState usa los campos cerrados de reclamoCambios del adaptador puro (estado, resolución y referencias/fechas tipadas), nunca patch libre. expectedClaimHash obligatorio cuando hay supportState y compara RAW completo autorizado del reclamo. Sin supportState continúa el contrato anterior de reparación de FK, sin permiso resolver adicional.

Structure lee Claim/Sale RAW como usuario, verifica hash, deriva FK recíprocos y reconstruye un único historial con actor y fecha servidor sobre historia original. Rechaza campos financieros/ajenos, resolución inconsistente, identidad/cliente contradictorios y CAS obsoleto. El historial enviado no sirve como evidencia. Cap supportResolving es privado/inmutable, derivado del comando claim tipado; no es claim JWT ni booleano de autorización cliente. Antes de emitirlo y en fase fresca exige `soporte.resolver` además del permiso estructural existente; módulo soporte activo y false explícito deniega, defaults admin/administrativo/vendedor/tecnico_vendedor. Todos los campos se escriben junto a los FK/OT en **un solo scope.update**, no dos commits.

Respuesta añade `{claimKey,claim}` además de OT/operationId/linksCommitted. Helper SVOTStructure.relate conserva esos campos para que el wrapper Soporte use el historial realmente confirmado. Las rutas sin OT (resolución remota o Claim↔Sale) siguen en su escritor Soporte existente: no emitir una capacidad OT falsa.

Para B: mismo namespace Metadata Kind claim/ClaimKey exactos. Si cambia estado/historial del Claim proyectado, exigir también current permiso soporte.resolver AND permiso OT estructural; no OR de bypass y no nuevo flag. Toda resolución tipada agrega historial, por lo que esa comparación detecta la rama. Conservar validación privada FULLPATCH anterior al grant, también tras proyección completa RecordList del Claim. Sólo create/claim pueden escribir Claim, y sólo claim con capacidad supportResolving admite esas hojas de Soporte.

## Empaquetado, evidencia y límites

El backend requiere **`cotizador/ot-related-adapters.js`**, copia byte exacta del modelo puro canónico `js/modules/ot-related-adapters.js`, además de cotizador/ot-material-edit-policy.js. Materials y Structure lo importan localmente para respetar el contexto Docker cotizador; la integración incluye aserción continua de identidad, sin modelo divergente. Raíz es dueña de Gateway/Store/Guard/app/Docker/Rules; aquí no se editaron. Sin esa composición no habilitar WholeOT ni permitir un fallback SDK tras error.

Puente final nativo solicitado: **`ot-material-native-policy.prepare({actor,lease,body,patch,scope,now}) → {patch,otKey,canonicalOT}`**. Reemplaza la llamada directa al puente Materials anterior cuando se monta Gateway. Exige body atomic/purpose/path exactos y exactamente dos expectedHashes (un OT, una Sale), sin flags mode cliente. Resuelve ambos RAW mediante lecturas autorizadas y deriva existing si la Sale es la principal existente, additional sólo para nueva Sale inexistente fuera de la principal. Valida perfil/permiso/reset y asignación técnica canónica o nombre histórico inequívoco; beforeCommit comprueba autorización/reset/config/RAW y asignación con **queryFresh**, nunca scope.query en fase de commit. No cambia el actor nativo ni su autorización financiera.

`canonicalOT` es RAW OT derivado (sin decoraciones UI), para respuesta del gateway; la proyección RecordList posterior puede incrementar su revisión. Mantener validación SourcesMaterials en Store contra el patch final tras los projectores reales. Las notificaciones adicionales permanecen sometidas a su permiso nativo, sin exigir lectura SDK de la notificación. No se modifica Gateway, SourceProtocol ni Docker desde este frente.

Nueve pruebas del puente nativo con Guard y REST Store reales, Accounts/History/Financial ON y coberturas financieras/Pages/Accounts/History reales: venta original y adicional, derivadas presentes, replay un solo PATCH, manipulación de patch/capacidad serializada rechazadas con código esperado y cero PATCH, reset/permiso/asignación revocados, fuente obsoleta y body estricto. Incluye identidad byte exacta UMD backend/UI. No son pruebas de reglas remotas ni de app17 publicada.

53 pruebas focales verdes (Materials privado/proyección/tamper/revocación, modelos de ambos carritos, Structure claim atómico/CAS/resolver false y revocado, clientes y Metadata). Se conserva la puerta raíz posterior para integración financiera real y app17; este bloque no certifica esa composición todavía. Sin Chrome adicional, suite global, datos reales, flags remotos ni publicación individual.
