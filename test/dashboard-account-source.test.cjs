'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Source=require('../js/core/dashboard-account-source.v1');
function fixture(){
 const calls=[],states=[],scope={authenticated:true,allowed:true,foreground:true,active:true,auth:{uid:'u'},authUid:'u',uid:'u',role:'tecnico',revision:1,permissionSignature:'fixture',epoch:0,dataEpoch:0,view:null,viewProfile:'',employeeId:'e',page:{id:'page-dashboard',isConnected:true},card:{},history:{},body:{},route:'dashboard',hash:'#/dashboard',db:{},moduleAccess:()=>true,accountAccess:()=>true,ownEmployee:()=>({fbKey:'e'})};
 scope.ref=(db,path)=>({db,path});scope.onValue=(ref,next,error)=>{const row={ref,next,error,stops:0};calls.push(row);return()=>row.stops++;};
 let broken=false;const api=Source.create({capture:()=>{if(broken)throw Error('fixture');return{...scope};},changed:state=>states.push(state)});
 const push=(data,index=calls.length-1)=>{let decoded=0;calls[index].next({val(){decoded++;return data;}});return decoded;};
 return{api,scope,calls,states,push,breakCapture(){broken=true;},restoreCapture(){broken=false;}};
}
test('own source is inert until acquired, then shares loading and ready across renders and pushes',()=>{
 const f=fixture();assert.equal(f.calls.length,0);assert.equal(f.api.peek(),null);
 for(let i=0;i<3;i++)assert.equal(f.api.ensure('e').status,'loading');assert.equal(f.calls.length,1);assert.equal(f.calls[0].ref.path,'sisventas/ctaemp/e');
 const raw={legacy:{monto:0.1,pagos:{p:{monto:0.2}}}};assert.equal(f.push(raw),1);
 for(let i=0;i<3;i++){assert.equal(f.api.ensure('e').status,'ready');assert.equal(f.api.peek().data,raw);}assert.equal(f.calls.length,1);
 assert.equal(f.push({changed:{monto:999}}),1);assert.equal(f.api.peek().data.changed.monto,999);assert.equal(f.calls.length,1);assert.equal(f.calls[0].stops,0);
});
for(const raw of [null,{},[],{old:{fecha:'2020-01-01'},future:{fecha:'2030-01-01'}}])test('ready preserves the complete raw value including empty/history '+JSON.stringify(raw),()=>{
 const f=fixture();f.api.ensure('e');f.push(raw);assert.equal(f.api.peek().data,raw);assert.equal(f.api.peek().status,'ready');f.api.ensure('e');assert.equal(f.calls.length,1);
});
for(const [field,value]of [['uid','other'],['auth',{uid:'u'}],['authUid','other'],['role','admin'],['revision',2],['permissionSignature','changed'],['epoch',1],['dataEpoch',1],['view',{}],['viewUid','other'],['viewRole','other'],['viewProfile','other'],['employeeId','other'],['page',{id:'page-dashboard'}],['card',{}],['history',{}],['body',{}],['route','ctaemp'],['hash','#/dashboard?other'],['db',{}],['onValue',()=>()=>{}],['ref',()=>({})],['moduleAccess',()=>true],['accountAccess',()=>true],['ownEmployee',()=>({})],['foregroundSession',{}],['authenticated',false],['allowed',false],['foreground',false],['active',false]])test('retires '+field+' before decoding and requires an explicit fresh attempt',()=>{
 const f=fixture();f.api.ensure('e');f.scope[field]=value;assert.equal(f.push({stale:999}),0);assert.equal(f.calls[0].stops,1);assert.equal(f.api.peek().status,'paused');assert.equal(f.api.peek().data,null);
 f.api.ensure('e');assert.equal(f.calls.length,1);
});
test('primitive Auth UID mutation and detached DOM cannot pass same-object identity fences',()=>{
 for(const mutate of [f=>f.scope.auth.uid='other',f=>f.scope.page.isConnected=false]){const f=fixture();f.api.ensure('e');mutate(f);assert.equal(f.push({}),0);assert.equal(f.calls[0].stops,1);}
});
test('context withdrawal inside val prevents publication after decoding',()=>{
 const f=fixture();f.api.ensure('e');f.calls[0].next({val(){f.scope.dataEpoch++;return{stale:999};}});assert.equal(f.api.peek().status,'paused');assert.equal(f.api.peek().data,null);assert.ok(!f.states.some(s=>s.status==='ready'));assert.equal(f.calls[0].stops,1);
});
test('hidden/restore and repeated incidental renders cannot resurrect a retired source',()=>{
 const f=fixture();f.api.ensure('e');f.push({old:1});f.scope.foreground=false;f.api.invalidate();assert.equal(f.calls[0].stops,1);f.scope.foreground=true;
 for(let i=0;i<3;i++)f.api.ensure('e');assert.equal(f.calls.length,1);assert.equal(f.api.peek().status,'paused');assert.equal(f.api.peek().data,null);
 f.api.retry('e');f.api.retry('e');assert.equal(f.calls.length,2);assert.equal(f.push({late:999},0),0);f.push({current:2});assert.equal(f.api.peek().data.current,2);
});
for(const synchronous of [false,true])test('SDK failure '+synchronous+' closes exactly once and latches until manual retry',()=>{
 const f=fixture(),sdk=f.scope.onValue;if(synchronous)f.scope.onValue=(ref,next,error)=>{const off=sdk(ref,next,error);error(Error('fixture denied'));return off;};
 f.api.ensure('e');if(!synchronous)f.calls[0].error(Error('fixture denied'));
 for(let i=0;i<3;i++){f.api.ensure('e');f.calls[0].error(Error('late'));f.push({late:999});}
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].stops,1);assert.equal(f.api.peek().status,'error');assert.equal(f.api.peek().data,null);
 f.scope.onValue=sdk;f.api.retry('e');assert.equal(f.calls.length,2);f.push({});assert.equal(f.api.peek().status,'ready');
});
test('synchronous cached push and reentrant ensure share the established attempt',()=>{
 const f=fixture(),sdk=f.scope.onValue;let joined;
 f.scope.onValue=(ref,next,error)=>{joined=f.api.ensure('e');const off=sdk(ref,next,error);next({val:()=>({cache:1})});return off;};
 assert.equal(f.api.ensure('e').status,'ready');assert.equal(joined.status,'loading');assert.equal(f.calls.length,1);
});
test('withdrawal during subscribe closes the unsubscribe returned later exactly once',()=>{
 const f=fixture(),sdk=f.scope.onValue;f.scope.onValue=(ref,next,error)=>{const off=sdk(ref,next,error);f.api.invalidate();return off;};
 f.api.ensure('e');assert.equal(f.calls[0].stops,1);f.api.invalidate();assert.equal(f.calls[0].stops,1);assert.equal(f.push({}),0);
});
test('a previous SDK callback cannot close or overwrite a newer attempt with the same context',()=>{
 const f=fixture();f.api.ensure('e');f.api.invalidate();f.api.retry('e');f.push({fresh:1});const ready=f.api.peek();
 f.push({stale:999},0);f.calls[0].error(Error('late'));assert.equal(f.api.peek().serial,ready.serial);assert.equal(f.api.peek().data.fresh,1);assert.equal(f.calls[1].stops,0);
});
test('ref side effect withdrawing permission prevents subscription',()=>{
 const f=fixture();f.scope.ref=()=>{f.scope.allowed=false;return{};};f.api.ensure('e');assert.equal(f.calls.length,0);assert.equal(f.api.peek().status,'paused');
});
test('unavailable capture retires and clears its raw; repeated peek has no transport',()=>{
 const f=fixture();f.api.ensure('e');f.push({private:1});f.breakCapture();assert.equal(f.api.peek().data,null);assert.equal(f.calls[0].stops,1);f.restoreCapture();f.api.ensure('e');assert.equal(f.calls.length,1);f.api.retry('e');assert.equal(f.calls.length,2);
});
for(const value of [undefined,1,'bad',true])test('invalid snapshot '+String(value)+' is an error, never a confirmed empty account',()=>{
 const f=fixture();f.api.ensure('e');f.push(value);assert.equal(f.api.peek().status,'error');assert.equal(f.calls[0].stops,1);assert.equal(f.api.peek().data,null);
});
for(const key of ['',null,42,'a/b','a.b','a#b','a$b','a[b','a\0b','a'.repeat(769),'á'.repeat(385),'\ud800','\udfff'])test('rejects invalid employee key '+String(key).slice(0,12),()=>{
 const f=fixture();f.scope.employeeId=key;f.api.ensure(key);assert.equal(f.calls.length,0);
});
for(const key of ['a'.repeat(768),'á'.repeat(384),'€'.repeat(256),'😀'.repeat(192)])test('accepts exact UTF8 key boundary '+key.length,()=>{
 const f=fixture();f.scope.employeeId=key;f.api.ensure(key);assert.equal(f.calls[0].ref.path,'sisventas/ctaemp/'+key);
});
test('cannot observe an arbitrary employee or missing authorization/SDK context',()=>{
 for(const field of ['auth','db','onValue','ref','moduleAccess','accountAccess','ownEmployee']){const f=fixture();f.scope[field]=null;f.api.ensure('e');assert.equal(f.calls.length,0,field);}
 const f=fixture();f.api.ensure('foreign');assert.equal(f.calls.length,0);
});
test('a changed callback error closes the source and does not recur indefinitely',()=>{
 const f=fixture();let count=0;const api=Source.create({capture:()=>({...f.scope}),changed:state=>{count++;if(state.status==='ready')throw Error('fixture UI');}});
 api.ensure('e');f.push({});assert.equal(api.peek().status,'error');assert.equal(f.calls[0].stops,1);assert.equal(count,3);
});
test('paused notification reentered by retry cannot orphan a second source',()=>{
 const f=fixture();let api,armed=false;api=Source.create({capture:()=>({...f.scope}),changed:state=>{if(armed&&state.status==='paused'){armed=false;api.retry('e');}}});
 api.ensure('e');f.scope.revision++;armed=true;api.ensure('e',true);
 assert.equal(f.calls.length,2);assert.deepEqual(f.calls.map(x=>x.stops),[1,0]);api.invalidate();assert.deepEqual(f.calls.map(x=>x.stops),[1,1]);
});
test('a loading presentation failure cannot start SDK IO',()=>{
 const f=fixture(),api=Source.create({capture:()=>({...f.scope}),changed(){throw Error('fixture UI');}});api.ensure('e');assert.equal(f.calls.length,0);assert.equal(api.peek().status,'error');
});
