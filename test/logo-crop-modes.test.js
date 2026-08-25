const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');

assert.match(html, /id="cfg-logo-crop-mode-fixed" class="active"/, 'El recorte fijo debe ser el modo predeterminado');
assert.match(html, /id="cfg-logo-crop-mode-free"/, 'Debe existir el modo de recorte libre');
assert.match(html, /id="cfg-logo-crop-width"/, 'El modo libre debe controlar el ancho');
assert.match(html, /id="cfg-logo-crop-height"/, 'El modo libre debe controlar el alto');
assert.match(app, /function setLogoCropMode\(mode\)/, 'Debe existir el selector de modo');
assert.match(app, /_logoCropState\.mode === 'free'/, 'El guardado debe respetar el recorte libre');
assert.match(html, /id="cfg-logo-print-crop-mode-fixed" class="active"/, 'El logo de impresión también debe iniciar con recorte fijo');
assert.match(html, /id="cfg-logo-print-crop-mode-free"/, 'El logo de impresión debe permitir recorte libre');
assert.match(app, /function renderLogoPrintCropToDataUrl\(quality\)/, 'El logo de impresión debe guardar el recorte confirmado');
assert.match(app, /function setLogoPrintCropMode\(mode\)/, 'El logo de impresión debe cambiar entre fijo y libre');
assert.match(html, /quitarFondoLogo\('system'\)/, 'El logo del sistema debe permitir quitar el fondo');
assert.match(html, /quitarFondoLogo\('print'\)/, 'El logo de impresión debe permitir quitar el fondo');
assert.match(app, /async function deshacerFondoLogo\(tipo\)/, 'La eliminación de fondo debe poder deshacerse');

console.log('logo-crop-modes.test.js OK');
