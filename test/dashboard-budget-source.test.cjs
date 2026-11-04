'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Source=require('../js/core/dashboard-budget-source-proposal');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};},tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const ctx={allowed:true,uid:'u',role:'vendedor',permissionRevision:7,permissionSignature:'fictitious-permissions',sessionEpoch:1,dataEpoch:1,auth:{currentUser:{uid:'u'}},db:{},timeZone:'America/Argentina/Buenos_Aires',sourceLocale:'es'},reads=[],events=[],handles=[],invalidated=[];let next=async()=>result();
 function result(extra={}){return{schema:2,uid:ctx.uid,role:ctx.role,permissionRevision:ctx.permissionRevision,generation:'fictitious-generation',revision:1,counts:{active:0,converted:0,totalNonCancelled:0,conversionPercent:0},notices:{complete:true,rows:[]},...extra};}
 const readiness={beginSource(key){assert(!['presupuestos','ventas','pagos'].includes(key));const h={key,readyCalls:0,errorCalls:0,cancelCalls:0,ready(){h.readyCalls++;},error(){h.errorCalls++;},cancel(){h.cancelCalls++;}};handles.push(h);return h;},invalidate(key){invalidated.push(key);}};
 const source=Source.create({capture:()=>ctx,valid:()=>true,read:async kind=>{reads.push(kind);return next(kind);},readiness,changed:(kind,view)=>events.push({kind,...view})});
 return {ctx,source,reads,events,handles,invalidated,result,setRead:fn=>{next=fn;}};
}
test('reentrant demands share one read and completion never claims the originals collection is complete',async()=>{
 const f=fixture(),d=deferred();f.setRead(()=>d.promise);const a=f.source.ensure(),b=f.source.ensure();assert.equal(a,b);await tick();assert.equal(f.reads.length,1);d.resolve(f.result());await a;assert.equal(f.handles[0].readyCalls,1);assert.equal(f.handles[0].key,'dashboardBudgets');assert.equal(f.source.peek().data.counts.active,0);await f.source.ensure();assert.equal(f.reads.length,1);
});
test('explicit revalidation retains valid visible data and does not start a timer or extra request',async()=>{
 const f=fixture();await f.source.ensure();const old=f.source.peek().data,d=deferred();f.setRead(()=>d.promise);const pending=f.source.refresh();assert.equal(f.source.peek().revalidating,true);assert.equal(f.source.peek().data,old);assert.equal(f.source.ensure(),pending);d.resolve(f.result({revision:2}));await pending;assert.equal(f.reads.length,2);assert.equal(f.source.peek().revalidating,false);assert.equal(f.handles[0].cancelCalls,1);
});
test('same-UID User replacement, permission signature and session epoch retire pending results',async()=>{
 for(const change of [f=>{f.ctx.auth.currentUser={uid:'u'};},f=>{f.ctx.permissionSignature='changed';},f=>{f.ctx.sessionEpoch++;}]){const f=fixture(),d=deferred();f.setRead(()=>d.promise);const pending=f.source.ensure();await tick();change(f);assert.equal(f.source.peek().data,null);await assert.rejects(pending,{code:'SV_BUDGET_SOURCE_RETIRED'});d.resolve(f.result());await tick();assert.equal(f.handles[0].readyCalls,0);assert(!f.events.some(e=>e.status==='ready'));}
});
test('a transport error preserves prior data with an error, never turns it into a successful zero and does not retry on render',async()=>{
 const f=fixture();await f.source.ensure();const old=f.source.peek().data,error=Error('Fictitious network failure');f.setRead(async()=>{throw error;});await assert.rejects(f.source.refresh(),error);assert.equal(f.source.peek().data,old);assert.equal(f.source.peek().status,'error');await assert.rejects(f.source.ensure(),error);assert.equal(f.reads.length,2);assert.equal(f.handles[1].errorCalls,1);
});
test('authority denial clears retained data and cancels readiness even before host permission events arrive',async()=>{
 const f=fixture();await f.source.ensure();await f.source.ensure('notices');f.setRead(async()=>{throw Object.assign(Error('Denied'),{statusCode:403});});await assert.rejects(f.source.refresh());assert.equal(f.source.peek().data,null);assert.equal(f.source.peek('notices').data,null);assert.equal(f.handles[2].cancelCalls,1);assert(f.invalidated.includes('dashboardBudgets'));assert(f.invalidated.includes('dashboardBudgetNotices'));
 await assert.rejects(f.source.ensure());await assert.rejects(f.source.ensure('notices'));assert.equal(f.reads.length,3,'Rendering an unchanged denied authority cannot trigger a retry loop');
 f.ctx.permissionSignature='new-authority';f.ctx.permissionRevision++;f.setRead(async()=>f.result());await f.source.ensure();assert.equal(f.source.peek().status,'ready');assert.equal(f.reads.length,4);
});
test('dashboard and on-demand notices have separate readiness and do not trigger one another',async()=>{
 const f=fixture();await f.source.ensure();assert.deepEqual(f.reads,['dashboard']);assert.equal(f.source.peek('notices').status,'idle');await f.source.ensure('notices');assert.deepEqual(f.reads,['dashboard','notices']);assert.equal(f.handles[1].key,'dashboardBudgetNotices');f.source.invalidate();assert.equal(f.source.peek().data,null);assert.equal(f.source.peek('notices').data,null);
});
test('invalid result and forbidden view cannot mark a consumer ready',async()=>{
 for(const value of [null,{}, {uid:'foreign',role:'vendedor',permissionRevision:7,generation:'g',revision:1}]){const f=fixture();f.setRead(async()=>value);await assert.rejects(f.source.ensure(),/Unverified budget result/);assert.equal(f.handles[0].readyCalls,0);assert.equal(f.source.peek().data,null);}
 const f=fixture();f.ctx.viewing=true;await assert.rejects(f.source.ensure(),{code:'SV_BUDGET_SOURCE_RETIRED'});assert.equal(f.reads.length,0);
});
test('valid metadata alone cannot certify absent metrics or a truncated notice payload',async()=>{
 for(const [kind,extra]of [['dashboard',{counts:null}],['dashboard',{counts:{active:1,converted:1,totalNonCancelled:1}}],['notices',{notices:{complete:false,rows:[]}}],['notices',{notices:{complete:true}}]]){const f=fixture();f.setRead(async()=>f.result(extra));await assert.rejects(f.source.ensure(kind),/Unverified budget consumer payload/);assert.equal(f.handles[0].readyCalls,0);}
});
test('invalidating a pending consumer settles immediately while its late rejection stays handled',async()=>{
 const f=fixture(),d=deferred();f.setRead(()=>d.promise);const pending=f.source.ensure();await tick();f.source.invalidate();await assert.rejects(pending,{code:'SV_BUDGET_SOURCE_RETIRED'});d.reject(Error('Late transport failure'));await tick();assert.equal(f.source.peek().status,'idle');assert.equal(f.handles[0].readyCalls,0);
});
