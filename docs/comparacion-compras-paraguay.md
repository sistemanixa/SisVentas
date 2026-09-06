# Comparación de compras en Paraguay — diseño propuesto

Estado: diseño, pendiente de definir ubicación de la comparación y gastos de compra con el usuario. No implementado ni publicado.

## Configuración

Interruptor global «Comparar compras en Paraguay», sincronizado entre dispositivos. Al deshabilitarlo se oculta la comparación y se conservan sus datos.

Cotizaciones explícitas: pesos por dólar y guaraníes por dólar, con fecha de actualización. Se debe distinguir la cotización usada para comprar divisas de la referencia comercial del catálogo. No asumir que son iguales. Una cotización ausente impide calcular el escenario correspondiente.

Gastos editables por proyecto: porcentaje sobre la compra, importe fijo o ambos, según confirme el usuario. Mostrar si están pendientes de cargar; no presentar el resultado incompleto como ganancia definitiva.

## Proveedores y productos

Identificar país y moneda del proveedor (USD o PYG). Mantener el vínculo con la URL exacta de cada producto. Conservar precio original, moneda, fecha, fuente y condición de impuestos informada; no deducir moneda a partir del símbolo «$» o del tamaño del importe.

La verificación debe comprobar identidad, moneda y precio antes de habilitar la consulta automática. La comparación no debe reemplazar automáticamente el costo habitual ni modificar precios de venta.

## Comparación por proyecto

Mantener el mismo ingreso de venta y la misma base de costos en ambos escenarios:

- Actual: proveedores habituales y restantes costos del proyecto.
- Paraguay: alternativas elegidas en Paraguay, conversión y gastos de compra, más los costos habituales de los productos sin alternativa y los restantes costos del proyecto.

Mostrar costo total, resultado estimado, diferencia en pesos y margen sobre venta. Diferenciar margen de recargo sobre costo. No calcular porcentaje si el ingreso es cero.

Detalle por producto: cantidad, proveedor habitual, costo habitual, proveedor alternativo, precio original y moneda, costo convertido y diferencia. Mostrar productos sin alternativa, precios vencidos, falta de stock y cotizaciones pendientes. Una verificación exitosa de una URL de prueba no confirma todos los productos del proveedor.

Conversión: USD × ARS por USD; PYG ÷ PYG por USD × ARS por USD. Redondear importes monetarios al cierre del cálculo, evitando conversiones repetidas.

Guardar una instantánea por comparación: productos, cantidades, precios originales, cotizaciones, gastos y fecha. Los cambios posteriores del catálogo no deben alterar silenciosamente una comparación guardada; ofrecer recalcular.

Respetar permisos existentes de visualización de margen. La comparación es interna; no incluir costos o ganancias en el presupuesto/PDF del cliente.

## Integración técnica observada

El cotizador y el importador de productos actualmente exigen ARS. La normalización de proveedores convierte datos heredados USD y fija monedaPublicada en ARS. Se necesita un contrato explícito de precio original y moneda antes de incorporar PYG o precios internacionales al flujo automático.

Reutilizar vínculos de proveedores por producto, la configuración sincronizada y el permiso presupuestos.verMargen. Mantener separados el precio original, su conversión y el costo de compra total.

## Validación requerida al implementar

Conversión USD/PYG, cotizaciones ausentes, productos sin alternativa, cantidades múltiples, costos fijos y porcentuales, precios vencidos, cambio de cotización sin alterar instantáneas, permisos y ocultamiento al desactivar la función. Comprobar que el flujo ARS existente no cambia.
