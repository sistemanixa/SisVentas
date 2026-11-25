# Conciliación current-pending: contrato incremental

Base Root `20b81b2f`; puerto Root `b19120b0` consumido como dependencia revisada
en la copia aislada. Sin producción, datos reales, Rules nuevas ni cambios Root.

## Modelo y prueba de fuentes

`purchase-current-pending-model.plan` recibe controles exactos
`{id,orderKey,expectedHash}`, original completo, ambos conjuntos de órdenes,
EOF/páginas, referencias P/J/R verificadas, ledgers actuales y dependencias.
El comando no acepta esas fuentes desde HTTP: las obtiene de su puerto privado.

Se suman pendientes conocidos de TODAS las fuentes, deduplicando únicamente
vínculos recíprocos `legacy.migradaA` / `canonical.legacyKey` inequívocos. Los
estados desconocidos, cantidades recibidas ausentes en activas, aliases
contradictorios o pasos pendientes son REVIEW. Recibidas/canceladas conocidas sin
pasos pendientes contribuyen cero por su estado: no requieren cantidades/PJR/
costos históricos de esas fuentes cerradas NO relacionadas. Sus originales
permanecen en EOF/hash/dedup. Activa con items:[] explícito, sin recepciones ni
flags ambiguos, puede contribuir cero; items ausente/null no puede hacerlo.
Cada J referenciada por fuentes activas (incluye todas las J del objetivo) exige
enCompra numérico presente e igualdad exacta con TODAS las contribuciones de
ambas raíces. No se afirma cobertura de un ledger huérfano fuera de ese conjunto;
no hay escaneo de todos los ledgers ni fallback a cero.

El único patch de negocio es la orden original con `inventarioCompra` nuevo.
Baseline inmutable conserva actor/operación/fence actuales, timestamp, hash de
orden anterior a metadata, digest de cobertura y filas con P/J/R original,
ordered/received/pending y hash de fila original. Las referencias iniciales usan
baselineOperationId/baselineRow; nunca un operationId de movimiento inventado.
General, reservado, consumido, enCompra, ledger y costos originales no se escriben.

Para cantidades ya recibidas se exigen capturas económicas completas. En USD se
requiere ARS anterior conocido; no se usa FX actual. Fuentes Sale/List se leen
cuando corresponden y sus baselines económicos deben ser coherentes con las
órdenes. No se reconstruyen recepciones ni se atribuye pasado a General.

## API de composición

Comando interno `purchase-current-pending-reconcile`, modo user real,
financialAction `ordenes.editar`, separado de register/edit/receive y de Host.ready.
Requiere administrador activo, índice de permisos vigente con Compras y
Configuración, edición de Compras y sin veto explícito mantenimiento.migrar.
No se ejecuta incidentalmente al editar o recibir.

Lectura original autorizada: scope.getAsUser orden exacta. Lecturas privadas:
scope.get ledgers, pares y recibos originales de asociación, fuentes y permisos.
Scanner: dos roots exactos, `$key`, limit129, cursor inclusivo de clave segura
1..128, orden RTDB de enteros antes de strings, EOF y límite de páginas failclosed.
No filtros, endAt ni subpaths. Se repiten páginas, EOF y fuentes antes del commit.
Esto acredita cierre frente a escritores SDK cortados y participantes del Guard;
no frente a un Admin externo que escriba entre EOF final y PATCH.

Recibo Guard actual exacto: `{fence,digest,actorUid,result,confirmedAt}`.
Resultado versionado: `{ok,committed,operationId,orderKey,reconciliation:
'current-pending',baselineVersion:1,actorUid,originalOrderHash,rowsHash,baselineDigest}`.
Digest corresponde al wire de tres campos. No se guardan fuentes/ledger en recibo.
History valida ese recibo específico y su binding; committed:true genérico no basta.

## Orden de migración y readiness

El comando de mantenimiento exige enabled, admisión genuina y Guard user sin
readonly global; no depende del ready de órdenes económicas y no habilita SDK.
Root montará el endpoint administrativo explícito
`/compras/ordenes/reconciliar-pendiente`. No se agregan botones ni rutas aquí.
La instalación/corte de negocio no se declara cubierta sólo porque exista este
comando: primero se cierra y verifica el circuito, luego se concilian únicamente
órdenes con evidencia suficiente y se repite la cobertura bajo admisión real.
Installed nunca se rebaja a false para obtener fallback.

## Composición privada y operaciones futuras

`purchase-current-pending-sources` sólo emite evidencia privada después de usar
el scanner acotado y `Explicit.resolveMapped` genuino sobre pares y recibos de
asociación originales. Un recibo Link acredita P/J/R, nunca el baseline. La
evidencia de conciliación está en WeakMap, ligada a actor/lease/body/permisos;
Policy la consume, recompone el modelo y sella RAW/derivadas/recibo exactos.
No hay autoridad por JSON, callbacks booleanos ni un modo bootstrap ficticio.

History distingue referencias baseline y comprueba su recibo Guard específico
versionado y fence/UID/digest de controles originales. El baseline y sus filas
permanecen inmutables. No compara hash del ledger ACTUAL con un hash histórico:
las operaciones posteriores hacen CAS de su ledger actual. Tampoco compara la
fila actual con sourceRowHash para siempre: precio/descripcion/header pueden
cambiar legítimamente. Se verifica selector y P/J/R actuales; identidad de
producto explícita contradictoria es REVIEW.

Los modelos Base/manual/linked conservan baselineOperationId/baselineRow en
filas sin movimiento físico. Sólo filas realmente afectadas pasan a un nuevo
operationId existente en el ledger; un PATCH del mismo J por otra fila no basta.
Borrado clásico sigue en Review; no se convierte en typed eliminable por baseline.

No se añade el comando a Host.routes ni a sus 17 capabilities. Host.ready
continúa siendo disponibilidad de dependencias/cohorte, NO un certificado global
de cierre histórico. El endpoint de mantenimiento y el reporte explícito de corte
pertenecen a Root. No se añadió un escaneo completo por cada capabilities, caché,
namespace de cobertura ni flag constructor que afirme ready sin prueba. Una fase
de mantenimiento debe usar admisión de negocio realmente pausada, manteniendo
Guard user habilitado para esta operación explícita; no saltarse readonly.

## Evidencia incremental

27 tests de modelo PASS: patch sólo metadata, fuentes RAW intactas, cantidades
desconocidas y saldo ausente rechazados, deduplicación recíproca, aliases y moneda,
capturas USD/ARS preservadas. Este checkpoint no acredita comando, montaje HTTP,
Rules ni activación. La composición privada y modelos futuros se verifican en
el bloque siguiente sin cambiar este criterio de preservación.

Composición posterior: 392 focales PASS, cero fallos/cancelaciones/omisiones,
incluidos scanner, helper/History, nuevos modelos, 25 casos de Guard/REST nativos
y regresiones de edición/header. Fuentes, Auth y transporte ficticios; no
acredita Rules remotas ni activación. Incluye baseline→header→cost-only sin
ledger→recepción, recepción parcial de filas del mismo J sin alterar referencias
ajenas, cantidades/cancelación con sólo deltas futuros y ACK perdido resuelto con
un recibo/efecto. Recibos ausentes, genéricos, digest o selector falsificados,
permisos/CAS/PJR/EOF cambiados abortan sin segundo PATCH. Los resultados
solapados no se suman como pruebas distintas. Log local:
`C:/SisVentas/tmp/purchase-current-pending-focused-20261125.log`.

## Medición acotada posterior al baseline

`purchase-current-pending-capabilities.test.cjs` crea el par P/J/R con mapper
real y ejecuta la conciliación con Guard/Store REST nativos y cohorte firmada
ficticia. Luego llama dos veces al Host INTACTO, sin añadir escaneo ni caché:

| Llamada | Ready | GET puntuales | Queries paginadas | Bytes JSON UTF-8 recibidos |
|---|---|---:|---:|---:|
| 1 | true | 10 | 0 | 2832 |
| 2 | true | 10 | 0 | 2832 |

Los GET corresponden a marker/activation, configuración operativa, Pages,
Accounts, History, cobertura financiera, contador y config/fence de orden Stock.
Se leen nuevamente en ambas llamadas. No hay escrituras ni modificaciones del
baseline, recibo o ledger. Autenticación HTTP, headers, TLS y latencia real no
están medidos; los bytes son sólo respuestas JSON de la fixture.

Esto mide el readiness actual de dependencias, NO prueba que se haya añadido una
validación global de compatibilidad ni acredita retiro de SDK. No se implementa
la caché positiva hipotética ligada a numeración; antes exige acreditar todos
los escritores monótonos y el reporte explícito de cierre que decidirá Root.

Follow-up: 27 PASS (26 nativos, incluido el nuevo caso de baseline de fuente
conjunta con SourceCostVersion0 y Sale/List/ledger intactos, más esta medición).
Se superponen a los 392 anteriores; no sumarlos como casos únicos. Ningún cambio
de producto en este follow-up. Log:
`C:/SisVentas/tmp/purchase-current-pending-measurement-20261125.log`.
