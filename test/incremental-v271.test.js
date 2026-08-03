const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.271.js', 'utf8');
const notifications = fs.readFileSync('js/modules/notifications.js', 'utf8');

assert(index.includes('app.v2.0.271.js'));
assert(index.includes('version.v2.0.271.js'));
assert(index.includes('notifications.js?v=2.0.271'));
assert(app.includes("VERSION: 'v2.0.271-firebase'"));
assert(notifications.includes("paginaActiva.id!=='page-dashboard'"));
assert(notifications.includes("pagina&&pagina!=='dashboard'"));
assert(!notifications.includes("+(indice+1)+' de '+avisos.length+"));

console.log('v2.0.271: avisos importantes exclusivos del Dashboard y sin contador');
