'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{create}=require('./helpers/ot-active-flow-fixture.cjs');
test('active OFF path uses server hash with fresh backend validation and one stock effect',async()=>{
 const f=await create();const result=await f.save();assert(result.confirmed);assert.equal(f.commits.length,1);assert.equal(f.client.filter(r=>r.kind==='SDK').length,0);assert.equal(f.clientRoot.SVLaborWriteRecovery.state(),null);for(let i=0;i<12;i++)assert.equal(f.get('sisventas/inventario_operativo/product'+i).consumido,2);
});
test('lost client ACK resolves confirmed receipt without repeating stock movement',async()=>{
 const f=await create();f.loseClientAck();const task=f.save(),recovery=f.clientRoot.SVLaborWriteRecovery;
 for(let i=0;i<1000&&recovery.state()?.status!=='unknown';i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(recovery.state()?.status,'unknown');await recovery.check();const result=await task;assert(result.confirmed);assert.equal(f.commits.length,1);assert.equal(f.client.filter(r=>r.path==='/ot/ciclo').length,1);assert.equal(f.client.filter(r=>r.path==='/laboral/operacion').length,1);assert.equal(recovery.state(),null);assert.equal(f.storage.size,0);for(let i=0;i<12;i++)assert.equal(f.get('sisventas/inventario_operativo/product'+i).consumido,2);
});
test('prepared hash never replaces fresh server permission check',async()=>{
 const f=await create(),prepared=await f.clientRoot.SVOTLifecycle.prepare(f.context,{kind:'custody'});f.set('sv_permisos/admin/acciones/ot/rendirMateriales',false);
 await assert.rejects(f.clientRoot.SVOTLifecycle.save(f.context,f.draft,{kind:'custody',prepared}));assert.equal(f.commits.length,0);assert.equal(f.client.filter(r=>r.kind==='SDK').length,0);
});
test('available hash still rejects a changed original before stock commit',async()=>{
 const f=await create(),ready=await f.api.available(f.identity,{otKey:'ot',kind:'custody'});f.set('sisventas/ordenes_trabajo/ot/obs','Concurrent fictional edit');
 await assert.rejects(f.api.execute(f.identity,{...f.body,expectedOTHash:ready.expectedOTHash}));assert.equal(f.commits.length,0);for(let i=0;i<12;i++)assert.equal(f.get('sisventas/inventario_operativo/product'+i).consumido,0);
});
