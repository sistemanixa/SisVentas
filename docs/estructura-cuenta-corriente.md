# Estructura de datos de Cuenta corriente

Firebase Realtime Database no usa tablas ni columnas rígidas. Cada nodo contiene objetos y los registros históricos pueden conservar nombres de campos de versiones anteriores.

```text
sisventas
├─ clientes
│  └─ {clienteFbKey}
│     ├─ id                         identificador comercial antiguo
│     ├─ nombre / empresa
│     ├─ saldo                      campo histórico redundante; ya no se crea
│     └─ datos de contacto
├─ ventas
│  └─ {ventaFbKey}                 identidad técnica e inmutable
│     ├─ id / numero               número comercial visible
│     ├─ clienteFbKey              vínculo recomendado al cliente
│     ├─ cliente                   nombre histórico para mostrar
│     ├─ total                     importe cerrado de la venta
│     ├─ pagos[]                   pagos embebidos antiguos (respaldo)
│     ├─ totalPagado / pagado /
│     │  montoPagado               resúmenes históricos de respaldo
│     └─ saldo                     campo histórico; no debe calcular métricas
└─ pagos
   └─ {pagoFbKey}
      ├─ ventaFbKey                vínculo recomendado a la venta
      ├─ venta                     número comercial histórico
      ├─ clienteFbKey
      ├─ monto
      ├─ fecha
      └─ anulado / estado
```

## Regla vigente desde v2.0.246

- La deuda no se guarda como una columna: se calcula como `total de ventas - pagos válidos`.
- `sisventas/pagos` es la fuente principal.
- `venta.pagos[]` y `totalPagado`, `pagado` o `montoPagado` sólo se usan como respaldo para registros antiguos que aún no tienen pagos globales.
- `venta.saldo` queda ignorado por Dashboard, Clientes, Cobranzas y Cuenta corriente.
- `cliente.saldo` tampoco interviene en las métricas y dejó de crearse en clientes nuevos.
- Los cuatro módulos consumen el mismo conciliador y no mantienen fórmulas propias.

## Campos duplicados que todavía no conviene borrar

Los alias `id`, `numero`, `venta`, `ventaId`, `clienteId` e `idCliente` se usan para enlazar registros históricos. Eliminarlos directamente podría separar pagos de sus ventas. Primero deben migrarse a `ventaFbKey` y `clienteFbKey`; después podrá retirarse cada alias con una auditoría de referencias huérfanas.
