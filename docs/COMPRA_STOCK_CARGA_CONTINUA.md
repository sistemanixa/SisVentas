# Compra para stock y carga continua de productos

Implementación local del pedido del titular del 27/10/2026, coordinada con el chat Revisar gastos duplicados históricos. Archivo asignado: js/modules/exterior-preparation.js. purchase-orders.js sigue bajo edición del otro chat para el buscador de Órdenes de compra; no se modifica aquí. Sin publicación ni cambio de versión en este bloque.

## Comportamiento

- Compra para stock: buscador Agregar productos visible desde el inicio, con foco. Productos del pedido, cantidades/proveedores y costo estimado, sin productos de venta, extras o ganancias ficticias en cero.
- Compra desde una venta o conjunta: conserva Agregar extras para stock y la separación respecto de los productos de venta.
- Seleccionar agrega al borrador, limpia la búsqueda y devuelve el cursor para continuar. Funciona con clic, Enter desde la búsqueda y ArrowDown seguido de Enter en un resultado. Enter vacío o repetido no vuelve a agregar; composición de texto no dispara selección.
- El selector grande permanece abierto para varias altas. Tab queda dentro, Escape/Cerrar devuelve el foco al buscador y el formulario de fondo queda inerte mientras está abierto.
- Una selección explícita repetida del mismo producto conserva la semántica anterior de renglones separados con cantidades editables. Las claves son únicas incluso con altas en el mismo milisegundo; no se fusionan importes/proveedores automáticamente.

## Cálculos e historial

Los 13 helpers públicos puros de cálculo, inicialización, proveedores y exportación permanecen idénticos al original. Los productos para stock siguen usando internamente extras/destination stock; no se migra el esquema ni se cambian precios, cotizaciones, reparto de gastos, aplicación a ventas, confirmación, órdenes, recepción o inventario. El resumen de una compra cerrada conserva su resultado guardado. No se toca el planificador legacy de versiones anteriores.

## Validación

- Baseline ficticio en390/1280: búsqueda oculta, acordeón cerrado/foco perdido después de elegir y selector grande retirado. Reproducción sin guardados ni red externa.
-39 regresiones focales de preparación, cálculo, aplicación y retorno de producto aprobadas;3 pruebas de alta cubren destino, datos de venta intactos, foco, ausencia de guardado implícito, identidades únicas, compra cerrada/ocupada y producto ausente.
-6 recorridos del módulo real con datos ficticios: stock y venta en390/768/1280, cinco altas consecutivas, teclado/clic, apertura/cierre del selector grande, Tab/Escape, cantidad/proveedor editable, un guardado explícito en memoria y ninguna confirmación. Dos lecturas de configuración simuladas al abrir y ninguna adicional al seleccionar; cero solicitudes externas y cero operaciones reales. Compra cerrada permanece de lectura y muestra el costo guardado.
- Navegación anterior de grupos/proveedores/equivalentes y Escape aislado aprobada. Capturas oscuras de escritorio/móvil inspeccionadas; no es prueba de teléfono físico ni de guardado auténtico.
- Suite del checkout:6.104total /6.077PASS /27opt-in omitidas /0fallos. Sintaxis y diff revisados.

Prueba reproducible: test/browser/exterior-stock-entry.cjs, Playwright disponible en NODE_PATH, CHROME_BIN opcional y STOCK_ENTRY_OUTPUT para capturas privadas. No conecta Firebase real ni envía mensajes/compras.

## Integración

La base del módulo es idéntica en contenido normalizado a la web15.15; el checkout propio todavía referencia app15.9 de segmentación. Integrar sólo el módulo, sus pruebas y este documento sobre la base productiva más reciente. No copiar app15.9, index/SW ni CONTEXTO completo de esta rama. El chat de publicación conserva su entrega15.16 y debe ejecutar su puerta integrada antes de proponer publicación. El formulario real del titular tenía una preparación sin guardar; no se recargó, cerró ni alteró para mostrar este cambio.
