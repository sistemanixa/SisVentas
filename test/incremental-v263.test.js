const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const notifications = fs.readFileSync('js/modules/notifications.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.263.js', 'utf8');

assert(index.includes('app.v2.0.263.js'));
assert(index.includes('notifications.js?v=2.0.263'));
assert(notifications.includes("paginaActiva.id==='page-notificaciones'"));
assert(notifications.includes('stackEnListado.remove()'));
assert(notifications.includes('programarAvisoCriticoPresupuesto();'));
assert(app.includes("VERSION: 'v2.0.263-firebase'"));

console.log('v2.0.263: tarjetas ocultas dentro de Notificaciones y visibles al salir');
