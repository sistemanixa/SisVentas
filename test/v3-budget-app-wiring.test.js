const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.0.236.js'), 'utf8');

test('presupuestos consulta V3 sólo a través del puente reversible', () => {
  assert.match(app, /function pptoV3Invocar[\s\S]*?bridge\.invoke\('presupuestos'/);
  assert.match(app, /function pptoModeloEconomicoCanonico[\s\S]*?pptoV3Invocar\('build'/);
});

test('formulario, tabla, detalle e impresión comparten el adaptador V3', () => {
  const form = app.slice(app.indexOf('function calcPpTotales'), app.indexOf('function toggleMargenPpto'));
  assert.match(form, /pptoV3Invocar\('form'/);

  const table = app.slice(app.indexOf('function renderPptoTabla'), app.indexOf('function initPptoTablaEventos'));
  assert.match(table, /pptoV3Invocar\('tableTotal'/);

  const print = app.slice(app.indexOf('function _pptoModeloImpresion'), app.indexOf('function imprimirPresupuestoActual'));
  assert.match(print, /pptoV3Invocar\('printModel'/);

  const detail = app.slice(app.indexOf('function verPpto'), app.indexOf('function renderTimeline'));
  assert.match(detail, /pptoModeloEconomicoCanonico\(p\)/);
});

test('guardado, actualización y conversión usan importes canónicos cuando V3 está activa', () => {
  const update = app.slice(app.indexOf('function _actualizarPresupuestoGuardadoDesdeCatalogo'), app.indexOf('function actualizarValoresPpto'));
  assert.match(update, /pptoV3Invocar\('fields'/);

  const save = app.slice(app.indexOf('function guardarPresupuesto'), app.indexOf('// Navegación', app.indexOf('function guardarPresupuesto')));
  assert.match(save, /pptoV3Invocar\('fields'/);

  const conversion = app.slice(app.indexOf('function pptoDatosParaVenta'), app.indexOf('function pptoCargarItemsEnEditor'));
  assert.match(conversion, /pptoV3Invocar\('toSale'/);
  assert.match(app, /datosVentaPpto\.v3Ready === false/);
  assert.match(app, /modelo\.v3Ready === false/);
  assert.match(app, /function asistGenerarPresupuesto[\s\S]*?pptoPersistirGuardar\(ppto\)/);
  assert.match(app, /clienteFbKey: clienteAsistente\.fbKey/);
});
