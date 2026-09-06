# Publicación v3.3.18

- Los importes de cada proveedor se conservan al abrir y guardar la ficha; el proveedor favorito define la referencia sin sobrescribir las otras cotizaciones. Los empates se identifican explícitamente.
- Cotización individual protegida contra navegación y atajos durante la consulta; confirmación del navegador al intentar recargar. El masivo conserva navegación en segundo plano.
- Presupuestos: descarga directa del contenido PDF, equivalente USD con cotización del sistema y columna Descuento en el listado.
- Consulta de comisiones sobre Gastos con conservación del origen y filtros.

Validación: 12 pruebas dirigidas aprobadas; sintaxis de la aplicación y coherencia local de versión correctas. En pantalla se verificó Free Electron a $75.000 y Biosegur a $84.234,15, con un único menor costo. Los presupuestos PP-0072 y PP-0071 muestran 5,00% en la grilla. La descarga se comprobó mediante prueba de transporte y unidad; la ventana de impresión real no se abrió en el navegador integrado durante esta comprobación.

Se recuperó únicamente el precio previo cotizado de Free Electron de la cámara revisada, con respaldo y registro de corrección. No representa una nueva consulta de precio al proveedor.

Los fallos históricos aplazados y la aplicación de Roles en Firebase permanecen fuera de este parche.
