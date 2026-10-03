const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
const c=load({},['cambiosRevisionManoObra']);
test('revisión de mano de obra sincroniza costo, venta y referencia USD',()=>{
 const r=c.cambiosRevisionManoObra({},100000,130000,1540,123);
 for(const k of ['compra','compraARS','precioGremio','costoRealArs','precioArsPublicado'])assert.equal(r[k],100000);
 assert.equal(r.ventaARS,130000);assert.equal(r.venta,130000);assert.equal(r.margenDeseado,30);
 assert.equal(r.compraUSD,64.94);assert.equal(r.ventaUSD,84.42);assert.equal(r.precioActualizadoEn,123);
});
test('costo cero y dólar ausente no generan importes inválidos',()=>{
 const r=c.cambiosRevisionManoObra({},0,100,0,123);
 assert.equal(r.margenDeseado,0);assert.equal(r.compraARS,0);assert.equal(r.compraUSD,undefined);
 for(const cost of [-1,NaN,Infinity])assert.throws(()=>c.cambiosRevisionManoObra({},cost,100,0,123));
});
