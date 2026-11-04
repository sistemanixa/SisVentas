# Personal y global: QA independiente4fbf9092

04/11/2026. Checkout propio `C:/SisVentas/.local/qa-dashboard-4fbf9092`, freeze `4fbf9092bde4c8a605442aa1a901199372878a96`. Sin cambios funcionales, staging, datos reales o publicación. Se conservan las evidencias de8GET sobreb609; no se modificaron sus expectativas.

## Renderer original y modo personal real

Los cuatro casos independientes rojos de la tarjeta repiten **4 PASS, 0 FAIL/SKIP**, mismas expectativas501/pending/noSinventas y privilegios. El checkout tiene CRLF (SHA256raw `8be48bd8d347b9b29a769499ed49c5860ea6119865006e0c114811c1acbaf7c7`) frente al LF original e48ff36f; comparación sin EOL no tiene diferencias. Blob normalizado del test `d404dd9b8c2b8c474c7e57ff436ab59bdcf0c4c5`. Log privado `C:/SisVentas/tmp/dashboard-personal-sales-4fb-independent-after.private.log`, SHA256 `0f87946b8711ebdbb674a6e0798e93345297a7ec33cae5b510e6fddd68074e3a`.

Prueba browser nueva separada `test/dashboard-own-month-browser-independent.integration.cjs`, SHA256 `ceac4fa6df93b840a44f9acfd1950a96785106cc8394a565f4c8f017a0922750`: **5 Chrome PASS** distintos, cuatro en una corrida y uno adicional de contador global. Índice/app/callpoint reales; sin puente de autenticación ficticio.

En1280 y390, sólo dashboard.miActividad autorizado, sin dashboard.actividad/interfaz.dashboard_admin_only: el arranque elige ownMonthly, hace **una GETventas**, no invoca las otras rutas y muestra501 en tarjeta visible pese a50filas locales. Grants capturados: ventas own; pagos/OT/presupuestos null. El paquete conserva activity:null y originales incompletos. Tres renders no repiten consultas. Últimas5 no se exigen: la lista dice “Detalle de ventas pendiente de actualización”, sin falsoSinventas.

Los501 provienen del lector real sobre511ventas ficticias: primeras501creadas poru, últimas10porv, todas dentro del alcance propietariou. Se regeneran Pages/actividad con constructores reales; la ruta interceptada devuelve ese lector, no un contador inyectado. Top5global de otro creador no se usa como lista personal.

## Medición global actual, separada del baseline8

| Variante del paquete | Presupuestos GET | Ventas GET | Pagos | OT | Totalinicio |
| --- | --- | --- | --- | --- | --- |
| Sin capacidad de creador completa | 3 | 1 | 1 | 1 | 6 |
| Con capacidad completa501 | 3 | 2 | 1 | 1 | 7 |

De los3GETpresupuestos,2son B0/B1 del Aggregate y1es el resumen separado de BudgetSource. Antes se medían5: los otros2eran solicitudes mensuales separadas, ahora sustituidas por monthly ya verificado en B0/B1. El segundo GETventas sólo se añade cuando hay capacidad de creador completa. No se cambió ninguna expectativa monetaria,501, autoridad o privacidad. Los casos nuevos trazan el nuevo contrato; los anteriores de8permanecen atribuidos ab609.

Se probaron respuesta legacy sin creatorMonthly y respuesta actual del fixture que también queda incompleta; ambas dan6GET. El caso separado con lector501completo da7GET. Pasar aVenta después del inicio sin capacidad no añade consultas. No se afirma factura ni ausencia global de otros cargadores legítimos.

## Evidencia y límites

Entorno `NODE_PATH=C:/SisVentas/cotizador/node_modules`, `SV_ACTIVITY_INTEGRATED_BROWSER_QA=1`, Chrome/loopback permitidos. Ejecutar `node --test --test-concurrency=1 test/dashboard-own-month-browser-independent.integration.cjs`.

- Cuatro casos: log `C:/SisVentas/tmp/dashboard-own-global-4fb-browser-aligned.private.log`, SHA256 `2e3eee9d5c16ca5808d8961ee7dfba10a6711060fb975cd6781628e7432ec7f7`.
- Quinto caso seleccionado con `--test-name-pattern='global bracket with real'`: log `dashboard-global-creator-4fb-browser.private.log`, SHA256 `3b483764e53b822ac2c8b91f9d9869c0e6ad67ac7cd290c91a1e515c17a6f20e` (mismo tmp).
- Primer intento2PASS/2FAIL antes de Chrome personal: generaciónPages del fixture no coincidía con configuración. Se alineó al mismo pages-fixture, sin cambiar expectativas; rojo conservado `dashboard-own-global-4fb-browser-independent.private.log`.

Backend/Auth ficticios en memoria, tráfico HTTPS interceptado, sin servidor productivo index ni RTDB remoto. El fixture global hereda los límites visuales/consumidores antiguos documentados en5c4. FlagsOFF en archivos y sólo activados en navegadorQA. La lista personal de últimas5 sigue pendiente; no se certifica el Dashboard completo ni se retiran ventas/pagos originales por esta evidencia.

Blobs: app `d08982e090e1d3a594d35e85f68b5f72ddc565d5`, ActivityHost `936f43c21ab1c8508cc0e680380af03fd6ddb0fd`, Aggregate `5c2087cc2d0a78c0bf52fd0a25b95069cde69b54`. Sintaxis del test correcta; commit/contexto compartido a cargo del coordinador.
