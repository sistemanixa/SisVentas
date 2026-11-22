# Respuestas E compatibles con C, sin ruta HTTP

preview añade exactamente el shape de C: `summary.record={key,name,code,quantity,unitLabel}` y `summary.product={key,name,code,active,service}`. El producto activo reparable tiene active=true/service=false. Los campos previos product/inventory se conservan por compatibilidad, sin costos, historial o readSet. expectedHash sigue siendo CAS del snapshot fresco.

execute sólo retorna después de guard.run confirmado o replay válido; incluye `status:'confirmed'`, `id=body.id`, `digest=Reference.digest(body)` y el resultado original con committed=true/operationId. No toma digest del body. Una cancelación nativa o un resultado incierto no se convierten en éxito.

recover mantiene `{id,digest}` del intento original; devuelve confirmed únicamente para recibo propio verificado. La cancelación nativa acreditada devuelve `status:'cancelled', definitive:'not-committed'` (también mantiene definitiveNonCommit por compatibilidad). Ausencia/pending/uncertain nunca autorizan un intento nuevo. El helper nativo puede crear su recibo genérico de cancelación; E no inventa recibos ni estados definitivos.

office-stock-core-ui-composition.test.cjs carga el componente REAL de C desde el archivo integrado si existe o desde el blob8654d34af470d7e6015def8f2559d14d331c738d, sólo lectura. No edita/copía su frontend. Lo conecta por puertos inyectados al command E real, createLaborGuard real y ambas políticas, con almacenamiento/coverage/barrera ficticios.390ACK directo y1280ACK perdido+recover:2PASS,1commit,1onSaved e inventario byte-semánticamente intacto. Sin HTTP, red exterior o datos reales. Transporte REST real ya tiene prueba aparte con fetch ficticio.

Gate de este cierre:2C/E+18command+17puerto=37PASS. Los doubles de cobertura/barrera y verificación de historia son sólo fixtures; no prueban reglas remotas ni cobertura de producción. No se activó UI/handler. La preparación autoritativa y matriz de consumidores siguen pendientes.
