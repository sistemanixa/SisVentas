const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.v2.0.247.js', 'utf8');
const start = source.indexOf('function ventaSubtotalBruto');
const end = source.indexOf('function ventaTienePagoTotal', start);
assert(start >= 0 && end > start, 'No se encontraron las reglas de trabajos sin cargo');

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const sinCargo = {
  total: 0,
  subtotal: 0,
  descuento: 202113.13,
  estadoPago: 'pendiente_pago',
  items: [{ qty: 1, punit: 202113.13, sub: 0, disc: 100 }]
};
assert.strictEqual(context.ventaPorcentajeDescuentoEfectivo(sinCargo), 100);
assert.strictEqual(context.ventaEsSinCargo(sinCargo), true);
assert.strictEqual(context.estadoPagoEfectivoVenta(sinCargo), 'sin_cargo');

const vacia = { total: 0, descuento: 0, estadoPago: 'pendiente_pago', items: [] };
assert.strictEqual(context.ventaEsSinCargo(vacia), false, 'Una venta vacía no debe confundirse con un trabajo sin cargo');
assert.strictEqual(context.estadoPagoEfectivoVenta(vacia), 'pendiente_pago');

const parcial = {
  total: 605,
  subtotal: 500,
  iva: 105,
  descuento: 500,
  estadoPago: 'pendiente_pago',
  items: [{ qty: 1, punit: 1000, sub: 500, disc: 50 }]
};
assert.strictEqual(context.ventaPorcentajeDescuentoEfectivo(parcial), 50);
assert.strictEqual(context.ventaEsSinCargo(parcial), false);

assert(source.includes("'sin_cargo':      { label:'Sin cargo'"));
assert(source.includes('Descuento \' + (Math.round(descuentoPctDetalle * 100) / 100)'));
assert(source.includes('No requiere pagos · descuento 100%'));

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
assert(index.includes('app.v2.0.247.js'));
assert(index.includes('version.v2.0.247.js'));
assert(sw.includes('sisventas-v2.0.247'));

console.log('v2.0.247: trabajos sin cargo verificados');
