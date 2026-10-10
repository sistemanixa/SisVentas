const {test}=require('node:test'),assert=require('node:assert/strict');const {listHistory,listSavings}=require('../js/modules/paraguay-shopping-access');
test('fechas de creación, agregado y primera compra sobreviven guardados y no inventan historia',()=>{
const first=listHistory(null,{a:1},{},100);assert.equal(first.creadoEn,100);assert.equal(first.fechasProductos.a.agregadoEn,100);
const old={...first,productos:{a:1},comprasFinales:{}};const bought=listHistory(old,{a:1,b:1},{a:{estado:'comprado'}},200);assert.equal(bought.creadoEn,100);assert.equal(bought.fechasProductos.a.compradoEn,200);assert.equal(bought.fechasProductos.b.agregadoEn,200);
const again=listHistory({...old,...bought,comprasFinales:{a:{estado:'comprado'}}},{a:1},{a:{estado:'comprado'}},300);assert.equal(again.fechasProductos.a.compradoEn,200);
assert.deepEqual(listHistory({productos:{a:1},comprasFinales:{a:{estado:'comprado'}}},{a:1},{a:{estado:'comprado'}},500),{fechasProductos:null});
});

test('ganancia usa venta acordada y cantidad comprada, sin depender del catálogo ni ML',()=>{
 const list={productos:{a:5,b:1,c:1},comprasFinales:{a:{estado:'comprado',cantidad:2,precioUnitario:400,moneda:'USD',precioVentaUnitarioUSD:500},b:{estado:'comprado',cantidad:1,precioUnitario:650000,moneda:'ARS',precioVentaUnitarioUSD:600},c:{estado:'comprado',cantidad:1,precioUnitario:1,moneda:'USD'}}};
 const result=listSavings(list,{a:{ventaARS:999999,proveedores:[{nombre:'Mercado Libre',precio:99999999}]}},1000);
 assert.equal(result.usd,150);assert.equal(result.ars,150000);assert.equal(result.included,2);assert.equal(result.missingSale,1);assert.equal(result.units,3);
 assert.deepEqual(listSavings(list,{},1000),result);
});
test('sin precio histórico no inventa ganancia; compra pendiente y PYG no comparables',()=>{
 const {itemProfit}=require('../js/modules/paraguay-shopping-access');
 assert.equal(itemProfit({precioUnitario:10,estado:'comprado',cantidad:1},1000).reason,'sale');
 assert.equal(itemProfit({precioVentaUnitarioUSD:100},1000).reason,'purchase');
 assert.equal(itemProfit({precioVentaUnitarioUSD:100,precioUnitario:10,estado:'comprado',cantidad:1,moneda:'PYG'},1000).reason,'currency');
 assert.equal(itemProfit({precioVentaUnitarioUSD:0,precioUnitario:10,estado:'comprado',cantidad:1},1000).usd,-10);
});
test('precio acordado se captura una vez para nuevos ítems; no migra históricos con precio actual',()=>{
 const {captureAgreedSale}=require('../js/modules/paraguay-shopping-access');
 const a=captureAgreedSale({}, {ventaARS:500000,iva:0},1000,true);assert.equal(a.precioVentaUnitarioUSD,500);
 captureAgreedSale(a,{ventaARS:900000,iva:0},1200,true);assert.equal(a.precioVentaUnitarioUSD,500);
 assert.deepEqual(captureAgreedSale({}, {ventaARS:900000,iva:0},1000,false),{});
});
