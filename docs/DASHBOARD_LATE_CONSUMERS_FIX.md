# Corrección aislada de consumidores tardíos sobre ee46d78e

Base exacta: ee46d78edbcad865a09b159dbac325b9cf25903a. Root no se modifica. No se cambian endpoints, Source, contratos de datos, flags, versión, CACHE, Novedades ni datos reales.

- changed(dashboard) actualiza vencimientos/badge con el resumen disponible, incluso después del timer1200 y fuera de la pantalla Dashboard. changed(notices) usa la misma ruta una sola vez: verificarVencimientosPptos ya genera notificaciones.
- Mientras el consumidor de avisos no tiene filas completas, el centro indica pendiente y el badge señala la información incompleta con aria-busy/etiqueta accesible. No afirma Todo al día/Sin notificaciones. Los avisos válidos de otros dominios mantienen filas y acciones. Source retenida completa durante loading/error sigue siendo utilizable; no se inicia otra consulta ni se mantiene otra colección de presupuestos.
- Cuando está oculto y no hay ninguna fila válida todavía, generarNotificaciones actualiza sólo el estado pendiente y badge. El renderer visible y sus llamadas directas también distinguen pendiente de vacío certificado. OFF y usuarios sin acceso a presupuestos no reciben un pendiente artificial.
- SHELL añade exclusivamente17 URLs locales exactas que ya referencia index.html y faltaban; test current-shell-manifest intacto. No se cambia CACHE ni versión de candidato, ni se publica.

## Evidencia

Las cinco pruebas originales de la revisión se conservaron byte a byte en tmp/dashboard-ee46-late-consumers.private.test.cjs (SHA256 C35747CC60A9D01DBE7C4ED6F50B36D79753A871500E5B64537413C785BDACF6). Contra fuentes gitshow de ee46:3rojas/2controlesPASS. Mismos cinco cuerpos, cambiando sólo proveedor de fuente al checkout actual:5PASS. Test mantenible test/dashboard-late-consumers.test.cjs lee los archivos candidatos; la prueba original privada sigue fijada a ee46. Los hashes de ambas fuentes están en logs, no se confunde candidato con baseline.

Focal:70PASS,0FAIL/SKIP (diez archivos), incluyendo cinco regresiones y cuatro casos nuevos del módulo real de Notificaciones: pendiente vacío, otras filas/acciones, Source retenida y vacío certificado, OFF/sin permiso. El test previo de callpoints conserva sus expectativas y corrige únicamente el doble de verificarVencimientosPptos: ahora reproduce que la ruta real genera una vez, en lugar de función vacía que dependía de la llamada duplicada. Sin expectativas financieras alteradas.

SHELL: baseline1FAIL/1PASS; candidato2PASS sin cambiar prueba. Chrome headless1280/390:2PASS, módulo real en maqueta oscura aislada con red bloqueada; capturas revisadas sin overflow. No es QA de toda la aplicación ni recarga de la ventana del titular. Node check de app/módulo/SW y git diff check correctos. No se ejecutó puerta general (la está corriendo root sobre ee46), emulador ni operaciones reales.

Logs privados en tmp/late-consumers-{red-baseline,focal,shell-red,shell-green,browser}.private.log. Patch aplicable docs/patches/dashboard-late-consumers-over-ee46.patch contiene solamente app, módulo, SHELL y pruebas; aplicar tras terminar la suite congelada de root. Luego repetir estas pruebas sobre integración y coordinar su gate. No se declara publicado ni cerrado el bloque completo.
