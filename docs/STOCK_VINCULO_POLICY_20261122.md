# Política de asociación y hook mínimo del store

Incremento local posterior a91a7d8b3 y a los commits comunes B cd9ad6ee/f665c2c1 (cherry-picks locales445df5cf/1d27a12f). No se restaura la versión anterior del store ni se duplican los cambios B en esta entrega. Sigue sin endpoint, loader, consumidores migrados ni UI de guardado; sin cambio de reglas/claims genéricos/remotos o builds.

## Interfaz exacta para A/B

Nuevo módulo `cotizador/office-stock-link-policy.js`:

- `issue(actor, lease, {snapshot, command, now})`: sólo actor.mode=user, operation=office-stock-link, financialAction=stock.ajustar. UID de actor/claims/lease iguales; opId de actor/lease/comando iguales; fence no vacío, digest y transporte iguales al hash del comando y actor.input. Recalcula el plan puro, no acepta un patch del cliente. Rechaza otras capacidades de conteo/OT/eliminación. Retorna plan y asigna actor.officeStockLink opaco congelado, respaldado por WeakMap privado con copia del plan/resultados/contexto.
- `validate(actor, lease, patch, read, now)`: exige la misma prueba/UID/opId/fence/digest/rol/revisión/digest de permisos, lease vigente y ninguna capacidad mezclada. Verifica rutas y valores exactos, guard=null y recibo coordinado coherente. Relee perfil y permisos actuales mediante read y usa el contexto de acceso Stock existente; revocación/cambio de rol/revisión/permiso/cambio de contraseña detienen el PATCH. No amplía permisos ni interpreta activo/allowed enviados por usuario como autoridad.
- `token(actor, lease)`: emite capacidad propia únicamente desde WeakMap+binding vigente; en ausencia de prueba retorna marcadores neutros.
- `reservedClaims()` y `sanitizeClaims(claims)`: reservan/neutralizan el prefijo completo svStockLink; no mutan los claims recibidos.

Claims específicos: svStockLinkVersion(0/1), svStockLinkProductKey, svStockLinkInventoryKey, svStockLinkReceiptIdentityKey, svStockLinkRole, svStockLinkPermissionRevision. Valores neutros:0, cadenas vacías y revisiónnull. UID/opId/fence/digest se toman de los claims genéricos coordinados existentes, no se introducen duplicados de autoridad. El schema2 canónico del store se conserva independiente de esta capacidad.

El store importa el módulo; sanitiza el prefijo en servicios y lecturas como usuario; acquire/abort y commits ajenos emiten versión0. Antes de un commit de asociación ejecuta validate con su lector y reloj, luego añade token de la prueba válida. La lectura como usuario no gana identidad servicio ni schema; sólo elimina el prefijo reservado. Cualquier write que toque stock_vinculos sin prueba se rechaza, incluso si se intenta con otra operación. La política de conteo office-stock-policy no se modifica ni reutiliza.

## Rutas cerradas del commit

Se requieren exactamente5rutas: las3del plan (`sisventas/stock_vinculos/porProducto/{productKey}`, `porInventario/{inventoryKey}`, `operaciones/{operationId}`), el recibo genérico existente `sv_labor_receipts/{operationId}` y `sv_labor_guard=null`. No se concede autoridad para modificar inventario, resumen, catálogo, otros mappings ni recibos ajenos. Las3rutas de asociación deben coincidir byte-semánticamente con el plan emitido; el recibo coordinado debe tener el mismo UID/fence/digest/resultado e instante válido. No se cambió su formato ni el guard que lo produce.

A/B deben cruzar estos claims con reglas candidatas sobre la copia privada actual y comprobar: autorización real sin permisos nuevos, mapping uno-a-uno y su inversa, snapshot/revisiones, capa de validación de campos y lease/receipt/fence. El hook no implica por sí mismo que las reglas remotas autoricen la operación. Los módulos nuevos también requerirán revisión del payload de empaquetado antes de un corte, fuera de este incremento sin builds.

## Límites que permanecen OFF

No hay handler del typed command, ni llamada a issue desde API. No se conecta el plan porque catálogo aún necesita fence y Compras SDK aún debe migrarse o demostrar un protocolo equivalente que cierre clientes anteriores. La política sólo protege un plan ya calculado; el comando futuro tiene que hacer lecturas bajo guard y revalidar mediante beforeCommit, y TODOS los escritores resolver mapping bajo la misma coordinación. La revisión emulada de reglas sigue en los frentes A/B; este incremento no la reemplaza.

## Evidencia

Pruebas con fetch doble local, sin conexiones: prueba válida/PATCH exacto, prueba falsificada, todos los bindings de actor/lease, lease vencido, extras/omisión/cambio de ruta, modificación de asociación o recibo genérico, permisos/rol/perfil/contraseña revocados, claims reservados forjados en acquire/abort/commit/readAsUser, prueba válida frente a claims falsos y capacidad mezclada. Se conservan las4pruebas comunes B de schema/capacidades. No se instala ni contacta Firebase.

Gate acotado: office-stock-link-policy, store-protocol-claims, office-stock-link-plan, office-stock-link-sdk-race, office-stock-link-writer-contract. Sin navegador ni suite general; sintaxis y diffcheck. Reglas privadas no copiadas a Git. Informe de reglas/identidades y matrices D sigue vigente.
