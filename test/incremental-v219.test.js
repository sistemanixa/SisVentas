const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function functionBody(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `No se encontró ${name}`);
  assert.notEqual(end, -1, `No se encontró el límite ${nextName}`);
  return app.slice(start, end);
}

test('presupuestos se duplican como un registro nuevo y sin cliente', () => {
  const body = functionBody('duplicarPresupuesto', 'abrirEditorPpto');
  assert.match(body, /_pptoEditandoFbKey = null/);
  assert.match(body, /_pptoEditandoId = null/);
  assert.match(body, /pp-cli'\); if \(cli\) cli\.value = ''/);
  assert.match(app, /item\('Duplicar', 'ti-copy'/);
});

test('ventas se duplican sin reutilizar identidad ni cliente', () => {
  const body = functionBody('duplicarVenta', 'fbGuardarVenta');
  assert.match(body, /_ventaEditandoFbKey = null/);
  assert.match(body, /_ventaEditandoOriginal = null/);
  assert.match(body, /cli-inp'\); if \(cliInp\) cliInp\.value = ''/);
  assert.match(app, /onclick="duplicarVenta/);
});

test('productos por metro guardan presentación y costo unitario', () => {
  assert.match(index, /id="pf-metros-presentacion"/);
  assert.match(app, /costoCompra = costoCompra \/ metrosPorPresentacionFormulario\(\)/);
  assert.match(app, /metrosPorPresentacion:/);
  assert.match(app, /costoPresentacionArs:/);
  assert.match(app, /class="qty"[^>]*min="0\.01"[^>]*step="0\.01"/);
});

test('Productos ordena localmente sin instalar observadores universales', () => {
  const body = functionBody('renderTablaProductos', 'toggleTodasCats');
  assert.match(index, /<thead id="prod-tbl-thead"><tr>/);
  assert.match(body, /var ordenProductos = _sortState\['prod-tbl'\]/);
  assert.match(body, /function ordenarProductos\(items\)/);
  assert.doesNotMatch(app, /function instalarOrdenamientoGrillas/);
  assert.doesNotMatch(app, /sisventas_grid_sort_v1/);
});

test('todos los archivos publicados corresponden a v2.0.219', () => {
  assert.match(app, /VERSION: 'v2\.0\.219-firebase'/);
  assert.match(index, /app\.v2\.0\.219\.js/);
  assert.match(index, /version\.v2\.0\.219\.js/);
  assert.match(sw, /sisventas-v2\.0\.219/);
  assert.equal(
    fs.readFileSync(path.join(root, 'js', 'app.v2.0.219.js'), 'utf8'),
    app
  );
  assert.equal(
    fs.readFileSync(path.join(root, 'js', 'core', 'version.v2.0.219.js'), 'utf8'),
    fs.readFileSync(path.join(root, 'js', 'core', 'version.js'), 'utf8')
  );
});
