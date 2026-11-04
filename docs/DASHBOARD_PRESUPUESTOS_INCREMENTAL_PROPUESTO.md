# Plan incremental de Presupuestos: contrato y driver local

## Contador de badge: extensión posterior al codec congelado

`badgeCounts({raw,query,authorize,asOfDay,pageSize,maxPages})` es un lector propuesto sin importación activa. `authorize` debe resolver autorización fresca de servidor y devolver `{scope,policyHash}`; nunca se toma scope, UID o rol del solicitante. Se repite al terminar. El handler y freshAuth reales siguen pendientes: este puerto no constituye por sí mismo una autorización.

Contrato **legacy-raw-lex/v1**: cinco estados exactos, admite avisos, `vence` no vacío y comparación de strings originales contra horizonte ISO hoy+2. `01/99/2026` cuenta como vencido aunque sea inválida; `2026-11-06T01:00:00Z` queda después de `2026-11-06`. No se corrigen históricos. Un vencimiento no-string truthy o truncado por la fila ligera exige reconciliación: bootstrap y planner rechazan antes de certificarlo. El codec congelado permanece igual.

El commit existente mantiene `stats.totalDueEligible` y membresías `noticeBadge` en el mismo fence/recibo, incluidas bajas, flags y reasignaciones. No añade árbol acumulativo, reloj, servicio o recibos. Coberturas anteriores sin ese contador fallan cerradas y requieren reconstrucción offline; no se rellenan con cero. El desempate usa hash fijo de clave para que fechas de 80 unidades UTF-16 más identificadores multibyte no excedan el límite de una clave RTDB.

El lector valida coverage ready/generación/revisión/policyHash, stats completos y scopeProof. Consulta exclusivamente noticeBadge del ámbito autorizado desde el texto ISO de hoy, con páginas de hasta 50. `query` debe ejecutar orderByKey + startAt en la primera página y startAfter exclusivo en las siguientes, con límite exacto solicitado, y devolver children ordenados `{sort,value:{key,dueRaw}}`. Una página corta demuestra fin sólo bajo ese contrato del adaptador; el lector valida forma, orden, rango, duplicados y cantidad. Una página llena exige otra consulta, incluso cuando ésta resulta vacía. Un proveedor que trunque arbitrariamente no cumple el contrato; no hay adaptador remoto certificado todavía.

Cuenta próximos como candidatos <= horizonte; resta los posteriores de totalDueEligible para obtener el badge con todos los vencidos. Al terminar relee coverage, stats y prueba y repite autorización. Drift, metadata ausente, candidato inválido, exceso sobre total o presupuesto maxPages agotado devuelven error, sin total parcial. El resultado no devuelve filas. maxPages limita trabajo, no convierte una primera página en conteo completo.

Caso ficticio tras commit del planner/guard real: 5.001 vencidos y 50 futuros requieren 6 puntos de metadata y dos queries (50 candidatos y página vacía), igual que un vencido con los mismos futuros. Las páginas serializadas del mock suman 8.043 bytes en ambos; metadata+páginas, 9.159 frente a 9.139 bytes. Esto no mide protocolo RTDB ni ahorro real. El mock enumera en RAM el índice para representar el motor ordenado del servidor; el lector sólo solicita queries acotados, sin originales ni raíz histórica. Con muchos futuros el costo crece y al exceder el presupuesto falla sin cifra. Centro, deduplicación local, transporte, cobertura de escritores, gate, instalación y reglas siguen pendientes.

**Propuesta no integrada.** El planner, su prueba y este documento se agregan como propuesta. El modelo puro, su prueba y su documento incorporan el codec compartido. No se cambia guard, store, servicio, app, índice, preparador, reglas o configuración. No se aplicó una raíz nueva ni se hicieron consultas reales.

## Qué resuelve y qué sigue faltando

El módulo calcula un patch persistible por registros afectados para conteos completos, facetas de empleado/mes y candidatos privados por fecha/estado. Se acopla al commit del guard existente mediante `raw`, `get`, `beforeCommit`, generación y revisión. No crea lease, lock, transporte, timer ni recibos propios. El driver usa **createLaborGuard real**, store RAM y datos ficticios para verificar atomicidad y recuperación, no reglas de RTDB ni despliegue.

El modelo puro exporta `projectRecord({key,original,ownerUid,offsetMinutes})`, reutilizado por `build` y `apply`. El planner recibe ese codec explícitamente y entrega sólo el original afectado, propietario resuelto y offset certificado en coverage. El codec valida snapshot JSON, clave, UID y offset; calcula la huella del original y deriva la misma fila ligera, sin resolver autoridad ni consultar reloj. UID vacío conserva ambigüedad. El driver llama al codec real; la reconstrucción completa ocurre fuera de la operación y sólo comprueba paridad, nunca suministra la fila.

Esta entrega sigue siendo **diseño ejecutable y driver**, no cierre del adaptador operativo: quedan la cobertura de todos los escritores/políticas y su gate de compatibilidad. El badge propuesto conserva comparación raw lexicográfica mediante total elegible menos candidatos posteriores al horizonte; su costo depende de futuros, sin prometer O(1).

## Persistencia privada propuesta

Raíz de propuesta: `sv_dashboard_budget_proposal/v1` (no instalada).

| Ruta bajo v1 | Función |
| --- | --- |
| `coverage` | schema, ready, generación/revisión, huella de política, cantidad global, propietarios sin resolver, acumulador de fuentes y contrato de ámbitos vacíos. |
| `policy/hash` | Vínculo con el snapshot de directorio/identidades/permisos aprobado para resolver propiedad. No se calcula leyendo esas raíces por cada presupuesto. |
| `sources/{budgetKey}` | Huella del original, propietario, huella de campos de propiedad y fila ligera privada. |
| `stats/{all\|u_UID}` y `scopeProof/{scope}` | records, activos, convertidos, no anulados, fechas desconocidas y totalDueEligible; generación/revisión y prueba de metadata. Conversión se calcula al leer, no con redondeos acumulados. |
| `months/{scope}/{hash(etiqueta,mes)}` y `monthProof` | Conteos completos total/convertidos de la faceta heredada. Etiqueta no concede acceso: primero se fija scope canónico. |
| `document/{scope}/{sort}` | Prefijo por fecha comercial/clave UTF-8 para el contrato de Core; no timestamp horario. Fecha desconocida se cuenta y obliga al futuro lector a declarar ese prefijo incompleto. |
| `monthMembers` | Membresías puntuales de las facetas, no listas completas de originales. |
| `noticeBadge/{scope}/{sort}` | Candidato mínimo key/dueRaw de cinco estados elegibles. Sort conserva orden UTF-16 raw y hash fijo de clave para desempatar. |
| `noticeStatus`, `noticeDue`, `noticeSent` | Candidatos ligeros por estado, vencimiento válido o envío. No materializan “hoy”, capacidades de aprobación ni deduplicación local. |

No se copian ítems, catálogo, fotos, adjuntos, costos o auditorías completas. `amount` es el total público usado por el aviso existente, no costo/margen. Las filas son privadas hasta que un lector autorizado elija un scope y devuelva un resultado acotado. No hay reglas que permitan escribir esta propuesta con una credencial real; no intentar un commit fuera del driver.

`bootstrap({model,records})` acepta una reconstrucción offline completa del modelo anterior, contrasta cardinalidad y huellas y produce sólo la raíz derivada. No copia los recibos del modelo puro. Esa salida no prueba ausencia del destino: un preparador posterior necesitaría snapshot estable, precondiciones del padre/v1, generación nueva y reconciliación exacta. Nunca sobrescribir un índice instalado o parcial usando esta función como aplicador.

## Operación normal y concurrencia

1. El escritor autorizado ya está dentro del guard actual. Stagea originales individuales; no admite reemplazar la colección completa.
2. `plan` examina las rutas del patch pendiente y coalesce claves de presupuesto, incluidas modificaciones anidadas. Rechaza inyección del derivado o sus padres.
3. Lee puntualmente coverage/policy, original anterior y source metadata por clave. `get` devuelve el original final incluyendo todo el patch pendiente. Normaliza originales/huellas con `payment-membership-index.normalizeRtdb`, igual que otros índices coordinados: null/arrays vacíos/objetos vacíos no deben crear una imagen distinta tras persistir. Restaura únicamente los campos nullable conocidos de la fila ligera antes de validarla. La huella anterior debe coincidir con su cobertura; el bootstrap exige snapshots canónicos observados, no una copia JS con contenedores que RTDB descartaría.
4. Reutiliza `commercial-ownership.owner` y `client-account-owner-evidence.fromRecord/validate`, sin otro resolver. Alta nueva exige `responsableUid` explícito válido: si proviene de herencia, el escritor vigente debe resolverla y stagear ese campo **antes** de entrar al planner; creadaPorUid o un nombre no lo sustituyen en altas. En históricos, UID canónico o propietario legacy ya certificado se conserva sólo si sus campos de propiedad, evidencia y política no cambiaron. Un alias nuevo/cambiado exige reconciliación; no se elige un homónimo ni se agrega un root scan como fallback. Un histórico ambiguo conserva propietario vacío y alcance administrativo, no se reasigna. Un eventual lookup compacto por cuenta/alias requeriría evidencia completa canónica validada: no está implementado ni se supone existente aquí.
5. Obtiene la fila del codec puntual. Suma/resta contribuciones anteriores/nuevas por ámbitos y buckets de mes afectados, elimina/reemplaza sólo membresías cambiadas y actualiza metadata. El acumulador suma/resta huellas `[key,sourceHash]` de tamaño fijo, como los índices incrementales existentes; no vuelve a hashear la colección.
6. Registra checks de cobertura/política, originales y metadata puntual con `beforeCommit`. Una revisión/generación o imagen que cambie antes del commit rechaza el plan completo. El guard conserva su fence/commit único y su control de concurrencia existente.
7. Devuelve sólo paths bajo v1. El integrador incorporará ese patch al mismo commit de originales y recibo; no hará un segundo update. Su costo depende de claves/ámbitos/buckets afectados, no del número de presupuestos ajenos a la operación.

Ámbito ausente equivale a cero sólo bajo cobertura completa `scopeAbsenceIsZero` y ausencia de metadata/prueba para un ámbito nuevo con contribución positiva. Scope existente sin prueba/meta o total global contrario a coverage rechaza. Buckets de cero pueden conservarse con su prueba; no se borran índices para ocultar inconsistencias. Falta diseñar la retención/compactación offline de buckets vacíos si el volumen lo requiere.

Los reintentos usan **sv_labor_receipts**. El test usa el modo `user` del guard real, que ya recupera ese recibo antes del callback: mismo request no reejecuta el planner ni suma dos veces. El modo `server` no recupera automáticamente igual en el guard actual; cada escritor servidor deberá revisar su contrato de idempotencia existente, no asumir esa capacidad por analogía ni agregar un mapa de recibos aquí. La autenticación/freshAuth del handler sigue siendo requisito previo, también para recuperar un resultado.

## Directorio, permisos y reconciliación

Un patch que toque `sv_usuarios`, `sv_chat_roles` o `sv_permisos` marca coverage `ready=false, requiresReconciliation=true` en el mismo commit, sin escanear presupuestos. Si además toca presupuestos, no certifica que esa imagen parcial mantuvo índices: requiere reconstrucción. Presupuestos normales se rechazan mientras esté invalidada. Otros cambios de autoridad pueden continuar invalidando bajo generación/revisión esperadas; nunca reactivan automáticamente.

La restauración de ready requiere reconciliación offline explícita contra todas las fuentes, política y destino estables; no un toggle. Este plan no observa cambios que eludan el guard. Antes de un corte deben cubrirse **todos** los escritores de Presupuestos y de autoridad, incluidos SDK/servidor: fence reservado/compatibilidad mediante el protocolo existente, revisión del inventario y pausa/drenaje. No se habilita un segundo mecanismo de coordinación. Un escritor viejo con otros claims vigentes no debe poder omitir este mantenimiento; la definición y prueba del gate de compatibilidad siguen pendientes.

## Límites de los avisos y lecturas futuras

El KPI puede leerse por metadata puntual con cobertura antes/después. La faceta empleado/mes se obtiene por hash dentro del scope autorizado. El prefijo diario requiere query desde el inicio, límite cinco, metadata consistente y unknownDates=0. Esos lectores/transporte todavía no existen aquí.

Los índices de avisos permiten consultar candidatos por estado/día. No certifican aún el total de una unión de rangos ni la paginación/orden global del centro. El badge heredado incluye todos los vencidos y compara fechas originales lexicográficamente; sustituirlo por contar sólo fechas ISO o una primera página cambiaría comportamiento. El lector badgeCounts resuelve sólo badge y próximos; el centro sigue pendiente. No agregar un reloj que reescriba diariamente cada presupuesto. Configuraciones, acciones, alias y fechas heredadas se mantienen como decisiones pendientes explícitas del contrato anterior.

## Evidencia local

Driver ficticio con guard real: alta, modificación anidada, reasignación y borrado; un commit original+derivados+recibo; replay sin callback; rechazo de metadata incompleta, before hash incorrecto, generación/revisión obsoletas y drift final; invalidación por autoridad; alias nuevo que falla cerrado; ausencia de campos pesados. Roundtrip con el normalizador RTDB compartido conserva huellas/metadata nullable y admite una segunda mutación incremental; no es una prueba de reglas o persistencia remota. Comparación de 1 y 1.001 presupuestos conserva cantidad de lecturas del planner y número de claves del commit para una modificación equivalente. No se presenta esa prueba de tamaño como benchmark de latencia productiva, el codec compartido sí se ejecuta en la operación. Para 1 y 1.001 originales se conservan 12 lecturas del planner y 21 paths de commit (dos más por el índice raw frente a la entrega anterior); el oráculo sólo contrasta el resultado.
