const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const version = fs.readFileSync(path.join(root, 'js', 'core', 'version.js'), 'utf8');

test('las grillas recuerdan el orden sin instalar un observador de ordenamiento', () => {
  assert.match(app, /sisventas_grid_order_v220/);
  assert.match(app, /function _svGuardarOrdenGrilla/);
  assert.match(app, /localStorage\.setItem\(SV_GRID_ORDER_STORAGE/);
  assert.match(app, /'ventas-tbl': function/);
  assert.doesNotMatch(app, /function instalarOrdenamientoGrillas/);
});

test('la firma espera el fin del trazo y confirma primero en la OT', () => {
  assert.match(app, /function firmaProgramarAutoguardado/);
  assert.match(app, /}, 2600\)/);
  assert.match(app, /function firmaDataUrlCompacta/);
  assert.match(app, /var dataUrl = firmaDataUrlCompacta\(canvas\)/);
  const autoguard = app.slice(
    app.indexOf('function firmaAutoguardar('),
    app.indexOf('function firmaGuardarEnOT(')
  );
  assert.ok(
    autoguard.indexOf('firmaGuardarEnOT(dataUrl') < autoguard.indexOf('window.fbUploadBytes'),
    'la confirmación en RTDB debe ocurrir antes que el respaldo en Storage'
  );
  assert.match(app, /conformidadFirma = conformidadActual \|\| 'conforme'/);
  assert.doesNotMatch(index, /id="firma-preview"/);
  assert.match(index, /class="ot-firma-superficie"/);
  assert.match(css, /\.ot-firma-canvas/);
});

test('las acciones compactas se preparan sólo en grillas renderizadas', () => {
  ['cli-tbl', 'prod-tbl', 'emp-tbl', 'ventas-tbl'].forEach((id) => {
    assert.match(app, new RegExp(`prepararAccionesGrilla\\('${id}'\\)`));
  });
  assert.match(css, /\.sv-grid-actions-menu\.abierto/);
  assert.match(css, /\.sv-responsive-grid/);
});

test('todos los archivos publicados corresponden a v2.0.220', () => {
  assert.match(app, /VERSION: 'v2\.0\.220-firebase'/);
  assert.match(index, /app\.v2\.0\.220\.js/);
  assert.match(index, /version\.v2\.0\.220\.js/);
  assert.match(sw, /sisventas-v2\.0\.220/);
  assert.equal(
    fs.readFileSync(path.join(root, 'js', 'app.v2.0.220.js'), 'utf8'),
    app
  );
  assert.equal(
    fs.readFileSync(path.join(root, 'js', 'core', 'version.v2.0.220.js'), 'utf8'),
    version
  );
});
