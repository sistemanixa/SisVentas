const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/app.v3.3.5.js', 'utf8');
const start = source.indexOf('function resumenEconomicoComprobanteVenta');
const end = source.indexOf('// Respaldo administrativo', start);
assert.notEqual(start, -1);
assert.notEqual(end, -1);

const context = {
  Number,
  pptoNumeroGuardado: value => parseFloat(value) || 0,
  pptoNormalizarItemGuardado: item => ({
    qty: parseFloat(item.qty || 1),
    punit: parseFloat(item.punit || 0),
    disc: parseFloat(item.disc || item.descuento || 0)
  }),
  ventaNormalizarDescuentoParaVista: (_venta, descuento) => parseFloat(descuento) || 0,
  ventaEsSinCargo: venta => (parseFloat(venta.total) || 0) === 0 && (parseFloat(venta.descuentoGeneral) || 0) >= 99.99
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

test('una venta bonificada al 100% no duplica el bruto ni inventa neto pendiente', () => {
  const resumen = context.resumenEconomicoComprobanteVenta({
    items: [{ qty: 1, punit: 96480, sub: 96480, disc: 0 }],
    descuentoGeneral: 100,
    descuento: 96480,
    subtotal: 0,
    iva: 0,
    total: 0,
    conIva: false
  });

  assert.deepEqual(JSON.parse(JSON.stringify(resumen)), {
    subtotalBruto: 96480,
    descuento: 96480,
    descuentoGeneralPct: 100,
    subtotalNeto: 0,
    iva: 0,
    aplicaIva: false,
    total: 0
  });
});
