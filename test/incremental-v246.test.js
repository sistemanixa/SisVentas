const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.v2.0.246.js');
const index = read('index.html');
const sw = read('sw.js');

function cargarConciliador() {
  const inicio = app.indexOf('function _svClavesVentaCuentaCorriente');
  const fin = app.indexOf('function _svResolverVentaRegistro', inicio);
  assert.ok(inicio >= 0 && fin > inicio, 'debe poder aislarse el conciliador');
  const context = {
    window: { _pagosListaActual: [], _historialPagosCompleto: [] },
    _svPagoValido: pago => !!pago && !pago.anulado && String(pago.estado || '').toLowerCase() !== 'anulado'
  };
  vm.createContext(context);
  vm.runInContext(app.slice(inicio, fin), context);
  return context;
}

test('todas las vistas usan la misma conciliación aunque reciban otra instancia del listado', () => {
  const ctx = cargarConciliador();
  const ventas = [
    { fbKey:'venta-a', id:'#V-000123', clienteFbKey:'cliente-1', cliente:'Cliente uno', total:100 },
    { fbKey:'venta-b', id:'#V-000124', clienteFbKey:'cliente-1', cliente:'Cliente uno', total:200 },
    { fbKey:'venta-c', id:'#V-000125', clienteFbKey:'cliente-2', cliente:'Cliente dos', total:50 }
  ];
  ctx.window._pagosListaActual = [
    { fbKey:'pago-a', ventaFbKey:'venta-a', monto:40, fecha:'2026-08-01' },
    { fbKey:'pago-b', venta:'#V-000124', monto:200, fecha:'2026-08-01' },
    { fbKey:'pago-c', ventaFbKey:'venta-c', monto:50, fecha:'2026-08-01' },
    // La coincidencia numérica parcial no debe adjudicar pagos a otra venta.
    { fbKey:'pago-ajeno', venta:'OT-000123', monto:60, fecha:'2026-08-01' }
  ];

  const resumenOriginal = ctx._svResumenCuentaCorriente(ventas);
  const resumenCopia = ctx._svResumenCuentaCorriente(ventas.slice());
  assert.equal(resumenOriginal.pendiente, 60);
  assert.equal(resumenOriginal.clientesConSaldo, 1);
  assert.equal(resumenCopia.pendiente, resumenOriginal.pendiente);
  assert.equal(resumenCopia.clientesConSaldo, resumenOriginal.clientesConSaldo);
});

test('Clientes deja de leer venta.saldo', () => {
  const bloque = app.slice(app.indexOf('function actualizarStatClientes'), app.indexOf('function _claveInventarioProducto'));
  assert.doesNotMatch(bloque, /parseFloat\(v\.saldo/);
  assert.match(bloque, /_svResumenCuentaCorriente/);
  const guardado = app.slice(app.indexOf("if (tipo === 'cliente')"), app.indexOf("} else if (tipo === 'producto')"));
  assert.doesNotMatch(guardado, /\bsaldo\s*:/);
});

test('la publicación corresponde a v2.0.246', () => {
  assert.match(app, /VERSION: 'v2\.0\.246-firebase'/);
  assert.match(index, /app\.v2\.0\.246\.js/);
  assert.match(index, /version\.v2\.0\.246\.js/);
  assert.match(sw, /sisventas-v2\.0\.246/);
});
