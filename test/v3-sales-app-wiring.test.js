const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.0.279.js'), 'utf8');

test('ventas y pagos consultan V3 exclusivamente mediante el puente reversible', () => {
  assert.match(source, /function ventasPagosV3Invocar\(/);
  assert.match(source, /bridge\.invoke\('ventasPagos'/);
  assert.match(source, /function ventasPagosV3Activo\(/);
  assert.match(source, /bridge\.status\('ventasPagos'\)\.active === true/);
});

test('deuda, cobranzas y reportes comparten total, cobrado y saldo canónicos', () => {
  assert.match(source, /function _svTotalVentaCanonico\(/);
  assert.match(source, /function _svMontoPagadoVenta\(/);
  assert.match(source, /function _svSaldoPendienteVenta\(/);
  assert.match(source, /clientesDeuda = \(ventasList\|\|\[\]\)\.filter\(function\(v\)\{ return _svSaldoPendienteVenta\(v\) > 0;/);
  assert.match(source, /totalMesCobrado = ventasMes\.reduce\(function\(s,v\)\{ return s \+ _svMontoPagadoVenta\(v\);/);
  assert.match(source, /pendienteCobro = ventasPendientes\.reduce\(function\(s,v\)\{\s*return s \+ _svSaldoPendienteVenta\(v\);/);
});

test('las operaciones normales persisten ventas y pagos mediante repositorios V3 con fallback v2', () => {
  assert.match(source, /function ventasPagosPersistirGuardarVenta\(/);
  assert.match(source, /function ventasPagosPersistirActualizarVenta\(/);
  assert.match(source, /function ventasPagosPersistirEliminarVenta\(/);
  assert.match(source, /function ventasPagosPersistirGuardarPago\(/);
  assert.match(source, /function ventasPagosPersistirActualizarPago\(/);
  assert.match(source, /function ventasPagosPersistirEliminarPago\(/);
  assert.match(source, /ventasPagosPersistirGuardarPago\(pago\)/);
  assert.match(source, /ventasPagosPersistirGuardarVenta\(venta\)/);
  assert.match(source, /ventasPagosPersistirActualizarVenta\(ventaObj\.fbKey/);
});
