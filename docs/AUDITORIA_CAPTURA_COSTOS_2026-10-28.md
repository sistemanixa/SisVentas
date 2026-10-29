# Captura de costos: revisión acotada del circuito vigente

## Evidencia y límites

Se leyó por clave exacta la venta de soporte indicada por el titular. Su ítem no tiene ningún campo de costo, incluidos los dos campos de instantánea histórica. Los datos financieros y la clave quedan sólo en evidencia privada de `tmp`, fuera de Git. No se consultó el historial completo ni se modificaron operaciones.

Esto confirma ese caso, no permite calcular cuántas ventas están afectadas. El conteo anterior del informe no es evidencia suficiente: su lector omitía dos nombres de costo histórico.

## Caminos revisados

| Circuito | Comportamiento comprobado en código |
| --- | --- |
| Venta manual | El constructor guarda `costoUnitarioCompra` y `costoTotalCompra`. |
| Alta comercial central | `SVCommercialOwnership.stamp` llama a `snapshotCosts`, que conserva `costoUnitarioPresupuestado` si puede identificar un costo. |
| Edición | `SVCommercialDocument.preserve` llama a `preserveCosts`; conserva la referencia original y marca un histórico desconocido, en lugar de confirmarlo con el catálogo actual. |
| Presupuesto a venta V3 | `toLegacyItem` copia la fuente del ítem antes de normalizar precio/cantidad/descuento, conservando sus campos extra de costo. No se comprobó una pérdida generalizada en este camino. |
| Venta desde soporte | Su constructor no incluye costos directamente. En el circuito actual depende de la captura central; una versión histórica inspeccionada también carecía de esos campos en el constructor. |
| Adicionales OT | Los constructores inspeccionados arman precio/cantidad/subtotal sin campos propios de costo. Es necesario revisar cada persistencia final; no se afirma que todos los caminos estén protegidos por la captura central. |
| Columna P. compra | Si no encuentra costo guardado, puede usar el costo actual del catálogo. Que exista una cifra visible no demuestra que se haya congelado al crear la venta. |

`snapshotCosts` no garantiza un costo en todos los casos: deja el ítem sin instantánea si no identifica un producto/costo; además recibe arrays, no cualquier forma histórica de ítems. No debe presentarse como validación estricta universal. El historial Git introduce esa función en `c114d36b`, del 16/10/2026; esto acredita incorporación al código, no fecha de despliegue ni cobertura de ventas anteriores.

## Corrección local del informe

El lector salarial reconoce ahora `costoUnitarioPresupuestado` y `costoUnitarioAntesPreparacion` como alternativas guardadas, sin reemplazar un costo real de compra disponible. Respeta `comisionCostoHistoricoPendiente` y no convierte un valor calculado posteriormente en histórico confirmado. No se modificaron capturas, pagos, comisiones ni importes de ventas.

58 pruebas focales del informe y 39 pruebas existentes de captura/conservación/comisiones pasaron. Esta revisión no demuestra todas las escrituras reales, ni autoriza reconstruir costos antiguos usando precios actuales. Queda pendiente unificar y exigir la captura de costos en cada alta/adicional, y explicar la procedencia de P. compra en la interfaz; no se publicó ni se aplicó esa modificación financiera como parte de esta auditoría.
# Captura y conservación de costos preparada en local · 28/10/2026

Se incorporó SVSaleCosts en los límites de guardado de venta manual/soporte, conversión de presupuesto, cierre de visita y adicionales/corrección de materiales de OT. Los ítems nuevos capturan costo unitario y total; si falta evidencia del costo se rechaza el guardado en lugar de suponer cero. Las ediciones conservan el costo original; cantidades recalculan su total y descuentos no reducen el costo. Reintentos no duplican ítems. La integración pura de materiales permanece sin efectos de guardado. Histórico sin costo sigue desconocido, sin rellenarlo con catálogo; P. compra de referencia se identifica visualmente.

Validación: suite vigente 6373 PASS, 27 skip, cero fallos; 57 pruebas focales finales. Navegador aislado ficticio: cinco circuitos en 390/768/1280, cero solicitudes externas y cero escrituras financieras. Evidencia privada en tmp/sale-cost-capture-qa y logs privados. Es una protección de los circuitos cliente auditados, no una nueva regla universal del servidor. Sin cambios de infraestructura, reglas, pagos, stock, comisiones ni históricos; sin sondeos añadidos. Candidata16.6 sin publicar, producción16.5 sin cambios.

Espejo local actualizado. Muestra ficticia disponible como cost-proof.html en el espejo de8766 y servidor acotado8894. La apertura en el navegador del titular falló por conexión y posterior bloqueo de control sobre su página de error: no se afirma haber mostrado o recargado su sesión. Capturas aisladas sí verificadas; no se alteró su ficha abierta. Siguiente paso: mostrar la muestra local cuando el navegador vuelva a admitir navegación, antes de publicar. Sin push.

# Guardado comercial unificado preparado en local · 28/10/2026

Pedido: una venta usa el mismo formato y guardado al crearse desde cualquier origen; un adicional de OT equivale a agregar un producto. SVSaleWriter concentra formato, cálculo de ítems/descuento general/IVA, captura de costos, conservación de pagos/factura/comisión generada, autoría y guardado. Integrados: venta manual y soporte por ventasPagosPersistirGuardarVenta; edición/actualización; conversión de presupuesto; resolución de visita; adicionales a venta existente y venta nueva de OT; creación con créditos históricos; carga demo; anulación y cambio autorizado de IVA. Cada origen conserva sólo la obtención de sus datos, permisos propios y vínculos. Las escrituras con vínculos permanecen atómicas, con CAS de la venta mediante el transporte existente. La conversión conserva autor/comisionado del presupuesto, no del operador. Edición sin cambios económicos no recalcula históricos. Configurar comisión conserva su permiso específico; no da permiso para alterar pagos.

Los comandos propios de cobros, facturación, stock, garantías y aplicación del costo real de una compra conservan sus controles especializados: no se convierten en un guardado libre de la venta ni se amplían permisos. El adaptador de repositorio V3 queda como infraestructura genérica; los puntos de creación comercial activos ya no escogen entre ese adaptador y un fallback Firebase. Los créditos conservan su transacción histórica existente y sus vínculos bilaterales, ahora pasando por el formato/escritor común; no se rediseñó su lectura amplia en este bloque.

Validación: suite vigente 6386 PASS/27 skip/cero fallos antes del ajuste final de permiso específico; 72 focales finales PASS, incluido transporte SVLaborWrites real contra almacenamiento ficticio: un comando atómico, lectura de la venta puntual, sin exigir lectura de avisos privados. Cinco circuitos en navegador390/768/1280, cero solicitudes externas/cero escrituras financieras reales. Demo usa los módulos reales de formato/costo y controles de documento con almacenamiento exclusivo en memoria; no constituye un guardado real ni prueba de todos los permisos remotos. Evidencias privadas en tmp/unified-sales-*.private.log y tmp/sale-cost-capture-qa/unified-local.png. Se abrió y operó efectivamente la muestra http://127.0.0.1:8894/ en la pestaña11, conservando la venta real del titular en su pestaña original. Espejo8766 actualizado, sin recargar ni guardar su ficha. Sin nuevas consultas por reloj ni servicios/costo fijo; comparaciones puntuales sólo al guardar. Sin cambios de servidor, reglas, históricos, pagos reales, stock real ni publicación. Candidata16.6 local; producción16.5 sin cambios. Sin push. Pagos candidatos ajenos siguen excluidos.
