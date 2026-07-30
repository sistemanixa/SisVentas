const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const backend = read('cotizador', 'index.js');
const index = read('index.html');
const sw = read('sw.js');

test('el servicio devuelve una variacion bloqueada como dato estructurado', () => {
  assert.match(backend, /PRICE_VARIATION_REQUIRES_APPROVAL/);
  assert.match(backend, /precioAnteriorArs:anterior/);
  assert.match(backend, /precioCandidatoArs:nuevo/);
  assert.match(backend, /Object\.assign\(error, validacion\)/);
});

test('solo el administrador puede aprobar el precio excepcional', () => {
  assert.match(app, /function aprobarVariacionPrecioProveedor/);
  assert.match(app, /Solo el administrador puede aprobar una variación excepcional de precio/);
  assert.match(app, /Aprobar nuevo precio/);
  assert.match(app, /variacion-aprobada-manualmente/);
});

test('la aprobacion registra responsable, fecha y ambos importes', () => {
  assert.match(app, /variacionAprobadaPor/);
  assert.match(app, /variacionAprobadaEn/);
  assert.match(app, /precioAnteriorAprobacion/);
  assert.match(app, /precioCandidatoAprobado/);
});

test('la publicacion corresponde a v2.0.239', () => {
  assert.match(app, /VERSION: 'v2\.0\.239-firebase'/);
  assert.match(index, /app\.v2\.0\.239\.js/);
  assert.match(index, /version\.v2\.0\.239\.js/);
  assert.match(sw, /sisventas-v2\.0\.239/);
});
