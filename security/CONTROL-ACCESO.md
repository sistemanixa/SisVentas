# Segunda fase: escritura de usuarios y Roles

Estado: publicación y migración autorizadas específicamente por el usuario. Versión v3.6.1 preparada; rutas protegidas creadas en las reglas sin retirar todavía el origen. La primera fase de identidades activas permanece publicada.

## Alcance probado

- Usuarios y configuración de Roles salen del ámbito de las transacciones comerciales: `sv_usuarios` y `sv_permisos`.
- Solo un admin activo, comprobado en el registro protegido, puede crear, modificar o eliminar fichas o permisos.
- Cada usuario activo puede actualizar exclusivamente sus dos marcas de último acceso; no las de otra persona ni su rol, UID o estado.
- Se conserva completa la configuración personalizada de Roles. Los guardados rechazados no sustituyen la configuración local ni anuncian éxito.
- Los guardados de usuarios actualizan simultáneamente ficha, identidad protegida y directorio de chat.
- Las transacciones comerciales siguen operando en su raíz actual; las reglas finales impiden recrear las ubicaciones antiguas.
- **Las lecturas del directorio completo de usuarios siguen disponibles para usuarios activos**, para conservar los consumidores existentes. Esta fase protege su escritura; no resuelve todavía la separación de campos privados ni todos los permisos comerciales.

## Validación

40 pruebas entre emulador y pruebas locales de regresión/migración. Incluyen rechazo de escrituras multipath que mezclan una operación permitida con una prohibida, borrado y creación de usuarios por roles no admin, acceso propio, personalización de Roles, transacciones comerciales y resolución de rutas antes de completar el inicio de sesión.

Suite general posterior: 767 pruebas, 743 aprobadas y 24 fallidas. Se compararon los nombres con la auditoría anterior: son exactamente las mismas 24 fallas, sin nuevas fallas detectadas por esa suite. No equivale a una validación integral en verde.

El preanálisis real comprobó siete identidades coherentes, destinos disponibles y existencia de la configuración. No modificó datos ni imprimió valores personales. La migración conserva todos los campos y agrega solamente el UID ya verificado cuando falta en la ficha. Si alguien cambia usuarios, identidades, directorio o Roles entre revisión y transacción, aborta para evitar pisar modificaciones. Cambios comerciales concurrentes se conservan.

## Activación coordinada necesaria

1. Obtener autorización para publicar cliente y servicio, trasladar estos datos con respaldo y retirar las rutas anteriores. No interpretar la autorización de la primera fase como permiso específico para esta migración.
2. Preparar una publicación con `window.SV_SECURITY_STORAGE_V2 = true` antes de cargar `security-storage.js`. La aplicación verifica si existe la copia protegida: conserva legacy hasta que aparezca y entonces cambia de rutas y recarga usuarios/permisos. Se verificaron los servicios desplegados: solo emitirFactura y testTFApp, que no consumen estas rutas. Las referencias pertenecen al experimento push no desplegado; si se habilita, deberá usar `SV_SECURITY_STORAGE_V2=true`. Las sesiones anteriores a esta versión deberán recargar.
3. Elegir un momento sin edición de Usuarios/Roles. Verificar nuevamente destinos, identidades y reglas remotas, y guardar respaldo de reglas. La variante final `database.control-access.rules.json` solo agrega las dos raíces protegidas y bloquea recrear las antiguas.
4. Coordinar publicación de cliente/servicio, reglas finales y `migrar-control-acceso.cjs --apply --clientes-coordinados`. El script exige reglas idénticas a las probadas, respalda el origen y copia/retira las dos rutas en una sola transacción. Mientras se completa el corte no deben usarse pantallas antiguas de Usuarios/Roles. No afecta los registros comerciales.
5. Verificar identidad de cada usuario, lectura de configuración, último acceso propio, guardado admin y bloqueo no admin; verificar la aplicación publicada. Conservar respaldos. Si el corte falla, analizar el estado exacto antes de restaurar: no reintentar a ciegas ni sobrescribir destinos.

Preparar no equivale a activar. `migrar-control-acceso.cjs` sin argumentos solo analiza; `--apply` es una acción sobre datos reales y no se ha ejecutado.
