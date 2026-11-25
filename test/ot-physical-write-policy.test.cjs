'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Policy=require('../cotizador/ot-physical-write-policy'),Lifecycle=require('../cotizador/ot-lifecycle-policy');
const original={estado:'en_curso',ventaFbKey:'sale',materiales:[{cod:'X',entregada:2,instalada:1,devueltaPendiente:1,stockRegistro:'r',stockRevision:1,custodiaActiva:true}],checks:{preparacion:[false]},firmaClienteUrl:'old'};
const base='sisventas/ordenes_trabajo/ot';
const check=(patch,actor={},lease={},value=original)=>Policy.claims({patch,actor,lease,read:async path=>{assert.equal(path,base);return structuredClone(value);}});
test('metadata notes, signature and checklist remain physically unchanged',async()=>{
 const claims=await check({[base+'/checks/preparacion/0']:true,[base+'/firmaClienteUrl']:'new',[base+'/notasTecnico/n']:{texto:'Fiction'},[base+'/obs']:'Fiction'});assert.equal(claims.svOTPhysicalUnchanged,true);
});
for(const field of ['instalada','devueltaPendiente','devuelta','enTecnico','danada','faltante','stockRegistro','stockRevision','stockPendiente','stockBaseInstalada','productoKey','ventaDestinoFbKey'])test('generic metadata cannot change physical field '+field,async()=>{
 await assert.rejects(check({[base+'/materiales/0/'+field]:field==='stockRegistro'?'other':3}),{code:'SV_OT_PHYSICAL_COMMAND_REQUIRED'});
});
test('root replacement, closed state, origin change and hidden items activity are protected',async()=>{
 for(const patch of [{[base+'/estado']:'completada'},{[base+'/ventaFbKey']:'other'},{[base+'/items']:[{cod:'HIDDEN',instalada:1}]},{[base]:null},{'sisventas/ordenes_trabajo':{}}])await assert.rejects(check(patch),{code:'SV_OT_PHYSICAL_COMMAND_REQUIRED'});
});
test('new virgin materials are permitted but physical initial quantities require command',async()=>{
 const ot={estado:'pendiente',materiales:[{cod:'X',vendida:2,instalada:0,entregada:0,custodiaActiva:false}]};assert.equal((await check({[base]:ot},{},{},null)).svOTPhysicalUnchanged,true);await assert.rejects(check({[base]:{...ot,materiales:[{cod:'X',instalada:1}]}},{},{},null));
});
test('only server issued capability bound to operation, lease and OT delegates physical validation',async()=>{
 const lease={actorUid:'u',opId:'fiction-op'},input={uid:'u',otKey:'ot',saleKey:'sale',operationId:'fiction-op',kind:'custody',role:'admin'},actor={uid:'u',opId:'fiction-op',mode:'user',operation:'ot-lifecycle',otLifecycle:Lifecycle.issue(input)};
 assert.equal((await check({[base+'/materiales/0/instalada']:2},actor,lease)).svOTPhysicalUnchanged,false);
 await assert.rejects(check({[base+'/materiales/0/instalada']:2},{...actor,otLifecycle:{...actor.otLifecycle}},lease));
 await assert.rejects(check({[base+'/materiales/0/instalada']:2},actor,{...lease,opId:'other'}));
 await assert.rejects(check({[base+'/materiales/0/instalada']:2},{...actor,otLifecycle:Lifecycle.issue({...input,otKey:'other'})},lease));
});
test('overlapping patches never rely on insertion order',async()=>{
 await assert.rejects(check({[base+'/materiales']:original.materiales,[base+'/materiales/0/instalada']:2}));
});
test('pristine deletion accepted by existing deletion policy keeps neutral physical fingerprint',async()=>{const original={estado:'pendiente',custodiaIniciada:false,remitosEntrega:{},materiales:[{cod:'X',vendida:2,instalada:0,entregada:0,stockRevision:0,stockPendiente:false,stockRegistro:''}]};require('../cotizador/ot-delete-policy').assertNoActivity(original);assert.equal((await check({[base]:null},{},{},original)).svOTPhysicalUnchanged,true);assert.throws(()=>require('../cotizador/ot-delete-policy').assertNoActivity({...original,materiales:[{cod:'X',instalada:1}]}));});
