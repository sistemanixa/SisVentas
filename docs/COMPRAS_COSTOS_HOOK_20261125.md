# Hook acotado para costos de Compras

El dueño de sale-cost-correction.js debe conservar su validador genérico. En validateChangedCosts, después de detectar un costo cambiado y antes de exigir el permiso genérico, usar:

```js
if (await require('./purchase-source-cost-validator').validate({actor,lease,patch,raw,get})) return;
```

La firma debe recibir lease desde Guard. El módulo de Compras obtiene la autoridad exclusivamente de purchase-inventory-policy, nunca del body ni de un callback inyectado. Si no existe autoridad genuina devuelve false para seguir con la validación genérica. Si la autoridad existe pero cambia un campo protegido, rechaza.

Propósitos: receive solamente purchase-inventory-receive; prepare solamente preparación, cancelación y edición; reconcile solamente purchase-order-reconcile. Se preservan filas, cantidades/precios vendidos, PVP, IVA, cobros, comisiones, autoría y el costo histórico anterior a preparación cuando ya existía. La auditoría previa no se sustituye. No exige dar al operador de Compras permiso genérico para corregir ventas.

Para las conjuntas la Policy reconstruye la orden contra padre e hija reales y conserva el listKey del padre aunque el wire de inventario no incluya listKey. SourceCost V2 incluye sourceTopology:'joint', parent contextListKey, sale/list de origen y jointSourceKey del índice verificado de sources. No se debe degradar receive conjunto a V1 ni otorgar autoridad de costo a un extra sin venta.

11 pruebas nuevas de autoridad privada y protección económica pasaron en la copia aislada. Se conservó el control rojo por pérdida de listKey antes de la corrección; log privado purchase-joint-authority-red-20261125.log. El verde y negativos están en purchase-source-cost-hook-20261125.log. No acredita aún Guard/Store/Rules reales: falta conectar este hook y los demás sellos en la composición compartida del principal.
