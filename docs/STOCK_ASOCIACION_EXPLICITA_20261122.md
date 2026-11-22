# Descubrir una referencia y usar una asociación existente — 22/11/2026

Estado: OFF y sin registro en runtime. Este incremento no activa una bandera, firma un certificado real, aplica reglas o cambia datos reales. La admisión rápida queda condicionada a la composición y verificación central de todos los artefactos y reglas de la cohorte.

## Invariantes y límite de autoridad

Crear/corregir un vínculo sigue usando **siempre** `office-stock-link-command.loadSnapshot` y cobertura dirigida completa. La vía rápida no se conecta a ese comando, no emite su capacidad de escritura y no permite crear una asociación sin inventario físico. `allowAbsent` se usa para descubrir ausencia en consumidores; incluso con ese loader, Link rechaza inventario inexistente.

Usar una asociación explícita requiere el contrato de namespace cerrado de B: ambos registros comparan sus ocho campos, oldPair conserva P/J/identidad histórica al aumentar revisión, cada alta/corrección tiene sus dos recibos y el commit Link solo alcanza los cinco destinos autorizados. Las capacidades SDK anteriores deben estar retiradas y los consumidores de Stock/Compras/OT/UI deben coincidir con los pins firmados. Ese conjunto hace que un cambio posterior de código/id del catálogo no reinterprete la relación explícita P→J.

`createMappedAdmission({enabled:false,expectedPins,expectedContract,expectedRulesDigest,publicKey,now})` del nuevo módulo explicit-reference verifica el documento privado `sv_stock_reference_config/activation` mediante el verificador Ed25519 de B. Su archivo es una copia exacta del blob `10c9d34017e76de2b905e033a3bd41faea6c66a8` de a0bbf71f, sin cambios al verificador.

Debe cumplirse **hash del manifiesto completo expectedContract = expectedPins.contractDigest**. Dentro de ese manifiesto, `stockReferences` debe coincidir exactamente con `STOCK_REFERENCES={schema:1,mode:'immutable-explicit-reference',invariantDigest:INVARIANT_DIGEST}` reconocido por la factory. INVARIANTS/INVARIANT_DIGEST se exportan para revisión de B y construcción del manifiesto total; no sustituyen su hash global. La firma debe coincidir además con rulesDigest, generación y los cuatro codePins esperados de servidor. La autoridad y admisión se reconocen mediante WeakSet/WeakMap locales, no por un objeto serializable, un booleano o un campo cliente.

Esto es una condición verificable de admisión, no un sustituto de auditar/desplegar las reglas que acredita el firmante. E no certifica por sí solo que la candidata remota implementa estos invariantes. Sin firma/manifiesto/pins correctos, el modo rápido falla cerrado y no cambia silenciosamente al lector anterior. Sin configurar `mappedAdmission` se conserva el resolver anterior de cobertura completa; el modo rápido sigue OFF por defecto.

## Asociados

`createReferenceResolver({enabled,mappedAdmission})` y `createStockReferenceResolver({enabled,assertBarrier,mappedAdmission})` aceptan la autoridad solo como dependencia de servidor. Primero se verifica el original de servidor y la historia por fila del consumidor. Para historia confirmada, la identidad del recibo debe coincidir con la asociación; para una primera operación, el producto canónico del original debe coincidir con P y el inventario físico verificado debe ser J. Un hint de código no puede cambiar esas identidades.

El inverso físico J identifica el candidato explícito; luego se verifica forward P/inverse J exactos, forma/revisión/origen, producto P actual, ledger J y sus etiquetas de propietario. Ambos recibos de origen deben coincidir en uid, operación, P/J/identidad/revisión, ok/committed, y tener forma válida. Inactivo está bloqueado para el consumidor genérico; Stock conserva únicamente su excepción de conteo cero para un inactivo exacto. Servicio/eliminado y propietario contrario siempre se rechazan.

Los puntos de activación, producto, ledger, mappings, recibos y original/historia pasan al readSet. El check final vuelve a leerlos; una revocación, cambio de mapping, catálogo/original o recibo aborta. No hay búsquedas globales de alias al usar el vínculo, y no se devuelve una supuesta cobertura global. Las cantidades, costos y recibos históricos no son reescritos por resolver.

## No asociados

Con original canónico P y forward/inverse P ausentes, un ledger **P ya existente**, con etiquetas de propietario ausentes/P, se conserva como legado exacto. No se infieren otros alias, no se crea otro inventario y el consumidor sigue verificando su historia por fila. Una identidad histórica fuera de P o un físico original distinto se rechazan para revisión; no se cambia su identidad por aproximación.

Si falta ledger P, se ejecuta la cobertura dirigida completa, incluidas membresías y aliases normalizados, antes de admitir un conteo inicial. Un J huérfano identificable por esas referencias bloquea la operación. No se convierte en P ni se regulariza mediante una rama sombra. La aparición de ese J entre revisión y commit también aborta. Esta prueba no atribuye a P un registro sin ninguna referencia demostrable a P.

## Concurrencia, pruebas y medición

IO.boundedRead/memoRead reconocen lectores ya acotados y evitan anidar dos leases del mismo pool. Los memos viven en un snapshot individual; el consumidor puede usar un memo **nuevo de readFresh** dentro de su check final para coalescer puntos repetidos de una cohorte, sin reutilizar snapshots de planificación ni ocultar cambios del overlay. `mapOrdered` drena todos los trabajos iniciados y conserva el máximo global seis.

30 pruebas nuevas cubren manifiesto total/descriptor/firma inválidos, shape/origen de pair, propietario contrario, historia inmutable, código/id renombrados después de L, primera operación de otro producto, compras, legado exacto sin queries, J huérfano, ausencia seguida de fantasma y cambio de mapping/catálogo/actor antes del commit. Se añade una regresión que demuestra que ausencia descubierta no autoriza Link contra inventario inexistente. Los 171 casos anteriores continúan pasando (202 en total).

Benchmark opt-in con 150 ms ficticios, originales/recibos generados por los modelos y Link reales de prueba, lecturas compartidas como las de un guard y memo nuevo solo para el check final:

| Modo | Registros | Resolver | Check fresco | Lecturas planificación/frescas | Queries | Máximo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Asociado | 1 | 844 ms | 319 ms | 8 / 8 | 0 | 6 |
| Asociado | 6 | 1.258 ms | 1.093 ms | 38 / 38 | 0 | 6 |
| Asociado | 12 | 2.195 ms | 2.031 ms | 74 / 74 | 0 | 6 |
| Legado exacto | 1 | 938 ms | 156 ms | 6 / 6 | 0 | 6 |
| Legado exacto | 6 | 938 ms | 781 ms | 26 / 26 | 0 | 6 |
| Legado exacto | 12 | 1.566 ms | 1.404 ms | 50 / 50 | 0 | 6 |

Son tiempos del resolver, **no de una OT completa ni de su lease**. El benchmark usa reloj fijo de fixture y no acredita expiración real. D debe repetir el comando completo 1/6/12 con el nuevo SHA y compararlo con su baseline antes de habilitar. Continúan pendientes la revisión B del descriptor/manifiesto global, el empaquetado de explicit-reference/activation-contract y la integración central. No se modifica index, versión, rutas, lista, reglas o activación desde E.
