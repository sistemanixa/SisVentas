const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { source: app, filename } = require('./helpers/active-app').readActiveApp();
const index = fs.readFileSync('index.html', 'utf8');

test('garantías selecciona un cliente válido y ofrece solamente sus ventas', () => {
  assert.match(app, /autocomplete-cliente-garantia/);
  assert.match(app, /function filterDropGarantiaCliente\(/);
  assert.match(app, /function garantiaCargarVentasCliente\(/);
  assert.match(app, /ventasValidasDeCliente\(cliente\)/);
  assert.match(app, /function garantiaVentaSeleccionada\(/);
  assert.match(app, /function garantiaCargarEquiposVenta\(/);
  assert.match(app, /ordenarItemsComerciales\(venta\.items\)\.filter\(garantiaItemEsEquipo\)/);
  assert.match(app, /Seleccioná un cliente válido de la lista/);
  assert.match(app, /Seleccioná una venta del cliente/);
  assert.match(app, /Seleccioná un equipo incluido en la venta/);
});

test('la garantía conserva las claves del cliente y la venta vinculada', () => {
  assert.match(app, /clienteFbKey:clienteGarantia\.dataset\.clienteKey/);
  assert.match(app, /ventaFbKey:\(ventaGarantia/);
  assert.match(app, /equipoCodigo:\(equipoGarantia\.selectedOptions/);
  assert.ok(index.includes('./js/' + filename));
});
