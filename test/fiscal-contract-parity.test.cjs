'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {functionSource,load}=require('./helpers/app-functions.cjs');
const Fiscal=require('../cloud-functions/emitir-factura/fiscal-contract.cjs');
// Git puede materializar CRLF en Windows; el helper de app entrega LF.
// La comparación sigue siendo literal tras normalizar sólo los saltos de línea.
const source=fs.readFileSync('cloud-functions/emitir-factura/fiscal-contract.cjs','utf8').replace(/\r\n/g,'\n');
test('La preparación fiscal desplegable conserva exactamente las funciones canónicas activas',()=>{
 for(const name of Fiscal.names)assert.ok(source.includes(functionSource(name)),name+' debe conservar sus reglas canónicas');
});
test('Servidor y frontend conservan descuentos, Sin IVA, aliases y cierre al centavo sin tocar la venta',()=>{
 const app={};load(app,Fiscal.names);
 const cases=[
  {items:[{qty:1,punit:100}],subtotal:100,conIva:true,iva:21,total:121},
  {items:[{qty:1,punit:100}],subtotal:100,conIva:false,iva:0,total:100},
  {items:[{qty:1,punit:100,disc:10}],subtotal:90,conIva:true,descuento:10,iva:18.9,total:108.9},
  {items:{a:{cantidad:'3',precio:'100,00'}},subtotal:272.73,conIva:true,iva:57.27,total:330}
 ];
 for(const sale of cases){const before=structuredClone(sale),client=app.prepararVentaParaFacturacion(sale,'FACTURA B'),server=Fiscal.prepararVentaParaFacturacion(sale,'FACTURA B');assert.deepEqual(JSON.parse(JSON.stringify(server)),JSON.parse(JSON.stringify(client)));assert.deepEqual(sale,before);assert.equal(server.totalEsperado,sale.conIva===false?121:sale.total);}
});
