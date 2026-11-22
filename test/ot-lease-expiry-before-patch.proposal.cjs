'use strict';
// Explicit proposal laboratory. The shared Store and guard stay unmodified.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const filename=path.resolve(__dirname,'../cotizador/labor-rtdb-store.js'),original=fs.readFileSync(filename,'utf8');
const commitAnchor=' async function commit(patch,lease,actor){';
const patchAnchor="  const response=await fetchImpl(destination,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(patch),signal:AbortSignal.timeout(requestMs)});";
function candidate(source){
 assert.equal(source.split(commitAnchor).length,2,'review the actual commit entry point before applying the proposal');assert.equal(source.split(patchAnchor).length,2,'review the actual PATCH dispatch before applying the proposal');
 return source.replace(commitAnchor,commitAnchor+"\n  const assertLease=()=>{if(!Number.isFinite(lease?.expiresAt)||now()>=lease.expiresAt)throw fail(409,'El plazo del guardado terminó. Revisá el estado antes de reintentar.','SV_LABOR_LEASE_EXPIRED');};assertLease();")
  .replace(patchAnchor,"  const preparedPatch={method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(patch),signal:AbortSignal.timeout(requestMs)};\n  assertLease();const response=await fetchImpl(destination,preparedPatch);");
}
function fixture({proposed=false,at=1000,expireAtToken=false,expireDuringClaims=false,expireAfterDispatch=false,claimError=false}={}){
 let clock=at,tokenCalls=0;const calls=[],local=Module.createRequire(filename),mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 mod.require=name=>name==='./ot-delivery-commit-protocol'?{claims:async({read})=>{if(expireDuringClaims)await read('sisventas/ordenes_trabajo/fixture');if(claimError)throw Object.assign(Error('Fictitious claims denied'),{statusCode:403});return{};}}:local(name);
 mod._compile(proposed?candidate(original):original,filename);
 const store=mod.exports.createLaborRtdbStore({databaseURL:'https://fixture.invalid/',now:()=>clock,accessToken:async()=>{tokenCalls++;if(expireAtToken)clock=2000;return'FICTITIOUS_TOKEN';},fetchImpl:async(_url,options)=>{calls.push({method:options.method,at:clock});if(options.method==='GET'&&expireDuringClaims)clock=2000;if(options.method==='PATCH'&&expireAfterDispatch)clock=2100;return{ok:true,status:200,json:async()=>null,body:{cancel:async()=>{}}};}});
 const lease={fence:'fictitious-fence',opId:'fictitious-operation',digest:'a'.repeat(64),expiresAt:2000,actorUid:'fictitious-user',mode:'command'},actor={uid:'fictitious-user',mode:'command',role:'admin',claims:{}},patch={'sisventas/gastos/fixture':{monto:3},sv_labor_guard:null};
 return{run:()=>store.commit(patch,lease,actor),calls,tokens:()=>tokenCalls};
}
test('antecedent: the unmodified Store dispatches PATCH when credential acquisition reaches lease expiry',async()=>{const f=fixture({expireAtToken:true});await f.run();assert.deepEqual(f.calls,[{method:'PATCH',at:2000}]);});
test('proposal rejects an already expired lease before credentials, reads or PATCH',async()=>{for(const at of [2000,2001]){const f=fixture({proposed:true,at});await assert.rejects(f.run(),{statusCode:409,code:'SV_LABOR_LEASE_EXPIRED'});assert.deepEqual(f.calls,[]);assert.equal(f.tokens(),0);}});
test('proposal rejects expiry during final credential acquisition before PATCH',async()=>{const f=fixture({proposed:true,expireAtToken:true});await assert.rejects(f.run(),{code:'SV_LABOR_LEASE_EXPIRED'});assert.equal(f.tokens(),1);assert.deepEqual(f.calls,[]);});
test('proposal rejects expiry during independent commit claims after draining the read and before PATCH',async()=>{const f=fixture({proposed:true,expireDuringClaims:true});await assert.rejects(f.run(),{code:'SV_LABOR_LEASE_EXPIRED'});assert.deepEqual(f.calls,[{method:'GET',at:1000}]);});
test('proposal preserves a valid final instant and the original authorization error',async()=>{const f=fixture({proposed:true,at:1999});await f.run();assert.deepEqual(f.calls,[{method:'PATCH',at:1999}]);const denied=fixture({proposed:true,claimError:true});await assert.rejects(denied.run(),{statusCode:403});assert.deepEqual(denied.calls,[]);});
test('proposal does not turn an accepted PATCH into a false failure when its acknowledgement arrives after expiry',async()=>{const f=fixture({proposed:true,at:1999,expireAfterDispatch:true});await f.run();assert.deepEqual(f.calls,[{method:'PATCH',at:1999}]);});
test('the proposal is applied only to an isolated module, never to the shared source file',()=>{assert.equal(fs.readFileSync(filename,'utf8'),original);assert.notEqual(candidate(original),original);});
