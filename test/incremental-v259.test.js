const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const moduleCode = fs.readFileSync('js/modules/notifications.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.259.js', 'utf8');

assert(index.includes('notifications.js?v=2.0.259'), 'El modulo de notificaciones debe invalidar la version anterior');
assert(index.includes('app.v2.0.259.js'), 'Index debe cargar la aplicacion v259');
assert(moduleCode.includes('avisoCriticoObserver=new MutationObserver'), 'Debe vigilar cierres involuntarios del aviso importante');
assert(moduleCode.includes('avisoCriticoActual&&!getN(avisoCriticoActual.id).estado'), 'Debe conservar el aviso aunque la fuente se reconstruya');
assert(app.includes("VERSION: 'v2.0.259-firebase'"), 'La aplicacion debe publicar v259');

console.log('v2.0.259: avisos importantes persistentes hasta una accion del usuario');
