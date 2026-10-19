'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
process.env.TZ='America/Argentina/Buenos_Aires';
function at(instant,extra={},names=[]){
 class Clock extends Date { constructor(...args){super(...(args.length?args:[instant]));} static now(){return Date.parse(instant);} }
 return load({Date:Clock,...extra},names);
}
test('defaults de comisiones y mes laboral coinciden con el día local al cambiar mes y año UTC',()=>{
 for(const [instant,day,month] of [['2026-02-01T01:30:00Z','2026-01-31','2026-01'],['2027-01-01T02:30:00Z','2026-12-31','2026-12'],['2026-02-01T03:01:00Z','2026-02-01','2026-02']]){
  const c=at(instant,{},['_comisionNormFecha','_hsexMesActual']);
  assert.equal(c._comisionNormFecha(''),day);assert.equal(c._hsexMesActual(),month);
  assert.equal(c._comisionNormFecha('2024-02-29'),'2024-02-29');
 }
});
test('referencia de proveedor nueva usa día local, conserva fecha e instante históricos y no muta origen',()=>{
 const instant='2027-01-01T01:00:00Z';
 const c=at(instant,{obtenerDolarReferenciaProducto:()=>({valor:1500,tipo:'oficial'}),normalizarUrlProveedorProducto:v=>v,factorIvaProveedorProducto:()=>1,costoEnvioProveedorProducto:()=>0},['completarReferenciaProveedorProducto']);
 const input={nombre:'Ficticio',precio:1500,actualizado:'2020-05-10',actualizadoEn:100};
 const previous=JSON.stringify(input);const result=c.completarReferenciaProveedorProducto(input,'','manual');
 assert.equal(result.actualizado,'2020-05-10');assert.equal(result.actualizadoEn,100);assert.equal(JSON.stringify(input),previous);
 const fresh=c.completarReferenciaProveedorProducto({nombre:'Nuevo ficticio',precio:1500},'','manual');
 assert.equal(fresh.actualizado,'2026-12-31');assert.equal(fresh.actualizadoEn,Date.parse(instant));
});
