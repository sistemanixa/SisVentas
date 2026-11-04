# Cadena parcial: evidencia de integración local

Fecha: 2026-11-04. Checkout aislado `integracion-v3190-verificada`, rama `codex/integracion-entrega-parcial-v3193`. Prueba explícita de integración; no sustituye la puerta general ni constituye autorización de publicación.

Se agregaron únicamente `test/commercial-partial-delivery-chain.integration.cjs` y `test/helpers/commercial-partial-chain.cjs`. El reproductor anterior y sus expectativas permanecen intactos.

## Resultado congelado

Repetición posterior de las mismas tres variantes sobre los modelos de stock corregidos por el coordinador para usar `Money.quantitySum`: **3 PASS, 0 FAIL, 0 SKIP**. Test y helper permanecen idénticos al commit `b7cd6c6d`; no se editaron modelos de stock. Esta cadena usa cantidades enteras y verifica regresión del flujo, no sustituye los casos específicos de precisión decimal del coordinador. La variante con `estadoInst` ausente también vuelve a pasar.

Log privado: `C:/SisVentas/tmp/partial-delivery-chain-stock-precision.private.log`, SHA256 `e2b1c8d00f2e3a14c9bf4de9607adbe8561521cbdb4a6181fbb8e72d3e3fdef9`. Capturas/JSON: `C:/SisVentas/tmp/partial-delivery-chain-native-20261104/stock-precision/`, usando `SV_CHAIN_EVIDENCE`. Modelos ensayados: navegador `7988f7cce514d17d3a3a293b40eb4f89bf0d3e76081bbe44746799ac786d7373`; servidor `6351a9c512a9fa4f62c8350c7b397946b6aafd7795aacd32a8ecb882fff43397`.

Ampliación posterior sobre `b13fcd43`, con la corrección compartida del modelo todavía local: **3 PASS, 0 FAIL, 0 SKIP**. Se agregó `omitSaleInstallationState` al helper y una tercera cadena completa de 1280 px, con pérdida de ACK y `estadoInst` ausente desde antes de la compra. La recepción no inventa ese campo. La instalación genera un solo evento con `antes: null` y `despues: "en_instalacion"`; conserva explícitamente la propiedad `antes` al serializar y releer JSON. La cadena completa termina sin errores de guard/JSON y conserva los mismos saldos. No se modificó código servidor en esta ampliación.

El coordinador informó una repetición independiente anterior de 5/5 PASS en `ot-partial-chain-root-independent.private.log`, SHA256 `680d1aac4b5232b7591f1ef31aaed8c49cdd1b0ba7a047c65bbbfb6a66f2d5b3`. Esa repetición precede a la nueva variante histórica; su repetición independiente sigue pendiente.

Evidencia privada nueva: `C:/SisVentas/tmp/partial-delivery-chain-missing-state.private.log` y `C:/SisVentas/tmp/partial-delivery-chain-native-20261104/missing-state/`. Se usó la variable correcta `SV_CHAIN_EVIDENCE`; los nombres de capturas y JSON distinguen `1280-missing-state` para no sobrescribir la variante normal. Sintaxis y diff de los dos archivos correctos.

| Huellas de la ampliación | SHA256 |
| --- | --- |
| Test actualizado | `7b85f8e129cc9e0a602d582df7439a5ba8c510ef86fe682a5826daf206ca7300` |
| Helper actualizado | `38084f5b2e53770932977c454812b334150c14c32c51ee3add34664aa6391ba8` |
| Log 3 variantes | `a206c1e7303e5e48678a1f32e00740a3d046baf282063095fa3281cc17567c46` |
| Modelo compartido con corrección `antes` | `c935159a25ddc0bfc71e3fdf4e9dfbc7b7647269b49a3533515d469954b66702` |

### Evidencia anterior conservada

**2 PASS, 0 FAIL, 0 SKIP**, Chrome nativo en 1280×844 y 390×844. La repetición final se hizo sobre HEAD `e0e8166a`, con cambios compartidos de custodia todavía locales. Sintaxis de ambos archivos correcta. La repetición independiente del coordinador queda pendiente.

En una sola base ficticia, la prueba ejecuta las funciones originales `transactionInventory`, `syncSalePurchaseCosts` y `finishReceipt`, extraídas de `purchase-orders.js`. Parte de una orden de 3 unidades sin recepción y otra reserva independiente de 5. Recibe 2 a costo real 12: una recepción parcial, 2 reservadas para la venta, 1 en compra y costo total de venta 34; conserva costo presupuestado 30. Rechaza repetir la recepción obsoleta sin alterar la base. La variante móvil pierde también el ACK de inventario de compra y recupera el resultado existente.

Después abre un host HTML sintético que carga los módulos originales de custodia, selector, ciclo, recuperación y consumo. La acción pública abre el selector real, entrega 2 por `/ot/ciclo` y emite un solo remito de 2. La variante móvil pierde el cuerpo de la respuesta después del commit y usa el botón real «Consultar operación», que consulta `/laboral/operacion` sin reenviar la entrega. Reenviar luego el comando original también conserva un solo commit/remito.

La instalación individual deja `vendida=3, entregada=2, instalada=2`; repetirla no consume de nuevo. La rendición pública corrige a 1 instalada y 1 devolución pendiente; la recepción administrativa devuelve esa unidad al depósito. Quedan 1 consumida, 5 en reserva ajena, 1 en compra y la asignación propia sin reserva, con 1 liberada. El stock general pasa de 4 a 5. Repetir recepción no genera cambios. El remito histórico sigue indicando 2, la orden de compra no cambia y el resumen OT refleja 1 instalada.

Cada fase conserva deuda comercial, saldo de cuenta e historial financiero en 26000 centavos. Después de la compra se conservan los ítems/costos de venta, pagos, comisiones, gastos y cuenta de empleados; el estado legítimo de instalación termina `en_instalacion`.

## Fronteras de la prueba

- Reales: funciones de recepción/costos extraídas del código; módulos del navegador; ramas HTTP originales extraídas de `cotizador/index.js`; servicios de ciclo/entrega, guard, políticas y proyecciones de listados/H7/cuentas/operativas.
- Ficticios: HTML anfitrión, identidad, almacenamiento en RAM y prueba de activación del fence. El transporte de compra es SDK/memoria. La transacción SDK de consumo usa un puente exclusivo del fixture con comparación de hash y guard/proyecciones reales; ese puente no es un endpoint de producción.
- No se ejercita la presentación del formulario de compra, la aplicación completa, reglas RTDB desplegadas, servidor desplegado ni datos reales. Las capturas muestran el host sintético y no acreditan el diseño de la aplicación completa. Todo el navegador queda restringido al origen loopback efímero; no usa el puerto 8765.

Un primer fixture omitía `venta.estadoInst`: el modelo intentó generar un evento con `antes: undefined`, rechazado por el guard después de consumir stock. Se completó inicialmente el estado ficticio con `pendiente` y se comunicó el hallazgo. El coordinador corrigió posteriormente el modelo a `antes: sale.estadoInst ?? null`; la ampliación de tres variantes descrita arriba valida ahora también esa ausencia histórica en la misma cadena, sin modificar el servidor desde esta prueba.

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
