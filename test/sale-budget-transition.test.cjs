const test=require('node:test'),assert=require('node:assert/strict');
const Model=require('../js/core/sale-budget-transition.v1.js');
const sale=()=>({items:[{cod:'FICTICIO',productoFbKey:'producto-ficticio',qty:2,punit:100,disc:10,sub:180,costoUnitarioCompra:0},{desc:'Sin costo histórico',qty:1,punit:20,sub:20}],subtotal:180,descuento:40,descuentoGeneral:10,iva:0,total:180,conIva:false});
test('item and general discounts retain distinct semantics and exact costs',()=>{const input=sale(),before=JSON.stringify(input),result=Model.toBudget(input,{sourceFormat:'sale'});assert.equal(result.subtotal,200);assert.equal(result.descuento,10);assert.equal(result.descuentoAmt,20);assert.equal(result.total,180);assert.deepEqual(result.items,input.items);assert.equal(Object.hasOwn(result.items[1],'costoUnitarioCompra'),false);assert.equal(JSON.stringify(input),before);result.items[0].cod='changed';assert.equal(input.items[0].cod,'FICTICIO');});
test('representative sixteen item sale preserves cents without treating amount as percent',()=>{const items=Array.from({length:16},(_,index)=>({cod:'F'+index,qty:1,punit:index===15?12773785.11:1,sub:index===15?12773785.11:1}));const result=Model.toBudget({items,subtotal:11496420.10,descuento:1277380.01,descuentoGeneral:10,iva:0,total:11496420.10,conIva:false},{sourceFormat:'sale'});assert.equal(result.subtotal,12773800.11);assert.equal(result.descuento,10);assert.equal(result.descuentoAmt,1277380.01);assert.equal(result.total,11496420.10);});
test('VAT and already canonical budget remain coherent',()=>{const input={...sale(),conIva:true,iva:37.8,total:217.8};const result=Model.toBudget(input,{sourceFormat:'sale'});assert.equal(result.total,217.8);const again=Model.toBudget(result,{sourceFormat:'budget'});assert.deepEqual(again.items,result.items);assert.equal(again.descuentoAmt,20);assert.equal(again.total,217.8);});
test('explicit format and metadata win over number size; inconsistent records reject',()=>{assert.throws(()=>Model.toBudget(sale()),/formato/);for(const change of [{descuentoGeneral:40},{conIva:undefined},{iva:1},{total:179},{descuento:10}])assert.throws(()=>Model.toBudget({...sale(),...change},{sourceFormat:'sale'}));});
test('missing percent can be derived from authoritative amounts without rounding percentage',()=>{const input=sale();delete input.descuentoGeneral;const result=Model.toBudget(input,{sourceFormat:'sale'});assert.equal(result.descuentoGeneral,10);assert.equal(result.transicionEconomica.porcentajeDerivado,true);});

test('user corrected native budget keeps its own semantics despite sale origin',()=>{const input={...sale(),ventaOrigenFbKey:'venta-ficticia',subtotal:200,descuento:5,descuentoGeneral:5,descuentoAmt:10,iva:39.9,total:229.9,conIva:true};const before=JSON.stringify(input),result=Model.toBudget(input,{sourceFormat:'budget'});assert.equal(result.descuentoGeneral,5);assert.equal(result.descuentoAmt,10);assert.equal(result.iva,39.9);assert.equal(result.total,229.9);assert.deepEqual(result.items,input.items);assert.equal(JSON.stringify(input),before);assert.throws(()=>Model.toBudget(input,{sourceFormat:'sale'}),/semántica propia/);});

test('sale origin alone never selects or certifies a source format',()=>{const input={...sale(),ventaOrigenFbKey:'venta-ficticia'};assert.throws(()=>Model.toBudget(input),/formato/);assert.equal(Model.toBudget(input,{sourceFormat:'sale'}).subtotal,200);const normalized=Model.toBudget(input,{sourceFormat:'sale'});assert.throws(()=>Model.toBudget(normalized,{sourceFormat:'sale'}),/semántica propia/);assert.equal(Model.toBudget(normalized,{sourceFormat:'budget'}).total,180);});

test('shared server validation accepts normalized economics and rejects cost or identity substitution',()=>{
 const source=sale(),budget=Model.toBudget(source,{sourceFormat:'sale'});
 assert.equal(Model.validateEconomicTransition(source,{...budget,id:'PP-FICTICIO',estado:'pendiente'}).total,180);
 for(const mutate of [record=>{record.items[0].costoUnitarioCompra=99;},record=>{record.items[0].productoFbKey='otro';},record=>{record.items[1].costoUnitarioCompra=0;},record=>{record.descuentoGeneral=40;},record=>{record.conIva=true;}]){
  const candidate=JSON.parse(JSON.stringify(budget));mutate(candidate);assert.throws(()=>Model.validateEconomicTransition(source,candidate));
 }
});

test('shared validation accepts explicit free line and preserves confirmed zero cost',()=>{
 const source={items:[{desc:'Ítem conservado sin cargo',qty:1,punit:0,sub:0,costoUnitarioCompra:0,costoVersion:1}],subtotal:0,descuento:0,descuentoGeneral:0,iva:0,total:0,conIva:false};
 const budget=Model.toBudget(source,{sourceFormat:'sale'});assert.deepEqual(Model.validateEconomicTransition(source,budget).items,source.items);
});
