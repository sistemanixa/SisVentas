const test=require('node:test'),assert=require('node:assert/strict');
const {profit}=require('../js/modules/public-catalog-requests.js');
test('el precio original permanece fijo aunque exista una edición anterior',()=>{
 const {requestItem}=require('../js/modules/public-catalog-requests.js');
 const item=requestItem({nombre:'Producto',precioUSD:100,cantidad:2},{precioUSD:150,cantidad:3});
 assert.equal(item.precioUSD,100);assert.equal(item.cantidad,3);
 assert.equal(profit(item.precioUSD,item.cantidad,60000,1000).total,120);
});
test('ganancia usa venta enviada y costo, multiplicada por cantidad',()=>{
 assert.deepEqual(profit(100,3,60000,1000),{unit:40,total:120,cost:60});
 assert.equal(profit(100,2,120000,1000).total,-40);
});
test('no inventa ganancia cuando faltan datos',()=>{
 for(const args of [[0,2,60000,1000],[100,2,0,1000],[100,2,60000,0],[100,2,NaN,1000]])assert.equal(profit(...args),null);
});
