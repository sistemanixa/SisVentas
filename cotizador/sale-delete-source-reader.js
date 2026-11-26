'use strict';
// Instance lifetime is ONE authorized delete/lease. No process cache or TTL.
const roots=new Set(['sisventas/ventas','sisventas/gastos','sisventas/ctaemp','sisventas/comisiones_generacion','sv_commission_generation']);
const fail=status=>Object.assign(Error('No se pudo verificar la fuente completa del borrado.'),{statusCode:503,code:'SV_SALE_DELETE_SOURCE_READ',...(status?{upstreamStatus:status}:{})});
const etagValid=v=>typeof v==='string'&&v.length>0&&v.length<=1024&&!/[\x00-\x20\x7f]/.test(v);
function discard(response){try{void response?.body?.cancel?.().catch(()=>{});}catch(_){}}
async function textBounded(response,limit,signal){
 if(!response.body?.getReader)throw fail();const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true}),pieces=[];let bytes=0;
 const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
 try{for(;;){if(signal.aborted)throw fail();const item=await reader.read();if(signal.aborted)throw fail();if(item.done)break;bytes+=item.value.byteLength;if(bytes>limit)throw Object.assign(Error('La fuente supera el alcance permitido para el borrado.'),{statusCode:413,code:'SV_SALE_DELETE_LIVE_SCOPE_SIZE'});pieces.push(decoder.decode(item.value,{stream:true}));}pieces.push(decoder.decode());return pieces.join('');}
 finally{signal.removeEventListener('abort',abort);try{void reader.cancel().catch(()=>{});}catch(_){}try{reader.releaseLock();}catch(_){}}
}
function create({databaseURL,accessToken,fetchImpl=fetch,requestMs=20000}={}){
 let base;try{base=new URL(databaseURL);}catch(_){throw TypeError('Configuración de fuentes inválida');}
 const local=['127.0.0.1','localhost'].includes(base.hostname),keys=[...base.searchParams.keys()];
 if((base.protocol!=='https:'&&!(base.protocol==='http:'&&local))||base.username||base.password||base.hash||base.pathname!=='/'||base.search&&(!local||base.protocol!=='http:'||keys.length!==1||keys[0]!=='ns'||!base.searchParams.get('ns'))||typeof accessToken!=='function'||typeof fetchImpl!=='function'||!Number.isSafeInteger(requestMs)||requestMs<1||requestMs>2147483647)throw TypeError('Configuración de fuentes inválida');
 const namespace=local?base.searchParams.get('ns'):null;base.search='';const slots=new Map(),active=new Set();let disposed=false;
 async function read(path){
  if(disposed||!roots.has(path))throw fail();if(!slots.has(path))slots.set(path,{requested:0,settled:0,entry:null});
  const slot=slots.get(path),sequence=++slot.requested,previous=slot.entry,controller=new AbortController();active.add(controller);
  const settle=entry=>{if(!disposed&&sequence>=slot.settled){slot.settled=sequence;slot.entry=entry;}};let response,timer,onAbort;
  try{
   const work=async()=>{const token=await accessToken();if(disposed||controller.signal.aborted||typeof token!=='string'||!token||/[\x00-\x20\x7f]/.test(token))throw fail();
    const target=new URL(path+'.json',base);if(namespace)target.searchParams.set('ns',namespace);
    response=await fetchImpl(target,{method:'GET',headers:{Authorization:'Bearer '+token,'X-Firebase-ETag':'true',...(previous?{'If-None-Match':previous.etag}:{})},cache:'no-store',redirect:'error',signal:controller.signal});
    if(disposed||controller.signal.aborted){await discard(response);throw fail();}
    if(response.status===304){await discard(response);if(!previous)throw fail();const tag=response.headers?.get?.('etag');if(tag!=null&&tag!==previous.etag)throw fail();settle(previous);return JSON.parse(previous.text);}
    if(response.status!==200||!response.ok){await discard(response);throw fail(response.status);}
    const text=await textBounded(response,path==='sisventas/gastos'?16*1024*1024:8*1024*1024,controller.signal);if(disposed||controller.signal.aborted)throw fail();
    const value=JSON.parse(text),tag=response.headers?.get?.('etag');settle(etagValid(tag)?Object.freeze({etag:tag,text}):null);return value;
   };
   return await Promise.race([work(),new Promise((_,reject)=>{onAbort=()=>reject(fail());controller.signal.addEventListener('abort',onAbort,{once:true});timer=setTimeout(()=>controller.abort(),requestMs);})]);
  }catch(error){settle(null);await discard(response);if(error?.code==='SV_SALE_DELETE_LIVE_SCOPE_SIZE')throw error;throw fail(error?.upstreamStatus);}
  finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);active.delete(controller);}
 }
 function dispose(){disposed=true;slots.clear();for(const controller of active)controller.abort();active.clear();}
 return Object.freeze({read,dispose});
}
module.exports={create};
