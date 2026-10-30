'use strict';
// One action, one atomic PATCH. The rules compare the original text/edit
// revision and (for deletion) the read nonce before accepting either side.
function createChatHeaderStore({databaseURL,accessToken,fetchImpl=fetch,isReady=async()=>true}){
 const base=new URL(databaseURL);if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname)))throw Error('Destino inválido');
 return {ready:isReady,async commit(actor,body,before,after,legacyUnique){
  const root='sv_chat/'+actor.channel+'/'+body.key,header='sv_chat_headers/'+actor.channel+'/'+body.key,patch={};
  const fields=body.action==='editar'?['texto','editadoEn','editadoPorUid']:['texto','eliminado','fotoUrl','audioUrl','archivoUrl','eliminadoEn','eliminadoPorUid'];
  for(const field of fields)patch[root+'/'+field]=after[field]??null;
  for(const field of ['texto','editadoEn','eliminado'])if(Object.hasOwn(after,field)&&after[field]!==before[field])patch[header+'/'+field]=after[field];
  if(body.action==='eliminar')for(const field of ['fotoUrl','audioUrl','archivoUrl'])patch[header+'/'+field]=null;
  const url=new URL('.json',base.href.replace(/\/?$/,'/'));
  url.searchParams.set('auth_variable_override',JSON.stringify({uid:actor.uid,token:{...actor.claims,svChatService:true,svChatAction:body.action,svChatLegacyOwner:legacyUnique,svChatExpectedText:before.texto??null,svChatExpectedEdit:before.editadoEn??null,svChatExpectedRead:before.leidoNonce??null}}));
  url.searchParams.set('print','silent');
  const response=await fetchImpl(url,{method:'PATCH',headers:{Authorization:'Bearer '+await accessToken(),'Content-Type':'application/json'},body:JSON.stringify(patch),signal:AbortSignal.timeout(20000)});
  await response.body?.cancel();
  if(!response.ok)throw Object.assign(Error('El mensaje o sus permisos cambiaron. Volvé a revisarlo.'),{statusCode:response.status===401||response.status===403?409:503});
 }};
}
module.exports={createChatHeaderStore};
