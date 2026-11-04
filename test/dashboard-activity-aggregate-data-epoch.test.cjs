'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/dashboard-activity-aggregate-fixture.cjs'),Aggregate=require('../js/core/dashboard-activity-aggregate-proposal');
test('same Auth and User with a new dataEpoch retires the pending aggregate',async()=>{
 const f=await fixture(),user=f.auth.currentUser,auth=f.auth;f.ctx.dataEpoch=1;let changed=false;const original=f.ports.commercial;f.ports.commercial={async read(q){const r=await original.read(q);if(!changed){changed=true;f.ctx.dataEpoch++;}return r;}};await assert.rejects(f.create().read(),{code:'SV_ACTIVITY_CONTEXT_RETIRED'});assert.equal(f.auth,auth);assert.equal(f.auth.currentUser,user);assert(changed);
});
test('swapped commercial domains reject before revision comparison or final B1/month reads',async()=>{
 const f=await fixture();f.ctx.dataEpoch=1;let budget=0,month=0;const b=f.ports.budget,m=f.ports.month,c=f.ports.commercial;f.ports.budget={read(q){budget++;return b.read(q);}};f.ports.month={read(q){month++;return m.read(q);}};f.ports.commercial={async read(q){const r=await c.read(q);if(q.domain==='ventas')r.value.recent.domain='pagos';return r;}};await assert.rejects(f.create().read(),/domain\/scope/i);assert.equal(budget,1);assert.equal(month,1);
});
for(const domain of ['ventas','pagos','ordenes_trabajo','presupuestos'])test('legitimately denied null grant never becomes an empty complete prefix: '+domain,async()=>{
 const f=await fixture();f.ctx.dataEpoch=1;f.ctx.grants[domain]=null;await assert.rejects(f.create().read(),/not authorized/i);assert.equal(f.trace.length,0);
});
test('dataEpoch is mandatory, nonnegative and safe; never defaults to zero',async()=>{
 const f=await fixture();for(const value of [undefined,null,-1,1.5,Number.MAX_SAFE_INTEGER+1,'1']){f.ctx.dataEpoch=value;assert.throws(()=>Aggregate.snapshot(f.capture()));}f.ctx.dataEpoch=0;assert.equal(Aggregate.snapshot(f.capture()).dataEpoch,0);
});
