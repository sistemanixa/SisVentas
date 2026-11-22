# Cierre acotado del frente Compras, 22/11/2026

El principal acotó el cierre por la demora: detener ampliación de flujos, conservar el modelo puro de listas entregado y apartar cualquier comando nuevo de listas sin integrarlo. Se completaron únicamente revisión/regresión de alta manual, recepción y eliminación actuales. No se edita CONTEXTO compartido; el principal conserva la integración central y su suite global.

## Entregas del frente

- `b581688e8c8726a5eb2dbe30ebcaf0854cf4247f`: planes vinculados OFF, fuentes internas, política/sellos y excepción estrecha de recepción, con conservación de pagos/comisiones.
- `ee7e766835dfc1c8713d73ba02d4896a8e46fc17`: hooks mínimos de guard separados; aplicar conservando E y queryPageFresh centrales.
- `a33e09e403c8b21f0a60e3d8842f82989ca87778`: hook REST SourceCost reservado/saneado, cero por defecto; no amplía reglas.
- `ffdca605970107e503d443185c710cf1cdf81d7b`: eliminación administrativa existente con referencia física y fuentes concurrentes, sin operación nueva de archivo.
- Modelo manual de otro frente `b429b18b7e31008f654ed332c13dc9c5d7ed6d7f`, incorporado aquí como `e5aa7155c743221a6b662e0f20493e02a8e9ad5e` por autorización del principal.
- `dd9c0d421d766889a69e86dfdbc3a422f20d26cd`: comando de alta manual OFF y capacidad específica sin fabricar originalOrder.
- Puerto E confirmado `da6e3a9055804cb85f0d37afe187c470f1229020`, incorporado aquí como `acee13b39a9b3cac42887ce8fdd40c2246190f55`.
- `d3871cb240faeb79dff0fe4add72c1545364bca1`: adaptación al evidence WeakMap real de E, producto canónico y reloj; prueba de composición guard/store central.
- `2deab35fa5c33b6c35b98f3c54562a328d5a4469`: sólo modelo puro de generación desde preparación capturada, 37 casos propios; no comando ni ruta.

## Validación final de este bloque

276/276 PASS, cero fallos/skip/canceladas: todos `purchase-inventory-*.test.cjs`, alta manual (modelo/comando), eliminación de orden (modelo/comando/referencia), costos de recepción, intercalación recepción/eliminación, corrección de costo, generador de comisiones y store REST. Evidencia privada `tmp/purchase-close-scope-regression-20261122.log`, sin incorporarla a Git.

10/10 PASS separados en `purchase-manual-create-core.integration.cjs` con composición aislada `C:/SisVentas/.local/audit-20261122-create-real-composition`: central congelada `60beec59` + puerto E + alta del frente. WeakMap E, guard y store central reales; variantes con cuentas/Pages/historial/índice financiero preparado y StockOrder C real usando la misma admisión firmada. Transportes REST interceptados en memoria ficticia, sin red; no equivalen a reglas/emulador. Evidencia privada `tmp/purchase-create-real-composition-20261122-close.log`.

Los 96 casos focales del modelo puro de listas y sus modelos relacionados pasaron antes del cierre. La suite global no se repitió aquí: el principal informó nueve fallos de integración en su cuarta ejecución y conservó su corrección. Estos PASS de dominio no convierten esa ejecución global en verde.

## WIP apartado, no integrar

Rama `codex/audit-20261122-list-generation-wip`, commit `cbcac6dabad7df8b16c86b7b9c2e67fffc13a726`, separado de la rama estable. Contiene cuatro archivos: comando interno nuevo, extensión de Policy para `operation:purchase-list-generate`/`kind:generate`, COPY del modelo y documento WIP. Sólo sintaxis/diff comprobados; sin pruebas de comportamiento, evidencia E de listas, reglas, interfaz ni activación. Incluye una fecha UTC que debe revisarse antes de usarlo. No trasladar esas modificaciones a central en este cierre.

Se volvió a `codex/audit-20261122-purchase-inventory` sobre `2deab35f`. Sólo permanecen cuatro archivos sin seguimiento, copias de dependencias B para lectura/pruebas previas; no se agregan: stock-link-activation-contract y tres builders stock-link. No hay cambios funcionales propios pendientes sin guardar.

## Pendientes reales

Reglas compuestas/SourceCost en emulador y revisión B/root; numeración autoritativa instalada; rutas/adapters reales; ausencia de inventario verificada; comando de listas apartado; autoridad específica de guardar/aplicar preparación con cambio de costo; fuentes conjuntas/externas/extras y atribución de reversión recibida con otras órdenes. Todo sigue OFF y no se activa el corte SDK con estos hitos.

No hubo push, build, publicación, cambios remotos, pruebas con datos reales ni operaciones financieras/stock en producción. Tampoco se volvió a probar PDF/recorridos HTML en este bloque de backend: no confundir estas regresiones con validación visual o del PDF. Resultados y SHAs se enviaron al principal por el canal autorizado.
