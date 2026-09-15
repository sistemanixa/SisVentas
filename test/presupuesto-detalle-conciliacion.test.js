const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const budget = require('../js/v3/budget-read-model.js');
const integration = require('../js/v3/budget-integration.js');
const index = fs.readFileSync('index.html', 'utf8');
const source = fs.readFileSync(index.match(/src="\.\/(js\/app\.v[\d.]+\.js)/)[1], 'utf8');
const start = source.indexOf('itemsBody.innerHTML = items.length ? items.map');
const end = source.indexOf("}).join('')", start) + "}).join('')".length;
const render = source.slice(start, end) + " : '';";

for (const comparison of [false, true]) {
  for (const discount of [0, 5, 100]) {
    test(`detalle concilia con guardado e impresión: comparación ${comparison}, descuento ${discount}`, () => {
      const record = {items: [{qty:7, punit:156434.85, sub:1}, {qty:7, punit:225000, disc:20, sub:2}], descuentoGeneral:discount, conIva:true};
      const model = budget.build(record);
      const context = {items:record.items, itemsBody:{}, _modeloEconomicoV3:model, _descPct:discount,
        mostrarComparacion:comparison, _redondearPrecioActual:budget.roundMoney,
        obtenerCostoUnitarioDetalleVenta:()=>100, productoRefDesdeItem:()=>'', escapeHTML:value=>value,
        imagenProductoItemHTML:()=>'', importeComprobanteVenta:value=>`[${value}]`};
      context.globalThis = context;
      vm.runInNewContext(fs.readFileSync('js/modules/comparacion-comercial.js','utf8'), context);
      vm.runInNewContext(render, context);
      const displayed = Array.from(context.itemsBody.innerHTML.matchAll(/font-weight:500">\[([\d.]+)\]/g), match=>Number(match[1]));
      assert.equal(budget.roundMoney(displayed.reduce((sum,value)=>sum+value,0)),model.subtotal);
      assert.equal(model.subtotal,2355043.95);
      const stored = integration.fields(record);
      const printed = integration.printModel(stored);
      assert.equal(printed.subtotal,model.subtotal);
      assert.equal(stored.total,model.total);
      assert.ok(model.conflicts.some(item=>item.kind==='line-total-mismatch'));
    });
  }
}
