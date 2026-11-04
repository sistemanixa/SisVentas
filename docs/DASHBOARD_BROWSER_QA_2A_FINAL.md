# QA browser final sobre2a0798a9

04/11/2026. Checkout propio `C:/SisVentas/.local/qa-dashboard-2a0798a9`, HEAD exacto `2a0798a9d25c62bc8c6640c494520c32348695d0`. Fuentes funcionales/root/producción intactos. Sin staging, puerta general o prestaciones adicionales.

## Latest personal y global:4PASS

`test/dashboard-latest-final-browser-independent.integration.cjs` repite **4 PASS, 0 FAIL/SKIP** sobre esta SHA, mismas expectativas queee46. Sólo CRLF del checkout cambia el SHA256raw a9298cbdc356bcd46ec3f2c08c677cb069535160c6eb1655d21d2b058f8ed55dc; comparación ignorando EOL sin diferencias, blob `455eba606caf2555bcad37bb682d50e8e81a47aa`. El original LF53d279 permanece en el checkoutee46.

Personal1280/390:1GET,501,cinco claves personales distintas deltop5global, centavos exactos, nombre vigente escapado, conservación503/visibilidad, salida/retorno real porClientes y retiroUser. Global6/7GET con/sin capacidad completa, sin nueva colecciónpresupuestos y sin GET adicional al irVenta. Se mantienen los límites del informeee46: backend/Auth ficticios en memoria, HTTPS interceptado, no prueba productiva ni aceptación total.

Log verificado `C:/SisVentas/tmp/dashboard-latest-2a0798-verified-checkout.private.log`, SHA256 `0243f34e03390225629b57b81d6a585f5f4ed5c4fc824000ee5f0b2208611144`.

## Avisos tardíos:2FAIL reproducibles con estado visible

Test nuevo `test/dashboard-late-notice-browser-independent.integration.cjs`, SHA256 `c1233eef9fccb70ada9449100b4c282bf34f33f7e53d7037613ce6ae9c99ac52`. **0 PASS, 2 FAIL, 0 SKIP**, escritorio1280 y móvil390.

Fixture autoriza explícitamente móduloNotificaciones en índice y bloqueados para que el router realmente active page-notificaciones; conserva grantpresupuestosown y permisolectura. Tiene acciones dashboard.actividad/interfaz.dashboard_admin_only, pero **no presupuestos.revisarVencidos**. No se concedió esa acción para forzar un verde.

Se retiene la respuestaGETavisos1400ms, sin reemplazar Host/Source/Consumer ni generadores reales. Durante la espera se exige y verifica visible el hostReadiness `[data-sv-data-status][data-sv-data-page="notificaciones"]`, con “Cargando datos… Esperando los avisos de presupuestos”. No hay Todoal día ni Sinnotificaciones visibles. El contenido del centro queda oculto por la clase pending; textoDOM/aria-busy señalan pendiente. Este estado de carga **sí pasa** y tiene captura.

Al liberar, Consumer entrega una fila válida `PP-FICTICIO`/own, estadoenviado/vencimiento05-11, y Readiness queda ready:true. Esperados1500ms adicionales, page-notificaciones continúa activa, lista visible, pero texto sigue **“Avisos de presupuestos pendientes de actualización.”**, etiqueta pendiente y todasNotifs vacío. Los dos casos fallan exactamente al exigir que la entrega completa sustituya ese pendiente visible por el aviso.

Trazado de fuente: changed(notices) llama únicamente verificarVencimientosPptos; ésta retorna por `_svSesionActivaParaVencimientos()` cuando no hay acción presupuestos.revisarVencidos. En esa combinación no se ejecuta generarNotificaciones después de recibir la fuente. Source y autorización de lectura funcionaron; falta actualizar el consumidor visible. No se probó ni se afirma una falla del transporte REST o de su comparación canónica con este rojo.

Log final `C:/SisVentas/tmp/dashboard-late-notices-2a0798-visible-final.private.log`, SHA256 `8f459e32e70cea34d627dd9fd55bc51450933812a5f44614078834272a0c530f`. Capturas privadas inspeccionadas dentro del checkout: `tmp/qa-late-notices-2a/held-1280.png`, held-390.png, delivered-1280.png y delivered-390.png. Las primeras muestran overlayvisible; las segundas, centrovisible aúnpendiente tras fuentecompleta. Las pruebas fallan antes del contador final de requests, aunque el interceptor registra un único intento retenido; no se certifica el cierre del caso.

## Reproducción y antecedentes de ejecución

Entorno `NODE_PATH=C:/SisVentas/cotizador/node_modules`, `SV_ACTIVITY_INTEGRATED_BROWSER_QA=1`, Chrome/loopback permitidos. Ejecutar cada archivo con `node --test --test-concurrency=1`.

El primer intento de avanzar el checkoutee46 fue rechazado por Git porque los dos archivos QA untracked ya estaban incorporados en2a; no se sobrescribieron. Una repetición inició aún sobreee46 y dio4PASS, pero su log se renombró `dashboard-latest-ee46-unadvanced-repeat.private.log` y **no** acredita2a. Se creó este checkout nuevo, se comprobó HEAD y luego se generó el log verificado citado arriba.

Primeras variantes del test tardío estaban limitadas por router sin móduloNotificaciones y luego por uso de innerText del contenido oculto. Se conservaron logs `dashboard-late-notices-2a0798-browser.private.log`, -router-allowed.private.log y -readiness-aware.private.log. El test final exige ruta real, overlayVISIBLE y ausencia de falso vacío visible; no usa DOMoculto para certificar presentación. Diagnóstico -delivery-diagnostic.private.log conserva la primera captura serializada de fila completa y Readinessready mientras UIpendiente. No se modificaron fuentes para esas comprobaciones.

Blobs2a: app `e6a2b0b412e017586df451da360663efd3a34584`, notifications `d12d46c7f5e3bc7cb6f0e5548453e9977fa35ce4`, helpercreatorLatest `1d341cd17c9bc5a8e393fff7d1325e2abb31f257`. Sintaxis nueva correcta. FlagsOFF en repositorio, datos exclusivamente ficticios, sin operaciones financieras ni recarga usuario/publicación.
