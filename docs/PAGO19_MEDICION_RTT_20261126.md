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
