const test = require('node:test');
const assert = require('node:assert/strict');
const {calcular} = require('../js/modules/comparacion-comercial');
test('descuento general se aplica después del descuento del ítem y margen sobre venta neta',()=>{
  const r=calcular(2,30,160,5);
  assert.equal(r.neto,152);
  assert.equal(r.costo,60);
  assert.equal(r.ganancia,92);
  assert.equal(r.margen,92/152*100);
});
test('bonificación total conserva pérdida y no inventa un porcentaje',()=>{
  assert.deepEqual(calcular(2,30,160,100),{compra:30,costo:60,neto:0,ganancia:-60,margen:null});
});
test('cantidades fraccionarias y centavos',()=>{
  const r=calcular(2.5,12.34,48.75,10);
  assert.equal(r.costo,30.85); assert.equal(r.neto,43.87); assert.equal(r.ganancia,13.02);
});
