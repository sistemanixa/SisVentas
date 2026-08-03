const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.268.js', 'utf8');
const notifications = fs.readFileSync('js/modules/notifications.js', 'utf8');

assert(index.includes('app.v2.0.268.js'));
assert(index.includes('notifications.js?v=2.0.268'));
assert(app.includes("let currentUser = '';"));
assert(app.includes("Object.defineProperty(window, 'currentUser'"));
assert(notifications.includes("if(typeof verPpto==='function') verPpto"));
assert(!notifications.includes("setTimeout(function(){ if(typeof verPpto==='function') verPpto(id); },180)"));
assert(app.includes("VERSION: 'v2.0.268-firebase'"));

console.log('v2.0.268: sesión segura y apertura directa desde notificaciones');
