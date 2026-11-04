'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/dashboard-activity-aggregate-fixture.cjs');
const A=require('../js/core/dashboard-activity-aggregate-proposal');
const Month=require('../js/core/dashboard-budget-month-port-proposal');
const ROOT=Month.ROOT;
const monthRead=f=>f.ports.month.read({schema:1,context:A.snapshot(f.capture())});

for(const field of ['generation','revision','policyHash','ready','directCompatible'])test('monthly missing header coverage rejects: '+field,async()=>{
 const f=await fixture(),h=f.read(ROOT+'/read/u');delete h[field];f.set(ROOT+'/read/u',h);
 await assert.rejects(monthRead(f),/Uncertified budget header/);
 assert.equal(f.trace.filter(x=>x.path.includes('/months/')).length,0);
});

test('missing absence certificate is never a zero, even with no monthly members',async()=>{
 const f=await fixture();f.ctx.month='2026-12';f.ctx.asOfDay='2026-12-01';
 assert.equal((await monthRead(f)).value.records,0);
 f.set(ROOT+'/coverage/scopeAbsenceIsZero',null);
 await assert.rejects(monthRead(f),/no certified absence/);
});

test('removing both populated monthly metadata leaves indexed members and rejects',async()=>{
 const f=await fixture(),key=await Month.hash(['u','2026-11']);
 f.set(ROOT+'/months/u_u/'+key,null);f.set(ROOT+'/monthProof/u_u/'+key,null);
 await assert.rejects(monthRead(f),/still have indexed members/);
});

for(const field of ['dataEpoch','ventas','pagos','ordenes_trabajo','presupuestos'])test('monthly read retires when captured authority changes after header: '+field,async()=>{
 const f=await fixture(),signature=f.ctx.permissionSignature,user=f.auth.currentUser;let changed=false;
 f.setHook(path=>{if(!changed&&path===ROOT+'/read/u'){changed=true;if(field==='dataEpoch')f.ctx.dataEpoch++;else f.ctx.grants[field]=f.ctx.grants[field]==='own'?'all':'own';}});
 await assert.rejects(monthRead(f),{code:'SV_ACTIVITY_CONTEXT_RETIRED'});
 assert(changed);assert.equal(f.ctx.permissionSignature,signature);assert.equal(f.auth.currentUser,user);
 assert.equal(f.trace.filter(x=>x.path.includes('/months/')).length,0);
});

for(const field of ['dataEpoch','ventas','pagos','ordenes_trabajo','presupuestos'])test('fresh monthly transport retires during token wait before starting HTTP: '+field,async()=>{
 const f=await fixture();let release,network=0;const token=new Promise(r=>{release=r;});
 f.auth.currentUser.getIdToken=()=>token;
 const fresh=Month.createFresh({databaseURL:'https://qa-only.firebaseio.com/',expectedOrigin:'https://qa-only.firebaseio.com',auth:f.auth,capture:f.capture,valid:f.valid,fetchImpl:async()=>{network++;throw Error('Unexpected network');}});
 const pending=fresh({path:ROOT+'/read/u'});await Promise.resolve();
 if(field==='dataEpoch')f.ctx.dataEpoch++;else f.ctx.grants[field]=f.ctx.grants[field]==='own'?'all':'own';
 release('fake-token');await assert.rejects(pending,{code:'SV_ACTIVITY_CONTEXT_RETIRED'});assert.equal(network,0);
});

test('fresh monthly transport retires after decoding body if dataEpoch changed',async()=>{
 const f=await fixture();let decoded=0;
 const fresh=Month.createFresh({databaseURL:'https://qa-only.firebaseio.com/',expectedOrigin:'https://qa-only.firebaseio.com',auth:f.auth,capture:f.capture,valid:f.valid,fetchImpl:async()=>({ok:true,json:async()=>{decoded++;f.ctx.dataEpoch++;return {old:true};}})});
 await assert.rejects(fresh({path:ROOT+'/read/u'}),{code:'SV_ACTIVITY_CONTEXT_RETIRED'});assert.equal(decoded,1);
});

for(const domain of ['ventas','pagos','ordenes_trabajo','presupuestos'])test('aggregate retires in-place grant during commercial interval: '+domain,async()=>{
 const f=await fixture(),original=f.ports.commercial;let changed=false;
 f.ports.commercial={async read(q){const r=await original.read(q);if(!changed){changed=true;f.ctx.grants[domain]=f.ctx.grants[domain]==='own'?'all':'own';}return r;}};
 await assert.rejects(f.create().read(),{code:'SV_ACTIVITY_CONTEXT_RETIRED'});assert(changed);
});

test('B1 payload change with same generation/revision rejects instead of certifying consumers',async()=>{
 const f=await fixture(),original=f.ports.budget;let calls=0;
 f.ports.budget={async read(q){const r=await original.read(q);if(++calls===2)r.value.badge={...r.value.badge,independentExtra:'changed'};return r;}};
 await assert.rejects(f.create().read(),/Budget changed across commercial interval/);assert.equal(calls,2);
});

test('missing budget source revision rejects at B0 before monthly/commercial reads',async()=>{
 const f=await fixture(),original=f.ports.budget;let others=0;
 f.ports.budget={async read(q){const r=await original.read(q);delete r.value.revision;return r;}};
 for(const kind of ['month','commercial']){const port=f.ports[kind];f.ports[kind]={read(q){others++;return port.read(q);}};}
 await assert.rejects(f.create().read(),/Missing source revision/);assert.equal(others,0);
});
