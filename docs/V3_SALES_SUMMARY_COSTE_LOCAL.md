# V3: trabajo de resúmenes de venta · propuesta local

Base de esta rama: `92479e43dd0be973295964c33fe6a5d63be5f17f`; referencia anterior comparada: `05be68ac4cbc92feb0318b849449d80bb4a48a9e`. Rama `codex/v3-sales-summary-cost`. No se modificaron reader/host de la entrega de búsqueda, índices, versión, SW, servidor8765, datos reales ni componentes de otros chats. No se reiniciaron builders ni puertas globales.

## Hallazgo

La resolución de venta y pagos ya usa índices; no se encontró un recorrido completo de las 10.000 ventas por cada consulta. Sin embargo, `summaryFor` llamaba a `saleTotal`, que construía el modelo económico, y luego volvía a construir el mismo modelo para la propiedad `economic`. El fixture de 50.000 resúmenes hacía **100.000 construcciones económicas**. En esa medición la construcción inicial del índice costó aproximadamente32ms; las consultas dominan el tiempo medido.

El cambio extrae un helper privado que recibe el modelo económico ya calculado. `saleTotal(sale)` conserva su API y sus reglas; `summaryFor` calcula una vez y comparte ese resultado únicamente dentro de la llamada. No hay caché persistente: ítems, total o pagos mutados entre llamadas se vuelven a leer. Tampoco se elimina la segunda validación de identidad de pagos ni el control exacto de redondeo del escritor. No cambia la complejidad asintótica; reduce trabajo y asignaciones redundantes.

## Comparación controlada

Windows x64, mismo ejecutable Node22.23.4 (`C:/SisVentas/tmp/node22-portable-20261104/node.exe`). Fixture ficticio idéntico:10.000 ventas,10.000 pagos y50.000 resúmenes. Cinco rondas alternando base/entrega/propuesta y orden inverso, procesos nuevos y secuenciales; mismo harness instrumentado para todas. La suma de control fue509950000 en las15 ejecuciones.

| Variante | Construcción mediana | Consultas mediana | Total mediano | Construcciones económicas |
| --- | ---: | ---: | ---: | ---: |
| Base05be | 31,1ms | 393,5ms | 424,2ms | 100.000 |
| Entrega92479 | 31,4ms | 408,9ms | 439,7ms | 100.000 |
| Propuesta | 32,0ms | 235,5ms | 267,3ms | 50.000 |

En esta serie, el total baja aproximadamente39% frente a la entrega92479 y el trabajo económico exactamente50%. Los tiempos absolutos dependen del entorno; la cuenta de trabajo no depende de un umbral de reloj.

El subtest original, sin modificar su límite1500ms, dio PASS en las tres variantes en el entorno actual:484,6ms(base),455,6ms(entrega) y294,7ms(propuesta). Cada archivo original completo dio35PASS/0FAIL. Esto no borra el rojo anterior: la puerta de búsqueda había observado1829,7ms, aislado2436,8ms y la base también había fallado. No se midió retrospectivamente la carga del equipo ni puede atribuirse esa demora exclusivamente a una causa de CPU. La duplicación de trabajo sí se identifica y elimina de forma demostrable.

## Pruebas y reproducción

Prueba nueva de presupuesto de trabajo: antes2PASS/1FAIL por2000 construcciones frente a1000 esperadas; después4PASS. Además comprueba mutación de importes y pagos entre consultas, cambios de ítems, cadena exacta del renglón, referencias ambiguas/sin venta y384 combinaciones fraccionarias de precio/cantidad/descuento/impuesto contra el escritor real.

Focal final:53PASS/0FAIL/0SKIP sobre `v3-sales-summary-work.test.cjs`, `v3-core.test.js`, `commercial-money-exact.test.cjs`, `sales-payment-line-rounding.test.cjs` y `cobros-anulados-atomicos.test.js`. Syntax y diff checks PASS. No sustituye la puerta conjunta de integración ni certifica todos los formularios financieros.

Harness versionado, sin red ni datos reales:

`node test/helpers/v3-sales-summary-benchmark.cjs <raíz-del-checkout-o-archivo-Git>`

Para reproducir una referencia, extraer `js/v3` de su commit con `git archive` a una carpeta temporal y usar esa raíz como argumento. El harness construye su propio fixture; no necesita ventas exportadas ni credenciales. Los datos y logs de esta comparación quedan ignorados en `tmp/v3-summary-comparison-frozen.private.{json,log}`; el JSON guarda las15 mediciones, versión, CPU de proceso y hashes de fuente/harness. Logs originales completos: `tmp/v3-core-{base,delivered,proposed}-current-env.private.log`. Focal final: `tmp/v3-summary-focal-final.private.log`. Rojo de trabajo conservado: `tmp/v3-summary-work-red.private.log`.

## Límite de entrega

Es una propuesta de fuente, no una versión publicada. El script de `js/v3` sigue referenciado en índice/SHELL con `?v=3.0.0-shadow-v279`: la integración debe mantener coherencia de URLs y caché antes de mostrarlo. No se recargó una ventana del usuario ni se probó un upgrade SW en este bloque. Sin push o publicación. El fallo temporal histórico no se reetiqueta como una puerta completa aprobada; corresponde volver a contrastarlo dentro de la integración autorizada.
