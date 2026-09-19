# Publicación v3.6.15

- Propuestas desde compra Paraguay: copia al editor, selección de alternativas, porcentaje sobre costo por renglón, gastos proporcionales, descuento por ítem y general, IVA y comparación de rentabilidad. No altera el original. Sin stock se excluye; stock no verificado requiere selección manual.
- Unión de presupuestos: copia de varios registros, agrupación sólo con identidad, precio, descuento y costo compatibles; descuento general explícito y referencias de origen en observaciones. El editor permite revisar cliente y domicilio antes de guardar.
- Costos trasladados conservados en normalización, editor, borradores y persistencia; comparaciones y margen del editor utilizan esos costos. Conversión V3 preserva los campos.
- Flytec: costo convertido con dólar vigente y diferencia en ARS/porcentaje respecto del menor proveedor local con stock, independientemente del favorito. No incluye flete.
- Consulta de proveedores sin captura global de clics/teclado. Se evita solapar consultas y se descartan respuestas si cambió la identidad o los proveedores de la ficha, incluyendo confirmación manual.
- Creador editable al pulsar el nombre para admin; totales destacados en las cuatro vistas comerciales.

Validación: 33 pruebas focalizadas aprobadas de propuestas, costos, descuentos, unión, permisos, comparación, guardado, impresión y conversión; sintaxis y consistencia local de versión aprobadas. Interfaz local: se preparó un combinado PP-0072 + PP-0071 en un borrador titulado «Verificación local de unión», sin guardar un presupuesto definitivo. Se verificó Flytec en P-39677: ARS 90.270 versus menor costo local 120.601,69, ahorro 30.331,69 (25,2%). Durante consulta Flytec fue posible navegar a Presupuestos; la consulta terminó sin errores de consola. Las pruebas no modificaron los presupuestos originales.
