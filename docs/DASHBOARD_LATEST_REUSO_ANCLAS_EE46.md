# Reuso de anclas dentro de una petición

Hunk único contra `ee46d78edbcad865a09b159dbac325b9cf25903a`: `docs/patches/creator-latest-request-anchors.patch`, en `cotizador/dashboard-commercial-activity-reader-proposal.js`. No se editó root ni el helper/modelo/DTO/host/app/índice. No incluye el hallazgo separado de cliente largo.

El lector ya captura cobertura Pages y total del ámbito en B0 y los relee frescos en el B1 exterior, después del helper y de revalidar autoridad. El adaptador de lecturas del helper reutiliza exclusivamente esas dos anclas para sus paths exactos. Las guarda como copias profundas locales a la petición y entrega otra copia profunda en cada acceso: un consumidor no puede alterar la captura original ni la siguiente lectura del helper. No hay caché entre peticiones.

Grupo creador/mes y hasta cinco filas Pages siguen consultándose y releyéndose por el verificador opcional. Las anclas no entran en esa lista redundante: su prueba fresca sigue siendo el B1 exterior existente, con igualdad de hashes y autoridad/calendario/config/cobertura. Si cambian total o cobertura durante grupo/fila se rechaza toda la respuesta; si sólo cambian grupo/fila a igual revisión, latest queda incompleto y el contador conserva su evidencia. No se sustituyen lecturas frescas B1 por caché.

Costo resultante por GET con latest completo: total Pages **2 lecturas** (antes 4); cobertura Pages **2** (antes 5, por los dos accesos internos del helper más el replay). Grupo **2** y hasta cinco filas **2 cada una**, sin cambios. Dos GET conservan **4** lecturas del total. No cambia el número de solicitudes HTTP.

## Pruebas

`test/dashboard-creator-latest-anchor-reuse.test.cjs` agrega cinco pruebas: conteos por GET, aislamiento entre dos GET, mutación de total/cobertura durante grupo/fila, mutación de grupo/fila sin revisión y copias independientes de las anclas ante mutación deliberada del helper.

Antes, sobre ee46 intacto: **2 PASS / 3 FAIL / 0 SKIP** (fallan el exceso de lecturas y la prueba instrumentada que exige dos lecturas incluso tras accesos adicionales a las anclas). Después del hunk: **85 PASS / 0 FAIL / 0 SKIP**, cinco nuevas y 80 existentes. Se ejecutaron sin modificar expectativas los tests mensuales que exigen 2 lecturas por GET y 4 en dos GET; también transporte latest, helper, actividad, carreras y host ownMonthly. Logs privados: `tmp/sdk-proof/creator-latest-anchors-before.log` y `creator-latest-anchors-after.log`.

Comando en root o copia con el hunk:

```powershell
node --test test/dashboard-creator-latest-anchor-reuse.test.cjs test/dashboard-sales-creator-month-transport.test.cjs test/dashboard-sales-creator-latest-transport.test.cjs test/commercial-creator-latest.test.cjs test/dashboard-commercial-activity-proposal.test.cjs test/dashboard-commercial-activity-snapshot-races.test.cjs test/dashboard-activity-own-monthly-host.test.cjs
```

El delegado usó snapshot privado y `SV_CREATOR_ANCHOR_SOURCE` para resolverlo. Parche comprobado y aplicado fuera de Git sobre una copia exacta de ee46, resultado idéntico al archivo ensayado; `node --check` y checks de diff aprobados. Sin puerta general, navegador, datos reales ni despliegue. Root integra el hunk y coordina la regresión final del gate que ya está corriendo.
