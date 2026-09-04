const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const source = fs.readFileSync('js/modules/purchase-orders.js', 'utf8');

test('la grilla y cabecera muestran el proveedor final conciliado', () => {
  assert.match(source, /function orderProviderSummary\(order\)/);
  assert.match(source, /item\.proveedorFinal/);
  assert.match(source, /return 'Varios proveedores'/);
  assert.match(source, /esc\(orderProviderSummary\(o\)\)/);
  assert.match(source, /esc\(orderProviderSummary\(order\)\)/);
});

test('guardar recepción o conciliación persiste el resumen final', () => {
  assert.match(source, /proveedorFinalResumen: providerSummary/);
  assert.match(source, /proveedorFinalResumen: finalProviderSummary/);
});
