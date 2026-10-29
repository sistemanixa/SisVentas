const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const create = require('../js/core/budget-conversion-costs.v1.js');
const Model = require(path.join(process.env.SV_CONVERSION_COST_SOURCE || path.join(__dirname, '..'), 'js/core/sale-costs.v1.js'));
function setup(price=75, product=true) {
 const root={obtenerProductoPorCodigoVenta:()=>product?{compraARS:price}:null,precioGremioARSDesdeProducto:()=>price,obtenerCostoUnitarioVenta:()=>price};
 root.SVSaleCosts=Model.create(root);
 return {api:create(root),costs:root.SVSaleCosts};
}
for(const role of ['admin','administrativo','vendedor','tecnico_vendedor']) test(role+': missing or pending historical cost uses current catalogue',()=>{
 const f=setup();
 for(const extra of [{},{costoTotalCompra:2,costoUnitarioUSD:99,costoVersion:1,comisionCostoHistoricoPendiente:true}]){
 const record={responsableUid:'unchanged',items:[{cod:'P',qty:2,punit:100,disc:7,...extra}]},before=JSON.stringify(record);
 const result=f.api.prepare(record);
 assert.equal(result.items[0].costoUnitarioCompra,75);assert.equal(result.items[0].costoTotalCompra,150);
 assert.equal(result.items[0].costoOrigen,'catalogo_al_convertir');assert.equal(result.items[0].comisionCostoHistoricoPendiente,undefined);
 assert.equal(JSON.stringify(record),before);assert.equal(result.responsableUid,'unchanged');
 assert.deepEqual(f.costs.prepare(result,null),result);
 }
});
test('preserves confirmed historical cost and timestamp despite catalogue changes',()=>{
 const f=setup(900),old={cod:'P',qty:2,costoUnitarioCompra:12,costoTotalCompra:24,costoVersion:1,costoOrigen:'guardado',costoCapturadoEn:123};
 assert.deepEqual(f.api.prepare({items:[old]}).items[0],{...old,costoUnitarioPresupuestado:12});
});
test('object items and explicit current zero are supported',()=>{
 const result=setup(0).api.prepare({items:{a:{cod:'MO',qty:5}}});assert.equal(result.items.a.costoTotalCompra,0);
});
test('unavailable catalogue and invalid prices do not fabricate cost',()=>{
 assert.throws(()=>setup(5,false).api.prepare({items:[{cod:'P',qty:1}]}),/No se encontró/);
 for(const value of [NaN,Infinity,-1])assert.throws(()=>setup(value).api.prepare({items:[{cod:'P',qty:1}]}),/costo actual/);
});
test('ordinary sale capture still rejects unresolved historical costs',()=>{
 assert.throws(()=>setup().costs.capture({cod:'P',qty:1,comisionCostoHistoricoPendiente:true}),/histórico/);
});
test('active conversion prepares fallback before the common writer and includes the helper',()=>{
 const fs=require('node:fs'),source=require('./helpers/active-app.js').readActiveApp().source;
 assert.match(source,/ventaBase=window\.SVBudgetConversionCosts\.prepare\(ventaBase\);\s*ventaBase=window\.SVSaleWriter\.prepare\(ventaBase,null\)/);
 assert.match(fs.readFileSync('index.html','utf8'),/core\/budget-conversion-costs\.v1\.js/);
});
