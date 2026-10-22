'use strict';

const COLLECTIONS=new Set(['sisventas/ventas','sisventas/presupuestos']);
const copy=text=>JSON.parse(text);
const failure=(upstreamStatus)=>Object.assign(new Error('No se pudo actualizar el listado comercial. Reintentá cuando se restablezca la conexión.'),{
 statusCode:503,code:'SV_COMMERCIAL_COLLECTION_READ',...(upstreamStatus?{upstreamStatus}:{})
});

function createCommercialCollectionReader({databaseURL,accessToken,fetchImpl=fetch,maxBytes=8*1024*1024,requestMs=20000}={}){
 let base;
 try{base=new URL(databaseURL);}catch(_){throw new Error('Configuración de datos comerciales inválida');}
 const loopback=['localhost','127.0.0.1','[::1]'].includes(base.hostname);
 if((base.protocol!=='https:'&&!(base.protocol==='http:'&&loopback))||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw new Error('Configuración de datos comerciales inválida');
 if(typeof accessToken!=='function'||typeof fetchImpl!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<0||!Number.isSafeInteger(requestMs)||requestMs<1||requestMs>2147483647)throw new Error('Configuración de lectura comercial inválida');
 // Sólo datos, nunca autorizaciones. Dos raíces permitidas y memoria acotada
 // por raíz. Cada petición valida otra vez la versión contra la base real.
 const slots=new Map();
 function slotFor(path){if(!slots.has(path))slots.set(path,{requested:0,settled:0,entry:null});return slots.get(path);}
 const etagValid=value=>typeof value==='string'&&value.length>0&&value.length<=1024&&!/[\x00-\x20\x7f]/.test(value);
 async function discard(response){try{await response?.body?.cancel?.();}catch(_){} }
 async function read(path){
  if(!COLLECTIONS.has(path))throw new Error('Colección comercial no permitida');
  const slot=slotFor(path),sequence=++slot.requested,previous=slot.entry;
  const settle=entry=>{if(sequence>=slot.settled){slot.settled=sequence;slot.entry=entry;}};
  try{
   const token=await accessToken();
   if(typeof token!=='string'||!token||/[\x00-\x20\x7f]/.test(token))throw failure();
   const response=await fetchImpl(new URL(path+'.json',base),{
    method:'GET',headers:{Authorization:'Bearer '+token,'X-Firebase-ETag':'true',...(previous?{'If-None-Match':previous.etag}:{})},
    cache:'no-store',redirect:'error',signal:AbortSignal.timeout(requestMs)
   });
   if(response.status===304){
    // Usar la copia vinculada al validador de ESTA solicitud, aunque otra
    // solicitud ya haya confirmado una versión posterior en la misma instancia.
    await discard(response);
    if(!previous)throw failure();
    const value=copy(previous.text);settle(previous);return value;
   }
   if(response.status!==200||!response.ok){await discard(response);throw failure(response.status);}
   const value=await response.json(),text=JSON.stringify(value);
   if(typeof text!=='string')throw failure();
   const etag=response.headers?.get?.('etag');
   settle(etagValid(etag)&&Buffer.byteLength(text)<=maxBytes?Object.freeze({etag,text}):null);
   // La respuesta y todas las reutilizaciones posteriores son copias aisladas.
   // Un consumidor no puede editar inadvertidamente la versión validada.
   return copy(text);
  }catch(error){
   // Fallar cerrado: nunca servir la copia anterior al fallar la red, Auth o
   // JSON. Un fallo viejo tampoco puede expulsar una respuesta más reciente.
   settle(null);
   throw failure(error?.upstreamStatus);
  }
 }
 return Object.freeze({read});
}

module.exports={createCommercialCollectionReader};
