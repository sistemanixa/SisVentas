# Puerto prospectivo para alta manual de Compras — 22/11/2026

Propuesta OFF, exclusivamente interna. No modifica consumidores existentes, modelos de escritura, índice, rutas, reglas, activación o datos reales. No representa una orden nueva como si ya existiera en RTDB y no recibe un original inventado.

## API acordada con A mediante coordinación

`purchase-create-reference-port.create({enabled:false,mappedAdmission,now})` devuelve únicamente:

```js
const resolved = await port.resolve({productKey}, {
  actor, lease, read, queryPage, referencePhase
});
// resolved = {product, inventory, reference, readSet, evidence}

await port.assertFresh(resolved.evidence, {
  actor, lease, readFresh, queryFresh, queryPageFresh
});
```

Los puertos y actor/lease son dependencias de servidor. La selección admite solamente productKey canónico, con la forma de clave del núcleo de referencias. Nunca acepta J, coverage, ready, originalOrder, sourceOrder o path del cliente. `product` contiene fbKey derivado del path real; un fbKey almacenado contradictorio se rechaza. `inventory` es el original físico completo y `reference` conserva P/J/identidad histórica/revisión del vínculo.

Contexto confirmado: mode=user, financialAction=ordenes.editar, operation=purchase-manual-create, input.kind=register. input.id, opId, transportDigest, hash(input), actor uid/claims uid y lease deben coincidir. El id de operación conserva el límite 8..160 del coordinador; no se trunca. La operación debe proceder del authorize autenticado de A: este puerto interno no autentica tokens ni se expone como endpoint.

Se lee también sv_labor_guard real y se cotejan actorUid/opId/fence/digest/expiresAt/mode con el lease recibido. Perfil, permisos actuales de Órdenes, revisión/digest, bloqueos y reset de acceso se revalidan. Un recibo genérico ya existente del intento bloquea nueva planificación; la recuperación y replay corresponden al guard de A.

## Resolución y evidencia

Con P→J explícito se usa la admisión firmada y verificación de pair/orígenes del núcleo: producto P actual activo, ledger J existente con propietario compatible, forward/inverse completos y ambos recibos de origen. Con ledger P existente y sin mapping se usa legado exacto bajo la misma cohorte, sin buscar alias globales ni inventar una historia de la compra nueva. Se conserva el inventario completo; no se calcula una cantidad inicial ni se cambia el costo de referencia.

Si falta P y hay lector acotado, se ejecuta discovery completo para detectar J huérfano. Incluso si la ausencia queda demostrada, este puerto devuelve REVIEW y **no emite evidencia válida para inventario null**: es el límite vigente de b429 y A debe mantenerlo hasta un contrato explícito de inicialización. Un J faltante en una asociación o una referencia ambigua también se rechazan. No se crea P sombra, catálogo u orden.

`evidence` es un objeto opaco emitido por WeakMap, ligado a la instancia de factory, actor/claims, permisos, operación, input/digest y lease/fence/deadline. Un booleano, JSON/clon, otra factory o un lease nuevo no lo sustituyen. Los readSet y resultados externos son copias; modificarlos no cambia la evidencia sellada. `assertFresh` reautoriza, compara todas las dependencias originales (incluidos guard, ausencia de recibo, firma, producto y mapping/ledger) y verifica otra vez el límite temporal.

Este objeto es evidencia de **lectura**, no una capacidad de escritura. No tiene patch, Policy.issue, scope.update, store.commit, allocator o generador de orden/número; no agrega actor.purchaseInventory. A debe comprobar destino de orden/recibo de dominio ausentes, proveedor, precios acordados y demás fuentes, construir su modelo puro y emitir su propia issueCreation bajo el guard. Solo el guard puede confirmar persistencia.

Para varias líneas, A puede compartir su lector de planificación de scope y usar un lector directo o memo **nuevo de readFresh** en el check final. No reutilizar el memo de planificación. Los puntos se ejecutan mediante la ventana común y drenan errores. La factory permanece OFF sin IO; el modo rápido requiere la autoridad firmada real del núcleo y no admite un callback que devuelva true.

## Evidencia y límites de validación

34 PASS nuevas: P→J y P existente, ausencia de lecturas a órdenes/listas/OT inexistentes, cero mutaciones/policy, OFF sin IO, input hints rechazados, operación/tipo/carga/identidad/fence alterados, guard real distinto, evidencia forjada/serializada/otra factory, deadline, permisos/reset/revisión, fuentes y firma cambiados, copias externas alteradas, recibo previo, ausencia completa sin inicialización, J huérfano, inactivo/desconocido/eliminado/servicio y propietario contrario. Todo usa datos ficticios y claves Ed25519 efímeras solo en memoria.

La composición con el comando create, modelo b429, issueCreation, allocator de número, reglas y replay del alta completa queda en A. Este incremento no modifica esos componentes ni acredita su publicación. Sin navegador, red, datos reales, build, despliegue o push. La nueva dependencia debe incluirse en Docker cuando A la importe en el runtime; actualmente no está registrada.
