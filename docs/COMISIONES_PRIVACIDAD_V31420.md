# Comisiones: privacidad de presentación y respuestas · candidata v3.14.20

Pedido urgente del titular del 24/10/2026: quien cobra una comisión debe ver la venta, el cliente y su importe. El porcentaje también se retira de la vista personal, porque junto al importe permite deducir la ganancia.

## Alcance de esta corrección urgente

Se reconstruye el concepto desde campos estructurados. No se imprime la descripción histórica ni se intenta borrar un sufijo económico. En registros antiguos se puede recuperar únicamente el código de venta de un prefijo estricto; un cliente faltante no se inventa ni provoca otra consulta.

La vista personal de Dashboard, movimientos, pagos, detalle de comisión y resumen del vendedor presenta datos guardados. No recalcula la comisión con precios o costos actuales. La gestión financiera queda separada de la recepción personal y conserva sus permisos de aprobación y pago; Ver como no hereda el detalle financiero del administrador.

También se revisan Gastos, títulos de pago e historial, corrección del medio, legajo, avisos de aprobación, Tesorería, Excel y recibos/PDF. En documentos para el empleado se usa el concepto seguro incluso cuando los imprime un administrador. La auditoría no encontró un productor automático específico de chat que publicara ganancias; no se reescriben conversaciones personales ni documentos históricos arbitrarios.

Las respuestas de los dos endpoints de generación usan una lista explícita de campos permitidos. Los planes completos siguen dentro del servicio: se conservan montos, porcentajes, base, costos originales, autenticación, concurrencia e idempotencia para el cálculo. Las nuevas descripciones de generación y redistribución no incluyen esos datos. El historial existente no se migra ni se recalcula.

## Límite material: datos crudos recibidos

Este parche de presentación y respuestas **no acredita el aislamiento completo de datos**. Las lecturas actuales de CTA, Gastos y controles de generación todavía pueden entregar campos internos según los permisos vigentes. Ocultarlos en HTML no revoca esa lectura. Tampoco un veto en un hijo de RTDB revoca una concesión del padre.

La auditoría preparó un diseño separado de proyecciones saneadas, mantenidas dentro del mismo PATCH financiero, sin observadores, servicios ni sondeos nuevos. Antes de retirar concesiones hay que migrar las acciones delegadas que comparan registros completos, verificar los escritores y cubrir el histórico. No se aplican reglas propuestas como parte de esta candidata ni se presenta esa fase como terminada.

## Validación y estado externo

Las pruebas usan movimientos, personas y pagos ficticios con canarios de ganancia, costo y porcentaje. Comparan también orden, centavos, anulaciones, identidad, registros, filtros y ausencia de escrituras. Las pruebas históricas conservan su comparación monetaria y normalizan solamente las etiquetas cuya exposición cambió por pedido del titular.

El primer pase completo dio 5.920 aprobadas, 27 opt-in omitidas y cinco fallos de dependencias o expectativas de presentación; se conservó la evidencia y se corrigieron las fixtures, sin quitar controles financieros. La QA aislada detectó además un problema de foco del modal personal, corregido y vuelto a comprobar. La validación final de privacidad dio 5.936 aprobadas, 27 opt-in omitidas y cero fallos. Los módulos completaron 152 pruebas focales; la QA final cubrió 320/390/768/1280px con 20 capturas, foco, teclado, capas y scroll, sin canarios expuestos, errores de JavaScript ni tráfico externo. Los roles delegados conservan aprobación y pago bajo sus permisos. La redistribución por porcentaje queda restringida al administrador real, fuera de Ver como, para no exponer la base a otros perfiles. La tabla de pagos CTA estrecha conserva una limitación visual anterior de columnas próximas y desplazamiento interno; no se amplía esta entrega para rediseñarla.

Un nuevo aviso del titular mostró totales angostos y fragmentados en el presupuesto sin precios por ítem. Se incorpora una corrección exclusiva de presentación, con verificación ficticia y una nueva puerta final antes de publicar. No cambia valores ni fórmulas. La puerta final combinada dio 5.945 aprobadas, 27 opt-in omitidas y cero fallos (5.972 total), con 51 focales de presupuesto. El resumen tiene columnas propias e importes sin corte; la función de captura y el cálculo no cambiaron. SHA, QA final PDF, publicación remota y comprobación en la sesión del titular se registran en CONTEXTO_ACTUAL cuando existan. Al crear este documento, web/aviso/servidor siguen en19 y sólo se ejecutaron preflights de metadatos. No hubo operaciones financieras reales como prueba, nuevas reglas, IAM ni infraestructura. La compilación prevista es única y limitada a 300 segundos en E2_STANDARD_2, con estimación de hasta USD0,03 de cómputo más imagen/comprobaciones, sin costo fijo nuevo.
