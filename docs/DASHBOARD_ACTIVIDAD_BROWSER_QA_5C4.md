# Actividad integrada: QA browser independiente5c4

## Repetición final sobre b609127d

04/11/2026. El checkout QA avanzó a `b609127d71e7f48d8b89c78a50be2abbb02a2368`. Los cuatro casos originales repiten **4 PASS, 0 FAIL/SKIP**, con test intacto SHA256 `a52307b7a80c364ee2d72baba05165859b44d79ef8e086e1ca4daf560174ee45`. Log privado `C:/SisVentas/tmp/dashboard-activity-b609-browser-intact.private.log`, SHA256 `13d5434e826c7d0fd2765706d824feac6383a9e7f6926fe9ebeab1fcb4802783`. Las mediciones del bloque5c4 de abajo conservan su atribución original; la repetición actual mantiene8/0/1/8 GET en el recorrido.

Control adicional separado `test/dashboard-budget-no-original-browser-independent.integration.cjs`: **2 PASS, 0 FAIL/SKIP**, escritorio1280 y móvil390. Test SHA256 `3af789742fc3f5841900a0e28348abee919e9be2887e9ef4e3d5827f54564542`. Inmediatamente antes de entrar al Dashboard se marcan métricas HTTP, lecturas SDK y suscripciones del fixture. Después del inicio real, no hay GET a `/comerciales/presupuestos`, ni GET/suscripción a `sisventas/presupuestos`. El plan excluye presupuestos y conserva clientes, ventas, pagos, ordenesTrabajo y clientes_unificados; los8GET acotados nuevos siguen presentes.

Log `C:/SisVentas/tmp/dashboard-budget-b609-no-original-browser.private.log`, SHA256 `e2cbabf61e7d5934553015d2e2e4a13c3ba30af088f4b47e3e8c1fbf596a273d`. Mismo entorno/opt-in; ejecutar el nuevo archivo con node --test. Se observaron lecturas legítimas de pagos/OT/agenda y no se exige su eliminación. La afirmación de ausencia sólo cubre consultas nuevas por esta entrada al Dashboard con ambos flags y consumidores cubiertos, no toda la sesión o todos los roles.

Los flags siguen OFF en repositorio. No se acredita todavía el lector mensual de ventas por creador, objetivo completo ni entorno remoto. No se modificaron fuentes ni expectativas previas; sólo test nuevo y documento propios, sin staging. Se mantienen los límites de Auth/backend ficticios y las evidencias anteriores.

04/11/2026. Checkout propio `C:/SisVentas/.local/qa-dashboard-5c4c6a25`, HEAD `5c4c6a25f36276de597ca8d53891b337ac067df1`. Fuentes funcionales intactas. Pruebas anteriores no modificadas; los tests y rojos de444/c53 permanecen en sus checkouts separados. Sin producción, cambios de datos reales, staging o puerta general.

**4 PASS, 0 FAIL/SKIP** en `test/dashboard-activity-integrated-browser-independent.integration.cjs`. SHA256 test `a52307b7a80c364ee2d72baba05165859b44d79ef8e086e1ca4daf560174ee45`. Chrome carga el índice/app reales y usa los callpoints de inicio/navegación, no reemplaza el host, HTTP, Aggregate, Readiness, Source ni renderer por resultados prefabricados.

## Recorrido y consultas observadas

| Acción | GET a rutas nuevas | Desglose |
| --- | --- | --- |
| Inicio Dashboard, escritorio1280 o móvil390 | 8 | presupuestos actividad-v2:5; ventas:1; pagos:1; OT:1 |
| Tres renders repetidos | 0 | no demanda desde renderer |
| Dashboard → Venta | 0 | páginaVenta efectivamente activa |
| Venta → Notificaciones | 1 | sólo avisos |
| Notificaciones → Dashboard | 8 | presupuestos actividad-v2:5; ventas:1; pagos:1; OT:1; ningún aviso |

Las cinco lecturas de presupuestos comprenden el resumen separado del host y las cuatro del bracket agregado (B0/mes0/mes1/B1). No se mide factura ni reducción total; otros consumidores antiguos siguen cargando datos fuera de esta tabla. Los cuatro scopes del paquete real del vendedor son ventas own, pagos own, OT all y presupuestos own. Renderer muestra cinco filas y no declara originales ni centro global completos.

Backend ficticio de cinco rutas: los módulos Reader de presupuestos/comerciales y Notices actuales leen índices/proyecciones reales preparados en memoria por el fixture de actividad. Para actividad se reutiliza el fixture builder del test existente y se expone su transporte únicamente en memoria; no se edita el test ni la fuente. Las respuestas atraviesan HTTP real del navegador interceptado por Playwright. El centro cuenta con permiso de navegación ficticio explícito, los cuatro grants proceden de los módulos del rol. Procedencia raw desconocida toma servidor autorizado. No hay puente artificial de isAuthenticated: se usa el getter integrado.

## Errores, cobertura y ausencia de fallback

Respuesta503 inicial y coverage comercial ausente producen error sin filas, nunca “Sin movimientos”. Tras recuperar un agregado válido,503 de refresh mantiene sus cinco filas y muestra error de actualización. Renderizar tres veces no inicia retry. Cambiar rol a distribuidora retira las filas. Durante render síncrono listo y sin datos/error se instalaron trampas temporales sobre ventasList, _pagosListaActual, _historialPagosCompleto, otData y pptoData; cualquier lectura falla el test. Se restauran inmediatamente los descriptores, sin alterar el resto del flujo. No hubo lecturas legacy desde ese renderer.

Esto no afirma que el app entero no cargue originales: continúan consumidores antiguos. Las capturas muestran un toast de fallo del historial de ventas del fixture; no se ignora ni se presenta el Dashboard entero como aceptado. El consumidor mensual de ventas por creador queda expresamente pendiente.

## Evidencia y límites

Log final `C:/SisVentas/tmp/dashboard-activity-5c4-browser-no-legacy.private.log`, SHA256 `8424f2f31adb0ddd8db65213442ceec7eaffd0293964667ed968bfcb1ff50242`. Comando `node --test --test-concurrency=1 test/dashboard-activity-integrated-browser-independent.integration.cjs`, con `NODE_PATH=C:/SisVentas/cotizador/node_modules`, `SV_ACTIVITY_INTEGRATED_BROWSER_QA=1`, Chrome y loopback permitidos.

Primera corrida1PASS/3FAIL por fixture incompleto: monitor reemplazado sin failure() y falta de permiso del centro. Se conservó log `dashboard-activity-5c4-browser-independent.private.log`. Se completaron esos puertos sin cambiar expectativas:4PASS en `dashboard-activity-5c4-browser-fixture-complete.private.log`. Después se añadieron las trampas explícitas sin fallback; el log final repite4PASS. No se alteraron fuentes para pasar.

Capturas inspeccionadas en escritorio/móvil: `tmp/qa-activity-5c4/activity-1280.png` y `activity-390.png`, privadas dentro de este checkout. Cinco filas legibles/adaptadas; tema claro, iconos externos bloqueados y timestamps pequeños de fixture (fechas1969 en algunos eventos) no son cambios productivos. No se acredita toda la UI, teclado/retornos de todos los formularios ni minimizaciónSO.

No se ejecuta servidor productivo index ni Auth/RTDB reales: el transporte HTTPS ficticio está interceptado y el resto de destinos externos se bloquea. Los flags sólo se activan en el navegador de prueba y siguen OFF en repositorio. No es aceptación de objetivo completo, despliegue ni reducción final de lecturas. Backend mensual de ventas y futuros cambios no heredan esta evidencia.

Blobs: ActivityHost `434d667ed5b4af13ad5559402e7d87edf8e2cfc2`, BudgetHost `1a52153f4a3e2b9495c896a453f5d8d328098342`, renderer `69bf78338992f4223c5ab0fc2c29f9c7ac38c8c0`, app `671516e01cda0127ca20b8f084395922bd90e3f9`, index `46c0b29c843317844779ce8bb2e7a8ceffdce9bf`. Integración documental y Git a cargo del coordinador.
