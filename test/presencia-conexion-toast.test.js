const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.v3.2.1.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

assert.match(app, /PRESENCIA_INICIALIZADA/,
  'La primera lectura debe establecer una base sin anunciar a todos como recién conectados');
assert.match(app, /actual\.online === true && anterior\.online !== true/,
  'Sólo debe avisar una transición real de desconectado a conectado');
assert.match(app, /uid === currentUserUid/,
  'No debe anunciar la propia conexión');
assert.match(app, /texto\.textContent = nombre \+ ' se conectó'/,
  'El aviso debe identificar al usuario conectado');
assert.match(app, /chatAbrir\(\);[\s\S]*chatAbrirDirecto\(usuario\)/,
  'Al tocar el aviso debe abrir el chat privado con la persona conectada');
assert.match(css, /\.sv-presence-toast\{/,
  'El aviso debe usar una píldora visual propia');
assert.match(css, /left:50%;bottom:20px/,
  'La píldora debe aparecer centrada en la parte inferior');
assert.match(css, /opacity \.22s ease,transform \.22s ease/,
  'La entrada y salida deben estar animadas');

console.log('presencia-conexion-toast.test.js OK');
