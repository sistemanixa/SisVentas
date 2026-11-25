'use strict';
// Frontera SDK/Auth de prueba. Index y controladores originales; HTTP de negocio real.
// No genera caps, commits, ACKs, recibos ni modelos financieros.
async function install(context){
 await context.route('**/js/core/firebase.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:`
 // SDK transport only; retain the actual application's native adapter installation.
 const get=window.fbGet,ref=window.fbRef;
 const sdk=()=>({set:window.fbSet,update:window.fbUpdate,push:window.fbPush,remove:window.fbRemove,runTransaction:window.fbRunTransaction,get,ref});
 if(window.SVRecordListModel&&window.SVRecordLists&&window.SVOperationalWritesFactory){
  window.SVRecordListWrites=window.SVOperationalWritesFactory(window,window.SVRecordListModel);
  window.SVRecordListWrites.install({sdk:sdk()});
  window.SVRecordLists.install({sdk:{get,ref,query:window.fbQuery,onValue:window.fbOnValue}});
 }
 window.SVOperationalWrites.install({sdk:sdk()});window.SVLaborWrites.install({sdk:sdk()});
 window.firebaseReady=true;document.dispatchEvent(new Event('firebase-ready'));
 export {};
 `}));
 await context.addInitScript(()=>{
  const network=window.fetch.bind(window),listeners=new Set(),pending=new Map();window.__qa={sdkWrites:[],http:[],reads:[],readFailures:[],errors:[],bootReady:false};
  addEventListener('error',e=>__qa.errors.push(e.message));addEventListener('unhandledrejection',e=>__qa.errors.push(String(e.reason?.message||e.reason)));
  const copy=v=>v==null?null:JSON.parse(JSON.stringify(v)),snapshot=value=>({val:()=>copy(value),exists:()=>value!=null,child:key=>snapshot(String(key).split('/').reduce((v,k)=>v?.[k],value)),forEach:fn=>Object.entries(value||{}).some(([key,v])=>fn({...snapshot(v),key})===true)});
  const headers=()=>({Authorization:'Bearer FIXTURE_ONLY'});
  async function read(ref){const key=JSON.stringify(ref);if(!pending.has(key))pending.set(key,network('/__qa/read?spec='+encodeURIComponent(key),{headers:headers()}).then(async r=>{if(!r.ok)throw Error('Fixture SDK read denied: '+ref.path);return r.json();}).finally(()=>pending.delete(key)));__qa.reads.push(ref.path);return pending.get(key);}
  async function refresh(){await Promise.all([...listeners].map(s=>s.deliver()));}
  window.fetch=async(input,options)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);let response;try{response=await network(input,options);__qa.http.push({path:url.pathname,status:response.status});}catch(error){__qa.http.push({path:url.pathname,error:error.message});throw error;}if((options?.method||'GET')==='POST'&&!url.pathname.startsWith('/__qa/')){const body=await response.clone().json().catch(()=>null);if(body?.committed===true||body?.status==='confirmed')queueMicrotask(()=>refresh().catch(e=>__qa.errors.push(e.message)));}return response;};
  window.fbDB={fixture:true};window.fbRef=(_,path='')=>({path,key:path.split('/').at(-1),toString:()=>location.origin+'/'+path});window.fbQuery=(ref,...specs)=>Object.assign({},ref,...specs);
  window.fbOrderByChild=orderBy=>({orderBy});window.fbOrderByKey=()=>({orderBy:'$key'});window.fbEqualTo=equalTo=>({equalTo});window.fbStartAt=startAt=>({startAt});window.fbStartAfter=startAfter=>({startAfter});window.fbEndAt=endAt=>({endAt});window.fbEndBefore=endBefore=>({endBefore});window.fbLimitToFirst=limit=>({limit});window.fbLimitToLast=limit=>({limit,last:true});
  window.fbGet=async ref=>{const loading=window.SVDataReadiness?.begin(ref);try{const value=await read(ref);loading?.ready();return snapshot(value);}catch(error){loading?.error();throw error;}};window.fbOnValue=(ref,callback,onError)=>{const loading=window.SVDataReadiness?.begin(ref),s={active:true,deliver:async()=>{try{const value=await read(ref);if(s.active){await callback(snapshot(value));loading?.ready();}}catch(error){loading?.error();__qa.readFailures.push({path:ref.path,message:error.message,stack:error.stack});if(s.active)onError?.(error);}}};listeners.add(s);void s.deliver();return()=>{s.active=false;loading?.cancel();listeners.delete(s);};};
  window.fbStopAllValueListeners=()=>{for(const s of listeners)s.active=false;listeners.clear();};window.fbOff=()=>{};window.fbOnAuth=()=>()=>{};
  window.fbAuth={currentUser:{uid:'',getIdToken:async()=>'FIXTURE_ONLY'}};
  for(const name of ['fbSet','fbUpdate','fbRemove','fbPush','fbRunTransaction'])window[name]=(...args)=>{__qa.sdkWrites.push({name,path:args[0]?.path});throw Error('SDK write forbidden: '+name);};
  window.fbOnDisconnect=()=>({remove:async()=>{},set:async()=>{},cancel:async()=>{}});window.fbServerTimestamp=()=>Date.now();window.fbGoOnline=()=>{};window.fbGoOffline=()=>{};window.fbSignOut=async()=>{};
  document.addEventListener('DOMContentLoaded',async()=>{try{
   const r=await network('/__qa/session',{headers:headers()});if(!r.ok)throw Error('Sesión fixture no preparada: '+await r.text());const s=await r.json();
   isAuthenticated=true;currentUserUid=s.uid;currentRole=s.role;currentUser=s.name;currentUserEmail='fixture@example.invalid';PERMISOS_ROLES=s.permissions;
   Object.assign(window,{currentUserUid,currentRole,currentUser,PERMISOS_ROLES});fbAuth.currentUser.uid=s.uid;fbAuth.currentUser.email=currentUserEmail;
   SISVENTAS_FUNCTIONS.cotizadorProveedor=location.origin;document.body.classList.remove('sv-sesion-cerrada');for(const id of ['screen-login','screen-loading']){const el=document.getElementById(id);if(el)el.style.display='none';}
   const app=document.getElementById('screen-app');app.style.display='flex';app.classList.add('visible');app.inert=false;
   document.dispatchEvent(new Event('sisventas:session-ready'));showPage('ordenes');await fbCargarTodo();__qa.bootReady=true;
  }catch(error){__qa.errors.push(error.message);}});
 });
}
module.exports={install};
