const {test}=require('node:test'),assert=require('node:assert/strict');
const client=require('../js/v3/sales-read-model'),server=require('../cotizador/commercial-models/sales-read-model');
function sale(){return {id:'VENTA-FICTICIA',conIva:true,items:[{cod:'FICTICIO',qty:5,punit:1.34,disc:35,sub:4.36}],descuentoGeneral:0,subtotal:4.36,iva:.92,total:5.28};}
test('lector y servidor conservan cadena exacta de redondeo del escritor',()=>{for(const model of [client,server]){const s=sale(),before=JSON.stringify(s);assert.equal(model.saleTotal(s),5.28);assert.equal(JSON.stringify(s),before);}});
test('no acepta importes modificados ni omite control del renglón',()=>{for(const edit of [s=>s.total=5.29,s=>s.items[0].sub=4.37,s=>s.iva=.93,s=>s.subtotal=4.37,s=>s.items[0].punit=1.35]){const s=sale();edit(s);assert.notEqual(server.saleTotal(s),s.total);}});
