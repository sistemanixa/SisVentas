'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Client=require('../js/modules/ot-stock-consumption.v1');
const Server=require('../cotizador/ot-stock-consumption-model');
for(const [name,Stock]of [['browser',Client],['server',Server]]){
 test(name+' preserves sub-millionth quantities instead of rounding stock',()=>{
  const inv={general:0,reservado:1,consumido:0,asignaciones:{own:{reservado:1,consumido:0}}};
  const command={before:0,target:0.1234567,revision:0,receipt:'r',allocation:'own',ot:'ot'};
  const next=Stock.plan(inv,command);
  assert.equal(next.consumido,0.1234567);assert.equal(next.reservado,0.8765433);
  assert.equal(next.rendicionesOT.r.instalada,0.1234567);assert.equal(next.rendicionesOT.r.deReserva,0.1234567);
  assert.deepEqual(Stock.plan(next,command),next,'same receipt is idempotent');
  const corrected=Stock.plan(next,{...command,before:0.1234567,target:0.0000001,revision:1});
  assert.equal(corrected.consumido,0.0000001);assert.equal(corrected.reservado,0.9999999);
  assert.equal(corrected.rendicionesOT.r.instalada,0.0000001);assert.equal(inv.consumido,0);
 });
 test(name+' consumes decimal fractions exactly through the shared quantity model',()=>{
  const inv={general:0,reservado:0.3,consumido:0,asignaciones:{own:{reservado:0.3,consumido:0}}};
  const command={before:0,target:0.1,revision:0,receipt:'r',allocation:'own',ot:'ot'};
  const first=Stock.plan(inv,command),next=Stock.plan(first,{...command,before:0.1,target:0.3,revision:1});
  assert.equal(first.reservado,0.2);assert.equal(next.reservado,0);assert.equal(next.consumido,0.3);
  assert.equal(next.rendicionesOT.r.deReserva,0.3);assert.equal(next.general,0);
 });
}
