const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.374.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

test('gastos separa la búsqueda de los filtros y ofrece empleado activo', () => {
  assert.match(html, /class="gas-toolbar-search"/);
  assert.match(html, /id="gas-buscar"/);
  assert.match(html, /id="gas-f-empleado"/);
  assert.match(css, /\.gas-toolbar-search\{display:grid/);
  assert.match(app, /function _cargarFiltroEmpleadosGastos\(\)/);
  assert.match(app, /function filtrarGastosPorEmpleado\(\)/);
  assert.match(app, /buscar\.value = nombre/);
  assert.match(html, /id="gas-f-empleado" onchange="filtrarGastosPorEmpleado\(\)"/);
  assert.match(app, /e\.activo !== false/);
});

test('listado y KPIs cambian con el empleado seleccionado', () => {
  assert.match(app, /var fEmpleado = \(document\.getElementById\('gas-f-empleado'\)/);
  assert.match(app, /var gastosMetricas = \(gastosData \|\| \[\]\)\.filter/);
  assert.match(app, /function _gastoCorrespondeEmpleado\(gasto, empleadoKey, empleadoNombre\)/);
  assert.match(app, /descripcion\.indexOf\(nombre\) >= 0/);
  assert.match(app, /actualizarMetricasGastos\(\);/);
});

test('horas extra usan fecha de imputación y conservan el período trabajado', () => {
  assert.match(app, /function fechaImputacionGasto\(g\)/);
  assert.match(app, /periodoTrabajo: String\(payload\.periodoTrabajo/);
  assert.match(app, /fechaImputacion: _pagableNormFecha\(payload\.fecha\)/);
  assert.match(app, /fechaPagoHs = _gastoPagosArray\(g\)/);
});

test('un comprobante guardado como ruta se detecta y puede reemplazarse', () => {
  assert.match(app, /function _normalizarComprobantePagoGasto\(comprobante\)/);
  assert.match(app, /Ruta inválida/);
  assert.match(app, /function previewEdicionPagoGastoComprobante\(input\)/);
  assert.match(app, /Reemplazar comprobante/);
  assert.match(app, /cambios\.comprobante = _pagoGastoEdicionComprobante/);
});

test('gastos mantiene sus acciones accesibles directamente en móvil', () => {
  assert.match(css, /#page-gastos #gas-tbl \.sv-grid-actions-original\{display:flex!important/);
  assert.match(css, /#page-gastos #gas-tbl \.sv-grid-actions-trigger,/);
  assert.match(css, /#page-gastos #gas-tbl \.sv-grid-actions-menu\{display:none!important\}/);
});
