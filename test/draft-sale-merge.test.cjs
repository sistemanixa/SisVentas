'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {same,mergeForm}=require('../js/modules/commercial-drafts.js');
function form(obs,rows=[{cod:'P-1',qty:'1',price:100}]){return {fields:[{id:'venta-obs',value:obs},{id:'cli-inp',value:'JAVIER JESKE'}],rows,iva:true,detail:false,currency:'ARS',edit:'javier'};}
test('El orden de propiedades no constituye un cambio de venta',()=>{assert.equal(same({id:1,items:[{qty:1,cod:'P'}]},{items:[{cod:'P',qty:1}],id:1}),true);});
test('Recupera la observación del borrador y conserva los productos cambiados después',()=>{
 const base=form('Original'),draft=form('Trabajo pendiente'),current=form('Original',[{cod:'P-1',qty:'2',price:120}]);
 const result=mergeForm(base,draft,current);assert.equal(result.data.fields[0].value,'Trabajo pendiente');assert.deepEqual(result.data.rows,current.rows);assert.deepEqual(result.conflicts,[]);assert.equal(current.fields[0].value,'Original');
});
test('Conserva el cambio de venta y detecta conflicto si ambos modificaron el mismo dato',()=>{
 const base=form('Original'),draft=form('Borrador'),current=form('Cambio posterior');
 const result=mergeForm(base,draft,current);assert.equal(result.data.fields[0].value,'Cambio posterior');assert.deepEqual(result.conflicts,['venta-obs']);assert.equal(draft.fields[0].value,'Borrador');
});
test('Productos incompatibles se conservan completos sin mezclar precios, cantidad o créditos',()=>{
 const base=form('Original'),draft=form('Original',[{cod:'P-2',qty:'2',price:80}]),current=form('Original',[{cod:'P-1',qty:'3',price:120,data:{creditoHistorico:'1'}}]);
 const result=mergeForm(base,draft,current);assert.deepEqual(result.data.rows,current.rows);assert.deepEqual(result.conflicts,['Productos e importes']);
});
test('Cambios coincidentes no son conflictos y los valores actuales no editados permanecen',()=>{
 const base=form('Original'),draft=form('Nuevo'),current=form('Nuevo');current.currency='USD';
 const result=mergeForm(base,draft,current);assert.equal(result.data.currency,'USD');assert.deepEqual(result.conflicts,[]);
});
test('Un conflicto de productos no mezcla precios actuales en pesos con la moneda USD del borrador',()=>{
 const base=form('Original'),draft=form('Original',[{cod:'P-2',qty:'1',price:80}]),current=form('Original',[{cod:'P-1',qty:'1',price:200}]);draft.currency='USD';
 const result=mergeForm(base,draft,current);assert.equal(result.data.currency,'ARS');assert.deepEqual(result.data.rows,current.rows);assert.equal(draft.currency,'USD');
});
