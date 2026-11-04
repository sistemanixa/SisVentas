# Atestación OT v2: publicación, generación y revocación

Propuesta local, sin activación ni cambios de permisos. Sustituye la caducidad
diaria de la firma v1; no agrega servicios, cron, temporizadores, polling de reglas,
otro lock o un registro externo de metadata.

## Runtime

`cotizador/ot-delivery-attestation.js` admite exclusivamente el payload firmado
Ed25519 `schema:2`, `capability:ot-delivery-v2`, con el mismo path privado
`sv_deployment_attestations/ot_delivery`. Vincula `activationId`, `rulesSha256`,
`configGeneration` y `artifactSha256` a los valores revisados del despliegue.
`issuedAt` es auditoría: se valida entero no negativo y no futuro, pero no hay
edad máxima ni renovación diaria. V1, `expiresAt`, mezclas, campos desconocidos,
firma inválida o campos obligatorios ausentes son rechazados.

Se conservan las dos lecturas pequeñas por comprobación: marcador y
`sv_operational_read_config`. La configuración debe tener schema1/ready=true y
la generación fijada. Falta/revocación del marcador, cambio de generación,
incompatibilidad de hash/id/firma y errores de lectura cierran la capacidad.
`OT_DELIVERY_ENABLED` sigue exigiendo el texto exacto `true`; faltas de entorno
o configuración mantienen disabled, sin lecturas.

El resultado conserva `schema:1` **como interfaz del proof de fence** que ya
consumen servicio/store; añade `attestationSchema:2`. Esto no admite firmas v1.
No se cambian las relecturas de precommit ni su comparación de proof estable.

## Contrato offline del publicador existente

`scripts/lib/ot-delivery-attestation-cut.cjs` no hace HTTP, no revoca, publica,
reabre ni restaura un marcador. `prepare` exige los bytes del artefacto revisado,
la clave privada de corte y estos callbacks del publicador existente:

- `readInstalledRules()`: bytes exactos instalados, cuyo SHA debe coincidir.
- `readOperationalConfig()`: configuración instalada schema1/ready/generación.
- `publisher.readMarker()`: observación explícita; antes de preparar debe ser
  exactamente `null`, no undefined ni una copia activa/anterior.
- `publisher.readCutProof()`: evidencia efímera schema1 con los cuatro vínculos
  del artefacto/activación y todos estos hechos en true: `exclusivePublication`,
  `sdkAdmissionPaused`, `commercialAdmissionPaused`, `fiscalAdmissionPaused`,
  `guardEmpty`, `httpDrained`, `fiscalReconciled`, `writersClosed`. Debe registrar
  `completedSteps: ['revoke-marker','pause-and-drain']` en ese orden.

Estos campos son el contrato de observaciones del publicador: no son nuevos
nodos RTDB ni evidencia remota creada por este helper. El publicador debe
obtenerlos de los mecanismos existentes de pausa SDK, gates HTTP, drenaje,
conciliación fiscal e inventario de principal/tags/URLs directas/forwarders.
Un booleano declarado no verifica por sí solo el estado de esos sistemas.

`prepare` hace dos rondas completas de observación, congela los vínculos
revisados y vuelve a comprobar los bytes del artefacto antes de devolver la
firma. Rechaza el parámetro antiguo `validForMs`. Su resultado conserva
`publicationAuthorized:false`; no representa aprobación del corte.

Secuencia requerida al operador/publicador:

1. Revocar el marcador antes de cambiar reglas, generación o artefacto.
2. Pausar las admisiones existentes y drenar solicitudes/eventos/fiscal;
   conservar el circuito autenticado de recuperación requerido por el plan.
3. Instalar el conjunto autorizado y verificar bytes/generación y writers.
4. Preparar y publicar exactamente el marcador v2 revisado.
5. Ejecutar `verifyPublished` con los mismos callbacks, artefacto, revisión,
   `prepared` y clave pública, manteniendo pausas y drenaje. Exige firma v2 y
   lectura del marcador exacto publicado; repite las observaciones y comprueba
   deriva del artefacto. Antes de publicar, o con cualquier discrepancia, falla.
6. Reabrir sólo después de esa verificación y de la autorización del corte.

`verifyPublished` devuelve `publicationVerified:true` y mantiene
`publicationAuthorized:false`/`reopenAuthorized:false`: separa la comprobación
de consistencia de la autorización operativa. En fallos, no publica, reabre ni
restaura una firma vieja. El operador debe mantener el cierre; este helper no
ejecuta rollback remoto. El publicador debe usar activaciones revisadas distintas
para nuevos cortes, sin reciclar un marcador revocado como solución automática.

## Límites de autoridad

El runtime no observa las reglas remotas: la firma prueba una observación de
publicación, no monitoriza el estado remoto. Los cambios privilegiados realizados
fuera del publicador no son detectables si dejan intactos marcador y generación.
La exclusividad real de publicación y el cierre de **todos** los escritores
privilegiados siguen siendo precondiciones del corte, no garantías implementadas.
No se cambia IAM ni se agrega una autoridad. `exclusivePublication:true` y el
proof de drenaje no sustituyen evidencia independiente de esas condiciones.

Revocar tampoco cancela mágicamente una solicitud ya iniciada entre su última
lectura y el PATCH. Por eso se exige pausa/drenaje antes de modificar el conjunto.
El namespace privado y las reglas permanecen intactos; no se amplían permisos.

## Verificación local

`test/ot-delivery-attestation.test.cjs`: 43 pruebas ficticias de contrato,
incluyendo vigencia tras 24 horas/un año, rechazo de v1/mezclas, firma y bindings,
revocación, proof incompleto, orden incorrecto, deriva entre observaciones y de
bytes de artefacto, publicación exacta antes de reapertura y disabled por defecto.
La prueba con runtime/store reales confirma que revocar después del preflight
impide un segundo PATCH. Las claves de prueba son efímeras, sólo en memoria.

Regresión focal: **103 PASS, 0 FAIL, 0 SKIP**, Node 22.23.4. Log privado:
`tmp/ot-attestation-v2-regression.private.log`. No se consultaron remotos ni datos
reales, no se publicó y no se ejecutó otra suite global. Falta conectar y probar
estos callbacks con el publicador operativo bajo un corte autorizado.
