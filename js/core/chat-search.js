(function(root){
 'use strict';let active=false,page=0,channel='';
 function controls(){let node=document.getElementById('chat-history-controls');if(!node){node=document.createElement('div');node.id='chat-history-controls';node.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;font-size:11px;color:var(--text3);flex-wrap:wrap';const messages=document.getElementById('chat-messages');messages?.parentNode.insertBefore(node,messages);}return node;}
 function stop(){if(root._chatListener){root._chatListener();root._chatListener=null;}root._chatHistory=null;}
 function reset(){active=false;page=0;channel='';}
 function restore(){reset();root.chatCargarCanal(root._chatCanal);}
 function search(nextPage=0){
  if(typeof root.chatPuedeAccederCanal!=='function'||!root.chatPuedeAccederCanal(root._chatCanal)){stop();reset();return;}
  const input=document.getElementById('chat-buscar'),term=String(input?.value||'').trim().toLocaleLowerCase();
  if(!term){if(active)restore();else root.chatRenderMensajes(root._chatListaVisible);return;}
  active=true;channel=root._chatCanal;page=Math.max(0,Number(nextPage)||0);stop();
  const data=root.chatHeadersSnapshot(channel),container=document.getElementById('chat-messages'),bar=controls();
  if(data===null){bar.textContent='Preparando búsqueda…';return;}
  const matches=Object.entries(data).filter(([,m])=>[m.texto,m.autor,m.archivoNombre].join(' ').toLocaleLowerCase().includes(term)).sort((a,b)=>(b[1].ts||0)-(a[1].ts||0)||b[0].localeCompare(a[0]));
  const size=50,start=Math.min(page*size,Math.max(0,Math.floor((matches.length-1)/size)*size));page=Math.floor(start/size);
  bar.innerHTML='<span>'+matches.length+' coincidencias · Toda la conversación</span><button class="btn btn-sm" onclick="SVChatSearch.restore()">Volver a mensajes</button>';
  const esc=root.escapeHTML;container.innerHTML=matches.length?matches.slice(start,start+size).map(([key,m])=>'<button type="button" class="btn" style="display:block;width:100%;text-align:left;white-space:normal;margin:8px 0;padding:12px" data-chat-result="'+esc(key)+'" onclick="SVChatSearch.reveal(this.dataset.chatResult)"><strong>'+esc(m.autor||'')+'</strong><span style="display:block;font-size:12px;margin-top:5px">'+esc(String(m.texto||m.archivoNombre||'Adjunto').slice(0,180))+'</span></button>').join(''):'<p style="text-align:center;color:var(--text3);padding:20px">No hay mensajes que coincidan con tu búsqueda.</p>';
  if(start>0||start+size<matches.length)container.insertAdjacentHTML('beforeend','<div style="display:flex;justify-content:space-between;gap:8px;padding:12px"><button class="btn btn-sm" '+(page?'':'disabled')+' onclick="SVChatSearch.search('+Math.max(0,page-1)+')">Anterior</button><span>'+(start+1)+'–'+Math.min(start+size,matches.length)+' de '+matches.length+'</span><button class="btn btn-sm" '+(start+size<matches.length?'':'disabled')+' onclick="SVChatSearch.search('+(page+1)+')">Siguiente</button></div>');
 }
 function reveal(key){
  const target=root._chatCanal,user=root.fbAuth?.currentUser,role=root.currentRole;let path;try{if(!user||!root.chatPuedeAccederCanal(target))return;path=root.SVChatReadModel.paths(target,key).body;}catch(_){root.notify('No se puede abrir este mensaje.');return;}stop();reset();const id=++root._chatCargaId,input=document.getElementById('chat-buscar');if(input)input.value='';
  const bar=controls(),container=document.getElementById('chat-messages');bar.innerHTML='<span>Mensaje encontrado</span><button class="btn btn-sm" onclick="SVChatSearch.restore()">Volver a la conversación</button>';container.textContent='Cargando mensaje…';
  let reading=false;
  const unsubscribe=root.fbOnValue(root.fbRef(root.fbDB,path),snapshot=>{
   if(id!==root._chatCargaId||target!==root._chatCanal||user!==root.fbAuth?.currentUser||role!==root.currentRole||!root.chatPuedeAccederCanal(target)||!root.chatEstaLeyendo(target))return;
   const message=snapshot.val();if(!message){container.textContent='El mensaje ya no está disponible.';return;}
   root._chatPrimeraCarga=true;root.chatRenderMensajes([{fbKey:key,...message}]);
   const name=root.chatNombreSesion();if(!reading&&message.autor!==name&&!root._chatFueLeido(message,name)&&root.chatEstaLeyendo(target)){
    reading=true;root.SVChatReadModel.markRead(target,[key]).catch(()=>{if(id===root._chatCargaId)root.notify('No se pudo confirmar la lectura del mensaje.');}).finally(()=>{reading=false;});
   }
  },()=>{if(id===root._chatCargaId)container.textContent='No se pudo cargar el mensaje. Revisá la conexión y los permisos.';});
  root._chatListener=()=>{unsubscribe();bar.remove();};
 }
 root.SVChatSearch=Object.freeze({search,restore,reveal,reset,refresh:target=>{if(active&&target===channel)search(page);}});
})(window);
