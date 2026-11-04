# Repetición nativa de la unidad conjunta 2a0798

Fuente exacta: `2a0798a9d25c62bc8c6640c494520c32348695d0`.

**14 PASS, 0 FAIL/SKIP, exit 0**: trece subcasos y su contenedor. Ejecutado con Node portátil **v22.23.4**, Firebase cliente 10.12.0, emulador RTDB 4.11.2 propio y servidor HTTP de loopback. No instalaciones ni servicios de producción.

La prueba `test/dashboard-native-cut-ee46.integration.cjs` conserva exactamente sus bytes y expectativas: SHA256 `B5B13FED6A567862301688ADBF875FA60235ED37624E2C4E75FAA52E7CAEAC14`. Commit de copia intacta: `b121802753106efaa0cbb94625d2c442c33b82da`. Se ejecutó fijando `SV_NATIVE_SOURCE_SHA` al SHA completo conjunto; su control de dependencias contrasta la fuente realmente cargada con ese commit.

## Evidencia aprobada

- Reglas standalone SDK extendidas con reglas mensuales, compiladas en emulador; SDK conectado, Fresh y Month reales. Admin `all` y regular `u_u`: dos presupuestos del nombre/mes, uno convertido, 50%. El regular no puede adquirir mensual `all`.
- Las cinco rutas GET del `cotizador/index.js` real, mediante HTTP real y store REST fresco, para admin y regular. Los lectores no pueden usar Admin cacheado, originales `sisventas`, otro origen o escrituras. Las cinco rechazan identidad inactiva, permiso Dashboard retirado y cobertura inválida.
- El mismo helper latest acepta ahora la evidencia después de REST. El diagnóstico conserva `sameValues:true` y `serializedEqual:false`: la corrección acepta los valores sin depender del orden de propiedades; no se ajustó el fixture para reconstruirlas.
- Host `ownMonthly`, contexto y Readiness reales: **un GET Ventas**, contador exacto **501**, últimas personales **s0500, s0499, s0498, s0497, s0496**. Otras diez ventas de otro creador dominan el prefijo global y una venta ajena comparte creador textual; no se confunden con el scope personal.
- El contexto tiene exactamente `ventas:own` y los otros tres grants nulos, mediante módulo Facturas; no se habilitan permisos de actividad global. Cada fila personal contiene sólo `key`, `number`, `client`, `clientRecordKey`, `rawDate`, `totalCents`; centavos exactos 1234 y ausencia de datos privados.
- Demanda concurrente deduplicada, `peek` y `ensure` ya satisfecho sin nueva red; Readiness sólo completa `dashboardActivity`, nunca Ventas/Pagos/OT/Presupuestos ni Dashboard global. Los originales ficticios permanecen idénticos.
- Cambio de membresía durante lectura invalida latest y conserva contador, sin fabricar vacío. Reset real con mismo UID retira el pendiente; sólo una nueva demanda explícita recupera latest completo. Revocar el grant Ventas durante el GET impide publicar, sin originales ni fallback.

Se comprobó puerto 9059 libre antes de iniciar; namespace ficticio aleatorio vaciado y verificado al terminar. El runner detuvo sólo el Java creado. No se tocaron procesos ajenos, reglas remotas, configuración externa, Auth real, Docker remoto, push o publicación.

## Rojo conservado y manifiesto

El antecedente `ee46d78edbcad865a09b159dbac325b9cf25903a` sigue **10 PASS / 4 FAIL** con esta misma prueba, incluidas tres fallas de latest y el padre. Sus logs, manifiesto y diagnóstico originales permanecen intactos, evidencia `1e978a741a3f6de88986a2a96668c9b7de8a07da`. No se reetiquetan sus resultados como verdes; el presente verde corresponde exclusivamente a la unidad nueva.

`DASHBOARD_NATIVE_CUT_2A0798_MANIFEST.json` registra Node y su binario, reglas compiladas, test, dependencias ejecutadas, activos adicionales del índice/SHELL, resultados y SHA256 de ambos pares de logs/manifiestos. Los bytes locales de las dependencias se contrastaron con Git normalizando sólo LF/CRLF; los activos adicionales se contrastaron mediante `git diff --quiet` contra el mismo SHA y sólo se hashearon. No se atribuye ejecución browser a esos activos.

Log nuevo privado: `C:/SisVentas/tmp/stage1-integral-plan/dashboard-native-2a0798-first/test.private.log`. La evidencia cruda y los datos ficticios no se añaden a Git. Los hashes están en el manifiesto versionado.

## Límites

Verificador de token ficticio ligado a UID/audiencia del namespace; owner sustituye sólo la credencial de servicio del backend. Día fijo 2026-11-04 y clonación del borde VM del contexto; algoritmos, puertos, modelos y lectores reales. Las reglas son propuestas standalone, no un despliegue ni auditoría de reglas productivas. Esta corrida no es navegador final, prueba financiera real, imagen Docker ni puerta general. Root ejecuta su puerta general separada sobre la misma fuente. No hubo recarga de la ventana del usuario.
