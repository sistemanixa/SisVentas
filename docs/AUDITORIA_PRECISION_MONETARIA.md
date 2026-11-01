Estado vigente: publicado y verificado en v3.17.7 el 01/11/2026. El texto de preparación inferior es histórico; no representa un despliegue pendiente. Referencias antiguas de stock y medición de reposo: ver CONTEXTO_ACTUAL.

# Precisión monetaria · candidata local · 01/11/2026

Estado: no publicado. Producción no fue modificada. Las pruebas usan datos ficticios; no registran cobros, no emiten facturas, no recalculan históricos ni mueven stock.

## Criterio

- Importes de cobros: centavos exactos. Una entrada con fracciones de centavo se rechaza; no se corrige silenciosamente.
- Cantidades, cotizaciones y costos unitarios conservan su precisión. No cerrar el costo unitario antes de multiplicarlo por la cantidad.
- El documento cierra los importes monetarios en el punto definido por su contrato: renglón descontado, base, impuesto y total. No redondear al peso ni sumar descuentos calculados con un criterio distinto del escritor.
- División y porcentajes pueden producir fracciones de centavo. La aritmética racional conserva la precisión intermedia; el cierre monetario es explícito, al centavo más cercano, y el reparto conserva exactamente el total mediante residuos ordenados. No es posible representar un tercio de centavo como tres pagos iguales en centavos.
- Un centavo pendiente mantiene el estado parcial. Los umbrales de ruido binario no son una autorización para perdonar deuda.
- Se conservan los formatos visuales USD enteros previamente acordados y las validaciones de históricos identificados. Presentar un entero no autoriza guardar ese entero sobre una base con decimales.

## Recorridos revisados

| Circuito | Corrección o comprobación |
| --- | --- |
| Venta y presupuesto | Descuento por renglón, general e IVA comparten cálculo decimal; escritor, lector y validación de cobro coinciden. |
| Conversión, soporte y adicionales OT | Conservación del costo y del formato común; no sustituir el costo histórico al editar. |
| Stock y compras | Costo final con gastos una vez; unitario sin corte prematuro; reparto de logística sin residuo negativo. No consume stock por calcular. |
| Exterior y envíos | USD 12,99 conserva 12,99; ARS conserva centavos; cambiar la base a ARS no genera una ida y vuelta USD. Editor conserva el precio original. |
| Cobros | Rechazo de fracciones de centavo, suma exacta de imputaciones, saldo y estado sin perdonar un centavo; replay y permisos conservados. |
| Gastos y bonificaciones | Pago parcial hasta el último centavo, historial y movimiento vinculado conservados, sin repetir pagos. Bonificación por unidades mantiene su cálculo entero existente. |
| Horas extra y aguinaldo | Eliminado cierre al peso, suma decimal de horas y reparto que conserva el gasto aprobado. |
| Comisiones | Generación sólo con cobro completo, costo original, cálculo decimal y reparto del total sin pérdida de centavos. No reescribe comisiones existentes. |
| Facturación | Preparación y servidor verifican el mismo neto y total. La última unidad puede separarse sólo en la representación fiscal del mismo producto para distribuir el centavo residual; conserva cantidad, total y venta comercial. Incluye cantidades fraccionarias. No se afloja el control fiscal. |
| Finanzas personales | Modelo de centavos enteros/BigInt conservado; tasas y proyecciones tienen su propio contrato. No se mezcla con finanzas laborales. |

El inventario estático abarca la aplicación activa y fuentes de core, módulos, modelos y servicios. Incluye ubicaciones que son geometría, fechas, identificadores, conteos o presentación; eliminar todos los Math.round sería incorrecto. El inventario es una ayuda, no una prueba de ausencia universal de fallos. El lector de cobertura salarial con sintaxis no soportada por el tokenizador antiguo se revisó directamente: no contiene un cierre monetario al peso.

## Evidencia y límites

Pruebas funcionales y de concurrencia de la puerta vigente, pruebas del servidor y pruebas de UI ficticias. Evidencia privada en tmp/precision-audit, fuera de Git/Hosting. Demostración local aislada en http://127.0.0.1:8898/: módulos reales de cálculo, datos ficticios, connect-src none. No equivale a emitir contra ARCA ni a registrar un cobro de producción.

Antes de publicar: versionar la aplicación inmutable; revisar el alcance de servidor fiscal y Cotizador, sus dependencias compartidas y las reglas/referencias de costo de stock del bloque anterior. Este checkout no se debe publicar directamente sobre la versión activa v3.17.6. No hay autorización de publicación en este bloque.
