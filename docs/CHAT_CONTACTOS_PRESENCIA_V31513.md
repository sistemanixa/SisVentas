# Chat y búsqueda de OT ·v3.15.13

Publicación urgente autorizada27/10/2026. Técnico puede elegir al administrador
en Directo → Nuevo mensaje sin conversación previa ni presencia online. Contactos
activos del directorio autorizado, selección por UID incluso con nombres iguales;
abrir no crea conversaciones ni envía mensajes. Conversaciones reales separadas
de Personas conectadas. Historial y no leídos conservados.

Encabezado muestra el destinatario del canal directo y flecha de retorno; también
al abrir una conversación existente/restaurada. Grupos mantienen su encabezado.
Buscador de OT flexible y ancho: aprovecha escritorio; fila completa en tablet/
celular sin reducir filtros. No cambia búsqueda ni guardados de OT.

Presencia v2 por foreground y onDisconnect: cx2 identifica conexiones de esta
versión que se retiran al ocultar/bloquear/abandonar. cx1 y el espejo antiguo no
acreditan conexión actual; los clientes antiguos siguen disponibles como contacto
pero sólo anuncian esta presencia al actualizarse. No se borra presencia ajena.
Desconexión local limpia peers y rótulo pasa a sin confirmar; callbacks anteriores
no reviven usuarios. Sin heartbeat, intervalos, sondeos ni escrituras por actividad.
Se deja de consultar el espejo legacy desde el cliente nuevo. No cambia reglas,
servidor, roles, permisos, mensajes, pagos o comisiones. No agrega infraestructura.
La detección de un corte físico sigue sujeta al cierre de transporte de Firebase.

Pruebas:29focalesPASS; suite6.187total/6.160PASS/27opt-in/0fallos. Navegador
aislado390/1280con funciones reales y módulos activos: administrador offline
seleccionable, destinatario/retorno, conectados sin huérfanos, ocultación y cero
mensajes enviados/red externa. OT390/768/1280: ancho332/706/546px, filtros visibles,
sin overflow de página. No se enviaron mensajes reales a Ignacio ni al titular.
Sólo3cuerpos de app cambiados; otros2.286idénticos. Backend15.12 conservado.
Evidencia privada tmp/chat31513-release. Registrar despliegue real por separado.
