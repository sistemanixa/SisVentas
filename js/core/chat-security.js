(function(root){
 'use strict';
 async function modify(channel,key,action,values){
  const user=root.fbAuth?.currentUser;if(!user||root._impersonacionOriginal)throw Error('Volvé a tu usuario para usar el chat');
  const token=await user.getIdToken();if(user!==root.fbAuth.currentUser)throw Error('La sesión cambió');
  const response=await fetch(root.SISVENTAS_FUNCTIONS.cotizadorProveedor+'/chat/mensaje',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({channel,key,action,...values}),signal:AbortSignal.timeout(20000)});
  const result=await response.json().catch(()=>({}));if(user!==root.fbAuth.currentUser)throw Error('La sesión cambió');
  if(!response.ok||!result.ok)throw Error(result.mensaje||'No se pudo confirmar el cambio. Revisá el mensaje antes de reintentar');return result;
 }
 root.SVChatSecurity={modify};
})(window);
