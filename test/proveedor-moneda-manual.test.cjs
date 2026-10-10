const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const source = require('./helpers/active-app').readActiveApp().source;
function setup(rate = 1535) {
  const ctx = vm.createContext({prodProveedoresActuales:[{precio:706100, precioOriginal:460, monedaOriginal:'USD', conversion:{}, costoEnvioArs:153500}],
    obtenerDolarReferenciaProducto:()=>({valor:rate}),
    actualizarProveedorProducto(i,k,v){ctx.prodProveedoresActuales[i][k]=v;}});
  const start = source.indexOf('function camposPrecioProveedorProducto(');
  const end = source.indexOf('function actualizarProveedorProducto(',start);
  vm.runInContext(source.slice(start,end),ctx);
  return ctx;
}
test('USD manual reemplaza importe importado, convierte y conserva envío separado',()=>{
  const c=setup(); const sibling={value:'',dataset:{}};
  c.editarPrecioProveedorMoneda(0,'USD',645,{closest:()=>({querySelector:()=>sibling})});
  const p=c.prodProveedoresActuales[0];
  assert.equal(p.precio,990075);
  assert.equal(p.precio+p.costoEnvioArs,1143575);
  assert.equal(p.precioOriginal,undefined);
  assert.equal(p.conversion,undefined);
  assert.equal(p.moneda,'ARS');
  assert.equal(sibling.value,'990.075,00');
  assert.equal(sibling.dataset.raw,'990075.00');
});
test('ARS se refleja en USD; cero reemplaza el precio anterior',()=>{
  const c=setup(), sibling={value:'',dataset:{}}, input={closest:()=>({querySelector:()=>sibling})};
  c.editarPrecioProveedorMoneda(0,'ARS',990075,input);
  assert.equal(sibling.value,'645,00');
  assert.equal(sibling.dataset.raw,'645.00');
  c.editarPrecioProveedorMoneda(0,'ARS',0,input);
  assert.equal(c.prodProveedoresActuales[0].precioArsPublicado,0);
  assert.equal(sibling.value,'0,00');
});
test('sin cotización no convierte USD ni acepta números inválidos',()=>{
  const c=setup(0);
  for(const n of [645,-1,Infinity,NaN]) c.editarPrecioProveedorMoneda(0,'USD',n);
  assert.equal(c.prodProveedoresActuales[0].precio,706100);
  assert.match(c.camposPrecioProveedorProducto(0,706100),/disabled/);
});
