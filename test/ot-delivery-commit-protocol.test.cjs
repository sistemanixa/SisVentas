'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Protocol=require('../cotizador/ot-delivery-commit-protocol'),Policy=require('../cotizador/ot-lifecycle-policy');
const base='sisventas/ordenes_trabajo/O1',lease={actorUid:'u',opId:'operation1'},original={ventaFbKey:'S1',materiales:[{cod:'P',productoKey:'P1',vendida:3,entregada:0}]};
function actor(kind){return {uid:'u',opId:lease.opId,mode:'user',operation:kind==='stockrepair'?'ot-office-count':'ot-lifecycle',otLifecycle:Policy.issue({uid:'u',otKey:'O1',saleKey:'S1',operationId:lease.opId,kind,role:'admin',permissionRevision:7})};}
const run=(patch,who={},before=original,extra={})=>Protocol.claims({patch,actor:who,lease,read:async p=>p===base?structuredClone(before):extra[p]??null});
for(const shape of ['record','leaf','nested','atomic','delete'])test('untyped delivery denied '+shape,async()=>{
 const before=structuredClone(original);before.materiales[0].entregada=1;
 const patch=shape==='record'?{[base]:{...before,materiales:[{...before.materiales[0],entregada:2}]}}:shape==='leaf'?{[base+'/materiales/0/entregada']:2}:shape==='nested'?{[base+'/materiales']:[{...before.materiales[0],entregada:2}]}:shape==='atomic'?{[base+'/materiales/0/entregada']:2,[base+'/audit']:[{note:'fiction'}]}:{[base]:null};
 for(const who of [{}, {claims:{svOTDeliveryUnchanged:true,svOTDeliveryCommitVersion:1}}, {...actor('delivery'),otLifecycle:{...actor('delivery').otLifecycle}},actor('close'),actor('return'),actor('stockrepair')])await assert.rejects(run(patch,who,before),/protocolo autorizado/);
});
for(const path of ['sisventas','sisventas/ordenes_trabajo'])test('ancestor patches fail closed '+path,async()=>assert.rejects(run({[path]:{}}),/protocolo autorizado/));
test('notes and authorized classifications/stock repair preserve unchanged delivery proof',async()=>{
 const before=structuredClone(original);before.materiales[0].entregada=2;before.materiales[0].custodiaActiva=true;
 for(const [who,patch]of [[{}, {[base+'/nota']:'fictitious'}],[actor('custody'),{[base+'/materiales/0/instalada']:1}],[actor('return'),{[base+'/materiales/0/devuelta']:1}],[actor('stockrepair'),{[base+'/materiales/0/stockRevision']:1}],[actor('close'),{[base+'/estado']:'completada'}]])assert.deepEqual(await run(patch,who,before),{svOTDeliveryUnchanged:true,svOTDeliveryCommitVersion:1,svOTDeliveryHistoricalVerified:false});
});
test('valid delivery is typed and binds every affected OT',async()=>{
 assert.equal((await run({[base+'/materiales/0/entregada']:2},actor('delivery'))).svOTDeliveryUnchanged,false);
 await assert.rejects(run({[base+'/materiales/0/entregada']:2,'sisventas/ordenes_trabajo/O2/materiales/0/entregada':1},actor('delivery')),/protocolo autorizado/);
});
test('remito-only edits, row reorder and delivery allocation changes require typed delivery',async()=>{
 const before={...original,materiales:[{...original.materiales[0],entregada:2,custodiaActiva:true},{cod:'P2',entregada:1,custodiaActiva:true}]};
 for(const patch of [{[base+'/remitosEntrega/r1']:{items:[{cantidad:2}]}},{[base+'/materiales']:before.materiales.toReversed()},{[base+'/materiales/0/productoKey']:'P2'},{[base+'/ventaFbKey']:'S2'}])await assert.rejects(run(patch,{},before),/protocolo autorizado/);
});
test('creation of an OT with zero delivery remains unchanged',async()=>assert.equal((await run({[base]:original},{},null)).svOTDeliveryUnchanged,true));
test('overlapping or prototype patches fail closed',async()=>{
 await assert.rejects(run({[base]:original,[base+'/materiales/0/entregada']:2}),/protocolo autorizado/);
 await assert.rejects(run({[base+'/__proto__/entregada']:2}),/protocolo autorizado/);
});
test('real store overwrites actor attestation flags and emits no PATCH for untyped delivery',async()=>{
 const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store'),calls=[];
 const store=createLaborRtdbStore({databaseURL:'https://fixture.invalid',accessToken:async()=>'fiction',fetchImpl:async(url,options)=>{calls.push({url:new URL(url),options});return {ok:true,json:async()=>original,body:{cancel:async()=>{}}};}});
 const who={uid:'u',mode:'user',claims:{svOTDeliveryUnchanged:true,svOTDeliveryCommitVersion:1,svOTDeliveryHistoricalVerified:true}};
 await assert.rejects(store.commit({[base+'/materiales/0/entregada']:2},lease,who),/protocolo autorizado/);
 assert.equal(calls.some(c=>c.options.method==='PATCH'),false);
 await store.commit({[base+'/nota']:'fiction'},lease,who);
 const claim=JSON.parse(calls.at(-1).url.searchParams.get('auth_variable_override')).token;
 assert.equal(claim.svOTDeliveryUnchanged,true);assert.equal(claim.svOTDeliveryHistoricalVerified,false);
});
test('historical custody initialization requires the existing model and verified stock receipt',async()=>{
 const Rows=require('../cotizador/ot-material-rows-model'),before={...original,items:[{cod:'LEGACY',productoKey:'P2',qty:1,adicionalOT:true}]},after=Rows.persisted(Rows.view(before)),receipt='b'.repeat(64);
 Object.assign(after[1],{entregada:1,custodiaActiva:true,instalada:1,stockRegistro:receipt,stockRevision:1});
 const patch={[base+'/materiales']:after},stockPath='sisventas/inventario_operativo/P2/rendicionesOT/'+receipt;
 await assert.rejects(run(patch,actor('custody'),before),/protocolo autorizado/);
 const proof=await run(patch,actor('custody'),before,{[stockPath]:{ot:'O1',instalada:1,revision:1}});
 assert.equal(proof.svOTDeliveryUnchanged,false);assert.equal(proof.svOTDeliveryHistoricalVerified,true);
 const invalid=structuredClone(after);invalid[1].entregada=2;
 await assert.rejects(run({[base+'/materiales']:invalid},actor('custody'),before,{[stockPath]:{ot:'O1',instalada:1,revision:1}}),/histórico/);
});
