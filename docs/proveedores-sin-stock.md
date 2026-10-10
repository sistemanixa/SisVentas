# Precio y disponibilidad del proveedor

La falta de stock no invalida un precio verificado. La cotización individual,
la actualización de proveedores y el actualizador conservan disponibilidad y
precio por separado. Sin precio válido o sin superar los controles de identidad,
URL y variación, se conserva el importe anterior. El proveedor favorito sigue
fijando el costo, aunque esté temporalmente sin stock; los alternativos no lo
sustituyen automáticamente. El stock propio nunca se modifica por una cotización.

`avisoStockProveedorFavorito` centraliza el aviso y
`advertirStockProveedorFavorito` lo muestra sin impedir seleccionar el producto.
Se integra en el selector común de ventas/presupuestos (incluida búsqueda
avanzada), selección del asistente, kits, catálogo interno, catálogo de
Distribuidora y listas de exterior, materiales de OT, compras manuales y extras
de preparación/planificación. La ficha muestra el aviso de forma persistente;
la fila recién seleccionada en ventas/presupuestos también lo conserva.

No se publica el nombre del proveedor en el catálogo público ni se modifica
la lógica de comparaciones que descarta ofertas no disponibles.

Pruebas: `test/provider-stock-price.test.cjs` verifica actualización del precio
sin stock, rechazo de precios no verificados, aislamiento del proveedor
alternativo y aviso exclusivo del favorito, independientemente del stock propio.
