'use strict';
const assert=require('node:assert/strict'),Model=require('../../cotizador/dashboard-budget-projection-proposal'),Index=require('../../cotizador/dashboard-budget-incremental-plan-proposal');
const {normalizeRtdb}=require('../../cotizador/payment-membership-index');
function budget(extra={}){return {id:'PP-FICTICIO',cliente:'Cliente ficticio',responsableUid:'u',estado:'enviado',fecha:'2026-11-04',vence:'2026-11-05',ts:1793800000000,total:123.45,items:[{costo:999,private:'NEVER_TRANSPORT'}],foto:'NEVER_TRANSPORT',...extra};}
function seed(records={p:budget()}){
 records=Object.fromEntries(Object.entries(records).map(([key,row])=>[key,normalizeRtdb(row)]));
 const users={a:{uid:'a',nombre:'Admin ficticio',activo:true,rol:'admin'},u:{uid:'u',nombre:'Uno',activo:true,rol:'vendedor'},v:{uid:'v',nombre:'Dos',activo:true,rol:'vendedor'}},identities={a:{activo:true,rol:'admin'},u:{activo:true,rol:'vendedor'},v:{activo:true,rol:'vendedor'}},permissions={admin:{indiceVersion:2,indiceRevision:7,indiceModulos:{dashboard:true,presupuesto:true}},vendedor:{indiceVersion:2,indiceRevision:7,indiceModulos:{dashboard:true,presupuesto:true}}};
 const model=Model.build({records,complete:true,users,identities,permissions,generation:'reader-fixture-generation',revision:1,offsetMinutes:-180}),tree=Index.bootstrap({model,records}).patch[Index.ROOT];
 return {sv_usuarios:users,sv_chat_roles:identities,sv_permisos:permissions,sv_dashboard_budget_proposal:{v1:tree},sisventas:{presupuestos:records,ventas:{sentinel:{total:777}},pagos:{sentinel:{monto:33}}}};
}
function authFixture(actorUid='u'){
 const calls=[],claims={uid:actorUid,svAccessVersion:1,iat:1700000000,auth_time:1700000000};let hook;
 return {calls,claims,setHook(fn){hook=fn;},async verifyIdToken(token,revoked){assert.equal(token,'fixture-token');assert.equal(revoked,true);calls.push({revoked});if(hook)await hook(calls.length);return structuredClone(claims);}};
}
function request(extra={}){return {method:'GET',url:'/commercial/dashboard/presupuestos',headers:{authorization:'Bearer fixture-token'},...extra};}
function traceDb(db,{onRead}={}){
 const reads=[];
 function wrap(ref,path,spec={}){return {
  orderByChild(field){return wrap(ref.orderByChild(field),path,{...spec,field});},equalTo(value){return wrap(ref.equalTo(value),path,{...spec,equalTo:value});},
  orderByKey(){return wrap(ref.orderByKey(),path,{...spec,orderBy:'key'});},startAt(value){return wrap(ref.startAt(value),path,{...spec,startAt:value});},startAfter(value){return wrap(ref.startAfter(value),path,{...spec,startAfter:value});},limitToFirst(limit){return wrap(ref.limitToFirst(limit),path,{...spec,limit});},
  async get(){
   assert(!path.startsWith('sisventas/'),'reader cannot load originals');
   if(path==='sv_usuarios'){assert.equal(spec.field,'uid');assert.equal(typeof spec.equalTo,'string');assert.equal(spec.limit,2);}
   else if(/\/(?:document|noticeBadge)\//.test(path)){assert.equal(spec.orderBy,'key');assert(spec.limit>=1&&spec.limit<=50);}
   else if(/\/monthMembers\/(?:all|u_[A-Za-z0-9_-]+)\/[a-f0-9]{64}$/.test(path)){assert.equal(spec.orderBy,'key');assert.equal(spec.limit,1);}
   else if(/\/(?:months|monthProof)\/(?:all|u_[A-Za-z0-9_-]+)\/[a-f0-9]{64}$/.test(path))assert.equal(spec.limit,undefined);
   else assert(/^(?:sv_access_resets\/[auv]|sv_chat_roles\/[auv]|sv_permisos\/(?:admin|vendedor)|sv_dashboard_budget_proposal\/v1\/(?:coverage|policy|stats\/(?:all|u_[uv])|scopeProof\/(?:all|u_[uv])))$/.test(path),'unexpected point '+path);
   const snapshot=await ref.get();reads.push({path,...spec});if(onRead)await onRead({path,spec,reads});return snapshot;
  }
 };}
 return {reads,db:{ref:path=>wrap(db.ref(path),path)}};
}
module.exports={budget,seed,authFixture,request,traceDb};
