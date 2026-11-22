# Fases independientes de OT sobre el núcleo intermedio 1c18

Este bloque compone únicamente `1c18fa7c41e2dbff8c622976783fbbba0613080b`, código comprometido de E. **No habilita ON ni certifica rendimiento suficiente.** La separación entre descubrimiento del vínculo y consumo puntual sigue siendo otro trabajo de E.

## Contrato interno

Los constructores de Lifecycle, Delivery y OfficeCount admiten una factory opcional de servidor `createReferencePhase`, normalmente `IO.createReferencePhase` del núcleo. No existe un campo del cliente ni un import de IO en los consumidores. Sin inyección, el comportamiento previo continúa disponible.

La planificación recibe una fase propia. El control final crea otra desde `queryPageFresh`, con lecturas realmente nuevas. Después de ese control tampoco se conservan sus resultados para el commit.

El protocolo de Store solicita explícitamente `State.getReferencePort(actor, lease, {phase:'commit'})`. Tras comprobar usuario, rol, capacidad y fence, una factory privada WeakMap crea una fase nueva para esa invocación del protocolo. Los verificadores de otros custodios reciben ese mismo resolver de commit. El Symbol propaga autoridad, no una caché de planificación. No se reutiliza la fase fresca ni se depende de que el guard siempre llame los validadores en el mismo orden.

Las pruebas observan dos filas compartiendo consultas dentro de su fase y lecturas separadas en las fases 1 (planificación), 2 (fresco) y 4 (commit explícito); la fase 3 de compatibilidad no se comparte con el commit. La identidad/historia siguen verificándose por fila y hash del original.

Una ventana local de seis IO abarca `ports.read`, `ports.query` y la consulta cruda de páginas. Es distinta de la ventana interna E, para evitar adquirir recursivamente un slot de la misma ventana. El trabajo crudo termina en scope/Store/HTTP; no vuelve a entrar a la ventana local. Esto evita que seis consultas paralelas de E coincidan con otros cinco puntos de identidad sin límite común. Los lotes exteriores de Lifecycle y del protocolo de commit drenan todos los trabajos iniciados con allSettled antes de rechazar; no comienzan el siguiente lote. Se conserva el control fresco de autorización y CAS.

## Perfil ficticio y límites

La exportación de pruebas incorpora el módulo nuevo `office-stock-reference-io.js`, con huella fijada, además de los otros ocho archivos comprometidos. El helper ahora exporta el núcleo 1c18 en `tmp/audit-front-d/core1c18`. No se copió WIP de E ni se instalaron dependencias.

El perfil usa 641 productos ficticios con IDs numéricos, 138 resúmenes de otras OT y demora real simulada de 150 ms por IO. No congela el reloj ni amplía el lease de 30 segundos. El benchmark conserva error, cantidad de commits y `guardWindowExceeded`, y distingue `lease-window-exceeded-not-pass` aunque una fixture REST sin reglas remotas acepte el PATCH. Una respuesta de esa fixture no certifica el permiso de un commit real fuera del plazo.

Antes de la ventana común, ON mapeado completó en 9552 ms/181 solicitudes para un material, 23867/796 para seis y 44025/1534 para doce. Los casos seis y doce llegaron a **11 IO simultáneos**, aunque el perfil 0 ms había observado seis. El caso 44 segundos no es PASS del protocolo de lease: la fixture REST no emula su expiración remota. Se retiene como evidencia anterior, no como resultado publicable. La ventana común elimina ese solapamiento en la regresión con seis filas y lecturas demoradas.

La repetición con la ventana común terminó con estos resultados:

| Materiales | OFF: ms / solicitudes | ON sin vínculo: ms / solicitudes | ON con vínculo: ms / solicitudes |
|---|---:|---:|---:|
| 1 | 4274 / 45 | 6505 / 67 | 9814 / 181 |
| 6 | 4507 / 75 | 7897 / 202 | 24098 / 796 |
| 12 | 5530 / 111 | 12219 / 364 | **44061 / 1534 — no aprobado por plazo** |

Máximo seis IO en todos los escenarios ON. Una muestra por celda. En doce materiales vinculados se observaron planificación 509 solicitudes/13926 ms, fresco 511/14511 ms y commit 502/13749 ms; se ejecutaron 366 rangos independientes en cada una de esas tres etapas. La ventana corrige el solapamiento, no elimina el volumen de descubrimiento. El costo sin vínculo también sigue pendiente.

El último caso conserva `guardWindowExceeded:true` y `status:lease-window-exceeded-not-pass`. La fixture REST aceptó un PATCH después de iniciar el commit cerca del límite y terminar fuera de plazo; **no se presenta ese PATCH como una autorización remota válida ni como un PASS funcional del lease**. No se consultaron ni alteraron las reglas reales para resolverlo.

JSON privado `tmp/audit-front-d/ot-reference-core1c18-bounded-641-150.json`, SHA-256 `c6581bb4a3cb337e2cbdfb03d1004be944961602aadcb5fce5e6856b1d3ee70c`; conserva las trazas, fases y huellas del código. El antecedente sin ventana está en `ot-reference-core1c18-641-150.json`, SHA-256 `6720247497caa82c0b14c606cf7ee9a70d733d94027af092a1e32887daa7881d`. No extrapolar el costo del loader a una OT completa.

Los perfiles anteriores contra 01347 se conservan como antecedentes y no se ejecutaron otra vez. El arreglo 1c18 elimina el rechazo por bucket numérico en los casos con demora cero; sigue usando descubrimiento completo por consumidor, por lo que todavía resulta caro.

## Verificación y continuidad

18 archivos de dominio, **262 PASS, cero fallos, omisiones y cancelaciones**. Log privado `ot-core1c18-stage-domain.log`. Incluyen núcleo real, tres identidades, conteo, OFF exacto, revocaciones, alias concurrentes, fases separadas para Store, mezcla de lecturas de identidad/consultas limitada a seis, rechazo con drenaje de hermanos y ausencia de escrituras parciales. Sintaxis y diff se comprueban antes del commit; la suite global corresponde a integración central.

Al integrar, preservar los commits previos de latencia `ceb58abd` y `30f1819e`: esta rama parte de 652. El allSettled exterior aquí alinea la base de este frente con la intención de esos cambios centrales; no quitar su cola de alias ni su opción `parallelQueries`. IO es una dependencia transitiva nueva del núcleo: el frente que arme el paquete debe incluirlo en Docker. No hay builds, cambios de versión, SDK, reglas, permisos, rutas habilitadas ni operaciones reales en este bloque.

Siguiente paso: consumir el SHA de E que separe descubrimiento y consumo bajo las invariantes autorizadas, verificar mapeos huérfanos/cambios de propietario y repetir las nueve celdas con la fuente integrada. Mantener OFF hasta entonces.
