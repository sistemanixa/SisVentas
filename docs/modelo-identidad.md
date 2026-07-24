# Modelo de identidad y relaciones

## Regla principal

Cada registro persistido en Firebase tiene dos identidades con propósitos distintos:

- `fbKey`: clave técnica, única e inmutable. Es la identidad primaria del registro.
- `id`, `numero`, `codigo` o `legajo`: identificador comercial visible. Puede corregirse y, en datos históricos, puede estar repetido.

Un número como `PP-0031`, `#V-910089` u `OT-054` nunca debe decidir por sí solo qué registro se modifica.

## Por qué existen referencias por número

Las primeras versiones guardaban relaciones usando los números visibles. Además, algunas ventas históricas cambiaron de numeración mientras sus pagos u OT conservaron el número anterior. Por eso se mantuvieron alias como `idOriginal` y una comparación numérica sin prefijo.

Esa compatibilidad sigue siendo necesaria para leer datos antiguos. El problema histórico no fue conservarla, sino resolverla con `find()`: cuando dos registros compartían número, se elegía el primero.

## Contrato vigente

1. Una acción de edición, eliminación o navegación debe transportar `fbKey`.
2. Una relación nueva debe guardar:
   - la clave técnica, por ejemplo `ventaFbKey`, `clienteFbKey` o `productoFbKey`;
   - la etiqueta visible correspondiente, por ejemplo `ventaId`, `clienteId` o `codigo`.
3. La resolución se hace en este orden:
   - coincidencia exacta de clave técnica;
   - número o código comercial, sólo si hay una única coincidencia;
   - alias histórico normalizado, sólo si hay una única coincidencia.
4. Si una clave técnica explícita no existe, no se reemplaza silenciosamente por una coincidencia comercial.
5. Si una referencia comercial es ambigua, la operación se detiene y la auditoría la informa. El sistema nunca elige el primer registro.

## Migraciones

Las normalizaciones automáticas sólo completan claves técnicas cuando la relación es inequívoca. No renumeran registros ni reparan duplicados por su cuenta.

Los duplicados de números comerciales se resuelven conservando ambos `fbKey`, eligiendo cuál etiqueta visible debe cambiar y verificando antes todos los vínculos relacionados. Esto evita que una corrección de presentación cambie la identidad real de ventas, presupuestos, pagos u OT.

## Entidades auditadas

- Ventas: `fbKey` / `id`
- Presupuestos: `fbKey` / `id`
- Órdenes de trabajo: `fbKey` / `id`
- Productos: `fbKey` / `codigo`
- Clientes: `fbKey` / `id`
- Empleados: `fbKey` / `legajo`

La auditoría de relaciones marca como crítico cualquier clave técnica ausente o identificador comercial duplicado. Los casos ambiguos quedan fuera del plan automático de normalización.
