# Propuesta aislada: no iniciar PATCH con una lease ya vencida

**No aplicada al Store ni al guard compartido.** Fuente revisada del frente: `299aa6285dd4955e0492eaa1d22d2a1d14136913`. La propuesta se compila únicamente en un módulo en memoria dentro del laboratorio explícito `test/ot-lease-expiry-before-patch.proposal.cjs`; el archivo real de Store se compara byte por byte al terminar. No se activa por importar el runtime ni forma parte de la puerta normal.

El antecedente reproduce que el Store actual puede comenzar el PATCH con `now()===lease.expiresAt` cuando la obtención del token termina justo en ese límite. El protocolo de claims se sustituye sólo en la fixture para controlar el momento del vencimiento; las demás dependencias y el Store comparado son los reales. El test no acredita permisos OT ni reglas remotas.

## Cambio propuesto para el dueño del Store

1. Al entrar a `commit`, comprobar que la expiración es finita y que el reloj sigue estrictamente antes del límite. Si no, rechazar con `409 / SV_LABOR_LEASE_EXPIRED` antes de iniciar más lecturas.
2. Después de las autorizaciones/claims y de esperar las credenciales, preparar completamente el destino, headers, cuerpo serializado y señal de la petición. Comprobar otra vez la expiración inmediatamente antes de llamar a `fetchImpl` para el PATCH, sin otro `await` intermedio.

No renovar ni extender el plazo, congelar el reloj, saltar claims o sustituir una lectura fresca. No añadir afirmaciones sobre el estado comercial o si una operación anterior pudo haberse confirmado. No comprobar el plazo después de una respuesta 2xx para convertir un ACK tardío en un falso fallo: el envío anterior pudo haber sido aceptado válidamente por el servidor.

## Evidencia ficticia

Siete pruebas, siete PASS, cero fallos/omisiones:

- Store sin modificar: envío al llegar a la expiración, antecedente del hueco.
- Propuesta: expiración inicial, incluyendo igualdad exacta, sin credenciales ni HTTP.
- Propuesta: expiración al esperar el token, sin PATCH.
- Propuesta: expiración durante claims, lectura terminada y ningún PATCH posterior.
- Límite inmediatamente anterior válido y error original de autorización conservado.
- PATCH aceptado antes del plazo con ACK tardío, sin falso error.
- Fuente compartida sin modificaciones.

Log privado `tmp/audit-front-d/ot-lease-before-patch-proposal.log`, SHA-256 `cbab298766c542a38068d393415309465ec09340696feb03b68876e80b5e29c0`.

Repetición explícita: `node --test test/ot-lease-expiry-before-patch.proposal.cjs`, con la guardia local de red exterior de la auditoría. No requiere credenciales, red, datos reales ni instalar dependencias. Sintaxis y `git diff --check` antes del commit de esta propuesta.

## Límite de la propuesta y siguiente paso

Un control local previo no demuestra que la lease siga vigente al evaluar la escritura en el servidor. Las reglas deben rechazarla si expira en tránsito. La medición final del consumo rápido de E deberá usar el nuevo SHA, fases independientes, ventana global de seis IO, reloj/plazo reales y comprobación de reglas de expiración en emulador. No se prolonga la lease para hacer pasar el benchmark. Las respuestas de una fixture REST permisiva que envíe fuera del plazo continúan marcadas como no aprobadas.

El integrador o el dueño del Store debe revisar el cambio propuesto y su ubicación sobre el código central vigente; aquí no se modifica ese archivo. ON continúa desactivado y no se repite el perfil conocido de 01347/1c18 mientras falta el SHA de consumo rápido.

## Aplicación central revisada

El integrador aplicó los dos controles al Store real después de componer los sellos de Order y SourceCost. Nuevas pruebas del módulo real rechazan lease ausente/vencida y vencimiento durante adquisición del token sin enviar PATCH, conservando ACK aceptado tardío. El laboratorio conserva el antecedente reconstruyendo sólo esas dos inserciones exactas; ya no afirma que la fuente actual está sin corregir. Fixtures de transporte usan reloj explícito coherente con su lease. La expiración durante tránsito sigue dependiendo de las reglas y su prueba separada.
