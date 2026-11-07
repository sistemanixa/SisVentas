const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const ctx={window:{prodData:{c:{codigo:'C',unidad:'metro'}}}};
vm.createContext(ctx);ctx.window.SVCommercialMoney=require('../js/core/commercial-money.v1');vm.runInContext(fs.readFileSync('js/modules/ot-material-custody.js','utf8'),ctx);
test('entrega suma cantidades y distingue renglones',()=>{
 assert.equal(ctx.window.otCustodiaDescripcionEntrega([{vendida:4,unidad:'unidad'},{vendida:2,unidad:'unidad'},{vendida:3,unidad:'unidad'}]),'9 unidades en 3 renglones');
});
test('no mezcla metros de cable con unidades de equipos',()=>{
 assert.equal(ctx.window.otCustodiaDescripcionEntrega([{vendida:4,unidad:'unidad'},{cod:'C',vendida:20.5}]),'4 unidades + 20,5 metros en 2 renglones');
});
