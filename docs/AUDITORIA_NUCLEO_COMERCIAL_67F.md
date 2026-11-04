# Revisión acotada del núcleo comercial, costos, pagos y comisiones

Fuente funcional revisada: **67f0418cc2b67618b0b3d89cfed365c2acd352b9**. Referencias: `PLAN_INTEGRAL_ETAPA1.md` (contrato común, pasos 1–3 y matriz transversal) y `CONTEXTO_ACTUAL.md`. El encabezado histórico del plan sobre c190/v3.19.2 no se toma como aceptación de esta fuente. No se modificaron código, pruebas, root, producción ni expectativas.

La revisión encuentra evidencia actual del núcleo, más allá de Dashboard. La puerta 67f registra 9.492 casos: 9.461 PASS, cero FAIL y 31 SKIP, exit 0, Node22.23.4. **El total no constituye por sí solo el cierre del objetivo.** Se contrastaron nombres de pruebas reales y líneas de su log con cada requisito; el JSON adjunto conserva esas anclas.

## Requisitos → implementación/prueba real → evidencia actual → límite local

Las líneas citadas son de `current-gate-67f0418c.private.log`, no números de pruebas supuestos por nombre de archivo.

| Requisito del plan | Implementación y prueba real | Evidencia actual en 67f | Faltante o límite local concreto |
| --- | --- | --- | --- |
| Separar creador, responsable, conversor y comisionado; conversión recuperable | `js/modules/commercial-document-controls.js`, `js/core/sale-writer.v1.js`, conversión del app; `commercial-conversion-audit.test.cjs`, `budget-sale-commission.test.cjs` | Gate líneas 11878/11884: autoría separada y conversión atómica con evento en venta/presupuesto, replay sin duplicar. Casos de costos de conversión y exclusión explícita de comisión presentes | Son funciones reales con transporte ficticio; no equivalen a probar todos los formularios manualmente |
| Capturar costos históricos, distinguir cero de ausente y conservar precisión | `js/core/sale-costs.v1.js`, `stock-purchase-costs.v1.js`, `purchase-receipt-costs.v1.js`; `budget-conversion-costs.test.cjs`, `sale-cost-quantity-precision.test.cjs`, `stock-purchase-costs.test.cjs` | Gate 5739: costo/fecha históricos sobreviven al catálogo; 5745: cero explícito; 51616/51622: cantidades y unitarios precisos; 54518: gastos ya incluidos no se suman otra vez | La prueba no sanea históricos reales incompletos ni autoriza completarlos por catálogo de forma masiva |
| Un cálculo monetario compartido, cierre explícito al centavo y descuentos/IVA coherentes | `js/core/commercial-money.v1.js`, `sale-economics-model.v1.js` y sus copias servidor/fiscal; `commercial-money-exact.test.cjs`, `sale-economics-model-parity.test.cjs` | Gate 13667/13673: decimales, descuentos y escritor/lector; 52144/52150: paridad frontend/servidor. Incluye 1.005×2→2.01 sin redondear antes el unitario y reparto de centavos | Igualdad de fuentes locales no acredita que todas sus copias estén desplegadas |
| Rechazar alteraciones económicas parciales sin reescribir históricos | `cotizador/commercial-validation.js`, modelo económico; `economic-integrated-review.test.cjs`, `economic-crossflow-review.test.cjs` | Gate 27295/27325: subtotal/renglón/cabecera adulterados no escriben; 27115/27157: precio ausente inválido frente a cero explícito autorizado. Edición histórica operativa conserva costos faltantes y subtotales legacy | No es auditoría de cada registro real; no se recalculó ninguno |
| Cobro separado de edición, autorizado, parcial/total/anulado, recuperable y acotado | `cotizador/payment-commands.js`, `payment-snapshot.js`, `payment-membership-index.js`; `payment-commands.test.cjs`, `payment-entry-idempotency.test.cjs` | Gate 41452/41458: cobro autorizado y replay público sin costos; pruebas reales de fence/saldo concurrente, ACK perdido, anulación, último centavo y precedencias distintas de registrar/anular. Opt-in runtime actual agrega recibo real, replay y respuesta de commit perdida | Transporte real de emulador con Auth ficticia; no acredita proveedor Auth/servicio remoto |
| No duplicar pagos canónicos/embebidos/legacy; esperar fuentes completas | Modelos de lectura y Cuenta Corriente; `current-account-canonical-payments.test.cjs` | Gate 18279/18285: no revivir embebidos al anular todos los globales; clave técnica prima sobre alias contradictorio. También ambos órdenes de llegada y reconciliación sin duplicar | No sustituye conciliación de todas las cuentas de producción ni define una nueva precedencia |
| Generar comisión sólo por cobro confirmado, con destinatario original e idempotencia | `cotizador/commission-generation.js`, `commission-event.js`, prueba de cobro; `commission-collection-proof.test.cjs`, `commission-generation.test.cjs`, `commercial-payment-commission-crossflow.test.cjs` | Gate 15217/15223: prueba ligada a operación y permiso explícito; 15715/15721: generación acotada; 14237/14249: parcial no genera, completo genera una vez, conserva autor/comisionado y evento duplicado. Opt-in actual confirma PATCH coordinado de job/control/venta/gasto/movimiento | No concede lectura comercial por cobrar o comisionar; faltante de costo queda en revisión, no genera una comisión inventada |
| Costo original para comisión; ahorro exterior y ganancia empresarial separados; pagadas intactas | `commission-calculations.js` y cálculos frontend; `commission-original-margin.test.cjs`, `commissions-concurrency.test.cjs` | Gate 16015/16021: ahorro/recepción repetida no aumenta base de comisión original; 17197/17203: participaciones pagadas cuentan y pago externo invalida reparto viejo. Opt-in de carreras conserva porcentaje global efectivo e historia pagada | No se borraron ni recalcularon comisiones existentes como prueba |
| Mismo hecho mantiene venta, cobros, comisión, cuenta, H7 y consulta sin libros divergentes | `test/commercial-complete-sale-chain.test.cjs`, helper `coordinated-backend.cjs`, lectores/proyecciones reales | Gate 11872 PASS: misma base persistente ficticia desde creación; estados pagado 0/40/100, deuda, costos20, comisión20 una sola vez, gasto/movimiento enlazados, replay; consulta real de Informes con páginas50 y cero escrituras | Cadena de backend/memoria, no una única sesión browser que recorra todos los circuitos del plan |
| Guard/fence y recuperación no eludibles por SDK, consultas o callbacks tardíos | `labor-guard.js`, `labor-db.js`, `labor-rtdb-store.js`, `labor-write-gateway.js`, `labor-scoped-transaction.js`; dos familias opt-in abajo | **27 PASS nuevos sobre 67f**, sin omisiones: scopes de originales, comandos/índices/comisiones, recibos, ACK perdido, actor/rol/permisos/reset/expiración durante lease, escapes Admin/priority, sentinels, claves válidas y bootstrap sólo derivado | Prueba la configuración ficticia de esas familias; no todos los modos posibles ni escritores privilegiados externos |

## Los 31 SKIP: inventario y cierre de evidencia

| Archivo | Omitidos en la puerta | Evidencia separada actual |
| --- | ---: | --- |
| `test/labor-runtime-emulator.test.cjs` | 20 | Repetición propia, mismos archivos intactos: PASS |
| `test/labor-expense-race-emulator.test.cjs` | 7 | Misma repetición serial: PASS |
| `test/commercial-draft-transport-restart-native.test.cjs` | 2 | Coordinación informó QA **6 PASS**, incluyendo estos dos SDK/Chrome; no reejecutados por este revisor ni se recibió ruta de ese log en el mensaje |
| `test/commercial-full-app-metrics.test.cjs` | 1 | Root **8 PASS** junto al editor, log `final-67-metrics-point-optin.private.log` leído: sin SKIP |
| `test/dashboard-notice-rest-independent.test.cjs` | 1 | Mismo log root, caso Chrome de retiro del editor: PASS |

Son **31 casos omitidos distintos cubiertos por evidencia complementaria**, no 27+8+6 casos nuevos exclusivos. El log de puerta conserva sus 31 SKIP; no se reescribe ni se convierte su resumen en un supuesto “cero omitidos”. La evidencia de los seis casos QA se conserva como reporte de coordinación, diferenciada de las dos corridas cuyos logs se leyeron aquí.

### Repetición financiera propia

Node **22.23.4**, `--test --test-concurrency=1` y exactamente los dos archivos originales. Puerto **9017 propio**, comprobado libre; namespace fijo `demo-sisventas-fence-proof`, por eso ejecución serial. Base histórica local pre-coordinación ya usada en el runner de integración, sin consulta remota ni permisos improvisados. El builder la aceptó antes de iniciar:

- Base privada: SHA256 `c44a50deadc0d7af16b02d0226a0acf1642fa77dac722d08d14d3b47e14c93fb`.
- Hash semántico base: `136954197b29137f0f92f0765dedace395c84d19c316ed02d33958316e83822a`.
- Candidata compilada actual: `978cea4169880cd9b5d2782fbe17b7243a2fea562cb1737cb15292ebaa2e1782`.
- Log `C:/SisVentas/tmp/stage1-integral-plan/financial-27-67f/test.private.log`: **27 PASS, 0 FAIL/SKIP, exit0**, SHA256 `eeffb70a1811cf8207ef26ca45ef45d9caecd930d85f62459d861f4d3af65173`.

Se usó guardia local de HTTP/fetch sólo loopback, SDK apuntado al emulador y credencial ficticia owner; sin instalaciones ni Google externo. Se vació/verificó el namespace y se detuvo sólo el Java creado. Reglas/datos privados no se agregan a Git. Código y pruebas coinciden con 67f; el HEAD del checkout contiene únicamente documentación posterior, explicitado en el manifiesto.

## Faltantes locales y remotos, sin ampliar prestaciones

En el alcance revisado no quedó un fallo financiero reproducido abierto: los 27 omitidos relevantes ya se ejecutaron. Esto **no declara completado todo el plan** ni sustituye revisiones de OT/stock/remitos, H7, salarios o cada formulario. Las cadenas y fixtures existentes prueban rutas concretas, no todas las combinaciones humanas.

El faltante local siguiente que coordinación ya está preparando es validar el **artefacto aislado 3.19.4 ON** cuando exista: fuente/activos/versionado, permisos, apertura/retorno/error y paquete realmente servido. Este informe sobre 67f no adelanta ese resultado ni pide nuevas funciones o migraciones.

Fuera del cierre local quedan estado remoto fresco, inventario/cercado de escritores privilegiados y accesos antiguos (incluidos los 14 inventariados históricamente), servicios fiscal/forwarders, pausas y drenaje, snapshot privado, reconciliación por contribución, instalación emparejada de reglas/derivados/configuración y aceptación del corte. No se consultaron ni activaron aquí. Un guard probado en emulador no garantiza un escritor privilegiado que lo eluda. Tampoco se certifican ahorro facturado, latencia productiva, Auth real ni conciliación de datos reales.

`AUDITORIA_NUCLEO_COMERCIAL_67F_EVIDENCIA.json` conserva fuente, árbol, hashes seleccionados, anclas del log, inventario completo de los 31 SKIP y procedencia diferenciada de los resultados complementarios. Revisión y evidencia únicamente; sin código, root, producción, publicación o push.
