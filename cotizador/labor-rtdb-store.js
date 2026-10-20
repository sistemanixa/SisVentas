'use strict';
const {parts}=require('./labor-guard');
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
function createLaborRtdbStore({databaseURL,accessToken,fetchImpl=fetch,now=Date.now,requestMs=20000}){
 const base=new URL(databaseURL);if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname)))throw Error('Destino de datos inválido');
 const local=['127.0.0.1','localhost'].includes(base.hostname),namespace=local?base.searchParams.get('ns'):null;
 if(base.search&&(!local||[...base.searchParams.keys()].some(key=>key!=='ns')))throw Error('Configuración de datos inválida');
 const root=new URL(base);root.search='';root.pathname=root.pathname.replace(/\/?$/,'/');
 function target(path){const result=new URL(path,root);if(namespace)result.searchParams.set('ns',namespace);return result;}
 function url(path,override,query){const result=target(parts(path).map(encodeURIComponent).join('/')+'.json');if(override!==undefined)result.searchParams.set('auth_variable_override',JSON.stringify(override));if(query)for(const [key,value]of Object.entries(query))result.searchParams.set(key,JSON.stringify(value));return result;}
 async function request(method,path,body,{override,headers={},query}={}){
  const token=await accessToken();const response=await fetchImpl(url(path,override,query),{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(requestMs)});
  if(!response.ok){await response.body?.cancel();throw fail(response.status===401||response.status===403?403:response.status===412?409:503,'No se pudo confirmar el acceso o el guardado',response.status===412?'SV_CAS_CONFLICT':undefined);}
  return response;
 }
 const service=(mode,lease,actor)=>({uid:actor?.mode==='user'?actor.uid:'sv-labor-service',token:{...(actor?.mode==='user'?actor.claims||{}:{}),svLaborService:true,mode,fence:lease.fence,opId:lease.opId,digest:lease.digest,actorUid:lease.actorUid,...(actor?.mode==='command'?{actorAccessVersion:actor.claims?.svAccessVersion||'',actorPasswordChangeRequired:actor.claims?.svPasswordChangeRequired===true,actorRole:actor.role||'',actorPermissionRevision:actor.permissionRevision??null}:{})}});
 async function read(path){const r=await request('GET',path);return r.json();}
 async function acquire(lease){
  // La exclusión la aplican las reglas en un PUT pequeño; no hay lectura raíz.
  let response;try{response=await request('PUT','sv_labor_guard',lease,{override:service('acquire',lease)});}catch(error){if(error.statusCode===403){const current=await read('sv_labor_guard');if(current?.expiresAt>now())throw fail(423,'Hay otro guardado en curso. Reintentá en unos segundos.','SV_LABOR_BUSY');}throw error;}await response.body?.cancel();
 }
 async function commit(patch,lease,actor){
  const token=await accessToken(),destination=target('.json');destination.searchParams.set('auth_variable_override',JSON.stringify(service('commit',lease,actor)));destination.searchParams.set('print','silent');
  const response=await fetchImpl(destination,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(patch),signal:AbortSignal.timeout(requestMs)});
  if(response.ok){await response.body?.cancel();return;}
  await response.body?.cancel();throw fail(response.status===401||response.status===403?409:503,'No se pudo confirmar la operación. Revisá su estado antes de reintentar.','SV_LABOR_COMMIT_UNCONFIRMED');
 }
 async function abort(lease){const r=await request('DELETE','sv_labor_guard',undefined,{override:service('abort',lease)});await r.body?.cancel();}
 return {read,acquire,commit,abort,query:async(path,field,value)=>{const r=await request('GET',path,undefined,{query:{orderBy:field,equalTo:value}});return r.json();},readAsUser:async(path,actor)=>{const r=await request('GET',path,undefined,{override:{uid:actor.uid,token:actor.claims||{}}});return r.json();}};
}
module.exports={createLaborRtdbStore};
