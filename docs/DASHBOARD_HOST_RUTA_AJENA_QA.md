# Revalidación fuera del consumidor: reproducción Chrome

04/11/2026. Fuente `c53be3dffff1f53a4130c72481481e6631d412bf` en checkout QA separado `C:/SisVentas/.local/qa-dashboard-74d343a7`. Host sin cambios frente44474115, blob `e461715c00f1d32c507e3347aa391b12921c3020`. Sin cambios funcionales, staging, producción ni datos reales.

**0 PASS / 2 FAIL / 0 SKIP** en `test/dashboard-unrelated-route-browser-independent.integration.cjs`. SHA256 del test `3129e646d45d30526af851c16f9b7009a7a352ea9a81366165bdfef2d0c02b17`.

Dos sesiones Chrome independientes con app/índice/callpoints reales y backend ficticio:

| Consumidor previamente demandado | Acción real | GET antes | GET después | Consulta adicional |
| --- | --- | --- | --- | --- |
| dashboard por startup | showPage('venta') | 1 | 2 | /commercial/dashboard/presupuestos/actividad-v2 |
| notices por centro | showPage('venta') | 1 | 2 | /commercial/dashboard/presupuestos/avisos |

En ambos casos se comprobó `document.querySelector('.page.active').id === 'page-venta'` antes de fallar la expectativa de conservar el número de consultas. Source termina ready, pero su consumidor ya no está visible. No se emitió budget-write ni se cambió sesión, permisos, epoch, red o visibilidad entre ambas consultas; la navegación es el disparador.

La ruta de host incluye página activa en marker y programa queueRefresh para cambios de página. queueRefresh recorre todos los kinds demandados si hay conexión/foreground, sin exigir que su consumidor esté visible. Esta evidencia confirma consultas fuera de pantalla; no mide bytes totales, ni prueba un bucle infinito o una falla de autorización.

Primera variante intentó Gastos para dashboard: fue redirigida a Dashboard por permisos, por lo que no se usa como evidencia de lectura en página ajena. Esa misma corrida sí confirmó notices en Venta. Log preservado `C:/SisVentas/tmp/dashboard-unrelated-route-c53-browser.private.log`. Se cambió sólo el destino del caso dashboard a Venta, manteniendo las expectativas de no revalidar y navegación efectiva.

Log final privado `C:/SisVentas/tmp/dashboard-unrelated-route-c53-venta-browser.private.log`, SHA256 `712ce2863c97a7e35710fdc8d339632aec277c1d0f3d8acad654c520872e7432`. Reproducir con `NODE_PATH=C:/SisVentas/cotizador/node_modules`, `SV_DASHBOARD_HOST_BROWSER_QA=1` y `node --test --test-concurrency=1 test/dashboard-unrelated-route-browser-independent.integration.cjs`, permitiendo Chrome/loopback.

Se reutiliza únicamente el fixture del test propio anterior, sin registrar ni modificar sus cuatro casos. Los cinco PASS de avisos/startup previos conservan su alcance: no cubrían navegación posterior a otra página visible. No se presenta ahorro ni objetivo global completo. Los flags permanecen OFF en repositorio y se activan sólo dentro del fixture; backend real remoto y actividad pendiente quedan fuera de esta revisión.
