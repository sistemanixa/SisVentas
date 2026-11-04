# Actividad por instante y clave estable · propuesta aislada v3

Decisión técnica autorizada: preservar el instante principal de actividad y la
prioridad entre dominios; reemplazar **sólo** el desempate por rango global legacy
con la clave original estable. No se afirma paridad exacta con empates legacy.

Checkout `activity-stable-key-order`, rama `codex/activity-stable-key-order`,
base `ca71ed48f1ac0f6e1a0e10827fdc84e0caa678a8`. No modifica main, integración,
app/index/SW ni reader/DTO/reglas SDK de Hist. No monta handlers ni writers.

## Contrato nuevo, sin renumeración

`eventSort(ms,key)` conserva los 16 hex del IEEE754 descendente existente y añade
`_` más la clave original codificada por unidades UTF16 de cuatro hex minúsculos.
Es inyectiva y compara como ASCII exacto, sin locale, SHA ni truncamiento. Una
clave de 128 unidades produce como máximo **529 caracteres/bytes ASCII**, dentro
del límite de clave RTDB. Prefijos de claves y pares surrogate conservan orden
UTF16; no se lo equipara al tratamiento especial de claves numéricas de RTDB.

- Orden por fuente: `legacy-ms-desc/stable-key-utf16-v3`.
- Orden mixto: `legacy-ms-desc/domain-stable-key-utf16-v3`.
- `activitySchema:3`, evidencia puntual `schema:3` y orden explícito.
- Filas de evento: nueve campos; desaparece `sourceOrdinal`. No se almacenan
  `ranks` globales ni por usuario. El prefijo conserva envelope schema2 y kind
  de instante; el id de orden y activitySchema distinguen el contrato nuevo.

El Core preserva instante descendente y prioridad ventas/pagos/OT/presupuestos;
sólo dentro de un mismo instante y dominio usa la clave estable. Un prefijo
ordinal viejo no puede renombrarse como nuevo: Core rechaza su id de orden y el
campo `sourceOrdinal`; planner rechaza coverage de actividad vieja y codec
rechaza evidencia con `ranks`. Una instalación vieja necesita bootstrap offline
explícito con nueva generación y precondiciones del destino, no un cambio de flag.

La comparación de PP/parseInt(ts)/locale del loader queda caracterizada en tests:
puede ser cíclica y su empate difiere deliberadamente del nuevo. Ya no se invoca
para preparar rangos ni impone un presupuesto de comparaciones por pares al
bootstrap. No se cambian id/numero/fecha/ts de los originales para acomodar orden.

## Instante y zona explícita

Dependencia importada sin modificaciones desde el commit de Costos
`dee905a90955e74c2054320248bf8a9e1229b4b9`: helper, test y documento propios;
cherry-pick local `45704838`. Usa `legacyMs(fecha,ts,zone)` y `canonicalZone`.
El helper sigue siendo autoría separada; sus nueve tests están incluidos en la
verificación focal de este bloque, no se cuentan como quince tests propios.

Core delega el parser, y codec/bootstrap/planner pasan la zona certificada del
índice. Se retira `assertRuntimeZone`: bootstrap y cambios de fecha funcionan con
proceso UTC y zona Argentina explícita. No se modifica `process.env.TZ` en código
productivo ni fechas financieras, offset de KPI, timestamps originales o locale
de negocio. El lector conserva la comparación de contexto certificado; su futuro
binding debe proveer zona/locale explícitos, no fingir el contexto del navegador
con el TZ del servidor. En navegador el helper debe cargarse antes del Core.

## Mantenimiento puntual en el guard existente

Bootstrap calcula cada punto y publica sus filas en los ámbitos global/propio,
sin ordenar toda la colección para asignar ordinales. El planner usa el mismo
codec para altas, ediciones de instante/presentación, bajas y reasignaciones.
Valida evidencia previa contra el original y su zona; calcula filas antiguas y
nuevas y toca sólo esos paths y contadores/proofs de los ámbitos afectados.

Los contadores `eventEligible`/`eventExcluded` se mantienen por delta, incluso
cuando un ts pasa a cero/NaN legacy o cambia de propietario. KPI, avisos y su
semántica permanecen. Bajo cobertura válida no apaga `activityReady` por una alta,
baja o cambio de orden. Tampoco reactiva un certificado ya retirado. Cambios de
autoridad conservan el protocolo previo de ready=false/reconciliación; originales
ambiguos/corruptos o instantes truthy no finitos no se certifican como cero.

No agrega lock, recibo, temporizador, servicio, mantenimiento global en el request
ni lectura de roots de presupuestos/directorio. El patch se incorpora al mismo
guard/commit/recibo ya existente. La integración de **todos** los escritores reales
sigue pendiente: un planner probado no es instalación o corte autorizado.

## Verificación y evidencia

Reproducción inicial `dashboard-activity-stable-key.test.cjs`: **0 PASS/5 FAIL**
contra la fuente anterior. Fallaban alta que invalidaba actividad, clave original,
empates, contadores tras cambios y continuidad con costo constante. Las pruebas
posteriores agregan rechazo del contrato viejo/corrupción con rollback, ejecución
UTC con zona Argentina y prohibición de reactivar un certificado retirado.

Se actualizaron explícitamente las expectativas de los tests anteriores afectadas
por la decisión de empate y continuidad: se conserva el oráculo del parser y la
prueba de prioridad temporal/dominios; se caracteriza y **no** se afirma paridad
con el loader cíclico. No se cambian expectativas financieras para ocultar fallos.

Costo medido del planner con 1 y 1.001 originales, incluidos PP/legacy mixtos:
**12 lecturas lógicas / 18 paths de patch en ambos casos**, para editar un solo
instante. No es conteo total del guard, bytes facturados ni latencia productiva.

Ensayo RTDB real, puerto loopback propio 9089, namespaces
`demo-budget-activity-14128` y repetición final `demo-budget-activity-38976`:
cinco casos PASS sin omisiones. Verifica 5.051 registros, prefijo limitado a cinco,
badge exacto, Unicode de 128 unidades persistido con clave de 529 bytes, guard/store
reales, permisos cambiados/metadata faltante que fallan y fuentes financieras
ficticias intactas. Observa 37 GET lógicos del oráculo servidor y cuatro checks de
actor; no lo presenta como el camino SDK más barato. Los originales se leen
completos sólo en preparación offline, nunca por el reader de la petición.

Namespaces vaciados y limpieza comprobada; emulador propio detenido. Sus reglas
son permisivas y Auth es ficticia: **no certifica permisos de SDK ni producción**.
No se consultaron remotos o datos reales. Logs privados fuera de Git:
`tmp/activity-stable-key-before.private.log`,
`tmp/activity-stable-key-focal-final.private.log`,
`tmp/activity-stable-key-emulator-final.private.log`.

Resultado final: **70/70 focales y 5/5 RTDB PASS, cero FAIL/SKIP**, Node 22.23.4.
Sintaxis de los nueve JS/CJS modificados y `git diff --check`: PASS. Son dos
bloques de prueba distintos; no representan una suite integral ni validación de
los consumidores SDK que permanecen a cargo de Hist.

## Coordinación pendiente antes de integrar

Reader/DTO/reglas SDK de Hist no se editaron. Aún deben adoptar conjuntamente el
id de orden, activitySchema3, fila sin ordinal y carga del helper. El reader
servidor propuesto sí verifica los nueve campos y el orden nuevo, sin montarse.
Los proveedores de ventas/cobros/OT y la actividad mixta real no quedan completos
por este cambio de Presupuestos. No se ejecuta otra puerta global: congelar y
coordinar consumidores, bootstrap/metadata y escritores antes de integrar/activar.
