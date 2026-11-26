# Pago19: medición reproducible de rondas de lectura

## Alcance y fuente

Reproductor ficticio; **no es una medición nueva de producción**. No abre navegador ni red, no modifica producto y no ejecuta Guard/lease ni escrituras. Ejecuta la rama literal `/comerciales/ventas/registro/sale?para=pagos` y su `send` JSON, con `createBusinessAuth`, Ownership scoped, PaymentSnapshot y RESTStore originales del mismo directorio. Sólo sustituye las fronteras de Firebase Auth/Admin/REST por memoria con un temporizador por operación. El token, usuario, venta y pago son ficticios. El transporte verifica identidad, permisos nativos y propietario; no certifica Rules remotas.

Git: `7714ce9bd35fd711fa09f6265d7b2d686ac466e4`, fuente funcional publicada `f2c4c870ff06f82f2fd4e2945da1b42a2cfa8d76`. Runtime recibido: snapshot privado `payment-flow19-combined-runtime-f2c4c870ff06f82f2fd4e2945da1b42a2cfa8d76/root/cotizador`. Sólo se cargan módulos de código conocidos; no se inspeccionan credenciales/configuración ni se copian archivos privados al repositorio.

El índice completo y RESTStore difieren entre Git y runtime. Tras normalizar CRLF, sí coinciden `commercial-sale-payments`, `commercial-ownership`, `payment-snapshot` y `user-access`. La rama comercial medida coincide exactamente, SHA256 LF `cdf91ec4730cd561114b7e67b8c8c742a08af88f05a5cb08e50fabcb155cafa8`. Los hashes de cada módulo, tanto crudos como LF, quedan en cada reporte. Esto acredita ese recorrido, no la equivalencia general de Git y runtime.

## Ejecución

```powershell
$env:PAYMENT_MEASURE_SERVER_ROOT='<directorio cotizador revisado>'
$env:PAYMENT_MEASURE_RTT_MS='175'
$env:PAYMENT_MEASURE_RICH_ALIASES='true'
$env:PAYMENT_MEASURE_OUTPUT='<archivo local de salida>'
node scripts/measure-sale-payment-rtt.cjs
node --test test/sale-payment-rtt-measure.test.cjs
```

Con `RICH_ALIASES=false` se usa una venta con cuatro buckets. Con `true` se agregan tres referencias históricas ficticias: diez buckets. Ambos tienen un solo pago global por 40 y `venta.pagos=[]`. No se afirma que la venta real tenga esos alias. El módulo determina los buckets con el Matcher/Index original; no inventa ni elimina pertenencias.

En el JSON, `baselineCriticalRoundsModel` y `baselineIdealCriticalMs` son exclusivamente el modelo publicado19 (Auth de cuatro rondas, pool de seis). No son una cuenta medida de rondas de una candidata. Para comparar versiones se usan `elapsedMs`, eventos con inicio/fin y los tiempos de fase nativos; no se atribuye automáticamente el modelo anterior a código nuevo.

## Resultados del reproductor

Una ejecución secuencial por caso, RTT configurado 175 ms. Windows despertó los temporizadores aproximadamente a los 185 ms; los tiempos de pared incluyen esa demora y CPU. Las rondas críticas se derivan de dependencias, **no** de dividir el tiempo de pared por 175.

| Caso | Rondas críticas | Ideal a 175 ms | Pared medida | Lector nativo | Snapshot | Validar fuentes | Auth final | Original final |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Runtime, diez buckets | 17 | 2975 ms | 3178 ms | 2232 ms | 556 ms | 378 ms | 745 ms | 189 ms |
| Runtime, cuatro buckets | 15 | 2625 ms | 2827 ms | 1878 ms | 381 ms | 189 ms | 747 ms | 187 ms |
| Git, diez buckets | 17 | 2975 ms | 3176 ms | 2242 ms | 566 ms | 381 ms | 742 ms | 176 ms |

La evidencia de producción aportada por Root era total 3397 ms, lector 2249 ms, Auth final 739 ms, original final 167 ms, Snapshot 507 ms y validación 339 ms. La reproducción explica una estructura compatible; no identifica todos los factores de producción. En particular, el tramo inicial aportado (~1148 ms) supera el tramo ficticio (~946 ms): no se atribuyen esos ~202 ms a una causa sin trazas adicionales.

Para diez buckets hay 37 operaciones externas ficticias: 2 verificaciones Auth, 2 resets, 2 roles, 2 consultas de perfil, 2 permisos, 3 lecturas de venta, 2 coberturas, 20 lecturas de pertenencia y 2 del pago. Con cuatro buckets son 25. Máximo observado: seis operaciones concurrentes. Cero escrituras; originales byte-equivalentes al terminar la consulta exitosa.

En el caso de diez buckets, los cuerpos/respuestas JSON ficticios suman 2120 bytes y el DTO HTTP 383 bytes. El contador de solicitud suma 4470 bytes de rutas/parámetros y token ficticio modelados; **no mide TLS, cabeceras HTTP completas, protobuf, compresión ni facturación**. El tamaño reducido de estos fixtures no representa el de los originales reales.

| Componente de acceso | Llamadas | Respuesta ficticia total | Dependencia por autorización |
|---|---:|---:|---|
| Auth token revocado | 2 | 106 B | Primero |
| Reset privado | 2 | 82 B | Después de Auth |
| Rol | 2 | 64 B | Después del reset, paralelo a perfil |
| Perfil por UID | 2 | 178 B | Después del reset, paralelo a rol |
| Permisos del rol | 2 | 230 B | Después de rol y perfil |

## Ruta crítica y diagnóstico

Para diez buckets: Auth inicial 4 rondas → original inicial 1 → cobertura inicial 1 → Snapshot 3 → validación de fuentes 2 → Auth final 4 → original final 1 → cobertura final 1 = 17. Snapshot consulta diez buckets en dos olas de seis, luego un pago. Validación consulta doce fuentes en dos olas. Con cuatro buckets se elimina una ola en cada fase: 15 rondas.

`sourceValidationMs` mide duración de fase, mientras `serviceReadMs` suma lecturas concurrentes: no son magnitudes aditivas comparables. Tampoco todas las lecturas iniciales de Snapshot pasan por `timedStore`. Las dos coberturas (~dos RTT) están dentro del total del lector y fuera de las cuatro fases principales; su ausencia en una suma parcial no implica trabajo perdido.

## Reducciones posibles y límites de seguridad

1. **Candidato para A/B:** tras verificar el UID/token, iniciar reset y contexto de acceso en paralelo, esperando y validando ambos antes de emitir el actor. Actualmente `createBusinessAuth` termina reset antes de que Ownership inicie rol/perfil. El solapamiento reduce estructuralmente una ronda por autorización, hasta dos rondas en esta ruta (350 ms ideales en este modelo), sin omitir el reset. No se implementó ni se afirma ahorro de producción. Deben mantenerse los rechazos ante reset, cambio de rol/permisos y UID distinto; el actor privado de un uso no se serializa ni reutiliza entre peticiones.
2. **Candidato condicionado a carga:** mayor concurrencia acotada podría eliminar una ola de Snapshot y otra de validación con diez buckets. El techo ilustrativo es otras dos rondas, a costa de mayor presión simultánea. No se ensayó ni modificó el pool compartido. No es una autorización para leer el padre del índice o la colección de pagos, saltar permisos o eliminar alias del Matcher.
3. **Conservar barreras:** no quitar Auth final, lectura final de propietario, comparación de originales ni cobertura final. No solapar fases de forma que la autorización final empiece antes de terminar las comprobaciones de fuentes. No cachear Auth/reset/perfil/rol/permisos entre solicitudes. Repetir un original bajo usuario valida cambios concurrentes y no es automáticamente una lectura redundante.

La prueba focal verifica éxito genuino y conservación de fuentes, presencia de claims de usuario en REST, dos comprobaciones separadas de cada componente de acceso y rechazo ante reset o revisión de permisos cambiados antes de la autorización final. Es prueba de composición local, no de Firebase Auth ni Rules reales. No se ejecutó suite global, navegador ni negocio real.

## Comparación con candidata A, 26/11/2026

Candidata A `349a888bf9fea7239b4ea5802f6035cbcfd377ae`, integrada en Root `908a08c4`. Se midió directamente `C:/SisVentas/.local/payment-final-20261126/cotizador`, sin copiar otro core ni alterar sus archivos. El antes usa el snapshot runtime150 ya descrito. Las dos fuentes ejecutan la misma rama literal comercial y producen el mismo DTO ficticio. En ambos se mantienen 37 operaciones, fuentes intactas, un pago visible y cero escrituras. Mismo fixture de diez buckets, ejecuciones secuenciales, una por combinación:

| RTT ficticio | Fuente | Total local | Lector | Auth final | Snapshot | Validación | Original final | Pico concurrente |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 175 ms | Antes | 3195 ms | 2267 ms | 754 ms | 567 ms | 382 ms | 188 ms | 6 |
| 175 ms | Candidata | 2450 ms | 1694 ms | 569 ms | 374 ms | 186 ms | 189 ms | 12 |
| 80 ms | Antes | 1594 ms | 1128 ms | 374 ms | 285 ms | 188 ms | 95 ms | 6 |
| 80 ms | Candidata | 1220 ms | 846 ms | 282 ms | 191 ms | 94 ms | 94 ms | 12 |

Ahorro local observado: 745 ms a RTT175 y 374 ms a RTT80, aproximadamente 23% en esta ejecución sintética. No es una estimación certificada de ahorro en producción. Los temporizadores reales del host superan el RTT configurado; por eso no se obtienen rondas dividiendo estas duraciones por 175/80.

La traza de Auth final a RTT175 confirma el cambio de orden: antes, Auth 0–189 ms, reset 189–379, rol/perfil 379–566 y permisos 566–753. Después: Auth 0–190, reset/rol/perfil 190–379 y permisos 378–568. El contexto empieza sólo con identidad verificada; reset y contexto se esperan antes de emitir el actor. Se conserva la nueva autorización después de validar fuentes.

La inspección de las dependencias, respaldada por inicio/fin de eventos y tiempos de fase, da Auth 4→3 rondas por autorización; Snapshot de diez buckets 3→2 (una ola de buckets y luego el pago); validación de doce fuentes 2→1. La cadena completa baja de 17 a 13 rondas, ideales 2975→2275 ms a RTT175, o 1360→1040 ms a RTT80. **Los campos JSON `baselineCriticalRoundsModel=17` siguen siendo sólo la referencia19**, incluso al medir la candidata. Las trece rondas se explican aquí mediante las nuevas dependencias; no se presentan como salida de aquel cálculo fijo.

La prueba focal conserva todos los conteos de acceso y fuentes, y exige para el GET un pico mayor que seis y menor o igual a 16. Su expectativa por defecto ahora es 16, propia de la candidata integrada; para repetir el baseline anterior se fija `PAYMENT_MEASURE_EXPECTED_READ_CONCURRENCY=6`. Este parámetro pertenece exclusivamente al test, no configura el negocio. El pool compartido real, ejecutado con veinte trabajos y sin opción de concurrencia, mantiene máximo seis. También se comprueba la firma nativa del Snapshot financiero con default seis y el rechazo de límites GET 0/17. Esto comprueba el default/pool, no ejecuta una operación financiera nueva.

Focales: cuatro PASS sobre runtime150 con expectativa seis; cuatro PASS sobre candidata con expectativa16; reset y revisión de permisos cambiados siguen rechazándose. No se amplió la puerta a otras suites ni se probaron datos, red o permisos remotos. Los reportes locales son `tmp/payment-compare-{before,after}-{175,80}-20261126.private.json`; no se incluyen artefactos privados en Git.

### Caso mínimo: cuatro buckets, RTT175

Root confirmó posteriormente, mediante metadatos privados preexistentes, que la venta señalada tiene **cuatro buckets**, no diez. No se importaron sus valores ni claves al reproductor. Por tanto, el ahorro del fixture rico anterior **no representa esa venta**. Se repitió únicamente el fixture mínimo ficticio:

| Fuente | Total local | Lector | Auth final | Snapshot | Validación | Original final | Llamadas | Pico |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Runtime150 anterior | 2828 ms | 1888 ms | 755 ms | 377 ms | 190 ms | 189 ms | 25 | 6 |
| Candidata Root | 2427 ms | 1674 ms | 565 ms | 362 ms | 185 ms | 190 ms | 25 | 6 |

Son 401 ms menos (~14%) en esta ejecución local; fuentes intactas y cero escrituras. La cadena pasa de 15 a 13 rondas, ideales 2625→2275 ms a RTT175. Cuatro buckets ya cabían en una ola y sus seis validaciones también: **el pool16 no elimina rondas en este caso**. La mejora estructural corresponde a dos rondas menos de autorización. Persisten aproximadamente 2,4 s locales bajo este modelo, no una predicción exacta de producción.

Los tamaños reales aportados por Root (~7 KB de venta, ~258 B de pago) tampoco se convirtieron en datos de fixture ni en una descarga real. No respaldan por sí mismos una hipótesis de transferencia masiva. La distancia entre regiones de servidor/base es una hipótesis adicional aportada por Root: este reproductor no mide red geográfica ni acredita la ubicación efectiva o su contribución a la latencia. No se investigó ni cambió infraestructura. Reportes mínimos: `tmp/payment-compare-minimal-{before,after}-175-20261126.private.json`.
