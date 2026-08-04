const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const index = read('index.html');
const scraper = read('cotizador', 'index.js');
const sw = read('sw.js');

test('el centro muestra siempre dónde revisar variaciones', () => {
  assert.match(index, /id="mod-ap-aprobaciones" style="margin-top:16px"/);
  assert.match(app, /Aprobación de variaciones/);
  assert.match(app, /Sin cambios de precio pendientes de aprobación/);
});

test('la cotización conserva el detalle del bloqueo individual y masivo', () => {
  assert.match(app, /function datosVariacionBloqueadaResultado/);
  assert.match(app, /function registrarVariacionPendienteActualizador/);
  assert.match(app, /r\.codigoProducto \|\| r\.codigo/);
  assert.match(scraper, /Object\.assign\(errorPrecio, validacionPrecio\)/);
  assert.match(scraper, /codigoProducto:item\.codigo/);
  assert.match(scraper, /precioCandidatoArs:Number\(e\.precioCandidatoArs\)/);
});

test('la publicación corresponde a v2.0.243', () => {
  assert.match(app, /VERSION: 'v2\.0\.243-firebase'/);
  assert.match(index, /app\.v2\.0\.243\.js/);
  assert.match(index, /version\.v2\.0\.243\.js/);
  assert.match(sw, /sisventas-v2\.0\.243/);
});
