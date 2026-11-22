# Asociación Stock: exclusión y límites revisados

Revisión de sólo lectura del contrato `60cf871c` y fuente confirmada, sin leer
como definitivos módulos WIP de E. No habilita asociación ni prepara un corte.

## Hooks y carreras

| Carrera | Contrato exigible |
| --- | --- |
| Asociación contra asociación | `guard.run`, lectura de mapping e inversa, originales y candidatos; `scope.beforeCommit` revalida todo; un único ganador. |
| Asociación contra Compras | Resolver dentro de la transacción/exclusión; conservar revisión y resumen. Reintento resuelve otra vez, no reutiliza clave física obsoleta. |
| Asociación contra entrega OT | Incorporar mapping/inversa a `track`, consultas y comprobaciones frescas de `ot-delivery`. |
| Asociación contra rendición/retorno | Separar productKey de inventoryKey en `ot-material-state.resolveProduct/verifyReceipt`; conservar identidad, hash y revisión de recibos históricos. |
| Asociación contra cambio de catálogo/permisos | Autorización repetida y comparación fresca son necesarias; catálogo debe participar además en el cierre común. |
| ACK perdido | Actor, operationId y digest originales recuperan un recibo sin otro efecto; payload diferente se rechaza. Autorizar antes de recuperar. |

`scope.get/query/update` no convierten por sí solos una lectura en CAS remoto.
`beforeCommit` ofrece `readFresh/readFreshAsUser/queryFresh`; la exclusión depende
de que todos los escritores respeten el fence durante el PATCH final.

La capacidad de `office-stock-policy.validate` sólo permite inventario, resumen,
recibo y liberación del guard. No reutilizar ni ampliar el permiso de conteo para
asociación: hace falta contrato específico de destinos exactos; si no está
autorizado por reglas actuales, mantener la operación bloqueada.

## Contraste con reglas actuales obtenidas por el coordinador

Se leyó exclusivamente la copia privada autorizada, sin copiar contenido ni
expresiones a este informe. SHA256 del archivo completo:
`ea197750dc668aedffc5e182dd6a6e7fd6e939279690cf4a8077ac4cd975f3db`.

`/` no concede acceso global y `/sisventas` deniega en el padre. El comodín
`/sisventas/$dominio` no concede escritura ordinaria de inventario.
`/sisventas/inventario_operativo/$record` sí exige cierre por guard para SDK,
además de revisión y resumen correspondientes. Esto corrige la sospecha inicial
de que SDK directo implicaba ausencia total de fence: el cierre remoto existe.

Evaluación acotada de expresiones reales con snapshots ficticios de administrador:

| Guard | Revisión y resumen | Escritura inventario |
| --- | --- | --- |
| Ausente | Ausentes | Rechazada |
| Ausente | Preparados | Admitida |
| Vigente | Ausentes | Rechazada |
| Vigente | Preparados | Rechazada |

El catálogo `/sisventas/productos` tiene concesión de escritura en el padre sin
comprobación de guard: el mismo administrador ficticio fue admitido con guard
ausente, vigente y vencido. Un veto hijo no revoca esa concesión padre.
**Bloqueo confirmado:** producto/alias puede cambiar después del beforeCommit de
asociación. Propuesta mínima para un futuro corte autorizado: hacer que todas
las concesiones relevantes de catálogo respeten la misma exclusión, sin ampliar
permisos. Hasta entonces no habilitar la asociación.

Hashes SHA256 de `JSON.stringify(expresión)` para reproducir la identificación:

- Inventario `$record/.write`: `b7b1d0c843a0de306365a29fe05a5bdb7507f1820beeddfada664809c7c0c594`.
- Productos `.write`: `b81f70dfa96850e6da1128567ab163f62ba247e5faf17cbd341243bb07dceebd`.

La evaluación anterior no sustituye un emulador con todos los validadores ni
prueba el estado de flags o attestations de producción. Ningún acceso a registros
comerciales, PUT remoto o modificación de reglas se ejecutó.

## Aceptación pendiente del prototipo de E

Comparar íntegramente inventario antes/después: general, reservado, consumido,
costos, ajustesConteo, asignaciones, rendicionesOT, operaciones y campos desconocidos
deben conservarse exactamente. Sólo mapping/inversa/recibo cambian. Ejecutar
ambos órdenes de cada carrera, incluyendo cambio después de la última lectura,
y comprobar un único efecto o conflicto sin escritura parcial. Esta revisión
no declara ejecutada esa matriz ni aprobado código WIP.
