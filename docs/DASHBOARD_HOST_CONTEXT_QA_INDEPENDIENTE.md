# Contexto del host: QA independiente sobre831ea79b

## Cierre sobre0edac181

04/11/2026. **Falla de procedencia incompleta cerrada.** Repetición independiente de los ocho casos propios intactos sobre `0edac181`: **8 PASS, 0 FAIL/SKIP**. El test conserva SHA256 `b39bc433545c71478476910939a508e6bb18de035aa1e7cf508e353a41a6a518`. La metadata sin booleano explícito ahora toma servidor autorizado; ausencia certificada permite directo y denegación de dashboard conserva grants null.

Context ensayado blob `44a7a94da1075f2d218a5b14b7d48e3fdb4bfb6d`. Comando `node --test test/dashboard-host-context-independent.test.cjs`; log privado `C:/SisVentas/tmp/dashboard-host-context-boolean-independent-after.private.log`, SHA256 `04722b4c08fab8ac1b59d10f84d05b4ba2bd77425b5f2b845abac664a91f1197`. Se conserva debajo la reproducción roja histórica. No se repitió puerta general, nativo ni backend mensual administrativo; sus cambios WIP ajenos permanecen separados. Sólo se actualiza este documento propio, sin staging ni modificaciones funcionales.

04/11/2026. Alcance acotado a Readiness real, Source y Aggregate reales; sin modificar fuentes, staging, puerta general, pruebas nativas ni datos reales. Se conservaron los cambios mensuales ajenos presentes en el checkout y no se ejecutaron sus pruebas. Los módulos revisados no tienen diferencias frente a831ea79b.

## Hallazgo: procedencia incompleta habilita ruta directa

Con configuración de rol válida y normalizada sin bloqueados, asignar `_svDashboardRawBlockedPresence={admin:{revision:7}}` (revisión vigente, campo `present` ausente) hace que `capture().rawBlockedExists` sea undefined y `decision().kind` devuelva **direct-rtdb**. El contrato conservador requiere **authorized-server** para procedencia desconocida. Context delega el undefined a Transport.plan, cuyo comportamiento legacy interpreta ese valor como ausencia conocida si config no posee bloqueados.

La reproducción queda roja e intacta en `test/dashboard-host-context-independent.test.cjs`, caso `unknown or stale raw metadata selects authorized server without broadening grants`. Metadata totalmente ausente y revisión desfasada sí toman servidor. El hook normal de aplicación de Roles produce booleanos, por lo que no se afirma que él genere este estado incompleto ni que la falla amplíe reglas RTDB remotas. El defecto es la selección conservadora de transporte ante metadata parcial del host.

Resultado focal: **31 PASS, 1 FAIL, 0 SKIP** (ocho propios, siete existentes de contexto y17 Source independientes). Comando: `node --test test/dashboard-host-context-independent.test.cjs test/dashboard-host-context.test.cjs test/dashboard-budget-source-readiness-independent.test.cjs`. Log privado `C:/SisVentas/tmp/dashboard-host-context-831-independent-contract.private.log`, SHA256 `d279c08cbe2c3fc88cbeb4f00eda6af32983a30eae6e418f8981e80c2a35bf2f`. Test propio SHA256 `b39bc433545c71478476910939a508e6bb18de035aa1e7cf508e353a41a6a518`.

## Controles y límites

- Reset real del engine con el mismo Auth/User/sesión retira una caché lista de Source y exige otra lectura. Un Aggregate.port pendiente también retira su respuesta. Reemplazar el engine por otro de igual generación no reutiliza autoridad.
- Cambios de grants derivados de módulos, firma o sesión retiran Source y el puerto de Aggregate antes de llamar al lector con captura antigua. Un dominio denegado rechaza el agregado completo antes de leer sus puertos.
- Offline/online conserva validez de autoridad y datos de Source; connectionEpoch cambia y el puerto de Aggregate rechaza la respuesta pendiente. No se prueba entrega de socket/HTTP: el lector está diferido en memoria.
- Primer log `dashboard-host-context-831-independent.private.log`:30PASS/2FAIL. Una era una exigencia propia demasiado estricta del código de error: Aggregate.port desconectado arroja AGGREGATE_INCOMPLETE por snapshot inválido, y aun así rechaza el resultado. Se corrigió sólo esa comprobación para aceptar los dos códigos de rechazo del contrato; la expectativa de metadata incompleta sigue roja. Se conserva el log inicial.

Source/Aggregate son módulos reales y Readiness corre en VM con generación/reset reales; los payloads finales y esperas de lectura de estas pruebas son fixtures sintéticos. No acreditan DTO/Fresh/reglas remotas ni HTML montado. No se cambiaron Roles, permisos o épocas de producción. Sintaxis correcta; no se amplió la auditoría.

Blobs: Context `9eb6febfbb6fc0a876b4267745fc6997e1610424`, Readiness `fc8b44ed45bc620cea14aee3001247fbbb64e1e8`, Aggregate `228cd4959ffa89074439f851a415f0f313145e6e`, Source `b76fc2c5c9bba56bc20570be090a66dd29a7e186`. El coordinador integrará contexto compartido y eventual corrección.
