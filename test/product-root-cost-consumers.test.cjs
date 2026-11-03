'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Costs=require('../js/core/sale-costs.v1');
const Shopping=require('../js/modules/paraguay-shopping-access');
const Catalog=require('../js/modules/public-catalog-share');
const line=()=>({cod:'P-62928',qty:1,punit:48000,sub:48000});
function setup(product,value){return Costs.create({obtenerProductoPorCodigoVenta:()=>product,obtenerCostoUnitarioVenta:()=>value,esProductoManoDeObra:()=>true});}

test('el cero del duplicado retirado no confirma un costo actual inexistente',()=>{
 const product={codigo:'P-62928',costoRealArs:0};
 assert.throws(()=>setup(product,0).capture(line()),/No se tomó como cero/);
 assert.throws(()=>setup(product,0).capture({...line(),costoUnitarioCompra:0}),/No se tomó como cero/);
 assert.deepEqual(product,{codigo:'P-62928',costoRealArs:0});
});
test('cada campo de costo operativo puede confirmar un cero explícito sin duplicado',()=>{
 for(const name of ['compraARS','precioGremio','compra']){
  const captured=setup({codigo:'P-62928',[name]:0},0).capture(line());
  assert.equal(captured.costoUnitarioCompra,0);
  assert.equal(captured.costoTotalCompra,0);
 }
});
test('la captura nueva conserva costo canónico mientras el duplicado y proveedor difieren',()=>{
 const product={codigo:'P-62928',compraARS:20000,costoRealArs:200000,proveedores:[{costoRealArs:19500}]},before=structuredClone(product);
 const captured=setup(product,product.compraARS).capture(line());
 assert.equal(captured.costoUnitarioCompra,20000);
 assert.equal(captured.costoTotalCompra,20000);
 assert.deepEqual(product,before);
});
test('un snapshot histórico confirmado mantiene sus costos positivos y cero sin catálogo ni duplicado',()=>{
 const api=Costs.create({obtenerProductoPorCodigoVenta:()=>null,obtenerCostoUnitarioVenta:()=>{throw Error('No debe recotizar histórico');}});
 for(const value of [0,18000]){
  const original={items:[{...line(),costoVersion:1,costoUnitarioCompra:value,costoTotalCompra:value,costoUnitarioPresupuestado:value,costoCapturadoEn:123}]};
  const before=structuredClone(original),saved=api.prepare({items:[{...line(),punit:50000}]},original);
  assert.equal(saved.items[0].costoUnitarioCompra,value);assert.equal(saved.items[0].costoTotalCompra,value);assert.equal(saved.items[0].costoCapturadoEn,123);assert.deepEqual(original,before);
 }
});
test('Compras Paraguay sigue usando el costo propio de proveedor y no la copia raíz',()=>{
 const p={categoria:'COMPRAS PARAGUAY',compraARS:20000,costoRealArs:200000,proveedores:[{nombre:'FLYTEC PARAGUAY',monedaOriginal:'USD',precioOriginal:10,costoRealArs:18000,precio:17000}]},before=structuredClone(p);
 assert.equal(Shopping.quote(p).ars,18000);assert.equal(Shopping.quote(p).usd,10);assert.deepEqual(p,before);
});
test('la referencia pública ML conserva el costo del proveedor sin exponerlo ni leer la copia raíz',()=>{
 const p={categoria:'COMPRAS PARAGUAY',nombre:'Fixture',ventaARS:30000,iva:0,compraARS:20000,costoRealArs:200000,proveedores:[{nombre:'Mercado Libre',costoRealArs:25000,precioArsPublicado:24000}]},before=structuredClone(p);
 const output=Catalog.project(p,1000);assert.equal(output.referenciaMLUSD,25);assert.equal(output.precioUSD,30);assert.equal(output.costoRealArs,undefined);assert.equal(output.proveedores,undefined);assert.deepEqual(p,before);
});
