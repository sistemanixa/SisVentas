const assert = require('assert');
const fs = require('fs');

const css = fs.readFileSync('css/app.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.249.js', 'utf8');

assert.match(app, /function _habCrearFilas\(\)/);
assert.doesNotMatch(app, /function generarGastosFijosMes\(/);
assert.match(app, /function _verificarHaberesPendientes\(/);
assert.match(app, /No se creó ningún duplicado/);
assert.match(app, /var gastoKey = 'haber_' \+ e\.fbKey \+ '_' \+ mesKey/);
assert.match(app, /await window\.fbUpdate\(window\.fbRef\(window\.fbDB\), actualizaciones\)/);
assert.match(app, /valorHoraAplicado/);
assert.match(app, /abrirConfiguracionCargosDesdeHaberes/);
assert.match(app, /window\.addEventListener\('resize'/);
assert.match(app, /En escritorio la IA tiene botón propio; en móvil\/tablet vive dentro del botón \+/);
assert.match(css, /#chat-fab\{bottom:calc\(18px \+ env\(safe-area-inset-bottom/);
assert.match(css, /\.fab-container\{bottom:calc\(78px \+ env\(safe-area-inset-bottom/);
assert.match(index, /css\/app\.css\?v=2\.0\.249/);
assert.match(index, /app\.v2\.0\.249\.js/);
assert.match(index, /version\.v2\.0\.249\.js/);
assert.match(sw, /sisventas-v2\.0\.249/);
assert.match(app, /VERSION:\s*'v2\.0\.249-firebase'/);

console.log('v2.0.249: haberes y accesos flotantes verificados');
