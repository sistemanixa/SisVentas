const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=require('./helpers/active-app').readActiveApp().source;
function fn(name){const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\nfunction ',start+1));}
const inputs={'pf-compra':{value:932365},'pf-venta':{value:1212074.5},'pf-iva':{value:'21'},'pf-margen':{style:{}},'pf-venta-iva':{},'pf-moneda':{value:'ARS'}};
const ctx=vm.createContext({document:{getElementById:id=>inputs[id]},getMontoRaw:e=>Number(e.value),window:{}});
vm.runInContext(fn('calcMargen'),ctx);vm.runInContext(fn('alicuotaIvaProducto'),ctx);
test('cambiar IVA recalcula el total y conserva el precio sin IVA y el costo',()=>{
  for(const [iva,total] of [['21','$1.466.610'],['10.5','$1.339.342'],['0','$1.212.075'],['21','$1.466.610']]){
    inputs['pf-iva'].value=iva;ctx.calcMargen();assert.equal(inputs['pf-venta-iva'].value,total);
    assert.equal(inputs['pf-venta'].value,1212074.5);assert.equal(inputs['pf-compra'].value,932365);
  }
});
test('exento sobrevive al ciclo de guardar y reabrir; ausente conserva 21%',()=>{
  for(const iva of [0,10.5,21]){const guardado=ctx.alicuotaIvaProducto(String(iva));const registro=JSON.parse(JSON.stringify({iva:guardado}));assert.equal(ctx.alicuotaIvaProducto(registro.iva),iva);}
  for(const valor of [undefined,null,'',NaN])assert.equal(ctx.alicuotaIvaProducto(valor),21);
  assert.match(source,/getElementById\('pf-iva'\)\.value = alicuotaIvaProducto\(p\.iva\)/);
  assert.match(source,/iva:\s+alicuotaIvaProducto\(document\.getElementById\('pf-iva'\)\.value\)/);
});
test('el selector llama al recálculo en el formulario publicado',()=>{
  assert.match(fs.readFileSync('index.html','utf8'),/id="pf-iva" onchange="calcMargen\(\)"/);
});
