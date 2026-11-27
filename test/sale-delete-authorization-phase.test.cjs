'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {create}=require('./helpers/sale-delete-native-http-lab.cjs');
const Access=require('../cotizador/user-access'),Gateway=require('../cotizador/labor-write-gateway'),Authorization=require('../cotizador/sale-delete-authorization');
const request={method:'POST',url:'/comerciales/ventas/eliminar',headers:{authorization:'Bearer FICTITIOUS_PHASE_TOKEN'}};
function actor(id){return {uid:'u',claims:{uid:'u',svAccessVersion:'lab-v1'},mode:'user',opId:id,operation:'phase-test',input:{id}};}
function firebase(f){return {verifyIdToken:async(token,revoked)=>{a.equal(token,'FICTITIOUS_PHASE_TOKEN');a.equal(revoked,true);if(f.control.revoked)throw Error('Revoked fixture identity');return {uid:'u',svAccessVersion:'lab-v1'};}};}
test('published scoped-DB authorization reproduces a false 401 inside the actual final commit phase',async()=>{
 const f=await create({mode:'targeted'});try{const bad=Gateway.createLaborWriteGateway({auth:Access.createBusinessAuth(firebase(f),f.runtime.db),db:f.runtime.db,enabled:true});
  await a.rejects(f.runtime.guard.run(actor('old-scoped-final-auth'),async scope=>{scope.beforeCommit(()=>bad.authorize(request));return {ok:true};}),{statusCode:401});a.equal(f.commits.length,0);
 }finally{await f.close();}
});
test('read-only access metadata keeps genuine final Auth outside closed business staging without any bypass or business read',async()=>{
 const f=await create({mode:'targeted'});try{const paths=[],raw={ref:path=>{paths.push(path);a(/^sv_(access_resets|chat_roles|permisos)\//.test(path));return {get:async()=>({val:()=>f.get(path)})};}},authorize=Authorization.create({auth:firebase(f),db:raw,enabled:true});
  const result=await f.runtime.guard.run(actor('new-fresh-final-auth'),async scope=>{scope.beforeCommit(async()=>{a.throws(()=>f.runtime.guard.current(),{code:'SV_LABOR_SCOPE_CLOSED'});a.equal((await authorize(request)).uid,'u');});return {ok:true};});
  a.equal(result.ok,true);a.equal(f.commits.length,1);a.deepEqual(paths,['sv_access_resets/u','sv_chat_roles/u']);a(!paths.some(p=>p.startsWith('sisventas/')));
 }finally{await f.close();}
});
for(const kind of ['revoked','reset','role'])test('fresh final authorization still rejects '+kind+' with zero commit',async()=>{
 const f=await create({mode:'targeted'});try{const authorize=Authorization.create({auth:firebase(f),db:{ref:path=>({get:async()=>({val:()=>f.get(path)})})},enabled:true});
  await a.rejects(f.runtime.guard.run(actor('fresh-final-'+kind),async scope=>{scope.beforeCommit(async()=>{if(kind==='revoked')f.control.revoked=true;if(kind==='reset')f.set('sv_access_resets/u/required',true);if(kind==='role')f.set('sv_chat_roles/u/activo',false);await authorize(request);});return {ok:true};}),e=>[401,403].includes(e.statusCode));a.equal(f.commits.length,0);
 }finally{await f.close();}
});
