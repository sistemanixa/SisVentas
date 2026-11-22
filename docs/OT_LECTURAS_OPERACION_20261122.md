# Lecturas OT por operación: mejora acotada

Fuente previa `8499795d`, consumidores OT sobre la base publicada `060c77f8`. Cambio separado de vínculos Stock, sin habilitar resolver o mapping. Sólo afecta planificación interna de `ot-lifecycle`.

## Duplicación y cambio

La consulta de catálogo por `codigo`/`cod` devuelve el original completo de cada producto. La planificación después hacía otro GET puntual del mismo registro. Se conserva ese original en el mapa de lecturas de la invocación actual; dos respuestas incompatibles para una misma clave rechazan la preparación. No hay cache global, TTL, reutilización entre operaciones, keepalive ni cambios de cold start.

Se conservan los GET puntuales frescos y las queries frescas del precommit, la lectura autenticada del inventario, validación independiente del store, autorización inicial/final y lectura autenticada de OT después del guard. No se cambia el presupuesto de lecturas de esas fases ni sus negativos de concurrencia.

## Instrumentación de pruebas

El helper `ot-performance-fixture` puede anotar fase, path, query, identidad de lectura y tiempo de IO. Envuelve únicamente el guard del doble para identificar planificación/precommit/commit; el runtime y las funciones de producto son los reales del checkout. La instrumentación no se instala en producción.

| Fase | Antes | Después |
| --- | ---: | ---: |
| Preflight | 8 | 8 |
| Guard | 2 | 2 |
| Planificación | 27 | 23 |
| Validación previa de commit | 1 | 1 |
| Precommit | 28 | 28 |
| Commit, incluida validación independiente | 16 | 16 |
| Después del guard | 1 | 1 |
| Total solicitudes del doble | 83 | 79 |

Concurrencia máxima seis y un commit en todos los ensayos. No se retiraron comprobaciones para conseguir la reducción.

Tres pares con retardo configurado de 6 ms por IO ficticio, antes usando el runtime de `proposal-qr-local-20261115` sin modificarlo y después el propio: antes 862/490/488 ms, después 518/484/463 ms; medianas 490/484 ms. Hay variación del host y del temporizador; **no demuestra resuelta la latencia productiva**, ni acredita mejora real de los incidentes históricos. El resultado estable es la reducción de cuatro lecturas redundantes de planificación, no una promesa de tiempo.

## Regresión y evidencia

Presupuesto nuevo rojo antes del cambio: 6 PASS/1 FAIL. Después: 120 PASS/0 FAIL/0 SKIP en rendimiento, comandos de ciclo, compatibilidad histórica, documentos y precommit acotado. Incluye denegación fresca de inventario, catálogo alterado, respuestas de catálogo incompatibles, replay, conservación documental/financiera y aislamiento entre operaciones. Sintaxis y diff correctos. No nueva suite global; la integra el coordinador.

Logs privados en `tmp/audit-front-d/`:

| Archivo | SHA-256 |
| --- | --- |
| ot-latency-budget-red.log | 92fea5c9f7668e182866a021218fdc8b39d89335d44bee3383990d2c324cef03 |
| ot-latency-focal-green.log | f9d77ea6af0e4d9815f76e7156ab0c276fdf05d6a15635615000e6448b93801b |
| ot-latency-paired.json | d9c114548620326b80bdd667a0a7d3da2a3df0f9f2ba35d95c936b94e2831370 |

Sin consultas, operaciones, ajustes de stock, permisos, despliegues o datos reales. El parche de consumidores de vínculos se entrega por separado cuando esté fijado su contrato interno.
