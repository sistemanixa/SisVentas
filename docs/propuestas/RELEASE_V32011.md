# Propuestas y revisión rápida · v3.20.11

Preparación aislada sobre la versión publicada v3.20.10. Conserva el lector de resúmenes y los contratos del servidor. No habilita las nuevas fuentes de Cuenta Corriente.

- Selección conjunta de presupuestos visibles del mismo cliente, con seleccionar todas, títulos y fotos ilustrativas; importes, descuento e IVA se toman del documento original autorizado. La exportación vuelve a verificar los originales.
- Vista previa desde el listado sin ventanas emergentes, con controles accesibles y recuperación del foco y de la búsqueda. Las acciones se mantienen en su columna.
- Volver desde Nuevo gasto conserva y revela el listado incluso si llegó una actualización mientras el formulario estaba abierto.
- Aplicar precios verificados conserva la selección ante rechazo o respuesta incierta y usa el producto vigente en una transacción. Un precio de API no finito o no positivo no reemplaza un costo existente.

Las pruebas específicas usan datos ficticios: modelos y adaptador, interfaz en tres anchos, PDF y cancelaciones, concurrencia y respuestas inciertas. Las ilustraciones son genéricas; no representan instalaciones del cliente. Los activos publicados se limitan a trece imágenes identificadas por nombre, sin documentos o capturas privadas. La puerta general se ejecuta sobre la fuente final y su resultado se registra por separado; no se declara aprobada por pasar solamente las pruebas focales.

No implica publicación ni actualización de registros comerciales en este commit.

## Evidencia final de esta preparación

La puerta general ejecutada sobre la fuente previa al ajuste de fixture terminó con 10.600 casos: 10.442 aprobados, 106 fallidos y 52 omitidos. Los 105 fallos conocidos de la base se repitieron; el único fallo adicional fue un fixture de controlador que no representaba la celda de Acciones actual. Se actualizó sólo ese DOM simulado, sin cambiar las aserciones ni el controlador, y sus 19 casos pasaron. No se presenta como puerta completa verde ni se atribuye a esta entrega la reparación de los fallos de base.

Verificaciones específicas: 53 casos de modelos/adaptador y concurrencia; 15 de persistencia del Actualizador, incluidos cuatro precios API inválidos; 26 recorridos nativos y contrato de activos; 19 escenarios de presentación/PDF con tres anchos, cero errores de página y ninguna lectura o escritura real. Sintaxis, coherencia local de versión y diff sin errores. Las evidencias y capturas de fixtures quedan fuera de Git.
