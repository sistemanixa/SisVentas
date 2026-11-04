# Cadena parcial: evidencia de integración local

Fecha: 2026-11-04. Checkout aislado `integracion-v3190-verificada`, rama `codex/integracion-entrega-parcial-v3193`. Prueba explícita de integración; no sustituye la puerta general ni constituye autorización de publicación.

Se agregaron únicamente `test/commercial-partial-delivery-chain.integration.cjs` y `test/helpers/commercial-partial-chain.cjs`. El reproductor anterior y sus expectativas permanecen intactos.

## Resultado congelado

**2 PASS, 0 FAIL, 0 SKIP**, Chrome nativo en 1280×844 y 390×844. La repetición final se hizo sobre HEAD `e0e8166a`, con cambios compartidos de custodia todavía locales. Sintaxis de ambos archivos correcta. La repetición independiente del coordinador queda pendiente.

En una sola base ficticia, la prueba ejecuta las funciones originales `transactionInventory`, `syncSalePurchaseCosts` y `finishReceipt`, extraídas de `purchase-orders.js`. Parte de una orden de 3 unidades sin recepción y otra reserva independiente de 5. Recibe 2 a costo real 12: una recepción parcial, 2 reservadas para la venta, 1 en compra y costo total de venta 34; conserva costo presupuestado 30. Rechaza repetir la recepción obsoleta sin alterar la base. La variante móvil pierde también el ACK de inventario de compra y recupera el resultado existente.

Después abre un host HTML sintético que carga los módulos originales de custodia, selector, ciclo, recuperación y consumo. La acción pública abre el selector real, entrega 2 por `/ot/ciclo` y emite un solo remito de 2. La variante móvil pierde el cuerpo de la respuesta después del commit y usa el botón real «Consultar operación», que consulta `/laboral/operacion` sin reenviar la entrega. Reenviar luego el comando original también conserva un solo commit/remito.

La instalación individual deja `vendida=3, entregada=2, instalada=2`; repetirla no consume de nuevo. La rendición pública corrige a 1 instalada y 1 devolución pendiente; la recepción administrativa devuelve esa unidad al depósito. Quedan 1 consumida, 5 en reserva ajena, 1 en compra y la asignación propia sin reserva, con 1 liberada. El stock general pasa de 4 a 5. Repetir recepción no genera cambios. El remito histórico sigue indicando 2, la orden de compra no cambia y el resumen OT refleja 1 instalada.

Cada fase conserva deuda comercial, saldo de cuenta e historial financiero en 26000 centavos. Después de la compra se conservan los ítems/costos de venta, pagos, comisiones, gastos y cuenta de empleados; el estado legítimo de instalación termina `en_instalacion`.

## Fronteras de la prueba

- Reales: funciones de recepción/costos extraídas del código; módulos del navegador; ramas HTTP originales extraídas de `cotizador/index.js`; servicios de ciclo/entrega, guard, políticas y proyecciones de listados/H7/cuentas/operativas.
- Ficticios: HTML anfitrión, identidad, almacenamiento en RAM y prueba de activación del fence. El transporte de compra es SDK/memoria. La transacción SDK de consumo usa un puente exclusivo del fixture con comparación de hash y guard/proyecciones reales; ese puente no es un endpoint de producción.
- No se ejercita la presentación del formulario de compra, la aplicación completa, reglas RTDB desplegadas, servidor desplegado ni datos reales. Las capturas muestran el host sintético y no acreditan el diseño de la aplicación completa. Todo el navegador queda restringido al origen loopback efímero; no usa el puerto 8765.

Un primer fixture omitía `venta.estadoInst`: el modelo intentó generar un evento con `antes: undefined`, rechazado por el guard después de consumir stock. Se completó el estado inicial ficticio con `pendiente`. El hallazgo se comunicó al coordinador; esta prueba no corrige ni certifica ventas históricas sin ese campo.

## Repetición y huellas

```powershell
$env:NODE_PATH='C:/SisVentas/cotizador/node_modules'
$env:SV_CHAIN_EVIDENCE='C:/SisVentas/tmp/partial-delivery-chain-native-20261104/frozen'
node --test test/commercial-partial-delivery-chain.integration.cjs
```

Evidencia privada, fuera de Git: `C:/SisVentas/tmp/partial-delivery-chain-frozen.private.log` y `C:/SisVentas/tmp/partial-delivery-chain-native-20261104/frozen/`. Las ejecuciones anteriores permanecen separadas.

| Archivo | SHA256 |
| --- | --- |
| Test nuevo | `e628c078b039c16aa99988984ef798eb5e120ff183fa66814b05932459c85a78` |
| Helper nuevo | `4ac3793f8efc376c5ad2be99b6edaa09913c8c1bd98ad692cfa2336b3a8079a4` |
| Log congelado | `f505463fa0226d3b0c56e3bef13a19cecabd98a268e3e766c0de17b31aa3ea76` |
| Custodia compartida ensayada | `e17f75c11d2ae0e7931d2aeee984fc5e0259524b6e8cf76a6a17c03b39bf7860` |
| Modelo de ciclo ensayado | `3df4cda53363eece1f47a028280f60ce6158d2d216d74ee2546b2348659a470b` |

Solo los dos archivos nuevos y este documento forman el commit de QA. Los cambios compartidos, contexto general, índice, Service Worker y prueba de acciones públicas del coordinador quedan fuera de ese commit.
