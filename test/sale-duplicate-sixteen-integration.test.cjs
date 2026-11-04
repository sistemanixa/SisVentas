'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const fixturePath=require.resolve('./sale-duplicate-row-continuity.test.cjs');
function createFixture(item){
 const source=fs.readFileSync(fixturePath,'utf8'),boundary=source.indexOf("\ntest('");assert.ok(boundary>0);
 const context={require:createRequire(fixturePath),module:{exports:{}},structuredClone};
 vm.runInNewContext(source.slice(0,boundary)+'\nmodule.exports=fixture;',context,{filename:fixturePath});
 return context.module.exports(item);
}
test('active duplicate and row functions render all sixteen current catalog photos, prices and costs',()=>{
 const items=Array.from({length:16},(_,index)=>({cod:'P-'+index,productoFbKey:'p'+index,desc:'Fixture '+index,qty:2,punit:100+index,costoUnitarioCompra:10+index,costoVersion:1,imagenUrl:'old-'+index+'.png'}));
 const fixture=createFixture(items[0]);fixture.original.items=items;
 fixture.ctx.prodData=Object.fromEntries(items.map((item,index)=>['p'+index,{fbKey:'p'+index,codigo:item.cod,nombre:item.desc,imagenUrl:'fixture-'+index+'.png',compraARS:20+index}]));
 fixture.ctx.precioVentaCanonicoProducto=product=>({precioARS:200+Number(product.fbKey.slice(1))});
 fixture.ctx.obtenerCostoUnitarioVenta=code=>fixture.ctx.prodData['p'+code.slice(2)].compraARS;
 const before=structuredClone(fixture.original);fixture.ctx.duplicarVenta('original');assert.equal(fixture.rows.length,16);
 for(const [index,row]of fixture.rows.entries()){
  const item=JSON.parse(row.dataset.itemComercial);assert.equal(row.dataset.productoFbKey,'p'+index);assert.equal(item.costoUnitarioCompra,20+index);assert.equal(item.costoTotalCompra,(20+index)*2);assert.match(row.innerHTML,new RegExp('fixture-'+index+'\\.png'));assert.match(row.innerHTML,new RegExp(String(200+index)));
 }
 assert.deepEqual(structuredClone(fixture.original),before);
});
