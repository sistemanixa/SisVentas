const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const purchaseOrders = fs.readFileSync(path.join(root, 'js', 'modules', 'purchase-orders.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('la recepción exige proveedor y costo final y conserva la comparación presupuestada', () => {
  assert.match(purchaseOrders, /Proveedor donde finalmente se compró/);
  assert.match(purchaseOrders, /oc-real-cost/);
  assert.match(purchaseOrders, /costoUnitarioPresupuestado/);
  assert.match(purchaseOrders, /diferenciaCompra/);
  assert.match(purchaseOrders, /Mejoró/);
  assert.match(purchaseOrders, /Empeoró/);
});

test('el costo real recibido se refleja de forma transaccional en la venta y su margen', () => {
  assert.match(purchaseOrders, /function syncSalePurchaseCosts/);
  assert.match(purchaseOrders, /fbRunTransaction/);
  assert.match(purchaseOrders, /saleItem\.costoTotalCompra/);
  assert.match(purchaseOrders, /sale\.margenPct/);
});

test('la OC dispone de un comprobante imprimible con proveedor e items', () => {
  assert.match(purchaseOrders, /ocImprimirOrdenActual/);
  assert.match(purchaseOrders, /ORDEN DE COMPRA/);
  assert.match(purchaseOrders, /Proveedor/);
  assert.match(purchaseOrders, /window\.print/);
  assert.match(index, /purchase-orders\.js\?v=3\.3\.5-conciliacion-compra-1/);
});
