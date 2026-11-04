# Entrega parcial: candidata aislada

Base `e47fc15e46890bce6bd5f940b127aeb18ff8262d`, rama `codex/ot-partial-delivery-verification`. No publicada ni aplicada al checkout primario. El reproducer de la acción pública anterior permanece sin modificar: este bloque agrega el comando, no cambia todavía esa acción ni importa el selector nuevo.

Fuente congelada de código: `adc80fd1c70f74057545b15b5435af489afbe871` y fixes `99655f633d7502ccec3e160af944b1556ccd61ab`. Las **164/164 focales** corresponden a99655f63, incluido legado por código y cableado real de atestación. El [manifiesto revisado](ot-delivery-candidate-manifest.json) fija árbol Git, hashes de archivos, comando de pruebas y límites. `7661eb92a6934e0b19b62e775aef608606ff94d6` contiene sólo CONTEXTO y se fusiona manualmente; no es una dependencia de código. Si la integración ya contiene el comando inicial, aplicar los fixes sin duplicar la base.

Fix posterior separado, identificado por hashes en `receiptMetadataFollowup` del manifiesto: remito conserva unidad de fila, catálogo autoritativo o default histórico `unidades`; descripción usa desc o descripcion. El catálogo ya leído se relee antes del commit. No recalcula precios ni cambia reglas, capabilities o el rechazo de originales cerrados. Tres pruebas nuevas más las164 anteriores: **167/167 PASS**; esta evidencia no amplía QA26 de reglas ni acredita la cadena frontend.

Contrato único: `POST /ot/ciclo`, `{id,otKey,expectedOTHash,kind:'delivery',changes:{entregas:[{index,cantidad}]},action}`. `GET /ot/ciclo/disponible?otKey=...&kind=delivery` devuelve `{ok:true,ready:true,version:1}` cuando el protocolo está listo; no publica costos, ventas ni cantidades disponibles. El transporte `SVOTLifecycle.save` admite `entregas` y conserva la recuperación compartida.

El servidor exige admin/administrativo activo y permiso vigente `ot.entregarMateriales`; rechaza técnico incluso con la casilla habilitada, Ver como y resets pendientes. Relee OT, índice completo certificado, cobertura H7, custodias vinculadas, generación y revisiones de inventario. Usa el guard existente, consultas por venta y originales puntuales, no la raíz de OT. El índice también identifica destinos secundarios. La custodia sin cantidades explícitas o sin consumo verificable queda en revisión, nunca se supone cero.

Revisión posterior a QA: filas antiguas sin productoKey se resuelven por consultas exactas codigo/cod contra catálogo autoritativo, con resultado único y relectura final. No se usa prodData del cliente ni se selecciona un homónimo. El resultado sólo completa la fila seleccionada al entregar; las otras OT se resuelven en memoria para descontar sus custodias, incluso destinos secundarios. Ausencia, ambigüedad o cambio concurrente se rechazan, sin migración masiva ni cero inferido.

El store deriva svOTDeliveryCommitVersion/svOTDeliveryUnchanged/svOTDeliveryHistoricalVerified desde registros completos, sobrescribiendo cualquier marca del actor. Las reglas exigen evidencia o delivery válido bajo lease y excluyen comodines ancestros. Con otDeliveryVersion=1, OT canónica y su resumen rechazan SDK incluso en reposo; inventario conserva su SDK legítimo en reposo. Notas por servicio conservan el protocolo de entrega sin cambios. Custodia histórica pasa por el modelo existente y recibo de stock, sin excepción genérica por kind.

Rollout H7 obligatorio: activar esta regla cierra también notas y demás ediciones SDK de OT canónica. Antes del corte deben verificarse las 14 entradas del frontend en la ruta H7/guard requerida, incluidos formularios, retornos y reintentos; no basta metadata H7 ready. Esa compatibilidad integral y el retiro del SDK antiguo NO están aprobados por estas pruebas de servidor. Coordinar frontend, servicio, reglas exactas y atestación en un único alcance revisado; no activar primero la bandera. El runtime real inyecta el verificador firmado; el corte externo sigue pendiente según el contrato siguiente.

Disponibilidad = reservado de la asignación menos unidades entregadas aún no instaladas ni recibidas de vuelta en todas las OT de esa asignación. Las sumas y diferencias de cantidades usan el modelo decimal compartido. La entrega confirma OT/remito y derivados existentes en un commit; no consume ni modifica stock, precios, cobros, comisiones o otras reservas. H7 no presenta cantidades de custodia: cuando sus campos públicos no cambian, conserva su fuente idéntica; no se fuerza una escritura inútil para aparentar actualización.

## Fence y límites de activación

`otDeliveryVersion:1` en configuración no habilita por sí solo. El runtime real inyecta `verifyOTDeliveryFence({read})` en el store; relee marcador firmado y generación para producir `{schema:1,verified:true,canonicalOT:true,inventory:true,rulesDigest}`. Sin configuración, firma válida o marcador vigente devuelve null y el comando falla cerrado. La atestación acredita lo observado por el corte; no constituye una observación fresca de reglas remotas. Los tests usan claves y datos ficticios; eso no prueba el despliegue real.

El builder offline `scripts/lib/ot-delivery-fence.cjs` compone el fence operativo existente y sella además `ordenes_trabajo` canónica y sus resúmenes; no basta el alias `ordenesTrabajo`. Exige padres cerrados y mantiene la autoridad original. `delivery` es un kind explícito en policy/token: no se hace pasar por `custody` o `return`, ni obtiene permiso de modificar campos económicos de venta.

Realizado: builder de entrega compuesto en emulador, hardening de capacidades/comodines/SDK idle y cableado local del verificador firmado real. Root informó **26 PASS de QA independiente de reglas**, con huellas builder/store coincidentes; esa aprobación no cubre cadena operativa, UI ni el cableado final de atestación, que tiene pruebas propias separadas.

Pendientes de integración: componer y probar también el namespace privado de atestación en las reglas exactas del corte; integrar el ejecutor autorizado que publica/revoca el marcador; integrar selector y retirar la antigua vía SDK; verificar las14 entradas H7 y recorrer recepción→entrega→instalación→corrección/devolución en la misma base. No activar mediante flags hasta cerrar esas condiciones. No hay despliegue, datos reales ni push.

## Evidencia local

- **164/164 PASS, cero omitidas**: comando/builder, protocolo de commit, atestación con runtime real y regresiones de lifecycle/policy/store/empaquetado/remitos/stock/transporte existente. Sustituye la tanda inicial de122; comando exacto y SHA del log en el manifiesto.
- Nuevos casos: 2/3, ACK perdido después del commit, repetición del mismo ID, payload diferente, dos OT concurrentes por la misma reserva, custodia previa, original/adicional del mismo código, fracciones y `0.3-0.1=0.2` sin tolerancia.
- Rechazos sin escritura: técnico, revocación, Ver como, fence no verificado, índice/cobertura ausente, generación/revisión ausente, legado ambiguo y hash/stock/permiso cambiantes.
- Legado: cod/codigo único sin productoKey, código ambiguo, custodia de destino secundario sin key y consulta de catálogo repetida antes del commit. Sin reescritura de inventario ni otras OT.
- **15/15 del ensayo propio de store+reglas en emulador**, separado de las164 focales: notas/cierre/custodia/return/stockrepair/delivery válidos; capacidades inválidas y ajuste sin permiso rechazados; SDK OT/remito/resumen idle denegado tras activar, inventario idle permitido y control H7 previo a activación permitido. El ensayo depende del helper QA sin seguimiento y queda fuera de commits.
- **QA independiente26 PASS**: informe recibido de root, sólo reglas compuestas; no se suma a164 ni se presenta como cadena completa. Sus archivos y hashes se enumeran sin incorporarlos a Git.
- La suite general de este checkout no quedó aprobada: dependencia Playwright ausente, permisos Git en temporales del sandbox y umbral temporal de v3-core. El gate aprobado del checkout primario es evidencia distinta y no sustituye estas verificaciones.
- No es aceptación de UI ni prueba de reglas productivas; la cadena operativa completa sigue pendiente.

Límite funcional del servidor congelado: rechaza entrega de un material original en OT cerrada, incluso si la UI muestra corrección para administrador. No se acepta un flag de UI como autorización. Habilitar esa corrección requiere acordar y probar contrato/capacidad de servidor con permisos actuales `corregirMateriales`, `rendirMateriales` y `entregarMateriales`; no forma parte de la aprobación de reglas ni de las164 focales. El flujo de adicionales cerrados conserva su criterio existente.

## Atestación de despliegue de entrega OT

El runtime real inyecta el verificador en labor-rtdb-store. Sin configuración completa, firma válida o marcador vigente, delivery permanece deshabilitado. No habilita por sí solo cliente, permisos, H7, generación ni reglas.

Variables de despliegue (sin valores): OT_DELIVERY_ENABLED=true, OT_DELIVERY_ATTESTATION_PUBLIC_KEY (Ed25519 pública PEM), OT_DELIVERY_EXPECTED_RULES_SHA256, OT_DELIVERY_EXPECTED_GENERATION, OT_DELIVERY_EXPECTED_ARTIFACT_SHA256 y OT_DELIVERY_ACTIVATION_ID. La clave privada pertenece exclusivamente al ejecutor del corte; nunca al runtime, navegador o repositorio.

Marcador: sv_deployment_attestations/ot_delivery. Contrato firmado: schema=1, capability=ot-delivery-v1, activationId, rulesSha256, configGeneration, artifactSha256, issuedAt, expiresAt, canonicalOT=true, inventory=true y signature. No acepta campos adicionales. Cada validación relee únicamente ese marcador y sv_operational_read_config; compara generación y firma contra las referencias inmutables de despliegue. El comando y el store vuelven a comprobar antes del commit. No consulta reglas completas por acción ni agrega timers.

Validez explícita máxima de24horas; el vencimiento deshabilita entrega. La renovación pertenece al corte autorizado, sin automatización implícita. La evidencia estable omite checkedAt para evitar conflictos artificiales entre comprobaciones.

scripts/lib/ot-delivery-attestation-cut.cjs sólo prepara: comprueba bytes del artefacto revisado, SHA exacto de reglas instaladas y generación, y firma un marcador. No publica ni autoriza. El ejecutor de corte aún debe integrar su publicación con exclusión de despliegues, volver a verificar reglas/generación inmediatamente antes de escribir y revocar el marcador ANTES de cualquier cambio posterior de reglas/generación. Componer también ot-delivery-attestation-rules.cjs: sesiones RTDB de aplicación, incluso administrador, no pueden leer ni escribir el marcador. Probar esa composición exacta con emulador antes de activar; las pruebas independientes de delivery no incluyen automáticamente este namespace nuevo.

Una atestación firmada prueba lo observado por el corte, no una observación actual de reglas remotas. Si un propietario externo cambia reglas omitiendo la revocación, dos lecturas pequeñas no pueden detectarlo. La operación exige restringir publicación y firma al ejecutor revisado; esa condición externa no queda demostrada por este código.

Pruebas: test/ot-delivery-attestation.test.cjs importa el runtime real sin sustituir fuentes; verifica cableado, firma/vinculaciones, marca revocada antes de un segundo PATCH y apagado por cada variable ausente. Son fixtures locales, sin credenciales ni publicación real.
