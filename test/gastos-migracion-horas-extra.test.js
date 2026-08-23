const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');

test('la carga de Gastos ejecuta una sola vez la migración legacy después del snapshot', () => {
  const inicio = app.indexOf('function fbCargarGastos()');
  const fin = app.indexOf('function _gastoFijoMesActual', inicio);
  const bloque = app.slice(inicio, fin);
  assert.match(bloque, /_migrarPagablesLegacyAGastos\(\)/);
  assert.match(bloque, /!_migracionPagablesLegacyEjecutada && !_migracionPagablesLegacyEnCurso/);
  assert.doesNotMatch(bloque, /currentRole[\s\S]{0,120}_migrarPagablesLegacyAGastos/);
});

test('las horas extra históricas pagadas se imputan por fecha de pago', () => {
  assert.match(app, /_pagableNormFecha\(m\.fechaPago \|\| m\.fechaImputacion\)/);
  assert.match(app, /function _pagableAplicarPagoLegacy\(/);
  assert.match(app, /gasto\.fechaImputacion = fechaPago/);
  assert.match(app, /gasto\.estado = gasto\.montoPagado >= montoTotal \? 'pagado' : 'pagado_parcial'/);
  assert.match(app, /gasto = _pagableAplicarPagoLegacy\(gasto, m\)/);
});

test('la migración conserva separado el período trabajado', () => {
  assert.match(app, /fechaTrabajo:tipo === 'hextra' \? fechaTrabajoLegacy : ''/);
  assert.match(app, /periodoTrabajo:tipo === 'hextra' \? String\(m\.mes \|\| fechaTrabajoLegacy \|\| ''\)\.slice\(0,7\) : ''/);
});

test('una solicitud aprobada recrea exactamente su clave de gasto faltante', () => {
  assert.match(app, /var gastoKeyHs = sol\.gastoFbKey \|\| _claveOperacionConcurrente\('hextra', \[solKey\]\)/);
  assert.match(app, /fbSet\(window\.fbRef\(window\.fbDB, 'sisventas\/gastos\/' \+ gastoKeyHs\), gasto\)/);
  assert.match(app, /setTimeout\(function\(\)\{ _migrarPagablesLegacyAGastos\(\); \}, 1800\)/);
});

test('si la clave ya existe repara su imputación sin reemplazar pagos ni estado', () => {
  assert.match(app, /var existentePorClave = sol\.gastoFbKey/);
  assert.match(app, /fecha:fecha, fechaImputacion:fecha, mes:fecha\.slice\(0,7\)/);
  assert.match(app, /periodoTrabajo:String\(sol\.mes \|\| sol\.fecha \|\| ''\)\.slice\(0,7\)/);
  assert.match(app, /fbUpdate\(window\.fbRef\(window\.fbDB, 'sisventas\/gastos\/' \+ sol\.gastoFbKey\), reparacion\)/);
  const inicio = app.indexOf('var reparacion = {');
  const fin = app.indexOf('writes.push', inicio);
  const reparacion = app.slice(inicio, fin);
  assert.doesNotMatch(reparacion, /estado\s*:/);
  assert.doesNotMatch(reparacion, /pagos\s*:/);
});
