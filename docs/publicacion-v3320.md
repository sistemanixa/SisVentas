# Publicación v3.3.20

- Cuenta corriente: resolución de clientes unificados, comprobante opcional compartido y guardado mediante actualización multipath. Se consulta cada venta involucrada y la colección de cobros; ya no se ejecuta una transacción sobre la raíz completa. Un control pequeño coordina los pagos de cuenta y el cobro individual de esta versión.
- Adjuntos disponibles desde los movimientos de cuenta corriente. Reintentos dentro del formulario reutilizan la identificación de la operación.
- Búsqueda general consistente entre catálogo, productos y selectores, descripción opcional e imágenes ampliadas.
- URL principal del producto como proveedor favorito para ficha y referencia de venta; otros proveedores conservan sus cotizaciones comparativas. Cotizador masivo permite solicitar ficha.

Validación: 12 pruebas dirigidas del frontend, 54 del cotizador, 5 de lanzamiento y marcadores aprobadas. Sintaxis y validación local de versión aprobadas. Suite general: inicialmente 716 pruebas, 702 aprobadas y 14 fallidas; se corrigió el marcador inmutable de esta publicación y pasó su comprobación dirigida. Los restantes 13 fallos no se resolvieron en este bloque.

La ventana de pago de Yago se abrió con el importe 377.060,00 y campo de adjunto. No se registró un pago real como prueba. La auditoría de Rentabilidad sigue siendo diagnóstico, sin implementación. Los cambios locales en versiones históricas y documentos de trabajo anteriores no se incluyen.
