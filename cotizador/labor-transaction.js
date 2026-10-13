'use strict';
// Solo servidor. ETag conserva la atomicidad sin el límite de 16 MB del SDK.
function createRootTransaction({databaseURL,accessToken,fetchImpl=fetch}){
 return async function transaction(update){
  const token=await accessToken();const url=databaseURL.replace(/\/$/,'')+'/sisventas.json';
  for(let attempt=0;attempt<5;attempt++){
   const read=await fetchImpl(url,{headers:{Authorization:'Bearer '+token,'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(90000)});
   if(!read.ok)throw Error('No se pudo leer la operación laboral');
   const etag=read.headers.get('etag');if(!etag)throw Error('No se pudo verificar la versión de datos');
   const next=update(await read.json());if(next===undefined)return {committed:false};
   if(next===null)return {committed:false};
   const body=JSON.stringify(next);if(Buffer.byteLength(body)>128*1024*1024)throw Error('La operación requiere una migración de almacenamiento');
   const write=await fetchImpl(url,{method:'PUT',headers:{Authorization:'Bearer '+token,'if-match':etag,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(90000)});
   if(write.status===412)continue;if(!write.ok)throw Error('No se pudo confirmar la operación laboral');
   return {committed:true};
  }
  return {committed:false};
 };
}
module.exports={createRootTransaction};
