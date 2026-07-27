const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const appVersionada = fs.readFileSync(path.join(root, 'js', 'app.v2.0.199.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('producción carga exactamente el código validado de v2.0.199', () => {
  assert.equal(appVersionada, app);
  assert.match(index, /js\/app\.v2\.0\.199\.js/);
  assert.match(index, /js\/core\/version\.v2\.0\.199\.js/);
});

test('la firma limita la espera, conserva reintento y permite cancelar', () => {
  assert.match(app, /fbUploadBytesResumable/);
  assert.match(app, /tardó más de 25 segundos/);
  assert.match(app, /function firmaGuardarAhora\(/);
  assert.match(app, /function firmaCancelarEspera\(/);
  assert.match(app, /_firmaGuardadoPendiente \|\| _firmaGuardarTimer/);
  assert.match(index, /id="firma-guardar-btn"/);
  assert.match(index, /id="firma-cancelar-btn"/);
});

test('el actualizador filtra por checks y Mercado Libre no integra la selección inicial', () => {
  assert.match(app, /data-actualizador-proveedor/);
  assert.match(app, /seleccionados\.includes\(item\.tipo\)/);
  assert.match(app, /return \['biosegur', 'free_electron', 'tecnoprices'\];/);
  assert.doesNotMatch(app, /return \['biosegur', 'free_electron', 'tecnoprices', 'mercado_libre'\];/);
});
