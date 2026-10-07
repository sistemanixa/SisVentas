const {test}=require('node:test'),assert=require('node:assert/strict');const {listHistory,listSavings}=require('../js/modules/paraguay-shopping-access');
test('fechas de creación, agregado y primera compra sobreviven guardados y no inventan historia',()=>{
const first=listHistory(null,{a:1},{},100);assert.equal(first.creadoEn,100);assert.equal(first.fechasProductos.a.agregadoEn,100);
const old={...first,productos:{a:1},comprasFinales:{}};const bought=listHistory(old,{a:1,b:1},{a:{estado:'comprado'}},200);assert.equal(bought.creadoEn,100);assert.equal(bought.fechasProductos.a.compradoEn,200);assert.equal(bought.fechasProductos.b.agregadoEn,200);
const again=listHistory({...old,...bought,comprasFinales:{a:{estado:'comprado'}}},{a:1},{a:{estado:'comprado'}},300);assert.equal(again.fechasProductos.a.compradoEn,200);
assert.deepEqual(listHistory({productos:{a:1},comprasFinales:{a:{estado:'comprado'}}},{a:1},{a:{estado:'comprado'}},500),{fechasProductos:null});
});
test('ahorro ML usa cantidad real, monedas comparables y omite no comprados o sin referencia',()=>{
const p={proveedores:[{nombre:'Mercado Libre',precio:600000}]};const products={a:p,b:p,c:{},d:p};
const list={productos:{a:5,b:1,c:1,d:1},comprasFinales:{a:{cantidad:2,precioUnitario:400,moneda:'USD',estado:'comprado'},b:{cantidad:1,precioUnitario:650000,moneda:'ARS',estado:'comprado'},c:{cantidad:1,precioUnitario:1,moneda:'USD',estado:'comprado'},d:{cantidad:1,precioUnitario:100,moneda:'USD',estado:'pendiente'}}};
assert.deepEqual(listSavings(list,products,1000),{ars:350000,usd:350,included:2,omitted:2,units:3});
assert.equal(listSavings(list,products,0).included,1);
});
