# Rol Compras Paraguay

Rol interno `compras_paraguay`, disponible al crear o editar un usuario. No se creó ni se cambió ninguna cuenta real durante el desarrollo.

Permite ver exclusivamente productos activos de la categoría exacta `COMPRAS PARAGUAY`, elegir cantidades enteras, guardar varias listas propias y descargarlas en CSV. Las listas son planificación: no crean órdenes, pagos ni movimientos de stock. Los precios corresponden a los registros del catálogo, no a una nueva consulta al proveedor. El costo ARS incluye el envío registrado; el precio USD de la página se conserva separado.

El inicio de sesión valida la identidad protegida y consulta únicamente la ficha asociada al UID. Luego abre la pantalla exclusiva sin iniciar la carga general de SisVentas. Las reglas limitan la lectura de productos a una consulta por categoría y bloquean el resto de la base, directorio y chat. No puede modificar productos ni usuarios. Cada lista se guarda en `sv_listas_paraguay/{uid}/{lista}`, con nombre, fecha y un mapa de claves de producto a cantidades. Las reglas verifican propiedad, categoría y cantidades. Administración conserva su acceso y puede leer las listas de un UID conocido.

## Publicación v3.8.1

La versión v3.8.1 publica frontend, cotizador y reglas conjuntamente. El cotizador rechaza consultas del nuevo rol. Generar las reglas con `scripts/generar-reglas-paraguay.cjs` sobre una copia verificada de las reglas vigentes, preservando cambios externos; `security/database.paraguay.rules.json` es la candidata local basada en la última copia del repositorio. Respaldar y comparar las reglas vigentes antes de aplicarlas. No publicar la candidata sin ese cotejo.

Validación: pruebas de catálogo/CSV/acceso, compatibilidad de sesión y rutas protegidas, y cinco pruebas integrales con RTDB Emulator (lectura restringida, prohibición de modificar datos, listas privadas y rechazo de registros inválidos y conservación del acceso de los roles existentes). Vista completa local `tmp/prueba-rol-paraguay.html` con identidad y productos simulados, sin conexión de Firebase a producción. Las reglas vigentes coincidieron con la base del repositorio, se respaldaron y se aplicó la candidata comparando de nuevo la base antes de escribir; la lectura posterior confirmó la coincidencia.
