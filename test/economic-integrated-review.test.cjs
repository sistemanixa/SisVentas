const test=require('node:test'),assert=require('node:assert/strict');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs');
const Economics=require('../js/core/sale-economics-model.v1.js');
for(const field of ['sub','subtotal','totalItem','importe','total'])test('isolated item subtotal edit rejects without writes: '+field,async()=>{
 const sale=Economics.calculate({id:'SUBTOTAL-FICTICIA',clienteFbKey:'c',responsableUid:'u',conIva:false,items:[{cod:'P',qty:1,punit:100,costoUnitarioCompra:25}]});
 const f=await createCoordinatedBackend({ventas:{v:sale}});
 await assert.rejects(f.gateway.write({uid:'u',claims:{uid:'u'}},{id:'item-subtotal-review',kind:'set',path:'sisventas/ventas/v/items/0/'+field,value:999}),/canónico/);
 assert.equal(f.commits.length,0);assert.deepEqual(f.get('sisventas/ventas/v'),sale);
 assert.equal(Economics.calculate(f.get('sisventas/ventas/v')).items[0].sub,100);
});
for(const field of ['subtotal','iva','total','descuento'])test('isolated sale header edit validates canonical economics: '+field,async()=>{const sale=Economics.calculate({id:'HEADER-FICTICIA',clienteFbKey:'c',responsableUid:'u',conIva:false,items:[{cod:'P',qty:1,punit:100,costoUnitarioCompra:0}]}),f=await createCoordinatedBackend({ventas:{v:sale}});await assert.rejects(f.gateway.write({uid:'u',claims:{uid:'u'}},{id:'header-subtotal-review',kind:'set',path:'sisventas/ventas/v/'+field,value:999}),/canónico/);assert.equal(f.commits.length,0);assert.deepEqual(f.get('sisventas/ventas/v'),sale);});
test('operational historical edit preserves missing costs and legacy subtotals without recalculation',async()=>{const sale={id:'HISTORICA-FICTICIA',clienteFbKey:'c',responsableUid:'u',total:100,items:[{desc:'Histórico incompleto',qty:1,subtotal:100}]},f=await createCoordinatedBackend({ventas:{v:sale}});await f.gateway.write({uid:'u',claims:{uid:'u'}},{id:'historic-operational-review',kind:'set',path:'sisventas/ventas/v/observaciones',value:'Nota ficticia'});assert.equal(f.commits.length,1);assert.deepEqual(f.get('sisventas/ventas/v/items'),sale.items);assert.equal(f.get('sisventas/ventas/v/total'),100);});
