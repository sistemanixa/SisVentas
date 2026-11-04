const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const Costs = require('../js/core/sale-costs.v1.js');
const { source } = require('./helpers/active-app.js').readActiveApp();
const { functionSource } = require('./helpers/app-functions.cjs');

test('real sale row mapper cannot confirm an unresolved anonymous cost', () => {
  const start = source.indexOf('items: filas.map(function(tr, itemIndex)');
  assert.ok(start >= 0);
  const end = source.indexOf('\n    descuentoGeneral:', start);
  assert.ok(end > start);
  const fields = {
    '.prod-sel-cod': { textContent: '' },
    '.desc-txt-clean': { textContent: 'Producto ficticio importado' },
    '.qty': { value: '2' },
    '.price': { value: '100', dataset: {} },
    '.disc': { value: '0' }
  };
  const context = {
    filas: [{ dataset: {}, querySelector: selector => fields[selector] || null }],
    _ventaMonedaActual: 'ARS',
    window: { SVSaleCosts: Costs.create({ obtenerProductoPorCodigoVenta: () => null }) },
    _redondearPrecioActual: value => value,
    obtenerProductoPorCodigoVenta: () => null,
    obtenerCostoUnitarioVenta: () => 0
  };
  vm.createContext(context);
  for (const helper of ['_svCostoGuardadoItem', '_svDatosItemFila']) {
    if (source.includes('function ' + helper + '(')) vm.runInContext(functionSource(helper), context);
  }
  const expression = source.slice(start + 'items: '.length, end).trim().replace(/,$/, '');
  const items = vm.runInNewContext(expression, context);
  assert.equal(items[0].productoFbKey, '');
  if (source.includes('function _svDatosItemFila(')) {
    assert.equal(Object.hasOwn(items[0], 'costoUnitarioCompra'), false);
    assert.equal(Object.hasOwn(items[0], 'costoTotalCompra'), false);
  }
  assert.throws(() => Costs.create(context).prepare({ items: Array.from(items) }, null), /Falta (definir|confirmar) el costo/);
  assert.throws(() => Costs.create(context).capture({ desc: 'Sin costo', qty: 2 }), /Falta definir el costo/);
  const explicit = Costs.create(context).capture({ desc: 'Cero autorizado ficticio', qty: 2, costoUnitarioCompra: 0, costoOrigen: 'correccion_manual_autorizada' });
  assert.equal(explicit.costoTotalCompra, 0);
});

test('anonymous implicit zero is rejected even with a product reference', () => {
  const api = Costs.create({ obtenerProductoPorCodigoVenta: () => null });
  for (const identity of [{}, { productoFbKey: 'ficticio' }, { cod: 'FICTICIO' }]) {
    assert.throws(() => api.capture({ ...identity, desc: 'Sin evidencia', qty: 1, costoUnitarioCompra: 0, costoTotalCompra: 0 }), /No se tomó como cero/);
  }
});

test('confirmed historical and authorized zero costs survive without catalogue substitution', () => {
  const api = Costs.create({ obtenerProductoPorCodigoVenta: () => null });
  const historical = { desc: 'Histórico ficticio', qty: 1, costoUnitarioCompra: 0, costoTotalCompra: 0 };
  assert.equal(api.prepare({ items: [{ ...historical, qty: 2 }] }, { items: [historical] }).items[0].costoTotalCompra, 0);
  for (const evidence of [{ costoVersion: 1 }, { costoOrigen: 'correccion_manual_autorizada' }, { costoUnitarioPresupuestado: 0 }]) {
    assert.equal(api.capture({ ...historical, ...evidence }).costoTotalCompra, 0);
  }
});

test('catalogue explicit zero is accepted while missing catalogue cost fails', () => {
  for (const product of [{ compraARS: 0 }, {}]) {
    const api = Costs.create({ obtenerProductoPorCodigoVenta: () => product, obtenerCostoUnitarioVenta: () => 0 });
    if (Object.hasOwn(product, 'compraARS')) assert.equal(api.capture({ cod: 'FICTICIO', qty: 1 }).costoTotalCompra, 0);
    else assert.throws(() => api.capture({ cod: 'FICTICIO', qty: 1 }), /No se tomó como cero/);
  }
});

test('real comparison markup hides unconfirmed cost, profit and margin without changing history', () => {
  const fs = require('node:fs');
  const context = { window: { importeComprobanteVenta: value => '$' + value.toFixed(2) } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/modules/comparacion-comercial.js'), 'utf8'), context);
  const comparison = context.window.ComparacionComercial;
  const html = comparison.celdas(comparison.calcular(2, 0, 200, 0));
  assert.match(html, /100\.0%/);
  const api = Costs.create({});
  for (const item of [{ desc: 'Histórico sin costo', qty: 2 }, { costoUnitarioCompra: 0, qty: 2, comisionCostoHistoricoPendiente: true }]) {
    const before = JSON.stringify(item);
    const result = api.costCells(html, item);
    assert.equal((result.match(/<td\b/g) || []).length, 4);
    assert.match(result, /Costo sin confirmar/);
    assert.doesNotMatch(result, /100\.0%|\$200\.00|\$0\.00|Costo de referencia/);
    assert.equal((result.match(/>—/g) || []).length, 4);
    assert.equal(JSON.stringify(item), before);
  }
  for (const cost of [0, 25]) {
    const confirmed = comparison.celdas(comparison.calcular(2, cost, 200, 0));
    assert.equal(api.costCells(confirmed, { qty: 2, costoUnitarioCompra: cost, costoVersion: 1 }), confirmed);
  }
});
