# Frente D: respuesta incierta de eliminación OT

Base local `060c77f80a5538a4d16be510513b159a11abc2d5`, publicada según coordinación como v3.21.2. Rama propia `codex/audit-20261122-ot-tecnoprices`; no se modificó el checkout compartido. `origin/main` en `4639a87b` es ancestro histórico y no sustituye esta fuente. Sin consultas ni operaciones reales.

## Defecto y cambio

La prueba existente de la ruta fallaba por el texto «Consultá el intento». La regresión ampliada reproduce además filtración del mensaje interno cuando el error trae `statusCode:500/503`: 2 PASS, 3 FAIL antes del cambio.

Único cambio funcional: el catch de `/operaciones/ot/eliminar` conserva los errores públicos 4xx y el código/estado del error, pero usa un mensaje genérico para 5xx o estado ausente: «No se pudo confirmar la eliminación. Consultá la operación antes de repetirla». No agrega `committed:false`, `svLaborAttempted:false`, éxito, cancelación ni reintento automático para un resultado desconocido. No cambia comando, guard, reglas, permisos, inventario, Stock UI ni versión.

## Evidencia

- Siete archivos de eliminación: 90 PASS, 0 FAIL, 0 SKIP; UI en VM, comandos/adaptadores/guard reales con datos ficticios, ACK perdido, replay, revocación y vínculos.
- HTTP real de loopback: 1 PASS. El handler real extraído de `index.js` se monta en un servidor propio con el adaptador/comando/guard reales y backend en memoria. Se confirma el borrado y se inyecta un 503 antes de responder; la respuesta oculta el diagnóstico. Repetir exactamente el identificador confirma el resultado con un solo commit. Inventario, pagos, ventas y comisiones se conservan. Servidor y conexiones cerrados en `finally`.
- `node --check` del JS modificado y `git diff --check`: PASS. No se ejecutó la puerta general: la realizará el coordinador una vez por integración.

Logs privados, fuera de Git, en `tmp/audit-front-d/`:

| Archivo | SHA-256 |
| --- | --- |
| ot-route-expanded-red.log | 9905fb0da7c2449f4a498681f0d874c82619ea3be4e82fa618bb17430b3e1542 |
| ot-delete-green.log | f9f7d546dd8ec5b3ee11b1dbb30423c118356bd6c9f21b7cb1f03c6235e817f3 |
| ot-delete-http-local.log | 335f23d55390030254d60319da8c84e78c826091922da407649cc3fecb7e2ed3 |

No es prueba de reglas remotas ni de una imagen desplegada, ni arranca el servidor completo con servicios reales. No hubo builds, instalaciones, publicación, push ni datos reales. La revisión extendida de OT documental y Tecnoprices se entrega aparte y no bloquea recoger este parche.
