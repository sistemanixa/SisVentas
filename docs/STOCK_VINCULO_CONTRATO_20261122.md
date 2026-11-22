# Revisar vínculo — contrato y corte de compatibilidad propuesto

Complemento separado de d052768a. Base060c77f8; sin modificaciones a escritores OT, Compras, reservas, recibos, claims o despliegues. Este documento solicita acuerdo del coordinador antes de editar archivos del frente D. No es un guardado habilitado ni una migración ejecutable.

## Contrato observado en fuente actual

| Circuito | Función / archivo | Identidad física usada |
| --- | --- | --- |
| Stock | resolve, detail, history, save; cotizador/office-stock.js | Clave producto y aliases id/codigo/cod normalizados; rechaza varios inventarios |
| Compras lectura | operationalFor; js/modules/purchase-orders.js | product.fbKey, luego item.productoKey, luego código normalizado |
| Compras transacción | escritor que construye PATH_INVENTORY + safeKey(productKey), línea981 del archivo anterior | Clave producto normalizada; no consulta asociación de Stock |
| Reservas/pendientes | reconciliación oldPending/newPending e inventoryKeys; purchase-orders.js | Claves de asignaciones/pedidos ya almacenadas |
| Entrega OT | productKey y create; cotizador/ot-delivery.js | Material.productoKey o producto resuelto por código; inventario bajo esa clave |
| Rendición OT | resolveProduct y verifyReceipt; cotizador/ot-material-state.js; llamadas en ot-lifecycle.js | Recibo rendicionesOT bajo inventario/productKey; verifica venta/OT/revisión |
| Consumo cliente heredado | sync; cotizador/ot-stock-consumption-model.js | product.fbKey o material.productoKey; identidad del recibo incluye esa clave |
| Conteo de oficina desde OT | módulo js/modules/ot-office-count.js | material.productoKey o producto.fbKey |

Los rangos/líneas son orientativos; las funciones son el contrato. No asumir que la propuesta89515 anterior está integrada ni compatible con esta base.

## Riesgo demostrado

Cuatro pruebas ejecutan funciones de la fuente actual con datos ficticios. Un inventario físico oldCode conserva saldos y recibos; un producto canonical tiene codigo=oldCode. Agregar metadata Stock que vincule ambos no cambia a Compras: lectura por canonical devuelve vacío. El resolver OT devuelve canonical y verifyReceipt busca el ledger allí: no encuentra el recibo intacto de oldCode. sync cliente intenta una transacción en canonical y no confirma. Cambiar únicamente el listado o permitir ajustar desde Stock produciría dos interpretaciones de la misma existencia. Las pruebas no editan producción ni los módulos del frente D.

## Solución compatible propuesta para acuerdo

Mantener la clave física original de cada inventario y conservar TODOS sus campos exactamente. Introducir una asociación autoritativa uno a uno, bidireccional y revisionada entre producto canónico y clave física, consumida por TODOS los lectores y escritores enumerados. Resolver debe devolver por separado productKey, inventoryKey, mappingRevision y referencias verificadas; nunca sustituir una clave dentro de un recibo o del hash de identidad legado. Un mapping no concede permiso ni cambia propietario/venta/OT. Una asociación ausente conserva el comportamiento histórico únicamente cuando es inequívoco; una divergencia entre mapping, aliases o recibos se bloquea con motivo identificable.

Cambios exactos a acordar por dominio:

1. Nuevo módulo puro de resolución compartida (ubicación propuesta cotizador/office-stock-reference.js, espejo cliente sólo si escritores cliente siguen activos). Entradas: catálogo puntual, mapping en ambas direcciones y candidatos de inventario por alias; salida con identidades separadas. Cero escrituras al resolver, error explícito ante alias compartido, varios inventarios o referencia incompleta.
2. Stock list/detail/history/save usan el mismo contrato y revalidan mappingRevision al guardar. List trabaja con proyecciones mínimas e índices, sin descargar costos/historial de cada fila.
3. Compras operationalFor y todas sus transacciones de recepción/reserva/devolución usan inventoryKey pero conservan productKey en documentos comerciales. No cambiar las claves de asignación por venta ni recibos existentes. La reconciliación de pendientes debe usar la misma resolución antes de calcular deltas.
4. Frente D: ot-delivery, ot-material-state.resolveProduct/verifyReceipt y ot-lifecycle reciben inventario físico por el contrato común. Las identidades de materiales/recibos y revisiones OT no se reescriben. OT cliente y ot-office-count deben consumir el mismo mapping o quedar explícitamente inhabilitados antes del corte; un solo escritor antiguo puede reabrir una segunda rama de inventario.
5. Comando nuevo y específico de asociación, distinto de conteo. Permisos existentes admin/administrativo + stock.ajustar/productos, sesión actual y sin Ver como. No ampliar reglas ni autoridades para hacerlo funcionar. Catálogo activo/no servicio por defecto; inactivo se muestra identificado y conserva la política de decisión pendiente, sin reactivar ni apuntar a otro producto automáticamente.

## CAS, un efecto y conservación

La solicitud de asociación debe fijar operationId, productKey, inventoryKey, hashes del producto/mapping/candidatos y revisión de permisos. La transacción guarda asociación, inversa y recibo en un solo commit coordinado, tras verificar nuevamente todos los originales. Debe participar en el mismo mecanismo de exclusión/fence que las escrituras comerciales involucradas: un CAS únicamente sobre el mapping no evita una reserva simultánea que resuelve la clave antigua. La propuesta requiere revisión del dueño de ese mecanismo; este frente no modifica guard/receipts/claims.

Mismo operationId + mismo digest devuelve el recibo sin segunda escritura; mismo ID con payload distinto se rechaza. Una respuesta perdida se recupera consultando operación. Cambio concurrente de producto, mapping inverso, alias, permiso o inventario obliga a recargar. Ninguna ruta de asociación puede modificar general, reservado, consumido, costos, ajustesConteo, asignaciones, rendicionesOT, operaciones ni documentos históricos. La prueba final debe comparar íntegramente esas ramas antes/después y cruzar asociación contra recepción/reserva/entrega/rendición en ambos órdenes.

## Bloqueos legítimos y siguiente implementación

Varios inventarios para un producto, inventario ya asociado a otro producto, aliases compartidos, producto inexistente/eliminado/servicio o histórico con procedencia contradictoria requieren conciliación explícita; no fusionar, mover, borrar, inventar producto ni elegir primer candidato. Un producto inactivo con vínculo exacto es un caso distinto de producto ausente.

Propuesta de orden: acuerdo coordinador/frente D sobre funciones anteriores y exclusión común; prototipo del resolver y plan de mapping con almacén ficticio; integración de TODOS los consumidores y pruebas de carreras; sólo entonces acción de UI y preparación de corte autorizado. Hasta ese acuerdo no se agrega un botón que guarde asociaciones ignoradas por otros circuitos. El commit de este bloque entrega contrato preciso + regresiones que reproducen el riesgo, no una reparación parcial presentada como completa.
