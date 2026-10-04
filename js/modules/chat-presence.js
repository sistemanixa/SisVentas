(function(root){
 'use strict';
 let uid='',ownRef=null,stops=[],timer=null,peers={},epoch=0;
 const legacy=root.usuariosPresentesUnicos;
 function allowed(){return !!root.currentUserUid&&root.currentRole!=='compras_paraguay'&&(root.currentRole!=='distribuidora'||root.SVDistribuidora?.allowed('chat'));}
 function refresh(){
  const label=document.getElementById('chat-online-label'),count=root.usuariosPresentesUnicos(false).length;
  if(label)label.textContent=count?count+(count===1?' persona conectada':' personas conectadas'):'Nadie más conectado';
  if(!document.getElementById('chat-modal')?.classList.contains('open'))return;
  if(root._chatCanal==='directos')root.chatAbrirDirectos?.(true);
  else{document.getElementById('chat-online-banner')?.remove();const html=root.chatOnlineEnCanal?.(root._chatCanal),messages=document.getElementById('chat-messages');if(html&&messages){const banner=document.createElement('div');banner.id='chat-online-banner';banner.innerHTML=html;messages.before(banner);}}
 }
 root.usuariosPresentesUnicos=function(includeSelf){
  const all=[...(legacy?legacy(includeSelf):[]),...Object.values(peers).flatMap(v=>Object.values(v||{}))],unique=new Map();
  all.forEach(p=>{if(!root.presenciaEstaActiva(p)||(!includeSelf&&p.uid===root.currentUserUid))return;const key=p.uid||root.normalizarIdentidadPresencia(p.nombre);if(!unique.has(key)||Number(p.ultimaConexion)>Number(unique.get(key).ultimaConexion))unique.set(key,p);});return [...unique.values()];
 };
 function stop(){epoch++;clearInterval(timer);timer=null;stops.splice(0).forEach(off=>off());if(ownRef)root.fbRemove(ownRef).catch(()=>{});ownRef=null;uid='';peers={};refresh();}
 function start(){
  if(!allowed()||!root.fbDB)return;if(uid===root.currentUserUid)return;stop();uid=root.currentUserUid;const current=++epoch;
  ownRef=root.fbRef(root.fbDB,'sv_chat_presencia/'+uid+'/'+root.obtenerIdSesionPresencia());const ref=ownRef;
  const write=()=>root.fbSet(ref,{uid,nombre:root.currentUser||'',rol:root.currentRole,online:true,ultimaConexion:root.fbServerTimestamp()}).catch(()=>{});
  stops.push(root.fbOnValue(root.fbRef(root.fbDB,'.info/connected'),snap=>{if(current!==epoch||snap.val()!==true)return;root.fbOnDisconnect(ref).remove().then(()=>{if(current===epoch)write();}).catch(()=>{});}));
  stops.push(root.fbOnValue(root.fbRef(root.fbDB,'sv_chat_presencia'),snap=>{if(current!==epoch)return;peers=snap.val()||{};refresh();},()=>{if(current===epoch){peers={};refresh();}}));
  timer=setInterval(()=>{if(current===epoch){if(allowed())write();else stop();refresh();}},30000);
 }
 document.addEventListener('sisventas:session-ready',start);document.addEventListener('sisventas:chat-ready',start);
 document.addEventListener('sisventas:session-ended',stop);document.addEventListener('sisventas:chat-disabled',stop);
 root.SVChatPresence={start,stop};
})(window);
