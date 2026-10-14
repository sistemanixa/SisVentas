'use strict';
// Solo servidor. ETag conserva la atomicidad sin el límite de 16 MB del SDK.
function createRootTransaction({databaseURL,accessToken,fetchImpl=fetch}){
 return async function transaction(update){
  const token=await accessToken();const url=databaseURL.replace(/\/$/,'')+'/sisventas.json';
  let pendiente=null;
  for(let attempt=0;attempt<5;attempt++){
   let etag,actual;
   if(pendiente){({etag,actual}=pendiente);pendiente=null;}
   else{
    const read=await fetchImpl(url,{headers:{Authorization:'Bearer '+token,'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(90000)});
    if(!read.ok)throw Error('No se pudo leer la operación laboral');
    etag=read.headers.get('etag');if(!etag)throw Error('No se pudo verificar la versión de datos');
    actual=await read.json();
   }
   const next=update(actual);if(next===undefined)return {committed:false};
   if(next===null)return {committed:false};
   const body=JSON.stringify(next);if(Buffer.byteLength(body)>128*1024*1024)throw Error('La operación requiere una migración de almacenamiento');
   // Tanto el éxito como un conflicto pueden incluir una respuesta grande.
   // Liberarla antes de reintentar evita transferencias y conexiones pendientes.
   // Firebase no admite combinar print=silent con if-match.
   const write=await fetchImpl(url,{method:'PUT',headers:{Authorization:'Bearer '+token,'if-match':etag,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(90000)});
   if(write.status===412){
    // Firebase devuelve la versión vigente y su ETag con el conflicto.
    // Revalidar esa versión evita otra descarga y acorta la ventana de carrera.
    const vigente=write.headers&&write.headers.get('etag');
    if(vigente&&typeof write.json==='function')pendiente={etag:vigente,actual:await write.json()};
    else if(write.body && typeof write.body.cancel==='function')await write.body.cancel();
    console.warn('[labor-transaction] Conflicto de versión; intento '+(attempt+1));continue;
   }
   if(write.body && typeof write.body.cancel==='function')await write.body.cancel();
   if(!write.ok)throw Error('No se pudo confirmar la operación laboral');
   return {committed:true};
  }
  throw Object.assign(Error('Los datos cambiaron durante el guardado. No se guardó la operación; volvé a intentarlo.'),{statusCode:409});
 };
}
module.exports={createRootTransaction};
