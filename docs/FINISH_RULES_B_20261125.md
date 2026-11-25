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
