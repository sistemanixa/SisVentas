const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');
const app = fs.readFileSync('js/app.v3.1.4.js', 'utf8');

assert(html.includes('id="chat-modal" data-sv-modal-behavior="compact"'), 'Chat debe quedar fuera del gestor de ventanas operativas');
assert(html.includes('id="ia-modal" data-sv-modal-behavior="compact"'), 'IA debe quedar fuera del gestor de ventanas operativas');
assert(css.includes('#chat-modal{display:none;position:fixed;inset:0;z-index:99997;background:rgba(0,0,0,.5);align-items:flex-end;justify-content:flex-end;padding:0 16px}'), 'Chat debe quedar acoplado abajo a la derecha');
assert(css.includes('#chat-box{background:var(--bg2);border-radius:16px 16px 0 0;width:min(390px,100%)'), 'Chat debe conservar formato angosto y apoyado en el borde inferior');
assert(css.includes('#ia-modal{display:none;position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.5);align-items:flex-end;justify-content:center'), 'IA debe quedar centrada y acoplada abajo');
assert(css.includes('#ia-box{background:var(--bg2);border-radius:16px 16px 0 0;width:min(560px,100%)'), 'IA debe conservar tamaño moderado sin flotar');
assert(css.includes('#chat-fab::before,#ia-fab::before'), 'Los accesos deben conservar una zona estable bajo el puntero');
assert(css.includes('#chat-fab.has-unread{right:10px!important;opacity:1!important'), 'Chat con pendientes no debe retraerse');
assert(css.includes('#ia-fab.has-unread{right:10px!important;opacity:1!important'), 'IA con respuestas pendientes no debe retraerse');
assert(app.includes("botonChat.classList.toggle('has-unread', total > 0)"), 'El contador debe controlar la visibilidad persistente');
assert(html.includes('id="ia-badge"'), 'IA debe mostrar un contador propio');
assert(app.includes("boton.classList.toggle('has-unread', _iaNoLeidos > 0)"), 'El contador de IA debe mantener visible su acceso');
assert(app.includes("if (!modalIA || !modalIA.classList.contains('open'))"), 'La IA solo debe sumar pendientes cuando su panel está cerrado');
assert(app.includes("' sin leer'"), 'El acceso debe explicar la cantidad pendiente');

console.log('OK: Chat e IA conservan tamaño, posición y aviso persistente sin titileo.');
