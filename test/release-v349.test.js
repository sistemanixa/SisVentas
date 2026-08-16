const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.349 publica ventanas gestionables en escritorio', () => {
  const index = read('index.html');
  const app = read('js/app.v2.0.349.js');
  const css = read('css/app.css');
  assert.match(index, /VERSION: 'v2\.0\.349-firebase'/);
  assert.match(index, /js\/app\.v2\.0\.349\.js/);
  assert.match(app, /function svPrepararModalGestionable/);
  assert.match(app, /function svModalAlternarMaximizado/);
  assert.match(app, /function svModalIniciarArrastre/);
  assert.match(app, /data-modal-header/);
  assert.match(css, /\.sv-modal-manageable\{[^}]*resize:both/);
  assert.match(css, /\.sv-modal-maximize-btn\{display:none!important\}/);
  assert.equal(read('js/app.js'), app);
  assert.match(read('js/core/version.v2.0.349.js'), /v2\.0\.349/);
  assert.match(read('sw.js'), /sisventas-v2\.0\.349/);
});

test('los procesos largos informan etapas reales', () => {
  const app = read('js/app.v2.0.349.js');
  assert.match(app, /function svCrearProgresoBoton/);
  assert.match(app, /Reservando número de venta…/);
  assert.match(app, /Guardando presupuesto y productos…/);
  assert.match(app, /Creando venta y orden de trabajo…/);
  assert.match(app, /Sincronizando venta y materiales…/);
});
