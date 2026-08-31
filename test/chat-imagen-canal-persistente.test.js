const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'js', 'app.v3.1.4.js');
const app = fs.readFileSync(appPath, 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(app.includes("sisventas_chat_ultimo_canal_"), 'El último canal debe guardarse por usuario.');
assert(app.includes('function chatRecuperarCanal()'), 'Debe existir la recuperación central del canal.');
assert(/function chatAbrir\(\) \{[\s\S]{0,160}_chatCanal = chatRecuperarCanal\(\);/.test(app), 'El chat debe recuperar el canal antes de cargarlo.');
assert(/function chatCambiarCanal[\s\S]*?chatGuardarCanal\(canal\);[\s\S]*?chatMarcarCanalActivo\(canal\);/.test(app), 'Cambiar de grupo debe guardar y reflejar el canal activo.');
assert(/function chatAbrirDirecto[\s\S]*?chatGuardarCanal\(_chatCanal\);/.test(app), 'Los chats directos también deben recordarse.');
assert(app.includes("onclick=\"otAbrirFoto(this.src,\\'Imagen del chat\\')\""), 'Las fotos del chat deben abrir el visor ampliado interno.');
assert(!app.includes("onclick=\"window.open(this.src,\\'_blank\\')\""), 'Las fotos del chat no deben depender de una pestaña externa.');
assert(index.includes('id="btn-chat-maximizar"'), 'El chat debe ofrecer el control de maximizar.');
assert(app.includes('function chatAlternarMaximizado()'), 'Debe existir un único alternador de tamaño del chat.');
assert(css.includes('#chat-modal.chat-maximizado #chat-box'), 'El modo maximizado debe tener geometría explícita.');
assert(css.includes('overflow-x:hidden'), 'Los mensajes no deben crear desplazamiento horizontal.');
assert(!app.includes("esMio ? 'left:-36px' : 'right:-36px'"), 'Responder no debe ubicarse fuera del chat.');
assert(app.includes("document.body.appendChild(modal)"), 'El visor ampliado debe salir del contexto de apilado de la página.');
assert(app.includes("modal.style.zIndex = '100050'"), 'El visor ampliado debe quedar delante del chat.');
assert(app.includes('var usuarioEstaLeyendo = !!(modalChat'), 'El chat sólo debe marcar leído cuando está realmente abierto.');
assert(app.includes('usuarioEstaLeyendo ? 0 : lista.filter'), 'Cerrar el chat no debe borrar pendientes por una respuesta tardía.');
assert(css.includes('#chat-fab.has-unread #chat-badge'), 'El contador debe permanecer visible mientras haya mensajes pendientes.');
assert(app.includes("if (totalVisible > 0) botonChat.style.display = 'flex';"), 'Un mensaje pendiente debe sacar el chat aunque estuviera retraído.');
assert(app.includes("chatVisible || chatBtn.classList.contains('has-unread')"), 'La configuración del rol no debe volver a ocultar un chat con pendientes.');

console.log('OK chat: imágenes ampliables, último grupo persistente y maximizado restaurable.');
