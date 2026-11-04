const test=require('node:test'),assert=require('node:assert/strict');
const Model=require('../js/v3/budget-read-model.js');
const Transition=require('../js/core/sale-budget-transition.v1.js');
test('explicit zero stays valid, missing invalid and negative prices cannot masquerade as free lines',()=>{
 for(const price of [0,'0']){const model=Model.build({items:[{qty:1,punit:price,sub:0,costoUnitarioCompra:0,costoVersion:1}],conIva:false});assert.equal(model.ready,true);assert.equal(model.items[0].unitNet,0);}
 for(const price of [undefined,null,'',NaN,Infinity,-1,'-1','NaN']){const item={qty:1,punit:price,sub:0};assert.equal(Model.build({items:[item],conIva:false}).ready,false);assert.throws(()=>Transition.toBudget({items:[item],subtotal:0,descuento:0,iva:0,total:0,conIva:false},{sourceFormat:'sale'}));}
});
test('explicit negative price is rejected even when a positive stored subtotal exists',()=>{assert.equal(Model.build({items:[{qty:1,punit:-1,sub:10}],conIva:false}).ready,false);});
