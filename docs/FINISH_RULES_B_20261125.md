# Reanudación B: reglas, contratos y preparación

Base nueva 37e1cbab93eb73b429f1997a28544a22436e4a95, rama aislada codex/finish-rules-20261125. Se releen AGENTS y CONTEXTO_ACTUAL; la referencia pública v3.21.15 no incluye esta migración. Se recuperan exclusivamente 26 archivos propios estables de a6d3224de4f97a0b97aa76aa2c199bd6625ed463 y tres pruebas unitarias puras. No se copian ramas completas, archivos compartidos, modelos de otros frentes, WIP3651, index, runtime, Guard, Store, Docker ni activos de interfaz.

## Dependencias mínimas directas que faltan en la base pública

| Módulo | Propietario/uso |
| --- | --- |
| cotizador/office-stock-order.js | C: classify/derive/compareKey y constantes del orden; bootstrap B depende de esas semánticas reales. No lo implementa B. |
| cotizador/office-stock-catalog-coverage.js | E: normalización canónica de alias para la barrera histórica. |
| cotizador/office-stock-explicit-reference.js | E: descriptor stockReferences exacto del contrato de cohorte. |
| cotizador/purchase-inventory-policy.js | A: extractor genuino getSourceAuthority, sello del patch y descriptor SourceV2 final. |

Las dependencias compartidas presentes son labor-guard, labor-fence-policy, payment-membership-index, sale-financial-dependencies-protocol y los constructores de History/Financial; se conservan los bytes de la base nueva. La lista anterior es de imports directos, no inventario transitivo de todos los modelos de los otros frentes.

## Contrato para E y Root

stock-link-activation-contract exporta pins/payload/verify/codes; comprueba firma Ed25519, pins y digest esperados suministrados por servidor. inventory-code-pins crea verifier genuino, marcado con WeakSet: se calculan bytes una vez al arranque de la revisión inmutable, no por fase o llamada. No se confía en JSON de cliente ni en un callback verify falso.

inventory-absence-evidence.create({read,verifier,contract,now}) emite autoridad congelada reconocida con isAuthority. verifyAbsence({productKey,aliases,actor,lease,read?}) emite prueba WeakMap; inspect(proof,context) y assertFresh(proof,context) exigen misma factory, actor, inputDigest, operación, lease con fence string real, expiry y alias. Una segunda factory genuina o una copia no acepta la prueba. isEvidence exportado por módulo sólo acredita emisión global; la pertenencia pertenece a authority.isEvidence/inspect. E conserva la responsabilidad de descubrir todos los alias del servidor y la autorización específica. No hay null→nunca existió.

inventory-cohort-contract conserva ocho campos y exige escritores cerrados acreditados; inventory-installation-contract conserva diez campos y marca sticky. inventory-metadata-preparation ofrece scan/apply/recover paginados de nueve dominios, CAS propietario y diario atómico, exclusivamente metadata. Un estado prepared aislado no basta. La autoridad de ausencia requiere bootstrap auténtico, marcador/firma/cohorte, cierres probados y evidencia fresca. No se instala ni habilita por importar estos módulos.

SourceCost V1 conserva siete campos receive. V2 prepare/reconcile y joint receive exige sello real, dos mapas inversos de fuentes con diez estados simples u once conjuntos, topología de servidor, FK antes/después, revisión real y marcador de orden/lista, sin SHA calculado por Rules. Presupuesto SourceCost JSON UTF-8 8192B; Root debe mantener límite real de override total 16KiB. Estado conjunto sigue esperando el descriptor final del backend de esta reanudación; no se declara probado por las pruebas históricas.

## Límites actuales y restricciones para integrar

- Root informa revisión cotizador-returncfg-32113, imagen 6b6276dd6b53f3ea745be726e0b277eaabf7d571a44e1948932756303045a01a. History/Financial están false; no se habilitan para hacer pasar una prueba. Los opt-ins de laboratorio se componen únicamente como candidatos separados y explícitos.
- Se necesita la ruta privada y SHA256 de las reglas remotas actuales revisadas por Root para la prueba combinada nueva. La copia EA del22/11 es histórica, no valida el corte actual. No se descarga ni modifica remoto desde B.
- El nombre histórico inventory-final-rules no certifica una composición final de esta reanudación: sus etapas base no incluyen automáticamente SourceV2, metadata, alternativa catálogo ni cierre final OT. Debe componerse con los contratos finales que entregue Root y repetirse en emulador.
- Catálogo sólo conserva permisos originales de usuario en reposo, stock/stockReal crudos inmutables cuando instalado y sin grants server nuevos. El control server anterior fue una propuesta de wrapper, no un endpoint activo detectado. No reabrir inventory ni padres como arreglo.
- Grants OTInventory/Count y sellos OrderON deben ajustarse a capacidades genuinas finales de D/Root. El WIP3651 no se reutiliza como probado. No duplicar esos modelos ni crear Sale ficticia.
- No modificar rutas de lectura privadas, queryPage ni límites del Store desde B; los hooks compartidos corresponden a Root. No escrituras en datos reales, IAM, Rules o flags remotos, builds ni publicación individual.

Evidencia nueva al recuperar: seis casos unitarios puros PASS (sticky, cierre Editar, permisos de metadata por lote). La evidencia previa de a6d322 sigue documentada como histórica; no equivale a pruebas con la base37e1, modelo final de otros frentes o reglas remotas actuales. Próximo paso: recibir cuatro dependencias/contratos, repetir capacidad genuina y transporte RTDB con la fuente exacta actual, y cerrar componentes concretos faltantes.

## Entrega inicial y puerto de preparación

Checkpoint curado 28972199933f8d0eb27b04f39d8df6fa81d00c88: los módulos B se pueden tomar individualmente de esta rama nueva, sin a6 completo ni3651. En particular E puede consumir los ocho módulos propios de cotizador listados en ese commit; las dependencias Order/CatalogCoverage/Explicit siguen perteneciendo a C/E. isAuthority/owner/inputDigest/fence string incluyen las correcciones posteriores a B592f. Se repiten además cuatro pruebas Ed25519 reales con claves efímeras en memoria: firma/pins exactos válidos, basura/otra clave, cambios de pins/generación/cobertura/digest/tiempo o campos extra rechazados, expectedPins incompletos rechazados. No se persisten claves ni se activa nada.

Root entregó 4c1f27cc72718b9f517713a92cfa0cc47ca704ec: queryPage de cuatro raíces para resolución dirigida y queryPageFresh con chequeo de lease antes/después. Se usa como dependencia compartida; B no copia sus archivos ni agrega raíces al Store. El paginado de bootstrap es un puerto administrativo distinto de las consultas dirigidas por operación: el puerto genérico de nueve fuentes de B NO debe conectarse sin más al queryPage dirigido de cuatro raíces, que además exige equalTo en los vínculos. No se cambia readQuery para resolver esta diferencia.

Contrato mínimo de numeración A/B: namespace privado sv_purchase_numbering/state con exactamente {schema:1,generation,revision,lastNumber,bootstrapOrderCount,bootstrapHash,cohortDigest,lastOperation}. A conserva su helper de allocation genuino y counter+orden atómicos. Operación ordinaria consume ese estado puntual; si falta o es inválido, no calcula max desde una página parcial ni asume cero.

El bootstrap global de numeración requiere órdenes actuales y legacy completas, paginadas por $key con cursor inclusivo, límite hasta129 y EOF probado, bajo pausa/lease/cohorte autorizadas; máximo del sufijo /\d+$/ de numero y legacyNum con BigInt y rechazo de entero inseguro. Mantener inventario/históricos intactos y contador existente sin reset. Para conectar al transporte, Root debe elegir un puerto de preparación cerrado y explícito para esas dos raíces (y las otras siete fuentes de la barrera), no ampliar consultas ordinarias por comodín ni activar escaneo por cada alta de orden. No se afirma que ese puerto de preparación esté montado en runtime público.

Se porta después el helper puro office-stock-order.js de la fuente curada a6d322, idéntico al original, para resolver classify/derive/compareKey de preparación. No se modifica el modelo OfficeStock publicado ni se duplica su cálculo de cantidades: el helper lo consume. Cuatro casos nuevos PASS con ese modelo actual: identidad de cantidad string/numérica y revisión corrupta, cobertura inválida visible, preparación exclusivamente metadata sin alterar fuentes y mantenimiento positivo→cero/revisión agotada. Quedan como dependencias externas directas CatalogCoverage/Explicit E y PurchasePolicy A.

## Composición con los módulos recuperados de imagen

Helper de pruebas read-only recovered-runtime-source.cjs verifica la imagen 6b6276dd y los SHA256 de exactamente ocho archivos autorizados por Root antes de evaluar módulos. No ejecuta index, no lee entorno/secretos de imagen, no copia sus fuentes al repositorio y conserva los módulos compartidos. Las dependencias no recuperadas de esos módulos son las de esta base pública; por eso no se llama a esto imagen completa ejecutada ni prueba remota/RTDB.

Cinco casos PASS en inventory-exact-runtime.integration.cjs: OfficeStock+Guard+RESTStore recuperados con transporte ficticio guarda/replay un efecto y preserva reservas/recibos/costos/pagos/comisiones; revocación después del lease rechazada sin PATCH; conflicto tardío conserva el valor concurrente; pérdida de ACK se recupera por recibo sin segundo PATCH. El Store de imagen propaga el error original de red, no el código añadido por versiones posteriores: la prueba verifica ese comportamiento explícito. El quinto caso reproduce que Policy real de cierre ignora Editar=false, mientras el predicado candidato B lo veta; no presenta el defecto como reparado en producción.

Conteo del fixture de detalle+guardar+replay: 10 solicitudes internas para detalle, 22 para primer guardado, 5 para replay, un único PATCH. Sin latencia artificial, red real ni interfaz: no es medición de tiempo productivo ni justifica retirar los controles. Opcional y manual, excluido de la puerta ordinaria por extensión integration.cjs: configurar SV_EXACT_RUNTIME_SOURCE y SV_EXACT_RUNTIME_MANIFEST con las rutas privadas entregadas por Root y ejecutar node --test test/inventory-exact-runtime.integration.cjs. No comparar el Guard37 contra producción como si fueran los mismos bytes.

## Dominio StockOrder reasignado por Root a B

Se recuperan office-stock-order-projections y office-stock-order-policy de fed81584, sin copiar Guard/Store/runtime/index ni modelos de otros frentes. Projection.create({enabled,verifyCohort}).augment({patch,raw,get,actor,lease,operationId,beforeCommit}) se llama después de Operational sobre originales/resúmenes completos. Retorna prueba WeakMap y derivados; OFF o patch ajeno no lee. La firma y evidencia privada del verifyCohort deben acreditarse de nuevo al precommit; un callback sin lectura/evidencia no sirve.

Policy.create({verifySource}) acepta un validador de servidor de la fuente concreta; authorizeSourcePatch conserva compatibilidad como alias, pero no se admiten ambos a la vez. El validador debe ejecutar la Policy genuina A/D/Stock sobre el patch sin metadata de orden y devolver undefined; true/false/objetos se rechazan. issue({proof,patch}) sella patch final y prueba; validate, token y sourcePatch conservan la API. Contexto sellado incluye ahora inputDigest/transportDigest, no sólo operation/mode. Root debe montar estos puertos en sus compartidos preservando los bytes nativos.

getAuthority(actor,lease,finalPatch,now) consulta únicamente la capacidad WeakMap ligada a la operación y revalida sello/fence/lease antes de retornar metadata congelada: schema1, kind stock-order-derived, sealed, sourceVerified, uid/opId/fence/inputDigest, basePatchHash del patch retirando derivados, derivedPatchHash, generation/revisiones y sourcePaths. Null si no hay capacidad propia. sourceVerified sólo es true cuando se ejecutó el puerto validador de fuentes; una capacidad metadata-only no implica autorización de negocio. Este envelope no se acepta como capacidad de entrada ni reemplaza el validador A/D.

Diecinueve pruebas históricas de proyección repetidas PASS con la base nueva y cinco adicionales PASS usando StockPolicy WeakMap genuina y firma Ed25519 de fixture: extracción sellada de fuentes, copia/falso callback rechazados, input/fence/patch alterados rechazados, metadata-only sin atribución de fuente y firma revocada en precommit. Las pruebas aisladas no son todavía Guard+Store+OrderON de la imagen ni SourceCost/Financial simultáneos; esa composición requiere Root.

Baseline remoto nuevo proporcionado por Root: rules-current-20261125.private.json, SHA256 5a5f7b34de6cbba2ae54517029de956b6be605e21143fe4a86c131255052e48f,3631288 bytes; sólo laboratorio y sin volcar contenido al repositorio. Reemplaza la comparación histórica EA para próximos emuladores.
