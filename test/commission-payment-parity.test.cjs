'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
const calculations=require('../cotizador/commission-calculations');
const {createCommissionOperations}=require('../cotizador/commission-operations');
test('Frontend y servidor conservan el resumen legacy sin detalle y excluyen los pagos anulados',()=>{
 const app={_gastosPagosCache:new WeakMap()};load(app,['_gastoPagosArray','pagoGastoEstaAnulado','totalPagadoGasto','normalizarEstadoGasto']);
 const cases=[
  [null,0],
  [{monto:100,montoPagado:30},30],
  [{monto:100,montoPagado:999,pagos:{a:{monto:20},b:{monto:40,anulado:true}}},20],
  [{monto:100,saldoPagadoLegacy:30,pagos:{a:{monto:20},b:{monto:40,estado:'anulado'}}},50],
  [{monto:100,saldoPagadoLegacy:30,pagos:{a:{monto:70}}},100],
  [{monto:100,saldoPagadoLegacy:30,pagos:[{monto:20,anulado:true}]},30],
  [{monto:100,saldoPagadoLegacy:-5,pagos:[{monto:20}]},20]
 ];
 for(const [record,total]of cases){const before=structuredClone(record);assert.equal(calculations.totalPagadoGasto(record),total);assert.equal(app.totalPagadoGasto(record),total);assert.equal(calculations.normalizarEstadoGasto(record),app.normalizarEstadoGasto(record));assert.deepEqual(record,before);}
});

test('Redistribuir no considera impaga una comisión con base legacy aunque sus pagos nuevos estén anulados',async()=>{
 const root={config:{maxComisionPct:10},gastos:{g:{tipoPagable:'comision',ventaId:'V-FICTICIA',gananciaBase:1000,pct:10,monto:100,estado:'aprobado',aprobadoPor:'Autor anterior',saldoPagadoLegacy:30,montoPagado:30,pagos:{nuevo:{monto:20,anulado:true}}}},ctaemp:{}};
 const before=structuredClone(root),service=createCommissionOperations({auth:{},db:{},transaction:async update=>{const next=update(structuredClone(root));return {committed:!!next};}});
 await assert.rejects(service.redistribute({nombre:'Admin ficticio'},{grupo:{clave:'V-FICTICIA',items:[{...root.gastos.g,fbKey:'g'}]},valores:[{fbKey:'g',pct:5}]}),{statusCode:409});assert.deepEqual(root,before);
});
