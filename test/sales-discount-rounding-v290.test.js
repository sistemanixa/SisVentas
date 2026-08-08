const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync('js/app.v2.0.305.js', 'utf8');
const helperStart = source.indexOf('function ventaTieneDescuentoItem');
const helperEnd = source.indexOf('function ventaPorcentajeDescuentoEfectivo', helperStart);
const resumenStart = source.indexOf('function resumenEconomicoComprobanteVenta', helperStart);
const resumenEnd = source.indexOf('function importeComprobanteVenta', resumenStart);

assert.notEqual(helperStart, -1, 'No se encontró ventaTieneDescuentoItem');
assert.notEqual(helperEnd, -1, 'No se encontró ventaPorcentajeDescuentoEfectivo');
assert.notEqual(resumenStart, -1, 'No se encontró resumenEconomicoComprobanteVenta');
assert.notEqual(resumenEnd, -1, 'No se encontró el cierre de resumenEconomicoComprobanteVenta');

const context = {
  console,
  Number,
  pptoNumeroGuardado: (valor) => parseFloat(valor) || 0,
  pptoNormalizarItemGuardado: (item) => ({
    qty: parseFloat(item.qty || 1),
    punit: parseFloat(item.punit || 0),
    disc: parseFloat(item.disc || item.descuento || 0)
  })
};
vm.createContext(context);
vm.runInContext(source.slice(helperStart, helperEnd), context);
vm.runInContext(source.slice(resumenStart, resumenEnd), context);

function calcularDescuentoVenta(v) {
  const items = Array.isArray(v.items) ? v.items : [];
  const subtotalBruto = items.reduce((s, i) => s + (i.qty * i.punit), 0);
  const subtotalNeto = items.reduce((s, i) => s + (i.sub || 0), 0);
  const descGenAmt = Math.round(subtotalNeto * ((v.descuentoGeneral || 0) / 100));
  let ajusteRedondeo = subtotalBruto - subtotalNeto;
  if (!(v.descuentoGeneral > 0) && !context.ventaTieneDescuentoItem(v)) ajusteRedondeo = 0;
  return context.ventaNormalizarDescuentoParaVista(v, descGenAmt + ajusteRedondeo);
}

test('Venta sin descuento: redondeo en centavos no aparece como descuento', () => {
  const venta = {
    descuentoGeneral: 0,
    items: [{ qty: 1, punit: 1853084.25, sub: 1853084, disc: 0 }]
  };

  assert.strictEqual(calcularDescuentoVenta(venta), 0);
});

test('Venta sin descuento con cantidades: múltiples redondeos no generan descuento', () => {
  const venta = {
    descuentoGeneral: 0,
    items: [
      { qty: 3, punit: 10.333, sub: 31, disc: 0 },
      { qty: 1, punit: 6.111, sub: 6, disc: 0 }
    ]
  };

  assert.strictEqual(calcularDescuentoVenta(venta), 0);
});

test('Venta con descuento real por ítem conserva el descuento', () => {
  const venta = {
    descuentoGeneral: 0,
    items: [{ qty: 2, punit: 1000, sub: 1800, disc: 10 }]
  };

  assert.strictEqual(calcularDescuentoVenta(venta), 200);
});

test('Venta con descuento general conserva el descuento', () => {
  const venta = {
    descuentoGeneral: 10,
    items: [{ qty: 1, punit: 1000, sub: 1000, disc: 0 }]
  };

  assert.strictEqual(calcularDescuentoVenta(venta), 100);
});

test('Resumen para impresión en venta sin descuento no muestra importe de descuento', () => {
  const venta = {
    items: [{ qty: 1, punit: 1853084.25, sub: 1853084, disc: 0 }],
    descuento: 0.25,
    subtotal: 1853084,
    total: 1853084,
    conIva: false
  };

  const resumen = context.resumenEconomicoComprobanteVenta(venta);

  assert.strictEqual(resumen.descuento, 0);
  assert.strictEqual(resumen.subtotalBruto, 1853084.25);
  assert.strictEqual(resumen.subtotalNeto, 1853084);
  assert.strictEqual(resumen.total, 1853084);
});

test('Resumen para impresión con IVA y sin descuentos conserva matemática y no muestra descuento', () => {
  const venta = {
    items: [{ qty: 1, punit: 100, sub: 100, disc: 0 }],
    descuento: 0.25,
    total: 121,
    iva: 21,
    conIva: true
  };

  const resumen = context.resumenEconomicoComprobanteVenta(venta);

  assert.strictEqual(resumen.descuento, 0);
  assert.strictEqual(resumen.subtotalNeto, 100);
  assert.strictEqual(resumen.iva, 21);
  assert.strictEqual(resumen.total, 121);
});

test('Venta histórica: recupera el descuento real desde el total aunque descuento tenga sólo el redondeo', () => {
  const venta = {
    items: [{ qty: 1, punit: 20081977.73, sub: 20081972.73, disc: 0 }],
    descuento: 5,
    subtotal: 20081972.73,
    total: 19077878.83,
    iva: 0,
    conIva: false
  };

  const resumen = context.resumenEconomicoComprobanteVenta(venta);

  assert.strictEqual(resumen.subtotalBruto, 20081977.73);
  assert.strictEqual(resumen.descuento, 1004098.9);
  assert.strictEqual(resumen.subtotalNeto, 19077878.83);
  assert.strictEqual(Math.round(resumen.descuentoGeneralPct * 100) / 100, 5);
  assert.strictEqual(resumen.total, 19077878.83);
});
