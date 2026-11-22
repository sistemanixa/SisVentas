'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/ot-material-state-fixture.cjs');
const path='sisventas/ordenes_trabajo/ot';
function documented(ot,keyed){
 Object.assign(ot,{estado:'en_progreso',progreso:100,firmada:true,firmaClienteUrl:'https://fixture.invalid/signature',firmaTecnicoUrl:'https://fixture.invalid/technician',nombreConformidad:'Firmante ficticio',adjuntos:{photo:{url:'https://fixture.invalid/photo',nombre:'Foto ficticia'}},fotosAntes:['https://fixture.invalid/before'],checks:{preparacion:keyed?{0:true,1:true}:[true,true],instalacion:keyed?{0:true}:[true],verificacion:keyed?{0:false,1:true}:[false,true]}});
 const audit=[...Object.values(ot.audit),{accion:'OT iniciada'},{accion:'✓ Completó toda la etapa: Preparación'},{accion:'✗ Desmarcó toda la etapa: Preparación'}];ot.audit=keyed?Object.fromEntries(audit.map((row,i)=>['event'+i,row])):audit;return ot;
}
for(const keyed of [false,true])test('documentary signature, attachments and '+(keyed?'RTDB keyed':'array')+' checklist survive one delivery and replay',async()=>{
 const f=await fixture(),original=documented(f.get(path),keyed);f.setOT(original);const before=structuredClone(f.state.sisventas),body=f.body();
 await f.api.execute(f.identity,body);const saved=f.get(path);
 for(const field of ['firmada','firmaClienteUrl','firmaTecnicoUrl','nombreConformidad','adjuntos','fotosAntes','checks','progreso','estado'])assert.deepEqual(saved[field],original[field],field);
 assert.deepEqual(Object.values(saved.audit).slice(0,Object.values(original.audit).length),Object.values(original.audit));
 assert.equal(saved.materiales[0].entregada,2);assert.equal(Object.keys(saved.remitosEntrega).length,1);assert.equal(f.commits.length,1);
 for(const domain of ['ventas','pagos','comisiones'])assert.deepEqual(f.get('sisventas/'+domain),before[domain]);
 const inventory=f.get('sisventas/inventario_operativo');await f.api.execute(f.identity,body);assert.equal(f.commits.length,1);assert.deepEqual(f.get('sisventas/inventario_operativo'),inventory);
});
test('lost ACK of documentary delivery resolves the same operation without a second stock change',async()=>{
 const f=await fixture();f.setOT(documented(f.get(path),true));const body=f.body();f.loseAck();await assert.rejects(f.api.execute(f.identity,body));assert.equal(f.commits.length,1);const inventory=f.get('sisventas/inventario_operativo'),saved=f.get(path);await f.api.execute(f.identity,body);assert.equal(f.commits.length,1);assert.deepEqual(f.get(path),saved);assert.deepEqual(f.get('sisventas/inventario_operativo'),inventory);
});
for(const change of ['signature-type','unknown-physical-history'])test('documentary compatibility still rejects '+change,async()=>{
 const f=await fixture(),ot=documented(f.get(path),false);if(change==='signature-type')ot.firmaClienteUrl={unsafe:true};else ot.audit.push({accion:'Entrega anterior sin datos',kind:'delivery'});f.setOT(ot);const before=structuredClone(f.state.sisventas);await assert.rejects(f.api.execute(f.identity,f.body()));assert.equal(f.commits.length,0);assert.deepEqual(f.state.sisventas,before);
});
test('delivery to installation keeps one remito and rejects deletion of physical activity without incidental stock writes',async()=>{
 const f=await fixture(),before=structuredClone(f.state.sisventas),delivery=f.body();await f.api.execute(f.identity,delivery);
 const delivered=f.get(path),materials=structuredClone(delivered.materiales);materials[0].instalada=2;materials[0].stockRevision++;
 const installation=f.body('custody',{materiales:materials,custodiaIniciada:true});await f.api.execute(f.identity,installation);await f.api.execute(f.identity,installation);
 const installed=f.get(path);assert.equal(installed.materiales[0].instalada,2);assert.equal(Object.keys(installed.remitosEntrega).length,1);assert.equal(f.commits.length,2);
 const inventory=f.get('sisventas/inventario_operativo');assert.equal(inventory.p.consumido,2);assert.deepEqual(inventory.p.asignaciones.foreign,before.inventario_operativo.p.asignaciones.foreign);
 f.store.otDeleteFenceReady=true;const {createOTDeleteCommand}=require('../cotizador/ot-delete-command'),{digest}=require('../cotizador/labor-guard');
 const deletion=createOTDeleteCommand({guard:f.guard,store:f.store,enabled:true,verifyActor:async()=>{}});
 await assert.rejects(deletion.execute(f.identity,{id:'synthetic-delete-installed',otKey:'ot',expectedHash:digest(installed)}),error=>['SV_OT_DELETE_ACTIVITY','SV_OT_DELETE_LINKED'].includes(error.code));
 assert.equal(f.commits.length,2);assert.deepEqual(f.get(path),installed);assert.deepEqual(f.get('sisventas/inventario_operativo'),inventory);for(const domain of ['ventas','pagos','comisiones'])assert.deepEqual(f.get('sisventas/'+domain),before[domain]);
});
