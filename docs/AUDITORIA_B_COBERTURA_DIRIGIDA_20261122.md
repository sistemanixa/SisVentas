# B · Revisión de cobertura dirigida E01347 e índices propuestos · 22/11/2026

Alcance: código confirmado 01347ba1c269fed21d015ca4253832fdf3708fd8 (dependencia 2121bfc4), importados en checkout B como b402bf2a/9ae94195. No se editó el núcleo E ni WIP. Se conserva candidata OFF, sin UI, activación, despliegue, índices remotos ni datos reales.

## Observación enviada al principal

`cotizador/office-stock-directed-coverage.js:8`, receiptIdentity: comprueba audit.revision pero no que receipt.revision sea entero seguro positivo antes de comparar ambos. Reproducción ficticia con auditedHistory(): borrar receipt.revision, sustituirlo por string '1' o Infinity permite devolver originalIdentity en los tres casos. Propuesta para E: rechazar revisión del recibo no segura/positiva y revisar forma del recibo. No se corrigió unilateralmente el núcleo ni se afirma cerrada esta observación.

## Índices de metadata, no espejo de datos

Nuevo helper puro stock-link-index-rules agrega campos ausentes y conserva todos los valores anteriores (string o array), rechaza representación inválida e informa cada ruta, campos agregados y existencia previa en manifest.indexes. Se compone dentro de Builder.prepare sobre la copia de Catalog, sin permisos nuevos.

Contrato: productos codigo/cod/id; inventario_operativo codigo/cod/id/productoKey/productKey; stock_vinculos porProducto y porInventario productKey/inventoryKey. No se agrega $key. En la base privada EA los tres de productos ya existen; sólo cambian tres rutas con nueve campos añadidos. Restaurar las rutas del manifiesto y quitar únicamente el namespace nuevo recupera la candidata Catalog exactamente por hash; EA permanece intacta. No contiene bytes de reglas privadas este reporte.

## Verificación

33 focales iniciales PASS; ampliación 42/42 PASS incluye permisos antes de cualquier consulta, inyección de path/campo/parámetro/límite, HTTP 400/401/403/500 rechazados, loader WeakSet y cobertura acotada. La revisión confirma allowlist de cuatro rutas, límites limit+1 y rechazo completo al exceder cobertura. Una respuesta rechazada no se convierte en null. La firma Ed25519 sigue siendo responsabilidad del contrato del servidor; RTDB sólo verifica semántica de configuración privada.

Emulador propio: override explícito queryPage:store.queryPage, sin mantener queryPage de la fixture aislada. El loader es la factory real WeakSet. Historia y mapping se leen del emulador. Primera tanda actual55/55 PASS. Ampliación59: 58 PASS, un fallo al inicializar segunda namespace en emulador single-project (no fallo de consulta ni negocio). Contraprueba sin índice se trasladó al mismo proyecto local como último caso, sin desactivar single-project. Aislada PASS. Se agregó aserción explícita HTTP400/error index antes de comprobar rechazo del store; repetición59 final: 59/59 PASS; emulador limpiado y detenido.

Los tres phantoms (catálogo, inventario, mapping) se introducen mediante owner ficticio en el emulador antes del check final; todos rechazan sin PATCH y conservan los datos concurrentes. No se inyectan en el PATCH, después de que la comprobación ya pasó.

Guard del checkout B anterior a 7f1c700c: E usa fallback a store.queryPage directo fresco sin caché. La integración central tiene queryPageFresh tipado; el principal debe repetir allí. No se afirma que este checkout probó cancelación coordinada ni toda readiness real de A/D. Pendientes: observación de recibo, composición con SDK cut A y guard actual, evidencia de cobertura/consumidores de los tres dominios y pins finales. Catálogo/inventario siguen a cargo B; A limita su SDK cut a órdenes/listas/compras_resumen bajo misma activación, sin bandera alternativa.
