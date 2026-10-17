(function(root){
 'use strict';
 function recoverable(error){
  if([401,403].includes(Number(error?.status))||[401,403].includes(Number(error?.statusCode))||['auth/user-disabled','auth/id-token-revoked','auth/user-token-expired','PERMISSION_DENIED','permission-denied'].includes(error?.code))return false;
  return ['SV_ASSET_LOAD','auth/network-request-failed','app/network-error'].includes(error?.code)||['TypeError','TimeoutError','AbortError','SyntaxError'].includes(error?.name)||Number(error?.status)>=500;
 }
 function create(env){
  let revision=0;
  function offer(error,user){
   if(!user||env.currentUser()!==user)return false;
   if(!recoverable(error))return false;
   const ticket=++revision;env.block();let busy=false;
   env.show(error,async()=>{
    if(busy||ticket!==revision||env.currentUser()!==user)return;
    busy=true;
    try{await env.retry(user);if(ticket===revision)revision++;}catch(next){
     if(ticket!==revision||env.currentUser()!==user)return;
     if(!offer(next,user)){env.block();env.deny(next);}
    }finally{busy=false;}
   });return true;
  }
  return {offer};
 }
 async function diagnoseLocalServer(error,env=root){
  if(!recoverable(error)||!['localhost','127.0.0.1','[::1]'].includes(env.location?.hostname)||typeof env.fetch!=='function')return error;
  const controller=new AbortController();let timer;
  try{
   // Ruta única y no navegable: el SW no puede confundir un índice cacheado con un servidor vivo.
   const nonce=Date.now()+'-'+Math.random().toString(36).slice(2),url=new URL('./__sv_local_probe__/'+nonce,env.location.href);
   const timeout=new Promise((_,reject)=>{timer=(env.setTimeout||setTimeout)(()=>{controller.abort();reject(Error('Servidor sin respuesta'));},1500);});
   const response=await Promise.race([env.fetch(url.href,{cache:'no-store',credentials:'omit',signal:controller.signal}),timeout]);
   if(response.type==='error'||!response.status||response.status===200&&response.headers?.get?.('x-sv-local-probe')!==nonce)throw Error('Servidor no disponible');
   // Un404 también confirma que el servidor está encendido; no ocultar el fallo de módulo.
  }catch(_){error.localServerUnavailable=true;error.userMessage='El servidor local está apagado o no responde. Inicialo y presioná «Reintentar carga».';}
  finally{(env.clearTimeout||clearTimeout)(timer);}
  return error;
 }
 function deadline(task,milliseconds=20000,clock=root.setTimeout?root:globalThis){
  let timer;return Promise.race([Promise.resolve(task),new Promise((_,reject)=>{timer=clock.setTimeout(()=>reject(Object.assign(Error('La verificación de acceso demoró demasiado. Podés volver a intentar.'),{name:'TimeoutError',code:'SV_AUTH_LOAD_TIMEOUT'})),milliseconds);})]).finally(()=>clock.clearTimeout(timer));
 }
 const api={recoverable,create,deadline,diagnoseLocalServer};if(typeof module!=='undefined')module.exports=api;
 if(root.document)root.SVSessionRecovery=api;
})(typeof window==='undefined'?{}:window);
