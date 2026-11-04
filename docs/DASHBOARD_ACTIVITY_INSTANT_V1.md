# Instante de actividad con zona explícita

2026-11-04. Base aislada ca71ed48. Módulo inactivo `js/core/dashboard-activity-instant.v1.js`, CommonJS o global UMD `SVDashboardActivityInstantV1`. Exporta `canonicalZone(zone)` y `legacyMs(fecha, ts, zone)` síncronos. Core puede importar esta última función sin modificar el helper.

La zona es obligatoria y se valida incluso cuando `ts` tiene precedencia. Se aceptan identificadores/alias reconocidos por Intl; se rechazan zonas inexistentes, omisiones y offsets numéricos. La canonicalización depende de ICU/tzdata del runtime; no promete que distintas versiones de ICU devuelvan el mismo alias textual.

Se preserva `if (ts) return Number(ts) || 0`, incluidos negativos, fracciones e infinitos. Sin timestamp verdadero, se conservan prefijos ISO/DDMM, año DDMM menor que 100 más 2000, regla Date de años ISO 0..99 más 1900, desbordes de mes/día y cero ante fecha no reconocida. Una medianoche repetida elige el instante anterior; una inexistente avanza por el salto, como el constructor local de Date. No se usa ni modifica TZ global.

La resolución obtiene offsets de Intl alrededor de la fecha normalizada (±72 horas, muestras cada seis horas), calcula candidatos y compara sus calendarios locales. La matriz contrasta el Core legacy sin modificar en hijos con la zona objetivo y el helper en hijos UTC/Buenos Aires: seis zonas, 33 entradas por zona y host. Incluye Buenos Aires 2008, medianoche ambigua de La Habana, salto de São Paulo, fecha omitida de Apia y salto de quince minutos de Katmandú. Se fijan además cuatro instantes UTC esperados y se verifica UMD. No es una demostración exhaustiva de toda la historia de tzdata ni de navegadores con otra versión de ICU.

Prueba focal: `node --test test/dashboard-activity-instant-v1.test.cjs test/dashboard-activity-model-v2.test.cjs`: 15 PASS, cero FAIL/SKIP (9 nuevas, 6 existentes). Sintaxis de ambos archivos y diff-check: PASS.

Se ejecutó también `scripts/test-current.ps1` en este checkout nuevo: exit 1, 8.734 casos, 8.630 PASS, 76 FAIL y 28 SKIP. Los errores observados incluyen ausencia de `playwright` y denegación de escritura de `.git/config` en fixtures temporales por el sandbox. No se clasificaron individualmente los 76 fallos ni se presenta la suite general como aprobada. Logs privados: `C:/SisVentas/tmp/stage1-integral-plan/dashboard-activity-instant-current.private.log` y `dashboard-activity-instant-focal.private.log`; no se versionan.

No se cambian Money, fechas comerciales, aplicación activa, codecs, configuración del servidor ni registros reales. Falta integrar explícitamente el helper y propagar la zona del contexto en los consumidores; esta entrega sola no corrige su dependencia de TZ.
