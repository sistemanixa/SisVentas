# Recepción vinculada con orden global y costo de origen

Fuente de producto: `f927f74a505fcc1712e254cf99cb05aec5e2c5f7`. Entorno aislado `audit-20261122-linked-order-proof`. Se agregan únicamente una prueba, su fixture y este informe; guard, store y módulos de producto intactos.

`test/purchase-linked-order-store-composition.test.cjs` ejecuta el comando real de recepción vinculada, `createLaborGuard` y `createLaborRtdbStore`, con Operational, Pages, Accounts, History, FinancialDependencies y StockOrder activados explícitamente en el laboratorio. Todo transporte se intercepta en memoria: ninguna conexión, cuenta ni escritura real.

Diez casos nuevos PASS, sin omisiones:

- Recepción completa para administrador y administrativo, con `ordenes.editar` y sin `ventas.corregirCosto`. El mismo PATCH transporta StockOrderVersion1 y SourceCostVersion1; el hash de costo corresponde al parche original recuperado mediante `OrderPolicy.sourcePatch`, que retira la fence y los derivados de orden.
- Revisión de fence incrementada una vez y rank/hash coherentes con el inventario final. Conserva campos desconocidos y asignaciones ajenas.
- Pagos, comisiones aprobadas/pagadas, cuentas de empleado, controles y jobs históricos conservados exactamente. Total/subtotal/cobrado, IVA, descuento, pagos embebidos, autoría y precio de venta conservados; únicamente el costo autorizado de recepción pasa a 22 en la venta ficticia.
- Pérdida de respuesta después de aplicar el PATCH: segundo intento recupera el mismo recibo y resultado, sin segundo PATCH ni repetición del proyector.
- Alteraciones al entrar al commit de venta, rank, fence, recibo y ruta adicional, y vencimiento del plazo: rechazadas antes del PATCH. Cada caso exige haber alcanzado el commit real, evitando dar por válida una excepción anterior del montaje.
- Plazo ausente rechazado por store antes de cualquier IO.

Verificación conjunta: `node --test test/purchase-linked-order-store-composition.test.cjs test/purchase-inventory-linked-command.test.cjs test/office-stock-order-store-composition.test.cjs`: **55 PASS, 0 FAIL, 0 SKIP**, salida 0. Sintaxis de ambos archivos nuevos y `git diff --check`: PASS.

Primeros intentos detectaron dos errores del montaje: creación de una segunda cohorte firmada distinta y falta de configuración Operational en la fixture. Se corrigió la fixture conservando las verificaciones del producto. Se corrigió además el disparador de alteraciones para esperar la entrada efectiva al commit.

Límites: no valida reglas RTDB ni CAS remoto, no sustituye la prueba combinada con emulador ni la puerta vigente completa, y no demuestra costo/rendimiento de producción. La admisión y la resolución de referencias utilizan fixtures explícitas; no se afirma integración del puerto prospectivo de referencias. Sin builds, instalaciones, activación, despliegue, reglas remotas o manejo del navegador del usuario.
