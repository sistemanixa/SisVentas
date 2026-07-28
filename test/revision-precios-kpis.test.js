const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('los KPI de revisión usan el mismo conjunto de productos pendientes', () => {
  assert.match(app, /var productosKeys = \{\}/);
  assert.match(app, /productosBiosegurActualizables\(\)\.filter\(function\(x\)/);
  assert.match(app, /cantidadManuales = Math\.max\(0, productos\.length - cantidadAutomatizables\)/);
});

test('cada KPI filtra la lista de revisión', () => {
  assert.match(app, /data-revision-kpi="todos"/);
  assert.match(app, /data-revision-kpi="automatizable"/);
  assert.match(app, /data-revision-kpi="manual"/);
  assert.match(app, /data-revision-tipo=/);
  assert.match(app, /coincideTexto && coincideTipo/);
});

test('la revisión permite recalcular sin perder búsqueda ni filtro', () => {
  assert.match(app, /function actualizarGestionRevisionPrecios\(\)/);
  assert.match(app, /tipo: _revisionPreciosFiltroTipo/);
  assert.match(app, /id="revision-precios-buscador"/);
  assert.match(app, /> Actualizar lista</);
});
