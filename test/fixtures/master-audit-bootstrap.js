'use strict';
window.__qa={errors:[],reads:[],writes:[],blocked:[],subscriptions:new Set()};
addEventListener('error',e=>__qa.errors.push(e.message));addEventListener('unhandledrejection',e=>__qa.errors.push(String(e.reason?.message||e.reason)));
const qaFetch=fetch.bind(window);window.fetch=async(input,opts)=>{const u=new URL(typeof input==='string'?input:input.url,location.href);if(u.origin!==location.origin){__qa.blocked.push(u.origin+u.pathname);throw Error('Auditoría: servicio externo bloqueado');}const response=await qaFetch(input,opts);if(response.ok&&opts?.method==='POST'&&['/laboral/escritura','/cobranzas/operacion'].includes(u.pathname))queueMicrotask(qaDeliver);return response;};
const qaSnap=(v,key)=>({key,val:()=>v==null?null:structuredClone(v),exists:()=>v!=null,forEach:cb=>Object.entries(v||{}).forEach(([k,x])=>cb(qaSnap(x,k)))});
window.fbDB={fixture:true};window.fbRef=(_,path='')=>({path,key:path.split('/').at(-1),toString:()=>path});
const qaPath=r=>r?.path??String(r||'');window.fbGet=async ref=>{const path=qaPath(ref);__qa.reads.push(path);if(path==='.info/connected')return qaSnap(true);if(path==='.info/serverTimeOffset')return qaSnap(0);const r=await fetch('/audit/db?path='+encodeURIComponent(path));const d=await r.json();if(!r.ok)throw Error(d.mensaje);return qaSnap(d.value,ref.key);};
async function qaDeliver(){for(const s of [...__qa.subscriptions])if(s.active){try{const value=await fbGet(s.ref);if(s.active)s.fn(value);}catch(e){__qa.errors.push('Fixture: '+e.message);}}}
async function qaWrite(kind,ref,value,expected){const path=qaPath(ref);__qa.writes.push({kind,path});const r=await fetch('/audit/sdk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,path,value,expected})}),d=await r.json();if(!r.ok)throw Error(d.mensaje);queueMicrotask(qaDeliver);return d;}
window.fbSet=(r,v)=>qaWrite('set',r,v);window.fbUpdate=(r,v)=>qaWrite('update',r,v);window.fbRemove=r=>qaWrite('remove',r,null);let qaSeq=0;
window.fbPush=(r,v)=>{const ref=fbRef(fbDB,qaPath(r)+'/qa_'+(++qaSeq));if(v===undefined)return ref;return qaWrite('set',ref,v).then(()=>ref);};
window.fbRunTransaction=async(r,fn)=>{const before=(await fbGet(r)).val(),v=fn(before);if(v===undefined)return {committed:false,snapshot:qaSnap(before)};await qaWrite('transaction',r,v,before);return {committed:true,snapshot:qaSnap(v)};};
window.fbOnValue=(ref,fn,error)=>{const source=window.SVDataReadiness?.begin('https://fixture.invalid/'+qaPath(ref)),s={ref,fn,active:true};__qa.subscriptions.add(s);fbGet(ref).then(snap=>{if(!s.active)return;fn(snap);source?.ready();}).catch(e=>{source?.error();error?.(e);});return()=>{s.active=false;__qa.subscriptions.delete(s);source?.cancel();};};
window.fbOff=()=>{};window.fbOnAuth=()=>()=>{};window.fbStopAllValueListeners=()=>{for(const s of __qa.subscriptions)s.active=false;__qa.subscriptions.clear();};
window.fbAuth={currentUser:{uid:'u',email:'qa@example.invalid',getIdToken:async()=>'fixture-token'}};window.fbSignOut=async()=>{};
window.fbQuery=r=>r;window.fbOrderByChild=()=>null;window.fbEqualTo=()=>null;window.fbLimitToLast=()=>null;window.fbServerTimestamp=()=>Date.now();window.fbOnDisconnect=()=>({remove:async()=>{},set:async()=>{},cancel:async()=>{}});
window.SISVENTAS_FUNCTIONS={cotizadorProveedor:location.origin,asistente:location.origin};window.SVServiceAuth={headers:async h=>({...h,Authorization:'Bearer fixture-token'})};
window.SV_PROJECTS_ENABLED=false;
