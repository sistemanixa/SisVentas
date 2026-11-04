'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/dashboard-activity-aggregate-fixture.cjs');
const Aggregate=require('../js/core/dashboard-activity-aggregate-proposal'),Month=require('../js/core/dashboard-budget-month-port-proposal'),BIndex=require('../cotizador/dashboard-budget-incremental-plan-proposal'),M=require('../cotizador/dashboard-commercial-activity-proposal');
test('inactive by default; actual four readers and own monthly metric beyond five rows, no original loads',async()=>{
 const f=await fixture();await assert.rejects(Aggregate.create({capture:f.capture,valid:f.valid,ports:f.ports}).read());assert.equal(f.trace.length,0);
 const result=await f.create().read(),expected=Object.values(f.model.entries).filter(r=>r.ownerUid==='u').filter(r=>r.employeeLabel==='u'&&r.date.slice(0,7)==='2026-11');assert.equal(result.activity.complete,true);assert.equal(result.activity.items.length,5);assert.equal(result.monthly.records,expected.length);assert(expected.length>5);assert.equal(result.monthly.converted,expected.filter(r=>r.status==='convertido').length);assert.equal(result.originalCollectionComplete,false);assert.equal(result.salesAuthorMonthly,null);assert.equal(result.salesAuthorMonthlyComplete,false);assert.equal(result.dashboardComplete,false);assert.equal(result.notificationCenterComplete,false);assert(f.trace.every(t=>!t.path.startsWith('sisventas/')));
});
test('separately valid commercial prefixes from different revisions are never one cut',async()=>{
 const f=await fixture();const original=f.ports.commercial;let tail=Promise.resolve(),verified=0;f.ports.commercial={read(q){const p=tail.then(async()=>{const r=await original.read(q);verified++;if(q.domain==='ventas')await f.mutate({'sisventas/ventas/s0000/observaciones':'cambio entre prefijos'});return r;});tail=p;return p;}};await assert.rejects(f.create().read(),/Commercial generations\/revisions differ/);assert.equal(verified,3);
});
test('real budget writer between B0 and B1 rejects even when every individual reader succeeds',async()=>{
 const f=await fixture();let changed=false;const original=f.ports.commercial;f.ports.commercial={async read(q){const r=await original.read(q);if(!changed){changed=true;await f.mutateBudget({'sisventas/presupuestos/b2/estado':'convertido'});}return r;}};await assert.rejects(f.create().read(),/Budget changed|Monthly metric/);assert(changed);
});
for(const kind of ['epoch','user','permission','month','connection'])test('retire same-UID context during commercial read: '+kind,async()=>{
 const f=await fixture();let changed=false;f.setHook(p=>{if(!changed&&p.startsWith(M.ROOT+'/document/')){changed=true;if(kind==='epoch')f.ctx.sessionEpoch++;if(kind==='user')f.auth.currentUser={...f.auth.currentUser};if(kind==='permission')f.ctx.permissionSignature='changed';if(kind==='connection')f.ctx.connectionEpoch++;if(kind==='month'){f.ctx.month='2026-12';f.ctx.asOfDay='2026-12-01';}}});await assert.rejects(f.create().read(),{code:'SV_ACTIVITY_CONTEXT_RETIRED'});
});
test('fresh permission revocation rejects without empty fallback or final budget retry',async()=>{
 const f=await fixture();let changed=false;f.setHook(p=>{if(!changed&&p.startsWith(M.ROOT+'/document/')){changed=true;f.set('sv_permisos/vendedor/indiceModulos/presupuesto',false);}});await assert.rejects(f.create().read());assert(changed);
});
test('monthly certified absence alone returns zero; missing half/proof/certificate rejects',async()=>{
 const f=await fixture(),context=Aggregate.snapshot(f.capture()),bucket=await Month.hash(['u','2026-11']),base=BIndex.ROOT;
 const original=f.read(base+'/months/u_u/'+bucket),proof=f.read(base+'/monthProof/u_u/'+bucket);f.set(base+'/months/u_u/'+bucket,null);await assert.rejects(f.ports.month.read({schema:1,context}));f.set(base+'/monthProof/u_u/'+bucket,null);await assert.rejects(f.ports.month.read({schema:1,context}));f.ctx.month='2026-12';f.ctx.asOfDay='2026-12-01';const emptyContext=Aggregate.snapshot(f.capture());assert.equal((await f.ports.month.read({schema:1,context:emptyContext})).value.records,0);f.set(base+'/coverage/scopeAbsenceIsZero',null);await assert.rejects(f.ports.month.read({schema:1,context:emptyContext}));f.set(base+'/coverage/scopeAbsenceIsZero',true);f.set(base+'/months/u_u/'+bucket,original);f.set(base+'/monthProof/u_u/'+bucket,proof);f.set(base+'/read/u',null);await assert.rejects(f.ports.month.read({schema:1,context:emptyContext}));
});
test('month proof mutation during the bracket rejects; old bucket revision is legitimate',async()=>{
 const f=await fixture(),key=await Month.hash(['u','2026-11']);f.set(BIndex.ROOT+'/coverage/revision',2);f.refreshHeader();const r=await f.ports.month.read({schema:1,context:Aggregate.snapshot(f.capture())});assert.equal(r.value.revision,2);assert.equal(r.value.bucketRevision,1);
 let hit=false;f.setHook(p=>{if(!hit&&p.includes('/monthProof/')){hit=true;f.set(p,'corrupt');}});await assert.rejects(f.ports.month.read({schema:1,context:Aggregate.snapshot(f.capture())}));
});
test('full consumer readiness requires actual complete notices, never implies pptoData readiness',async()=>{
 const f=await fixture();await assert.rejects(f.create({requireNotices:true}).read(),/Budget consumers incomplete/);
});
test('monthly bucket drift at unchanged header is caught by the budget interval now including monthly',async()=>{
 const f=await fixture(),key=await Month.hash(['u','2026-11']),path=BIndex.ROOT+'/months/u_u/'+key;const original=f.ports.commercial;let changed=false;f.ports.commercial={async read(q){const r=await original.read(q);if(!changed){changed=true;const value=f.read(path);value.records++;f.set(path,value);f.set(BIndex.ROOT+'/monthProof/u_u/'+key,await Month.hash(value));}return r;}};await assert.rejects(f.create().read(),/Budget changed across commercial interval/);
});
test('separate monthly port disagreement still fails its own monthly interval check',async()=>{
 // Select the supported non-embedded representation; HTTP now embeds this value.
 const withoutMonthly=port=>({async read(q){const r=await port.read(q),{monthly,...value}=r.value;return {...r,value};}});
 const f=await fixture(),original=f.ports.month;f.ports.budget=withoutMonthly(f.ports.budget);let reads=0;f.ports.month={async read(q){const result=await original.read(q);if(++reads!==2)return result;const records=result.value.records+1;return {...result,value:{...result.value,records,conversionPercent:Math.round(100*result.value.converted/records)}};}};await assert.rejects(f.create().read(),/Monthly metric/);assert.equal(reads,2);
});
