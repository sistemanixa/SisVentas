'use strict';
// Isolated synthetic GETs. No native Rules certification or real credentials.
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path');
const source=process.env.SV_PAYMENT_ADVERSARIAL_SOURCE||path.resolve(__dirname,'..'),at=p=>require(path.join(source,p));
const {setup,wait}=at('test/helpers/payment-reader-latency-fixture.cjs');
const {createBusinessAuth}=at('cotizador/user-access'),{createCommercialOwnership}=at('cotizador/commercial-ownership'),{createLaborRtdbStore}=at('cotizador/labor-rtdb-store');
async function drained(f){const n=f.events.length;await wait(35);a.equal(f.events.length,n,'No background reads after rejection');}
test('reset version changes with required false during final profile query: real user REST port denies response',async()=>{
 let f,writes=0,denials=0,profiles=0;const calls=[];
 const store=createLaborRtdbStore({databaseURL:'http://127.0.0.1:1/?ns=security-fiction',accessToken:async()=>'FIXTURE_ONLY',fetchImpl:async(url,options)=>{
  if(options.method!=='GET')writes++;a.equal(options.method,'GET');const u=new URL(url);a.equal(u.origin,'http://127.0.0.1:1');
  const p=decodeURIComponent(u.pathname).slice(1,-5),actor=JSON.parse(u.searchParams.get('auth_variable_override'));a.equal(actor.uid,'a');calls.push(p);
  // Explicit simulated native read rule for reset version, not an emulator proof.
  const state=f.root.sv_access_resets?.a;if(state&&(state.required||state.version!==actor.token.svAccessVersion)){denials++;return{ok:false,status:403,body:{cancel:async()=>{}},json:async()=>({})};}
  const value=p.split('/').reduce((v,k)=>v?.[k],f.root)??null;return{ok:true,status:200,json:async()=>structuredClone(value)};
 }});
 f=setup({rtt:3,authFactory:(raw,db)=>createBusinessAuth({verifyIdToken:async(...args)=>({...await raw.verifyIdToken(...args),svAccessVersion:'before'})},db),ownershipFactory:options=>createCommercialOwnership({...options,readAsUser:store.readAsUser})});
 const original=structuredClone(f.root.sisventas);f.root.sv_access_resets={a:{required:false,version:'before'}};
 f.control.hook=(p,kind)=>{if(p==='sv_usuarios'&&kind==='query'&&++profiles===2)f.root.sv_access_resets.a={required:false,version:'after'};};
 await a.rejects(f.load());a.equal(profiles,2);a.equal(denials,1);a.equal(calls.at(-1),'sisventas/ventas/one');a.equal(writes,0);a.deepEqual(f.root.sisventas,original);await drained(f);
});
test('same permission revision cannot hide a module revocation or a changed permission digest during final source reads',async()=>{
 for(const change of ['module','digest']){
  const f=setup(),before=structuredClone(f.root.sisventas),revision=f.root.sv_permisos.vendedor.indiceRevision;let reads=0;
  f.control.hook=(p,kind)=>{if(p==='sisventas/pagos/p'&&kind==='user'&&++reads===2){const cfg=f.root.sv_permisos.vendedor;if(change==='module')cfg.indiceModulos={};else cfg.adversarialRevisionMarker='changed-with-same-revision';}};
  await a.rejects(f.load(),e=>change==='module'?e.statusCode===403:e.statusCode===409&&/permisos cambiaron/.test(e.message));
  a.equal(reads,2);a.equal(f.root.sv_permisos.vendedor.indiceRevision,revision);a.deepEqual(f.root.sisventas,before);await drained(f);
 }
});
test('profile and permission IO errors remain 503 and both context branches drain before rejection',async()=>{
 for(const failedPath of ['sv_usuarios','sv_permisos/vendedor']){
  const f=setup({rtt:2}),before=structuredClone(f.root.sisventas),counts=new Map();let siblingDone=false;
  f.control.hook=async p=>{if(!['sv_usuarios','sv_permisos/vendedor'].includes(p))return;counts.set(p,(counts.get(p)||0)+1);if(counts.get(p)!==2)return;
   if(p===failedPath)throw Object.assign(Error('Fictitious context IO unavailable'),{statusCode:503});
   await wait(20);siblingDone=true;
  };
  await a.rejects(f.load(),e=>e.statusCode===503);a.equal(siblingDone,true);a.equal(counts.get(failedPath),2);a.deepEqual(f.root.sisventas,before);await drained(f);
 }
});
