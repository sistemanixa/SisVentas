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

test('compra personal tiene ganancia cero sin modificar precio acordado ni costo real',()=>{const {itemProfit,listSavings}=require('../js/modules/paraguay-shopping-access');const actual={compraPersonal:true,precioUnitario:591,precioVentaUnitarioUSD:872.45,cantidad:1,estado:'comprado',moneda:'USD'};assert.equal(itemProfit(actual,1535).usd,0);assert.equal(actual.precioUnitario,591);assert.equal(actual.precioVentaUnitarioUSD,872.45);assert.equal(listSavings({productos:{a:1},comprasFinales:{a:actual}},{},1535).usd,0);assert.equal(itemProfit({...actual,compraPersonal:false},1535).usd,281.45);});

test('ganancia descuenta envío editable y conserva compra personal en cero',()=>{const {itemProfit,captureAgreedSale}=require('../js/modules/paraguay-shopping-access');const a={precioVentaUnitarioUSD:872.45,precioUnitario:591,cantidad:1,estado:'comprado',moneda:'USD',proveedor:'Flytec'};captureAgreedSale(a,{proveedores:[{nombre:'Flytec',costoEnvioArs:107450}]},1535,false);assert.equal(a.costoEnvioUnitarioUSD,70);assert.equal(itemProfit(a,1535).usd,211.45);a.costoEnvioUnitarioUSD=80;captureAgreedSale(a,{proveedores:[{nombre:'Flytec',costoEnvioArs:100}]},1535,false);assert.equal(itemProfit(a,1535).usd,201.45);assert.equal(itemProfit({...a,compraPersonal:true},1535).usd,0);});

test('envío inicial coincide con los dólares enteros mostrados en la ficha',()=>{const {captureAgreedSale}=require('../js/modules/paraguay-shopping-access');const a={};captureAgreedSale(a,{proveedores:[{costoEnvioArs:107800}]},1535,false);assert.equal(a.costoEnvioUnitarioUSD,70);a.costoEnvioUnitarioUSD=72.5;captureAgreedSale(a,{proveedores:[{costoEnvioArs:107800}]},1535,false);assert.equal(a.costoEnvioUnitarioUSD,72.5);});

test('nuevo ítem conserva precio inicial del proveedor y precarga pagado sin marcar compra',()=>{const {captureAgreedSale}=require('../js/modules/paraguay-shopping-access');const product={ventaARS:900,iva:0,proveedores:[{nombre:'Proveedor',precioOriginal:597,monedaOriginal:'USD'}]};const a=captureAgreedSale({},product,1,true);assert.equal(a.precioProveedorInicialUSD,597);assert.equal(a.precioUnitario,597);assert.notEqual(a.estado,'comprado');product.proveedores[0].precioOriginal=650;a.precioUnitario=591;captureAgreedSale(a,product,1,true);assert.equal(a.precioProveedorInicialUSD,597);assert.equal(a.precioUnitario,591);assert.equal(captureAgreedSale({},product,1,false).precioUnitario,undefined);});
test('envío en USD guardado no cambia con la cotización ni se reconstruye desde pesos',()=>{const {captureAgreedSale}=require('../js/modules/paraguay-shopping-access');const product={proveedores:[{costoEnvioUSD:40,costoEnvioArs:61600}]};assert.equal(captureAgreedSale({},product,1535,false).costoEnvioUnitarioUSD,40);assert.equal(captureAgreedSale({},product,1700,false).costoEnvioUnitarioUSD,40);const a={costoEnvioUnitarioUSD:45};assert.equal(captureAgreedSale(a,product,1700,false).costoEnvioUnitarioUSD,45);});
