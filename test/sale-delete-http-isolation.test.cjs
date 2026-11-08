'use strict';
const saleHash=value=>{const original=structuredClone(value);if(original)delete original.fbKey;return require('../cotizador/labor-guard').digest(original);};
const {fixture:signedFixture}=require('./helpers/commercial-delete-attestation-fixture.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createLaborRuntime}=require('../cotizador/labor-runtime');
const {createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
const {createSaleDeleteHttpAdapter,PATH}=require('../cotizador/sale-delete-http-adapter');
const {child,put,parts}=require('../cotizador/labor-guard');
const Payments=require('../cotizador/payment-membership-index');
async function fixture(){
 let state={sv_labor_config:{schema:1,ready:true},sv_chat_roles:{u:{activo:true,rol:'admin'},other:{activo:true,rol:'admin'}},sv_permisos:{admin:{indiceVersion:2,indiceModulos:{venta:true},acciones:{ventas:{eliminar:true}}}},sisventas:{ventas:{s:{id:'V-0001'},other:{id:'V-0002'}},pagos:{p:{venta:'PREFIX / 0001',monto:1}},ordenes_trabajo:{},presupuestos:{},reclamos:{}}};
 for(const [path,value]of Object.entries(Payments.buildIndex(state.sisventas.pagos,{generation:'isolation-fixture',ready:true}).patch))state=put(state,parts(path),value);
 const prepared=await signedFixture({...state.sisventas,ventas:Object.fromEntries(Object.entries(state.sisventas.ventas).map(([id,sale])=>[id,{...sale,total:100,fecha:'2026-11-01',clienteFbKey:'c',responsableUid:'u'}])),pagos:Object.fromEntries(Object.entries(state.sisventas.pagos).map(([id,payment])=>[id,{...payment,fecha:'2026-11-01'}]))});
 Object.assign(prepared.state.sv_chat_roles,state.sv_chat_roles);prepared.state.sv_permisos=state.sv_permisos;state=prepared.state;
 const calls=[],authState={revoked:false,passwordRequired:false,uid:null};let commits=0;
 const fetchImpl=async(target,options)=>{
  const url=new URL(target),path=decodeURIComponent(url.pathname.replace(/^\//,'').replace(/\.json$/,''));calls.push([options.method,path]);
  if(options.method==='GET')return new Response(JSON.stringify(child(state,parts(path))));
  if(options.method==='PUT'){
   const value=JSON.parse(options.body);
   if(path==='sv_labor_guard'&&child(state,parts('sv_labor_receipts/'+value.opId)))return new Response('null',{status:403});
   state=put(state,parts(path),value);
  }
  if(options.method==='DELETE')state=put(state,parts(path),null);
  if(options.method==='PATCH'){commits++;for(const [destination,value]of Object.entries(JSON.parse(options.body)))state=put(state,parts(destination),value);}
  return new Response('null');
 };
 const db={ref:path=>({toString:()=> 'https://fixture.invalid/'+path,get:async()=>({val:()=>structuredClone(child(state,parts(path)))})})};
 const runtime=createLaborRuntime({db,databaseURL:'https://fixture.invalid',accessToken:async()=> 'fixture-service',fetchImpl,enabled:true,commercialPages:true,clientAccounts:true,clientHistory:true,operationalSummaries:true,deleteEnvironment:{COMMERCIAL_DELETE_ENABLED:'true',COMMERCIAL_DELETE_ATTESTATION_PUBLIC_KEY:prepared.publicKey,COMMERCIAL_DELETE_PINS_JSON:JSON.stringify(prepared.pins)}});
 const auth={verifyIdToken:async(token,checkRevoked)=>{assert.equal(checkRevoked,true);if(authState.revoked||!['u','other'].includes(token))throw Error('revoked fixture');return {uid:authState.uid||token,svPasswordChangeRequired:authState.passwordRequired};}};
 const gateway=createLaborWriteGateway({auth,db,guard:runtime.guard,store:runtime.store,enabled:true});
 const adapter=createSaleDeleteHttpAdapter({authorize:gateway.authorize,guard:runtime.guard,store:runtime.store,enabled:true});
 return {adapter,authState,calls,commits:()=>commits,get:path=>child(state,parts(path)),set:(path,value)=>{state=put(state,parts(path),value);},req:{method:'POST',url:PATH,headers:{authorization:'Bearer u'}},body:{id:'isolation-operation',ventaKey:'s',expectedHash:saleHash(child(state,parts('sisventas/ventas/s')))}};
}
for(const change of ['uid','role','password','revocation'])test('persisted receipt is inaccessible after '+change,async()=>{
 const f=await fixture();await f.adapter.handle(f.req,f.body);f.calls.length=0;
 if(change==='uid')f.authState.uid='other';if(change==='role')f.set('sv_chat_roles/u/rol','administrativo');if(change==='password')f.authState.passwordRequired=true;if(change==='revocation')f.authState.revoked=true;
 await assert.rejects(f.adapter.handle(f.req,f.body));assert.equal(f.commits(),1);assert(!f.calls.some(([method])=>method!=='GET'));assert(!f.calls.some(([,path])=>path.startsWith('sisventas/')));
});
test('concurrent identical operation returns one receipt with one business commit',async()=>{
 const f=await fixture(),results=await Promise.all([f.adapter.handle(f.req,f.body),f.adapter.handle(f.req,f.body)]);assert.deepEqual(results[0],results[1]);assert.equal(f.commits(),1);assert(f.get('sv_labor_receipts/'+f.body.id));
});
test('concurrent operation ID with different body commits only one request',async()=>{
 const f=await fixture(),results=await Promise.allSettled([f.adapter.handle(f.req,f.body),f.adapter.handle(f.req,{...f.body,ventaKey:'other'})]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected').length,1);assert.equal(f.commits(),1);assert.equal(Object.keys(f.get('sisventas/ventas')||{}).length,1);
});
test('capability and own receipt recovery avoid commercial root reads and additional writes',async()=>{
 const f=await fixture();assert.equal(f.adapter.capability(),true);assert.equal(f.calls.length,0);await f.adapter.handle(f.req,f.body);f.calls.length=0;const recovered=await f.adapter.handle(f.req,f.body);assert.equal(recovered.body.committed,true);assert(f.calls.some(([,path])=>path==='sv_labor_receipts/'+f.body.id));assert(!f.calls.some(([method,path])=>method!=='GET'||path.startsWith('sisventas/')));assert.equal(f.commits(),1);
});
test('missing or revoked Auth never acquires guard nor writes business or technical nodes',async()=>{
 for(const mode of ['missing','revoked']){const f=await fixture();if(mode==='missing')f.req.headers={};else f.authState.revoked=true;await assert.rejects(f.adapter.handle(f.req,f.body));assert.deepEqual(f.calls,[]);assert.equal(f.commits(),0);assert(f.get('sisventas/ventas/s'));}
});
