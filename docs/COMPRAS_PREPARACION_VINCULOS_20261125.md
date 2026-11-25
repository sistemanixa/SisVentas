# Preparación con vínculos descriptivos existentes

Una preparación v2 puede cambiar precios, proveedor o FX conservando los materiales y cantidades de existencias ya vinculadas. Antes de emitir un parche, se verifica el array original exacto, identidad P/J/R/lista/venta, cantidades por producto y la captura de filas previa. Cambiar, omitir o vaciar esas decisiones vinculadas devuelve REVIEW antes de guardar. No se mueve inventario ni se recrean planes del ledger.

La preparación conjunta comprueba la unión exacta de trazas del padre y los hijos, conservando fuentes todavía no vinculadas. No exige inventar un vínculo para una fuente sin él. La traza original y las fuentes financieras protegidas se conservan en guardado y aplicación de costos.

Se conserva la comprobación de paridad textual completa del calculador puro con la interfaz. Había quedado fuera del espejo el helper puro `reviewLegacyPreparation` de la entrega UI dc605: se incorporó literalmente la misma función y export, sin cambiar las correcciones históricas autorizadas ni las expectativas del test. El modelo no aplica automáticamente esa revisión ni recalcula historias antiguas.

138 pruebas del modelo de preparación PASS, incluyendo guardado/aplicación simple y conjunta, contradicciones de trazas, cambio de cantidades rechazado, actualización de precios/FX permitida, fuentes mixtas y paridad del calculador. No Guard/Store/emulador para este delta todavía. Este bloque se revisó en main antes del commit; los cambios de agrupación/edición de lista tienen entrega separada.
