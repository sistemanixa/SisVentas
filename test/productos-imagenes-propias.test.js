const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('las imágenes externas se archivan como adjuntos Base64 al primer uso', () => {
  assert.match(app, /function programarArchivoImagenProducto\(/);
  assert.match(app, /requestIdleCallback\(procesarColaArchivoImagenesProducto/);
  assert.match(app, /canvas\.toDataURL\('image\/webp', 0\.78\)/);
  assert.match(app, /imagenGuardadaMetodo:\s*'adjunto_base64'/);
});

test('el producto conserva la URL original y evita descargas repetidas', () => {
  assert.match(app, /imagenUrlOriginal:\s*producto\.imagenUrlOriginal \|\| src/);
  assert.match(app, /imagenProductoEsRemotaArchivable/);
  assert.match(app, /_imagenesProductoArchivoPendientes\[claveReal\]/);
  assert.match(app, /_imagenesProductoArchivoFallidas\[claveReal\]/);
});

test('las miniaturas y la ficha disparan la misma regla progresiva', () => {
  assert.match(app, /class="prod-row-img"[\s\S]{0,300}onload="programarArchivoImagenProducto/);
  assert.match(app, /function imagenProductoItemHTML[\s\S]{0,700}onload="programarArchivoImagenProducto/);
  assert.match(app, /pdImg\.onload = function\(\)\{ programarArchivoImagenProducto/);
});
