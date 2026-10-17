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
 function deadline(task,milliseconds=20000,clock=root.setTimeout?root:globalThis){
  let timer;return Promise.race([Promise.resolve(task),new Promise((_,reject)=>{timer=clock.setTimeout(()=>reject(Object.assign(Error('La verificación de acceso demoró demasiado. Podés volver a intentar.'),{name:'TimeoutError',code:'SV_AUTH_LOAD_TIMEOUT'})),milliseconds);})]).finally(()=>clock.clearTimeout(timer));
 }
 const api={recoverable,create,deadline};if(typeof module!=='undefined')module.exports=api;
 if(root.document)root.SVSessionRecovery=api;
})(typeof window==='undefined'?{}:window);
