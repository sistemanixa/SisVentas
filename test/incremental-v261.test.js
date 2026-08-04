const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const moduleCode = fs.readFileSync('js/modules/notifications.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.261.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

assert(index.includes('notifications.js?v=2.0.261'), 'Debe cargar el modulo lateral actualizado');
assert(moduleCode.includes("stack.id='sv-important-alert-stack'"), 'Debe crear la pila lateral de avisos importantes');
assert(moduleCode.includes("tarjeta.className='sv-action-alert sv-important-alert '"), 'Debe reutilizar la tarjeta lateral profesional');
assert(!moduleCode.includes("overlay.id='modal-aviso-critico-presupuesto'"), 'No debe crear nuevamente el modal central');
assert(!app.includes('setTimeout(cerrar, 18000);'), 'Las tarjetas no deben cerrarse por tiempo');
assert(css.includes('.sv-important-alert.is-urgent'), 'Debe distinguir visualmente las urgentes');
assert(app.includes("VERSION: 'v2.0.261-firebase'"), 'La aplicacion debe publicar v261');

console.log('v2.0.261: notificaciones importantes laterales, apiladas y sin cierre automatico');
