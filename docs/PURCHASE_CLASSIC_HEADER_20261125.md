# Encabezado clásico: excepción estrecha implementada

Delta autorizado sobre `05b1288e` / fuente `02f7693b`. No implementa baseline de
pendientes ni conciliación de stock. No activa cohortes ni retira SDK remoto.

## Contrato existente

`POST /compras/ordenes/inventario` conserva su body actual:

```json
{
  "id": "fiction-classic-header",
  "kind": "edit",
  "orderKey": "oldOrder",
  "expectedHash": "hash-del-original-completo",
  "expectedRevision": 0,
  "header": {"providerKey": "provider", "date": "2026-11-02"}
}
```

Sólo se selecciona esta excepción si la orden NO tiene propiedad propia
`inventarioCompra`, header está presente y quantities/declaration están ausentes.
No se reinterpretan un marcador null, un registro parcial ni cantidades enviadas
como una edición de encabezado. El body wire y su digest se conservan.

El modelo puro exige borrador/enviada, ítems originales sin recepción ni costos
reales, sin señales de historia de inventario ni operaciones pendientes. La
recepción malformada se rechaza. Header sólo admite proveedor/fecha, y el nuevo
proveedor debe estar activo con nombre vigente. No se infiere moneda ni FX.

## Autoridad y preservación

Después de autenticar y leer mediante `scope.getAsUser`, el comando comprueba CAS
del original completo y revisión. Para ese shape llama directamente a
`Policy.issueEditedOrder`, que recompone el plan puro `purchase-order-edit-plan`.
No llama a resolver de inventario, no construye un port falso y no ejecuta register.

La Policy conserva su WeakMap, begin/sealDerived/validate y comprobación fresh
de originales y dependencias. El proveedor se lee RAW en scope y su snapshot
normalizado se valida contra ese RAW; se vuelve a comprobar antes del commit.
Permisos, sesión y admisión de cohorte se revalidan en la fase final.

Sólo cambian proveedor/fecha solicitados, auditoría de encabezado, autor/fecha de
actualización y revisión/operación nativa con las proyecciones correspondientes.
Ítems, cantidades, precios públicos/proveedor, capturas USD/ARS, moneda, totales,
pagos, Sale/List y ledger se conservan. No se añade inventarioCompra ni operación
de stock. Una traza antigua en un ledger permanece idéntica y no es reinterpretada.

Las órdenes vinculadas pueden usar este header estrecho sin alterar Sale/List;
no se interpreta como declaración económica, edición de filas ni conciliación.
Fuera del shape estrecho se conserva exactamente el circuito anterior: qty,
recepción y borrado clásicos siguen en revisión. Una orden recibida tampoco
obtiene acceso a header por esta excepción.

## Evidencia y límites

Se actualizan únicamente los dos casos header de la caracterización anterior
para exigir el éxito ahora autorizado; los seis casos de qty/receipt/delete
conservan rechazo y todas sus aserciones de no escritura. Los originales
financieros/capturas no se rebaselínean.

Primera regresión: 198 PASS, incluye los 14 casos de caracterización y modelos
edit/Policy/manual/linked/FX/wire. Corrida final conjunta: **236 PASS, cero fallos,
cancelaciones u omisiones**; incluye esos 198, 13 de host y 25 nativos nuevos.
No se suman corridas solapadas como pruebas distintas. Log local:
`C:/SisVentas/tmp/purchase-classic-header-final-20261125.log`.

Los nativos usan StockOrder, Financial y History activos, permisos/CAS/proveedor/
sesión y ACK perdido con datos ficticios y REST interceptado. Proveedor eliminado
también se rechaza. El digest wire real coincide con el recibo; el resolver
genérico confirma y replay conserva un solo PATCH/audit, sin resolver stock.
Control rojo contra la copia congelada anterior: 409
`SV_PURCHASE_HISTORY_REVIEW` para el mismo header. Sin modificar esa copia.
Syntax/diff-check PASS. No acredita Rules remotas, interfaz completa ni activación.

No hay cambios de Rules, Guard, Store, runtime, Docker, index ni aplicación.
