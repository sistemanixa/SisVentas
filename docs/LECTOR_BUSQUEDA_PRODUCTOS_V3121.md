# Lector en buscadores de productos · candidata local v3.12.1

17/10/2026. Continuación de `codex/proyectos-movil-integral`, sobre el bloque de Proyectos `1f2f2406`. Sin publicación, cambios de servidor, reglas ni datos reales.

## Alcance

- Botón de cámara común en Productos, catálogo interno, selector compartido de filas de Ventas/Presupuestos, búsqueda avanzada, asistente de selección, kits, materiales de OT, catálogo/listas de Compras Paraguay y Comprobantes de Distribuidora. Se adjunta explícitamente al construir cada buscador; no hay un observador que recorra todo el DOM constantemente.
- Reutiliza `SVSerialCamera`, ZXing local, selección de cámara/preferencia trasera y bip. Modo de producto con textos distintos del de series; garantías conserva su modo de serie. Diálogo centrado, Escape reservado al lector/ventanas de Proyectos sin navegar el fondo, cierre y retorno de foco sin desplazar la página. Sin micrófono, fotos guardadas ni cuadros enviados.
- Leer solo escribe el texto y dispara la búsqueda existente. No agrega ítems, cambia cantidades/importes ni guarda documentos. Ceros iniciales conservados, máximo120 caracteres, sin controles. No abre enlaces ni interpreta HTML/JS del QR. Un código desconocido queda sin resultados.
- Usa código comercial/SKU registrado. **No se agregó una equivalencia EAN de fabricante → código interno** ni un campo nuevo para registrar esa relación: si la etiqueta no coincide con el catálogo, el lector no puede deducir el producto. Los filtros de categoría/otros criterios se conservan; Productos selecciona búsqueda por Código y búsqueda avanzada General.
- Se invalida la lectura si cambia página/sesión, se quita/bloquea el campo o cambia la fila del selector. La misma apertura procesa un solo resultado. Cámara ausente/permiso denegado conserva alternativa manual. La cámara solo se solicita al tocar el botón; HTTPS o loopback requeridos.

## Verificación

1.790 pruebas generales aprobadas. Seis nuevas de controlador (texto literal/ceros, apertura explícita, repetición, cancelación/contexto, campo bloqueado y alternativa manual). 18 específicas contando las doce anteriores del lector: QR y Code128 decodificados realmente, bip único, liberación del stream y permisos/cierre tardíos. Sintaxis/diff y versión coherentes.

`scripts/dev-product-code-search.cjs`: solo loopback8772, rutas permitidas, CSP sin conexiones de datos y catálogo/cámara ficticios. Funciones de búsqueda y selector flotante extraídas de la aplicación activa; persistencia inexistente y selección manual sustituida por contador. No acredita el guardado comercial ni todos los formularios. La prueba usa los módulos reales del lector/controlador y ZXing sobre video generado, no un callback que simula una lectura exitosa.

Recorrido CUA: QR P-2542 en Productos, QR 000001234567 en selector de Presupuesto, barras Code128 SN-001 en selector de Venta. Después de cada lectura: resultado correcto, cámara detenida, cero productos agregados automáticamente. NO-EXISTE-999 devuelve Sin resultados, permiso denegado muestra alternativa y cuadro sin código permite cerrar/detener. En390×844, diálogo centrado (x17,y111,356×621), sin desborde; consola del fixture sin errores/warnings observados. Sonido comprobado por prueba del oscilador, no escuchado en dispositivo físico.

Aplicación completa local: cuatro controles estáticos presentes y selector compartido/avanzado conectados por sus constructores. Se detectó interferencia del contador genérico que envuelve el input y una regla móvil que reducía el botón a36 px: CSS contempla ese contenedor y fuerza área44 px/alineación con el campo. No se abrió cámara real ni se guardaron operaciones de negocio.

Una pestaña temporal de recarga volvió al acceso al fallar fetch de perfil/ventas (03:55–03:56 UTC), reproduciendo el incidente intermitente ya conocido. No ocultarlo ni atribuirlo al lector sin evidencia. Lecturas de diagnóstico: cero5xx/ERROR del servidor en los30 minutos revisados; petición anónima al perfil respondió401 y CORS del origen8766 correcto. Eso no determina la causa de las fallas del navegador ni sustituye autenticación real. No se modificó autenticación para eludirlo. La ventana principal terminó recargada y autenticada en Productos, v3.12.1; allí se confirmó campo y botón alineados con44 px. También registró fetch fallido de Ventas a las03:58 UTC, por lo que el incidente de red sigue abierto aunque Productos cargue.

## Entrega

Espejo8766 actualizado con aplicación/módulos/estilos/cargador opcional. `session-assets.js` solicita la versión nueva del portal Paraguay; índice y SHELL incluyen CSS/controlador y las nuevas consultas del lector/Comprobantes. Producción permanece v3.12.0. Evidencia privada `C:/SisVentas/tmp/product-code-search-*`, fuera de Git/Hosting. Fixtures no se publican.

Pendiente: teléfono/tablet físicos, cámara trasera, etiquetas utilizadas realmente y bip audible; no declararlos comprobados por emulación. Si se necesitan códigos EAN distintos del SKU, definir y registrar explícitamente esa relación. Publicación no ejecutada en este bloque.
