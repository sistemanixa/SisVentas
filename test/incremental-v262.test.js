const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const notifications = fs.readFileSync('js/modules/notifications.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.262.js', 'utf8');

assert(index.includes('app.v2.0.262.js'));
assert(index.includes('notifications.js?v=2.0.262'));
assert(notifications.includes('window.marcarNoLeida'));
assert(notifications.includes('Marcar no leída'));
assert(notifications.includes("setN(id,{estado:'',reaparece:null})"));
assert(app.includes("VERSION: 'v2.0.262-firebase'"));

console.log('v2.0.262: las notificaciones leídas pueden volver a pendientes');
