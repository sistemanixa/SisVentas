# Lector de pagos: latencia, 2026-11-26

Base revisada: 7714ce9b. Alcance local; sin datos reales, despliegue ni Rules.

## Cambio

`createBusinessAuth.verifyIdTokenWithContext(token, afterVerified)` verifica primero el token con revocación. Sólo entonces inicia en paralelo el control fresco de `sv_access_resets` y el contexto privado de esta autorización. Espera ambos, incluso ante error. No reutiliza contexto entre solicitudes. El método anterior `verifyIdToken` mantiene su contrato.

Ownership usa el nuevo método cuando lo provee el wrapper de confianza. Los adaptadores anteriores conservan la ruta anterior. En lectura scoped, el permiso del rol actual comienza apenas termina la lectura del rol, sin esperar la consulta independiente del perfil. No usa UID anticipado del cliente ni rol anterior.

El GET de historial selecciona explícitamente concurrencia 16 para snapshot y revalidaciones independientes. `payment-snapshot` y `pool` mantienen 6 por defecto, incluidos sus consumidores financieros. Valores permitidos: enteros 1..16. Cada grupo drena sus trabajadores antes de propagar error.

Orden de barreras intacto: fuentes originales → revalidación de fuentes → autorización final → lectura final como usuario/propiedad → cobertura final → respuesta. Las lecturas no forman una transacción atómica; Rules y lecturas finales siguen imponiendo sus controles. No se agregó caché entre peticiones, polling ni fallback de servicio.

## Evidencia

`node scripts/measure-payment-reader-latency.cjs 7714ce9b` compila en memoria los cuatro módulos anteriores desde Git y compara el mismo fixture ficticio. Usa Ownership, lector y Store REST reales con transporte simulado, una venta con alias múltiples y perfil de 2 RTT. Mismas 39 lecturas, cero escrituras:

| RTT | Anterior | Nuevo |
| --- | ---: | ---: |
| 20 ms | 589 ms | 409 ms |
| 80 ms | 1850 ms | 1218 ms |
| 175 ms | 3733 ms | 2439 ms |

Son muestras locales con demora artificial, no una predicción de percentiles de producción. Incluyen autorización inicial y recorrido del lector. Las consultas de perfil cuentan como una lectura en ambos lados.

116/116 pruebas focales: authorization-latency, payment-guard-integration, commercial-sale-payments, commercial-sale-payments-http, commercial-ownership y user-access. Incluyen token revocado sin lecturas posteriores, reset concurrente, roles/permisos/perfil ambiguos, propiedad, fuentes/cobertura, override de usuario, ausencia de caché, drenaje de errores y concurrencia por defecto/opt-in. Syntax y diff check correctos.

No se ejecutó emulador ni navegador. Los scripts separados commercial-ownership.integration/user-access.integration requieren configuración de emulador/dependencias que este checkout no tiene; sus intentos fallaron antes de ejecutar pruebas. No se ejecutó suite global. Root debe integrar, auditar y medir servidor antes de publicar.
