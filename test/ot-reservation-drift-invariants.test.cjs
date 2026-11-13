'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {confirm}=require('../cotizador/ot-physical-confirmation-model');
const Exception=require('../cotizador/ot-general-consumption-exception');
const clone=structuredClone;
const command=extra=>({kind:'installation',otKey:'fictionalOT',rowKey:'0',productKey:'fictionalProduct',allocation:'own',operationId:'fictionalOperation',at:1,actor:{uid:'fictionalAdmin',role:'admin',allowed:true},heldByOthers:0,beforeDelivered:3,targetDelivered:3,beforeInstalled:0,targetInstalled:3,...extra});
const deficit=inv=>Object.values(inv.asignaciones).reduce((s,a)=>s+a.reservado,0)-inv.reservado;
test('installation retires only physically consumed own phantom reservation and preserves unrelated consumption',()=>{
 const inventory={general:3,reservado:1,consumido:2,asignaciones:{own:{reservado:3,consumido:0,liberado:0},foreign:{reservado:0,consumido:2,liberado:0}},custom:'unchanged'},original=clone(inventory),c=command({inventory});
 const r=confirm(c);assert.equal(r.inventory.general,1);assert.equal(r.inventory.reservado,0);assert.equal(r.inventory.consumido,5);assert.equal(r.inventory.asignaciones.own.reservado,0);assert.deepEqual(r.inventory.asignaciones.foreign,original.asignaciones.foreign);assert.equal(deficit(r.inventory),0);assert.equal(r.regularization,0);assert.deepEqual(inventory,original);assert.deepEqual(confirm({...c,inventory:r.inventory}).inventory,r.inventory);assert.deepEqual(r.inventory.confirmacionesOT[c.operationId].r0.stockDiscrepancy,{kind:'reserved-total-existing',assignedReserved:3,globalReserved:1,difference:2,corrected:true,ownReservationReleased:2});
 const ctx={...c,before:original,after:r.inventory,receipt:r.receipt,revision:0};assert.equal(Exception.validate(ctx).allowed,true);
 for(const tamper of [x=>x.after.asignaciones.foreign.consumido++,x=>x.after.general++,x=>x.after.reservado++,x=>x.after.confirmacionesOT[c.operationId].r0.stockDiscrepancy.ownReservationReleased++,x=>delete x.after.confirmacionesOT[c.operationId].r0.stockDiscrepancy.ownReservationReleased]){const altered=clone(ctx);tamper(altered);assert.throws(()=>Exception.validate(altered));}
});
test('delivery followed by installation consumes the newly backed receipt once despite unrelated deficit',()=>{
 const inventory={general:3,reservado:5,consumido:0,asignaciones:{foreign:{reservado:6,consumido:0,liberado:0}}},original=clone(inventory);
 const delivery=command({kind:'delivery',inventory,beforeDelivered:0,targetDelivered:1,targetInstalled:0}),d=confirm(delivery);
 assert.equal(d.inventory.general,2);assert.equal(d.inventory.reservado,6);assert.equal(d.inventory.asignaciones.own.reservado,1);assert.equal(deficit(d.inventory),1);assert.deepEqual(d.inventory.asignaciones.foreign,original.asignaciones.foreign);
 const installation=command({inventory:d.inventory,operationId:'fictionalInstall',beforeDelivered:1,targetDelivered:1,targetInstalled:1,receipt:d.receipt,revision:d.revision}),i=confirm(installation);
 assert.equal(i.inventory.general,2);assert.equal(i.inventory.consumido,1);assert.equal(i.inventory.reservado,5);assert.equal(i.inventory.asignaciones.own.reservado,0);assert.equal(deficit(i.inventory),1);assert.deepEqual(i.inventory.asignaciones.foreign,original.asignaciones.foreign);assert.deepEqual(confirm({...installation,inventory:i.inventory}).inventory,i.inventory);
});
test('delivery does not reuse an unbacked own historical reservation as physical backing',()=>{
 const inventory={general:3,reservado:1,consumido:0,asignaciones:{own:{reservado:3,consumido:0,liberado:0}}};
 const d=confirm(command({kind:'delivery',inventory,beforeDelivered:0,targetInstalled:0}));assert.equal(d.inventory.general,1);assert.equal(d.inventory.reservado,3);assert.equal(d.inventory.asignaciones.own.reservado,5);assert.equal(deficit(d.inventory),2);assert.equal(d.inventory.rendicionesOT[d.receipt].enReserva,3);
});
test('partial installation cannot retire more own reservation than its confirmed physical delta',()=>{
 const inventory={general:3,reservado:1,consumido:2,asignaciones:{own:{reservado:3,consumido:0,liberado:0},foreign:{reservado:2,consumido:2,liberado:0}}};
 const r=confirm(command({inventory,targetInstalled:1}));assert.equal(r.inventory.asignaciones.own.reservado,2);assert.equal(r.inventory.reservado,1);assert.equal(r.inventory.general,2);assert.equal(r.inventory.consumido,3);assert.deepEqual(r.inventory.asignaciones.foreign,inventory.asignaciones.foreign);assert.equal(deficit(r.inventory),3);
});
