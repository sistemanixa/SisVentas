'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {fixture}=require('./commercial-ownership-fixtures.cjs');
const {createBusinessAuth}=require('../../cotizador/user-access');
const {createCommercialOwnership}=require('../../cotizador/commercial-ownership');
const {createLaborRtdbStore}=require('../../cotizador/labor-rtdb-store');
const Index=require('../../cotizador/payment-membership-index');
const {create}=require('../../cotizador/commercial-sale-payments');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function setup({rtt=0,serial=false,rich=false,authFactory=createBusinessAuth,ownershipFactory=createCommercialOwnership,readerFactory=create}={}){
 const f=fixture(),root=f.db.root,events=[],control={hook:null,invalid:false,deny:false};
 root.sisventas.ventas.one.responsableUid='a';root.sisventas.pagos={p:{ventaFbKey:'one',monto:40}};
 if(rich)Object.assign(root.sisventas.ventas.one,{idOriginal:'V-101',numeroOriginal:'V-102',ventaIdOriginal:'V-103',numero:'V-104'});
 const get=p=>p.split('/').reduce((v,k)=>v?.[k],root)??null;
 const put=(p,v)=>{const keys=p.split('/');let node=root;for(const k of keys.slice(0,-1))node=node[k]??={};node[keys.at(-1)]=v;};
 for(const [p,v]of Object.entries(Index.buildIndex(root.sisventas.pagos,{generation:'latency-fixture',ready:true}).patch))put(p,v);
 async function point(path,kind='point',delay=rtt){events.push({path,kind,phase:'start'});await wait(delay);const value=structuredClone(get(path));await control.hook?.(path,kind);events.push({path,kind,phase:'end'});return value;}
 const db={ref:path=>({get:async()=>{const value=await point(path);return {val:()=>value};}})};
 const rawAuth={verifyIdToken:async(token,revoked)=>{a.equal(revoked,true);events.push({path:'token',phase:'start'});await wait(rtt);if(control.invalid)throw Error('revoked');events.push({path:'token',phase:'end'});return {uid:token};}};
 const auth=authFactory(rawAuth,db);if(serial)delete auth.verifyIdTokenWithContext;
 const store=createLaborRtdbStore({databaseURL:'http://127.0.0.1:1/?ns=latency-fictitious',accessToken:async()=>'FIXTURE_ONLY',fetchImpl:async(url,options)=>{
  a.equal(options.method,'GET');const u=new URL(url),path=decodeURIComponent(u.pathname).slice(1,-5),actor=JSON.parse(u.searchParams.get('auth_variable_override')||'null');
  if(actor){a.equal(actor.uid,'a');if(control.deny||root.sv_chat_roles.a.activo!==true||root.sv_access_resets?.a?.required)return {ok:false,status:403,json:async()=>({})};}
  const value=await point(path,actor?'user':'service');return {ok:true,status:200,json:async()=>value};
 }});
 const ownership=ownershipFactory({auth,db,enabled:true,scopedReads:true,queryReader:async(path,field,uid)=>{
  a.equal(path,'sv_usuarios');a.equal(field,'uid');const users=await point(path,'query',2*rtt);return Object.fromEntries(Object.entries(users).filter(([,u])=>u.uid===uid));
 },readAsUser:(path,actor)=>store.readAsUser(path,actor)});
 const req={headers:{authorization:'Bearer a'}},service=readerFactory({ownership,store,observe(){}});
 const authorize=()=>ownership.authorize(req,'ventas');
 async function load(){const actor=await authorize(),record=(await ownership.readAuthorizedRecordsByIds(actor,'ventas',['one'])).one;return service.load({req,actor,record,saleKey:'one'});}
 return {root,events,control,authorize,load,ownership,req};
}

module.exports={setup,wait};
