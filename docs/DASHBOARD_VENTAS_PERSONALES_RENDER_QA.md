# Tarjeta personal: reproducción independiente del total parcial

04/11/2026. Checkout QA separado `C:/SisVentas/.local/qa-dashboard-fae7e766`, freeze `fae7e76624acaa0d754aebb4d1369df892b308db`. Sin modificaciones funcionales, staging, puerta general o datos reales. No se alteraron las expectativas de pruebas anteriores.

**0 PASS / 4 FAIL / 0 SKIP**, en `test/dashboard-personal-sales-card-independent.test.cjs`, SHA256 `e48ff36f9314ff25b8eba42367b81134a3076ef6bd7c96bd8df2b933072b55b9`.

| Caso | Fuente disponible | Resultado actual | Expectativa conservada |
| --- | --- | --- | --- |
| Total501,50ventas en memoria | Host→HTTP→Aggregate reales; capacidad mensual completa501 | 50, “50 este mes” | 501 |
| Sin capacidad,50ventas en memoria | Aggregate declara salesAuthorMonthlyComplete:false y null | 50 | — y pendiente |
| Total501,memoria vacía | Contador certificado501 | “Sin ventas este mes” | No afirmar ausencia |
| Sólo miActividad,50en memoria | Ventas own; pagos/OT/presupuestos null; sin fuente personal demandada | 50 | — y pendiente |

Los tres primeros usan ActivityHost actual con HTTP/Aggregate/Context/Readiness reales y DTOs ficticios que pasan sus validaciones. Se exige que el paquete entregue501 y salesAuthorMonthlyComplete:true antes de invocar el renderer. Son dosGETventas para validar el contador en el agregado. La cuarta configuración tiene dashboard.miActividad autorizado, dashboard.actividad e interfaz.dashboard_admin_only denegados, y no concede los tres dominios faltantes. No se añadió modo ownMonthly, endpoint, puente, ni fuente ficticia nueva que simule ese arreglo: si todavía no hay capacidad personal, la UI debe permanecer pendiente.

Se extraen y ejecutan `renderDashAdministrativo` y `ventaResponsableComercialReporte` reales de la app activa en VM con nodos DOM mínimos. Las50filas tienen creador textualu y otro responsable para mantener la distinción creador/comisión. Fecha fijada04/11/2026 sólo en el fixture, sin cambiar TZ ni reloj del sistema. Se simulan etiquetas/formato de cliente e importe; no se comprueban todos los formularios ni UI completa.

No se exige una fuente de últimas5 ni su orden: el tercer caso sólo prohíbe afirmar “Sin ventas este mes” cuando ya se certificaron501. La entrega Core de últimas5 continúa fuera de este alcance. Los501 son una capacidad DTO ficticia validada por el pipeline, no501registros originales recontados por esta prueba; la prueba existente del lector de501registros pertenece a su entrega separada.

Log privado `C:/SisVentas/tmp/dashboard-personal-sales-fae-independent-red.private.log`, SHA256 `7d241f656727d9a7c034b18e7bc3020fc5e698afabfa4e2ab00ad40ba53d94a7`. Reproducir con `node --test test/dashboard-personal-sales-card-independent.test.cjs`. Sintaxis correcta. No se usó navegador en esta caracterización específica ni se publicaron datos.

Blobs: app `61d518100c3948cd0e8ec9b6598132a831c39457`, ActivityHost `434d667ed5b4af13ad5559402e7d87edf8e2cfc2`, Aggregate `6af7897480477e84b5b895689d3679b4e9fce94f`, HTTP `75ebe0ec1866b88bf0e44cfe5e6918efb6d48b92`. El defecto es la tarjeta todavía conectada a ventasList, no un fallo de los501 certificados en transporte. Fuente futura y cierre deberán repetirse sin cambiar estas expectativas.
