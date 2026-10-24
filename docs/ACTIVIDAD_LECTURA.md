# Lectura del historial de Actividad

## Candidata15 local; producción14

Configuración→Actividad hacía un GET completo por entrada o clic, incluso si
había otra carga pendiente. Una respuesta vieja podía reemplazar un resultado
nuevo. La candidata comparte sólo la promesa pendiente del mismo contexto y
descarta las retiradas antes de leer el snapshot. La actualización explícita
posterior al resultado vuelve a consultar; memoria ready no acredita frescura.

Auth/UID/rol/revisión/época/vista/permiso de módulo y dominio, página/panel y
primer plano conservan el alcance. Cambiar identidad limpia filtros; salir y
volver con la misma identidad los conserva. Ocultar o abandonar no consulta de
nuevo al regresar: se requiere la apertura/actualización manual existente.

La interfaz diferencia carga, error y vacío confirmado, bloquea Actualizar
mientras carga y ofrece Reintentar tras fallo. Los mensajes están fuera de las
tablas; las tarjetas móviles sólo muestran resultados confirmados. El token
de caché del controlador conserva el prefijo de teclado y añade la versión15,
igual en índice y Service Worker.

Limpiar conserva permiso, confirmación, escritura y auditoría existentes. Se
evitan diálogos/escrituras duplicados y ACK de contextos retirados. Salir durante
la confirmación impide el borrado; una escritura SDK ya enviada no se puede
cancelar. No se ejecutó ninguna limpieza real como prueba.

Se mantiene exactamente el orden estable por fecha, los300 registros anteriores
de presentación, sus filtros y HTML. **La primera consulta sigue descargando la
raíz completa**, igual que una actualización posterior: esta corrección elimina
duplicados simultáneos, sin prometer paginación ni ahorro universal. Para reducir
esa primera carga hacen falta índices/consultas compatibles y un alcance aparte.

49 pruebas nuevas con VM/SDK/DOM ficticios incluyen3→1GET, respuestas inversas,
identidad/permisos/panel/hidden, errores, confirmación/ACK y paridad rica con350
filas. La revisión independiente encontró138 funciones financieras/OT/Vacaciones
idénticas14. QA visual aislada320/390/768/1280 con fuente y módulo reales,
conexiones bloqueadas y personas ficticias. Puerta final4.995PASS/27omitidas,
sin fallos; sintaxis/diff/coherencia local correctos. Evidencia privada fuera de
Git en `tmp/listings-next-private/actividad15-ui` y logs de puerta.

No publicada, sin servidor/reglas/índices/permisos nuevos ni datos reales. El
estado externo exacto y el SHA de entrega están en CONTEXTO_ACTUAL.md y Git.
