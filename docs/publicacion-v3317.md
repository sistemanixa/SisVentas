# Publicación v3.3.17

Incluye centavos consistentes en ventas y presupuestos; integración y corrección de materiales de OT con su venta; controles de cierre por entrega y rendición; permisos de la aplicación centralizados y configuración de Roles con buscador, orden alfabético, acciones desplegables y resaltado de Configuración.

Incluye duración de audios y envío que detiene la grabación, inicio/fin/duración de sesiones en Usuarios sin la columna Clave, salida de presentación al abrir productos, comparación de proveedores por costo con enlaces individuales y búsqueda general sin descripción por defecto.

Se migraron 447 casillas ausentes conservando las autorizaciones existentes, con respaldo previo. La autorización de Firebase del lado del servidor sigue pendiente: esta publicación no modifica reglas de base de datos. Tampoco cambia el cotizador.

Validación: 48 pruebas dirigidas aprobadas sobre el nuevo archivo activo. La puerta general ejecutó 695 pruebas; tras corregir el marcador de etiquetas de versión, quedan los 15 fallos históricos de pruebas, dependencias y aserciones literales que el usuario dejó pendientes. La prueba específica del marcador y la validación oficial de versión pasaron.

Los artefactos históricos editados localmente se conservan fuera del commit; el código nuevo está en app.v3.3.17.js. Los datos guardados durante las correcciones previas no se vuelven a modificar al publicar.
