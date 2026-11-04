# Propuesta aislada: escrituras OT por coordinación existente

Base: `8c0f3000458b3547068f5f988d7e8a9dd8c1988d`. Rama:
`codex/ot-coordinated-routing-proposal`. No activa una versión, un flag, reglas,
un servicio ni un corte. Los únicos fuentes modificados son
`js/core/labor-writes.js` y `js/core/operational-writes.js`.

## Ruta y condición de uso

Para `sisventas/ordenes_trabajo`, los wrappers consultan el host de Cuentas
existente con la sesión actual. Sólo si `prepareWrite`/`start` termina y
`coordinated()` devuelve `true` utilizan la coordinación. El host conserva su
clasificación sticky y su rechazo de pausa; esta propuesta no inventa un segundo
flag ni consulta configuración privada por otro canal. La disponibilidad de H7,
sus generaciones y los permisos siguen siendo comprobaciones del servidor.

Sin coordinación se conserva el guardado SDK anterior, con sus revisiones,
resúmenes y contratos. Fuera de OT no se cambia el escritor. No se habilita el
alias histórico `sisventas/ordenesTrabajo` como nueva fuente canónica.

`fbSet`, `fbUpdate`, `fbRemove`, `fbPush` y `fbRunTransaction` derivan las OT al
adaptador de registros instalado. No delegan reemplazos de ancestros. Si falta
el adaptador, fallan antes de intentar SDK. `SVRecordListWrites.records` también
consulta coordinación: su SDK fue capturado antes de instalar LaborWrites, por
lo que no bastaba con ampliar la lista de dominios del wrapper exterior.

Ese adaptador llama al único `SVLaborWrites.atomic` existente. Lee los originales
seleccionados, calcula sus hashes, aplica el callback y envía originales sin
incrementar revisiones ni suministrar resúmenes del cliente. El guard de servidor
ya genera original/revisión/resumen/H7/recibo en el mismo commit. La respuesta
local reconstruye la revisión y operación a partir del ID del comando confirmado;
`atomic` agrega ese `operationId` a su resultado sin cambiar sus campos previos.
`restTransaction` conserva `{committed,value}` y transacciones conservan snapshot.
`push` sigue reservando una clave local y devolviendo un ThenableReference que
resuelve a una referencia distinta, sin ciclo de promesa ni escritura incidental.

Los acompañantes `extra` se envían en el mismo comando y también reciben hashes
de comparación, incluso si no pertenecen al modelo de resúmenes. Se conserva el
límite de 128 fuentes y el rechazo de rutas superpuestas/ancestros. Sólo el CAS
explícito relee y vuelve a ejecutar el callback, hasta tres intentos. Los errores
de permisos/red/protocolo no causan reenvío por SDK. La recuperación existente
consulta el recibo del mismo intento tras un ACK perdido.

## Pruebas propias

`test/ot-coordinated-routing-proposal.test.cjs` instala los wrappers en el orden
real de `firebase.js`, con almacenamiento ficticio, gateway y guard reales. Cubre
alta OT, notas, técnico/domicilio/horario, eliminación de campos, acta,
transacción/restTransaction, respuesta/revisión, guardados combinados, CAS,
cancelación/no-op, sesión/pausa, fallback legacy, dominios ajenos, rechazo de
ancestros y ausencia del adaptador. Una prueba prepara cobertura real
Pages/Accounts/H7 y confirma que historial, resumen y recibo viajan juntos. Otra
usa `SVLaborWriteRecovery` real y pierde la respuesta sólo después del commit,
confirmando por recibo sin duplicar la nota.

La base 8c no contiene el protocolo de entrega de la candidata. Para comprobar
que la adaptación no saltea sus rechazos, el helper de prueba
`test/helpers/ot-routing-delivery-policy.cjs` es una copia de
`cotizador/ot-delivery-commit-protocol.js` de
`99655f633d7502ccec3e160af944b1556ccd61ab`; sólo cambian los imports relativos y
el comentario de procedencia. Se ejecuta en el commit del almacén ficticio.
Borrar una OT con remito o alterar su entrega sigue rechazado con
`SV_OT_DELIVERY_PROTOCOL`; editar metadatos sin modificar esa proyección pasa.
Esto no incorpora esa política al servidor de esta rama ni modifica permisos.

Comando focal con Node 22:

```powershell
node --test test/ot-coordinated-routing-proposal.test.cjs test/labor-writes.test.cjs test/operational-writes.test.cjs test/labor-write-gateway.test.cjs test/labor-write-recovery.test.cjs test/record-list-projections.test.cjs test/client-history-writers.test.cjs
```

No equivale a ensayo de reglas compuestas en emulador, ni a recorrido visual de
todos los formularios públicos. La integración de selector/comando de entrega,
los fences remotos, el verificador de despliegue y la cadena operativa completa
siguen pendientes de su checkout y aprobación específicos. Una eliminación con
entrega requiere política autorizada, no un bypass desde el cliente.

## Validación del bloque (04/11/2026)

- Node `v22.23.4`: 15 pruebas propias y 95 focales/regresiones, 0 fallos,
  0 omitidas. Incluye alta y nota posteriores a la preparación H7; una nota sin
  cambio de contribución conserva la revisión del historial.
- Puerta `scripts/test-current.ps1`: cuatro lotes, 8.582 aprobadas, 30 omitidas,
  0 fallos, salida 0. Las omitidas corresponden a las condiciones de ejecución
  ya previstas por las pruebas; no se las presenta como verificadas.
- `node --check` de ambos módulos y de los dos archivos de pruebas: PASS.
  `git diff --check`: PASS.
- El primer intento de suite se interrumpió por `ERR_NETWORK_ACCESS_DENIED`
  del sandbox en los navegadores de loopback. La ejecución completa anterior
  es la repetición autorizada con acceso local, sin datos reales.
- Evidencia privada local fuera del commit: `tmp/ot-coordinated-routing-current-loopback.private.log`
  y `tmp/ot-coordinated-routing-focused-final.private.log`.

Esta rama sola no reemplaza la candidata de entrega: necesita integrarse con
su comando, selector, protocolo de commit y verificación de fences antes de
cualquier activación. El helper de prueba no es un control de producción.
