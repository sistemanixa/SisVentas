# Cierre browser independiente: montaje mínimo74d343a7

## Repetición posterior sobre c53be3df

04/11/2026. El mismo checkout QA avanzó por detach a `c53be3dffff1f53a4130c72481481e6631d412bf`; el checkout rojo444 permanece separado. Los cuatro casos originales conservan SHA256 `324e4b945542f6591a4ac61cc2b00b5a8d8637e2e4448c704318eb4f02030a6a` y repiten **4 PASS, 0 FAIL/SKIP**. Log privado `C:/SisVentas/tmp/dashboard-host-c53-browser-independent.private.log`, SHA256 `88ddcf99de05376e7379f0138b24493e3b8eeafd8633aa11c9460f7764023a52`. La evidencia de74 de abajo conserva su atribución original.

Se agregó por separado `test/dashboard-startup-browser-independent.integration.cjs`, SHA256 `e7adf91127ecb3cb0b94abc8e9c591bdb7b62532ed333f0301bb2534690d648e`, sin alterar los cuatro anteriores: **1 PASS**. Navega al Dashboard real y ejecuta `svCargarInicioDashboardDemandado`; entrega un único resumen válido a Source, no solicita avisos y tres renders/demandas repetidos no producen otra consulta. Usa roles normalizados por `aplicarPermisosRolesGuardados` real antes de navegar. Primer intento sin esa aplicación falló en access-control.indexOf porque el fixture compartido conservaba bloqueados crudos como objeto; no era evidencia de fallo del nuevo callpoint y no se cambió su expectativa. Se conserva log `dashboard-startup-c53-browser-independent.private.log`.

Log verde de inicio `C:/SisVentas/tmp/dashboard-startup-c53-browser-normalized.private.log`, SHA256 `f6ec45dd183079eff4dd1e59a71ac222f3195c244415903a04e510d1146ce8f8`. Mismo entorno/opt-in del test de avisos; ejecutar el nuevo archivo con node --test. App congelada blob `000845d7d280305ac60395c656ef1a706fd3dcb7`. No se midió reducción total: sigue el cargador antiguo. El mensual nuevo no se ejercita con acciones apagadas del fixture; las limitaciones de backend ficticio, flags OFF en repositorio y objetivo global pendiente siguen vigentes. Sin cambios funcionales ni staging.

04/11/2026. Checkout separado `C:/SisVentas/.local/qa-dashboard-74d343a7`, HEAD `74d343a79803f35a611be986b9b456ba4d52e213`. Se copió el test propio sin modificar un byte: SHA256 `324e4b945542f6591a4ac61cc2b00b5a8d8637e2e4448c704318eb4f02030a6a`. El checkout rojo44474115, su test y logs permanecen intactos; no se agregó un puente de autenticación al fixture.

**4 PASS, 0 FAIL/SKIP** al repetir el mismo test. El fallo de autenticación lexical queda cerrado: Chrome ve simultáneamente `isAuthenticated:true`, `window.isAuthenticated:true` y sesión autenticada del getter existente. Se usaron el índice completo y callpoints reales; no un mock de Host.create.

## Evidencia acotada

- Escritorio1280 y móvil390 arrancan con flags OFF sin construir host ni hacer GET nuevos. Tras activarlos sólo en el navegador ficticio y demandar desde `svCargarDatosDePaginaActual('notificaciones')`, hay exactamente un GET a avisos y una fila propia válida. `pptoData` sigue vacío y Readiness de presupuestos originales sigue sin certificar.
- Tres renders de notificaciones y eventos data-state-changed no generan GET nuevos. Se preservan los avisos al perder red y al ocultar la página. Volver al primer plano revalida una vez; respuesta503 conserva las filas válidas de esa autoridad.
- Reset real de Readiness con mismo User retira inmediatamente las filas antiguas mientras espera la nueva lectura y sólo después permite otra vista completa. Logout elimina los slots. Cambiar rol a distribuidora durante un GET pendiente rechaza la entrega y no publica Source ni llena pptoData.
- Capturas desktop y mobile inspeccionadas: un aviso visible y acciones con distribución adaptada al ancho. Archivos privados `tmp/qa-dashboard-444/notices-1280.png` y `notices-390.png` dentro de este checkout. El tema claro y comunicados en carga son del fixture existente; no se modificaron preferencias/CSS ni se presenta esta inspección como aceptación visual completa.

Comando: `node --test --test-concurrency=1 test/dashboard-host-browser-independent.integration.cjs`, con `NODE_PATH=C:/SisVentas/cotizador/node_modules`, `SV_DASHBOARD_HOST_BROWSER_QA=1` y loopback/Chrome permitidos. Log privado `C:/SisVentas/tmp/dashboard-host-74-browser-independent.private.log`, SHA256 `8b8220a6eeea56b8516e767aef16d7e3ede6c8e51dde4beab929c2af29b7c819`.

## Alcance que sigue pendiente

Se intercepta una URL HTTPS ficticia sin salir a Internet; Reader/Notices reales usan memoria, no RTDB o Auth remotos. Los eventos de red/visibilidad se emiten en el navegador; no es una desconexión física/minimización delSO. El caso de role change prueba denegación/retirada, no un login completo de otro rol. No acredita escrituras ni todos los formularios.

Esta repetición valida el montaje mínimo de avisos y el getter corregido. El nuevo consumidor mensual de presupuestos del renderer no fue ejercitado por estos cuatro casos: el fixture desactiva acciones y no demanda dashboard. Tampoco prueba la futura sustitución de startup, actividad reciente o ventas mensuales por creador. Los flags del repositorio siguen OFF; no se certifica objetivo Dashboard completo ni despliegue. No se tocó fuente funcional, root compartido, staging o datos reales.

Blobs del freeze: app `2468eb4fdca445e045a60f52c3df676046562e4b`; host `e461715c00f1d32c507e3347aa391b12921c3020`; contexto `08a30702f5e07c417667701e3973d7450e08ac94`; index `d132b178b548415ebb55dce5c0c1f4129338b529`. La integración documental/Git queda a cargo del coordinador.
