# Cobros, descuentos/IVA y valores históricos — auditoría local 22/11/2026

Fuente funcional: app activa `js/app.v3.21.2.js` declarada por index.html, base `060c77f8`. Revisión en rama aislada `codex/audit-20261122-consultas-gastos`; los commits anteriores de este frente sólo modifican selección de navegador y documentación. No se incorporaron cambios de Stock ni se publicó nada.

## Resultado y alcance

No se encontró un defecto reproducible en los contratos revisados. **349 ejecuciones aprobadas, 0 FAIL / 0 SKIP; 346 casos distintos**, porque los tres casos de sale-budget-economic-roundtrip se incluyeron en dos tandas. No se modificaron producto ni pruebas. Se ejecutaron regresiones existentes y se contrastaron sus expectativas con las funciones activas; no se fabricaron expectativas a partir de la implementación.

Cobros USD/ARS: cinco casos collections-usd-agreed-rate verifican una sola conversión de USD a ARS con cotización acordada, conservación de montoOriginal/tipoCambio, independencia de la referencia actual, pesos con centavos, ausencia de cotización automática sin inventar valor y reinicio del formulario en ARS. El alta/reintento ficticio confirma un solo commit en el backend en memoria y conserva el cobro ARS anterior. También se cubren idempotencia, fuentes canónicas, saldos exactos, permisos y rechazo del escritor antiguo sobre campos monetarios en las regresiones de payment-commands/guard/entry y current-account-canonical-payments.

Descuentos/IVA: cálculo decimal, descuentos por renglón y general, IVA y cierre al centavo; combinaciones de cantidades/precios fraccionarios; rechazo de importes, alias y porcentajes inconsistentes. La cadena venta → presupuesto → venta usa funciones de la app activa y conserva total, IVA, porcentaje de descuento, costos, cero explícito y costo ausente sin sustituirlos desde catálogo. La excepción de redondeo histórico se acota a documentos comprobados, sin recalcular sus originales ni omitir autorización de descuento.

Históricos y actualizaciones: duplicar una venta con fecha actual toma precios/costos actuales para la copia, incluso con costos históricos completos o parcialmente ausentes, sin modificar el original. Se prueban dieciséis filas y una referencia no resuelta. Actualizar precios de una venta mantiene sus costos históricos; actualizar explícitamente un presupuesto desde catálogo puede sustituir costos, conserva descuentos/IVA y no modifica el objeto original. Cancelación o referencia de compra no resuelta evita persistencia; cero explícito es válido. La extracción posterior en USD/ARS no reconvierte costos ya expresados en ARS. Se inspeccionaron además `_cargarDuplicadoPresupuesto`, `confirmarDuplicadoPresupuesto`, `pptoCargarItemsEnEditor` y los controles de moneda activos; la inspección no equivale a una prueba integral de duplicación de presupuesto en navegador.

## Tandas y evidencia

Node portable existente y NODE_PATH al cotizador/node_modules; --test-concurrency=1. Logs privados en `C:/SisVentas/tmp/audit-20261122-C`, fuera de Git:

| Log | Casos PASS | SHA256 |
| --- | ---: | --- |
| economics.log | 259 | 40fc3cef408639078cd09aed90236a0c07723560606205b4d2e8c4c0de6525c7 |
| economics-currency.log | 56 | de5518f91bf221db3cf3ea452775c1bf5f54282aaa2cc91eb5a133a4ed4e1edd |
| economics-exact.log | 24 | 58938bce0f84cc0faa91a462de44946181ff06d0ba5030365eaabf1ab34f5426 |
| economics-collections-native.log | 10 | 2bbc5e4a0793998a202d6ba8e28593aa7c25aeb7175a0c8b6f10d0801e1a0f8d |

Tanda 259: payment-commands, payment-entry-idempotency, payment-related-frontend-contract, payment-guard-integration, current-account-canonical-payments, sales-payment-line-rounding, sales-discount-first-chain, sales-discount-first-adversarial, sale-budget-economic-roundtrip, sale-budget-transition, sale-budget-transition-integration, sale-return-to-budget, sale-duplicate-row-continuity, sale-duplicate-sixteen-integration, budget-catalogue-cost-refresh, budget-conversion-costs, budget-explicit-zero y commercial-historical-rounding (todos .test.cjs).

Tanda 56: collections-usd-agreed-rate, native-collections, commercial-linked-budgets, guarded-budget-cache, budget-save-read-scope y budget-editor-draft-isolation. Tanda 24: commercial-money-exact, commercial-approval, sale-budget-economic-roundtrip y budget-sale-commission. Este último sólo verifica los indicadores de conversión en memoria, sin cambiar comisiones existentes.

Tanda 10: collections-indexed-native-ui.test.cjs, Chrome instalado headless, un navegador a la vez, servidor loopback y datos ficticios. Cubre 390/768/1280, búsqueda histórica/paginación de cincuenta, totales completos, recibo puntual, conservación de formulario y filtros, revocación, registro/reintento/anulación simulados en fixture, retorno y consultas agrupadas tras escritura del usuario. No se utilizó la ventana del usuario ni una sesión comercial real.

## Límites y siguiente paso

Las pruebas antiguas venta-actualizar-precios-historicos.test.js y presupuesto-conversion-y-confirmacion-humana.test.js fijan versiones históricas; presupuesto-flujo-simple-y-redondeo.test.js lee app.js. Se inspeccionaron para detectar el límite, pero no se usaron para certificar la app activa ni se cambiaron sus expectativas.

No se ejecutó emulador de permisos, servicio desplegado, banco, facturación fiscal, guardado comercial real ni una sesión de usuario real. La fixture nativa de Cobranzas no acredita toda la aplicación, ni la suite cubre cada combinación monetaria posible. No se probaron exportaciones ni presentaciones. Sin cambios de pagos, comisiones, Stock, permisos, reglas, versión/index/SW/CONTEXTO compartido; sin otra puerta global, instalaciones, push o publicación. Siguiente paso del coordinador: integrar únicamente este informe y reunir las evidencias de los demás frentes; no hay arreglo de producto propuesto por este bloque.
