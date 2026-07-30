const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const index = read('index.html');
const sw = read('sw.js');

test('la propuesta bloqueada se conserva sin modificar el precio', () => {
  assert.match(app, /variacionPendienteAprobacion:pendienteAprobacion/);
  assert.match(app, /precioAnteriorArs:precioAnteriorBloqueado/);
  assert.match(app, /precioCandidatoArs:precioCandidatoBloqueado/);
  assert.match(app, /variacionPendienteAprobacion:\s*null/);
});

test('auditoria y revision de precios exponen la aprobacion', () => {
  assert.match(app, /function variacionPrecioPendienteProducto/);
  assert.match(app, /excepcional pendiente de aprobaci/);
  assert.match(app, /revisarYAprobarVariacionPrecio/);
  assert.match(app, /Revisar y aprobar/);
  assert.match(app, /Pendiente de aprobaci/);
});

test('el editor muestra la comparacion y exige guardar el producto', () => {
  assert.match(app, /function mostrarVariacionPrecioPendienteEnEditor/);
  assert.match(app, /Aprobar prepara el cambio; Guardar producto lo confirma definitivamente/);
});

test('la publicacion corresponde a v2.0.240', () => {
  assert.match(app, /VERSION: 'v2\.0\.240-firebase'/);
  assert.match(index, /app\.v2\.0\.240\.js/);
  assert.match(index, /version\.v2\.0\.240\.js/);
  assert.match(sw, /sisventas-v2\.0\.240/);
});
