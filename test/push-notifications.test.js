const fs = require('fs');
const assert = require('assert');

const frontend = fs.readFileSync('js/modules/push-notifications.js', 'utf8');
const firebase = fs.readFileSync('js/core/firebase.js', 'utf8');
const worker = fs.readFileSync('sw.js', 'utf8');
const backend = fs.readFileSync('cloud-functions/emitir-factura/index.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert(firebase.includes('window.fbApp'), 'Firebase debe reutilizar la app ya inicializada');
assert(frontend.includes("previewParams.get('push_preview') === '1'"), 'El experimento push debe permanecer encapsulado detrás de su bandera local');
assert(frontend.includes("getMessaging(global.fbApp)"), 'FCM debe reutilizar la app Firebase existente');
assert(frontend.includes("'Authorization':'Bearer ' + idToken"), 'El registro de dispositivos debe autenticarse con Firebase ID token');
assert(frontend.includes('Notification.requestPermission()'), 'La activación debe pedir permiso al usuario');
assert(frontend.includes('serviceWorkerRegistration:swRegistration'), 'FCM debe usar el service worker PWA existente');
assert(frontend.includes("sisventas:session-ended"), 'El dispositivo debe desvincularse al cerrar sesión');
assert(frontend.includes("pushType") && frontend.includes("pushId"), 'Debe resolver destinos profundos desde una notificación');

assert(worker.includes('firebase-messaging-compat.js'), 'El service worker debe cargar Firebase Messaging');
assert(worker.includes("const PUSH_PREVIEW = new URL(self.location.href).searchParams.get('push_preview') === '1'"), 'El service worker normal no debe activar FCM fuera del experimento');
assert(worker.includes("messaging.onBackgroundMessage"), 'El service worker debe mostrar mensajes en segundo plano');
assert(worker.includes("notificationclick"), 'El service worker debe manejar clics');
assert(worker.includes("SISVENTAS_PUSH_OPEN"), 'El clic debe comunicarse con una ventana ya abierta');

assert(backend.includes('verifyIdToken'), 'Las funciones HTTP push deben validar Firebase Auth');
assert(backend.includes("process.env.SISVENTAS_ENABLE_PUSH_EXPERIMENT === 'true'"), 'Las Functions push no deben exportarse en el despliegue normal');
assert(backend.includes("Access-Control-Allow-Headers', 'Content-Type, Authorization"), 'CORS push debe aceptar únicamente la autorización Firebase necesaria');
assert(backend.includes('usersByEmail'), 'Los envíos por rol deben volver a validar el rol actual y no confiar en el token guardado');
assert(backend.includes('registrarDispositivoPush'), 'Falta registrar dispositivos');
assert(backend.includes('desregistrarDispositivoPush'), 'Falta desregistrar dispositivos');
assert(backend.includes('despacharEventoNotificacion'), 'Falta el despachador central');
assert(backend.includes('notificarOtAsignada'), 'Falta el evento de OT asignada');
assert(backend.includes('notificarReclamoAsignado'), 'Falta el evento de reclamo asignado');
assert(backend.includes('notificarPresupuestoPendiente'), 'Falta el evento de presupuesto pendiente');
assert(backend.includes('recordatoriosAgendaPush'), 'Falta el recordatorio de agenda');
assert(backend.includes('sendEachForMulticast'), 'El backend debe enviar mediante Admin SDK');
assert(backend.includes('registration-token-not-registered'), 'Los tokens vencidos deben limpiarse');

assert(html.includes('js/modules/push-notifications.js'), 'El módulo push debe estar cargado por la aplicación');
assert(!frontend.includes('PRIVATE KEY') && !frontend.includes('service_account'), 'No debe haber credenciales privadas en el frontend');

console.log('OK: FCM autenticado, eventos centrales, navegación profunda y PWA');
