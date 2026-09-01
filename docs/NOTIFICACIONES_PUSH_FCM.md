# Notificaciones push FCM de SisVentas

> Estado: experimento local encapsulado. No está publicado ni desplegado. El frontend permanece inactivo salvo al abrir localmente con `?push_preview=1`.
> Las Functions tampoco se exportan en un despliegue normal: requieren habilitar expresamente `SISVENTAS_ENABLE_PUSH_EXPERIMENT=true`.

## Arquitectura incorporada

- Se reutiliza la aplicación Firebase inicializada en `js/core/firebase.js`.
- Cada navegador registra su token en `sisventas/push/dispositivos/{uid}/{hashToken}` mediante una Cloud Function autenticada.
- Los cambios de asignación generan registros en `sisventas/eventos_notificacion`.
- `despacharEventoNotificacion` es el único componente que resuelve destinatarios y usa Firebase Admin SDK para enviar.
- El service worker existente muestra avisos en segundo plano y abre la OT, el reclamo, Presupuestos o Agenda.
- Al cerrar sesión el dispositivo se desvincula del usuario; al volver a ingresar se registra otra vez si la preferencia local seguía activa.

## Configuración manual en Firebase

1. En Firebase Console, abrir **Configuración del proyecto → Cloud Messaging → Web Push certificates** y generar o reutilizar un par de claves Web Push.
2. Configurar la clave pública como parámetro `FCM_VAPID_PUBLIC_KEY` al desplegar Functions. La clave pública VAPID no es una credencial privada; la clave privada queda administrada por Firebase.
3. Verificar que la API **Firebase Cloud Messaging** esté habilitada para el proyecto existente `nixa-sisventas`.
4. Desplegar el mismo paquete existente de Functions; no crear otro proyecto ni otra aplicación Firebase.
5. Las reglas de Realtime Database no necesitan habilitar escritura pública para tokens ni eventos: las escrituras sensibles se realizan con Admin SDK desde Functions.

## Functions creadas

- `configuracionPush`: devuelve la clave VAPID pública únicamente a sesiones Firebase válidas.
- `registrarDispositivoPush`: vincula token, uid, rol real, usuario y plataforma.
- `desregistrarDispositivoPush`: elimina el token del usuario autenticado.
- `despacharEventoNotificacion`: envío central, registro de resultado y limpieza de tokens inválidos.
- `notificarOtAsignada`: detecta asignación o reasignación de una OT.
- `notificarReclamoAsignado`: detecta asignación o reasignación de un reclamo.
- `notificarPresupuestoPendiente`: avisa a administradores cuando entra en revisión.
- `recordatoriosAgendaPush`: se ejecuta cada 15 minutos; usa 30 minutos de anticipación salvo que `sisventas/config/push/agendaAnticipacionMinutos` defina otro valor.

## Prueba extremo a extremo

1. Cuando se decida habilitar el experimento, desplegar Functions con el parámetro VAPID configurado.
2. Abrir la carga local agregando `push_preview=1` a la URL. Sin ese parámetro el módulo y FCM permanecen inactivos.
3. Iniciar sesión como técnico, abrir el engranaje, entrar en **Notificaciones** y activar.
4. Confirmar que aparezca un dispositivo activo bajo el uid correspondiente en Realtime Database.
5. Desde otro usuario asignar una OT al técnico. Debe aparecer un evento con estado `sent` y una notificación en el dispositivo.
6. Hacer clic en el aviso: SisVentas debe abrir la ficha exacta de la OT.
7. Repetir asignando un reclamo y verificar la apertura del reclamo exacto.
8. Pasar un presupuesto a revisión y confirmar que solamente los dispositivos con rol admin reciban el aviso.
9. Crear una actividad de agenda dentro de la ventana de anticipación y verificar el recordatorio.
10. Cerrar sesión en el técnico y comprobar que el token se retire. Al iniciar nuevamente se registra automáticamente si seguía habilitado en ese dispositivo.

## Compatibilidad

- Chrome y Edge en escritorio: compatible sobre HTTPS.
- Chrome Android: compatible en navegador y PWA instalada.
- iOS/iPadOS 16.4 o superior: preparado para Web Push cuando SisVentas está instalada en la pantalla de inicio; el permiso debe solicitarse desde la acción del usuario.
