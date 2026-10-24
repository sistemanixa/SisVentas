'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../js/core/dashboard-account-read.v1.js');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
async function flush(){for(let i=0;i<12;i++)await Promise.resolve();}
function fixture(){
 const calls=[],references=[],page={id:'page-dashboard',isConnected:true},scope={authenticated:true,allowed:true,foreground:true,active:true,auth:{uid:'u'},uid:'u',role:'tecnico',revision:1,permissionSignature:'{"indiceRevision":1}',epoch:0,view:null,viewProfile:'',employeeId:'e',page,route:'dashboard',hash:'#/dashboard',db:{}};
 scope.ref=(db,p)=>{const result={db,path:p};references.push(result);return result;};
 scope.get=ref=>{const task=deferred();calls.push({...task,ref});return task.promise;};
 let captureFailure=false;
 const api=M.create({capture:()=>{if(captureFailure)throw Error('capture');return{...scope};}});
 return{api,scope,calls,references,page,failCapture(){captureFailure=true;},restoreCapture(){captureFailure=false;}};
}
const caught=promise=>{promise.catch(()=>{});return promise;};
test('three simultaneous own-account reads share exactly the same Promise and one SDK GET',async()=>{
 const f=fixture(),a=f.api.get('e'),b=f.api.get('e'),c=f.api.get('e');assert.equal(a,b);assert.equal(b,c);await flush();assert.equal(f.calls.length,1);assert.equal(f.calls[0].ref.path,'sisventas/ctaemp/e');assert.equal(f.calls[0].ref.db,f.scope.db);
 let parsed=0;const snapshot={val(){parsed++;return{legacy:{monto:123.45}};}};f.calls[0].resolve(snapshot);
 assert.equal(await a,snapshot);assert.equal(await b,snapshot);assert.equal(parsed,0);
});
test('after ACK a new render makes a new GET; no ready snapshot is reused',async()=>{
 const f=fixture(),first=f.api.get('e');await flush();const snapshot={val:()=>({})};f.calls[0].resolve(snapshot);await first;
 const second=f.api.get('e');assert.notEqual(first,second);await flush();assert.equal(f.calls.length,2);f.calls[1].resolve(snapshot);assert.equal(await second,snapshot);
});
test('a render reentered from SDK.get joins the already established Promise',async()=>{
 const f=fixture(),original=f.scope.get;let joined;
 f.scope.get=ref=>{joined=f.api.get('e');return original(ref);};
 const promise=f.api.get('e');await flush();assert.equal(joined,promise);assert.equal(f.calls.length,1);f.calls[0].resolve({});await promise;
});
test('reentrant read from an ACK callback starts fresh rather than joining a fulfilled entry',async()=>{
 const f=fixture(),first=f.api.get('e');let next;first.then(()=>{next=f.api.get('e');});await flush();f.calls[0].resolve({});await first;await flush();assert.equal(f.calls.length,2);assert.notEqual(first,next);f.calls[1].resolve({});await next;
});
for(const [field,replacement]of [
 ['uid','other'],['auth',{uid:'u'}],['role','administrativo'],['revision',2],['permissionSignature','{"changed":true}'],['epoch',1],['view',{}],['viewProfile','profile2'],['employeeId','other'],['page',{id:'page-dashboard',isConnected:true}],['route','ctaemp'],['hash','#/dashboard?other'],['db',{}],['get',()=>Promise.resolve({})],['ref',(_db,path)=>({path})],['authenticated',false],['allowed',false],['foreground',false],['active',false]
])test('retired '+field+' response is rejected before any snapshot decoding',async()=>{
 const f=fixture(),promise=caught(f.api.get('e'));await flush();let parsed=0;const snapshot={val(){parsed++;return{};}};
 f.scope[field]=replacement;f.calls[0].resolve(snapshot);await assert.rejects(promise,{name:'AbortError',code:'SV_DASHBOARD_ACCOUNT_CANCELLED'});assert.equal(parsed,0);
});
test('detached page retires response even when its object identity remains equal',async()=>{
 const f=fixture(),promise=caught(f.api.get('e'));await flush();f.page.isConnected=false;f.calls[0].resolve({val(){assert.fail('No decode');}});await assert.rejects(promise,{name:'AbortError'});
});
test('changing context retires its pending Promise and cannot let an old answer retire the new one',async()=>{
 const f=fixture(),first=caught(f.api.get('e'));await flush();f.scope.revision=2;const second=f.api.get('e');await assert.rejects(first,{name:'AbortError'});await flush();assert.equal(f.calls.length,2);
 f.calls[0].resolve({val(){assert.fail('No old decode');}});await flush();assert.equal(f.api.get('e'),second);const current={};f.calls[1].resolve(current);assert.equal(await second,current);
});
test('UID change with its new Auth starts a separate own-account request',async()=>{
 const f=fixture(),first=caught(f.api.get('e'));await flush();f.scope.uid='u2';f.scope.auth={uid:'u2'};f.scope.employeeId='e2';const next=f.api.get('e2');await assert.rejects(first,{name:'AbortError'});await flush();assert.equal(f.calls.length,2);assert.equal(f.calls[1].ref.path,'sisventas/ctaemp/e2');f.calls[1].resolve({});await next;f.calls[0].resolve({});await flush();
});
test('explicit lifecycle invalidation rejects immediately and does not retain a never-resolving SDK read',async()=>{
 const f=fixture(),first=caught(f.api.get('e'));await flush();f.api.invalidate();await assert.rejects(first,{name:'AbortError'});
 const second=f.api.get('e');await flush();assert.equal(f.calls.length,2);f.calls[1].resolve({});await second;
});
test('hidden then restored invalidation cannot replay the earlier visible result or cause automatic reads',async()=>{
 const f=fixture(),first=caught(f.api.get('e'));await flush();f.scope.foreground=false;f.api.invalidate();await assert.rejects(first,{name:'AbortError'});f.scope.foreground=true;
 f.calls[0].resolve({val(){assert.fail('No stale decode');}});await flush();assert.equal(f.calls.length,1);
 const second=f.api.get('e');await flush();assert.equal(f.calls.length,2);f.calls[1].resolve({});await second;
});
test('invalidation before the scheduled SDK invocation emits no GET',async()=>{
 const f=fixture(),promise=caught(f.api.get('e'));f.api.invalidate();await assert.rejects(promise,{name:'AbortError'});await flush();assert.equal(f.calls.length,0);assert.equal(f.references.length,0);
});
for(const field of ['authenticated','allowed','foreground','active'])test('does not issue I/O when '+field+' is false',async()=>{
 const f=fixture();f.scope[field]=false;await assert.rejects(f.api.get('e'),{name:'AbortError'});await flush();assert.equal(f.calls.length,0);assert.equal(f.references.length,0);
});
test('does not read another employee or accept a mismatched Auth/UID',async()=>{
 const f=fixture();await assert.rejects(f.api.get('someone-else'),{name:'AbortError'});f.scope.auth={uid:'other'};await assert.rejects(f.api.get('e'),{name:'AbortError'});await flush();assert.equal(f.calls.length,0);
});
for(const [field,value]of [['auth',null],['uid',''],['role',''],['revision',-1],['epoch',-1],['permissionSignature',undefined],['view',undefined],['viewProfile',undefined],['page',null],['db',null],['get',null],['ref',null]])test('incomplete scope cannot issue an account read: '+field,async()=>{
 const f=fixture();f.scope[field]=value;await assert.rejects(f.api.get('e'),{name:'AbortError'});await flush();assert.equal(f.calls.length,0);assert.equal(f.references.length,0);
});
for(const key of ['',null,42,'a/b','a.b','a#b','a$b','a[b','a\u0000b'])test('rejects invalid employee key '+String(key),async()=>{
 const f=fixture();f.scope.employeeId=key;await assert.rejects(f.api.get(key),{name:'AbortError'});await flush();assert.equal(f.calls.length,0);
});
test('accepts exact UTF-8 key boundaries without normalizing or shortening the path',async()=>{
 for(const key of ['a'.repeat(768),'á'.repeat(384),'€'.repeat(256),'😀'.repeat(192),'e\u0301'.repeat(256)]){
  const f=fixture();f.scope.employeeId=key;const promise=f.api.get(key);await flush();assert.equal(f.calls.length,1);assert.equal(f.calls[0].ref.path,'sisventas/ctaemp/'+key);f.calls[0].resolve({});await promise;
 }
});
test('rejects oversized UTF-8 employee keys even below the UTF-16 length limit',async()=>{
 for(const key of ['a'.repeat(769),'á'.repeat(385),'€'.repeat(257),'😀'.repeat(193),'e\u0301'.repeat(257)]){
  const f=fixture();f.scope.employeeId=key;await assert.rejects(f.api.get(key),{name:'AbortError'});await flush();assert.equal(f.calls.length,0);
 }
});
test('rejects lone or broken UTF-16 surrogates instead of replacing or normalizing them',async()=>{
 for(const key of ['\ud800','\udfff','a\ud800b','\udc00\ud800','\ud800\ud800']){
  const f=fixture();f.scope.employeeId=key;await assert.rejects(f.api.get(key),{name:'AbortError'});await flush();assert.equal(f.calls.length,0);
 }
});
test('Auth UID respects its 128-code-unit bound and is never shortened',async()=>{
 const accepted=fixture(),uid='u'.repeat(128);accepted.scope.uid=uid;accepted.scope.auth={uid};const promise=accepted.api.get('e');await flush();assert.equal(accepted.calls.length,1);accepted.calls[0].resolve({});await promise;
 const rejected=fixture(),longUid='u'.repeat(129);rejected.scope.uid=longUid;rejected.scope.auth={uid:longUid};await assert.rejects(rejected.api.get('e'),{name:'AbortError'});await flush();assert.equal(rejected.calls.length,0);
});
test('network failure is propagated unchanged, shared, and removed before retry',async()=>{
 const f=fixture(),first=caught(f.api.get('e')),second=caught(f.api.get('e'));await flush();const error=Error('offline');f.calls[0].reject(error);await assert.rejects(first,e=>e===error);await assert.rejects(second,e=>e===error);
 const retry=f.api.get('e');await flush();assert.equal(f.calls.length,2);f.calls[1].resolve({});await retry;
});
test('synchronous SDK exception is propagated and does not poison the next read',async()=>{
 const f=fixture(),original=f.scope.get,error=Error('SDK');f.scope.get=()=>{throw error;};await assert.rejects(f.api.get('e'),e=>e===error);f.scope.get=original;const next=f.api.get('e');await flush();assert.equal(f.calls.length,1);f.calls[0].resolve({});await next;
});
test('capturing an unavailable scope retires pending reads without invoking SDK code',async()=>{
 const f=fixture(),first=caught(f.api.get('e'));await flush();f.failCapture();await assert.rejects(f.api.get('e'),{name:'AbortError'});await assert.rejects(first,{name:'AbortError'});assert.equal(f.calls.length,1);f.restoreCapture();const next=f.api.get('e');await flush();assert.equal(f.calls.length,2);f.calls[1].resolve({});await next;
});
test('context withdrawal inside ref prevents even the following SDK GET',async()=>{
 const f=fixture();f.scope.ref=(_db,path)=>{f.scope.allowed=false;return{path};};await assert.rejects(f.api.get('e'),{name:'AbortError'});assert.equal(f.calls.length,0);
});
test('creation is inert and the browser module needs no DOM, events, timers or network globals',async()=>{
 const window={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../js/core/dashboard-account-read.v1.js'),'utf8'),{window,Object,Promise,Error,Number});assert.deepEqual(Object.keys(window.SVDashboardAccountRead),['create']);
 const f=fixture();await flush();assert.equal(f.calls.length,0);f.api.invalidate();await flush();assert.equal(f.calls.length,0);
 assert.throws(()=>M.create());assert.throws(()=>M.create({capture:null}));
});
