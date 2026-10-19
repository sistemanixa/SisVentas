(function(root){
 'use strict';
 let session=null,peers={},rendered='',usersRendered='',requested=false;
 const legacy=root.usuariosPresentesUnicos;
 const derived=new WeakMap();
 const connectionPrefix='cx1_';
 // A connection owns a distinct path, even after a same-account login or a
 // duplicated tab. A late cleanup can therefore never remove its successor.
 const instance=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
 let connectionId=0;
 const roles=['admin','administrativo','vendedor','tecnico','tecnico_vendedor','distribuidora'];
 function allowed(){
  const uid=root.currentUserUid,access=root._chatAccesoPresencia,directory=root._chatDirectorio||{};
  return !root._impersonacionOriginal&&!!uid&&!!root.currentUser&&root.fbAuth?.currentUser?.uid===uid&&roles.includes(root.currentRole)&&
   !(access?.uid===uid&&(access.activo!==true||access.rol!==root.currentRole))&&directory[uid]?.activo!==false&&
   (!root._chatDirectorioListo||!!directory[uid])&&(root.currentRole!=='distribuidora'||root.SVDistribuidora?.allowed('chat'));
 }
 function valid(s){return session===s&&s.auth===root.fbAuth?.currentUser&&s.uid===root.currentUserUid&&s.role===root.currentRole&&allowed();}
 function normalize(value){return root.normalizarIdentidadPresencia?root.normalizarIdentidadPresencia(value):String(value||'').trim().toLowerCase();}
 function identity(p){
  if(p.uid)return String(p.uid);
  const name=normalize(p.nombre),email=normalize(p.email),users=root.usuariosData||[];
  const matches=Object.entries(root._chatDirectorio||{}).filter(([uid,user])=>{
   const profile=users.find(u=>u.uid===uid);
   return (email&&normalize(profile?.mail||profile?.email)===email)||(name&&normalize(user.nombre)===name);
  });
  return matches.length===1?matches[0][0]:email||name;
 }
 function eligible(p,key){
  const directory=root._chatDirectorio||{};
  return !!key&&directory[key]?.activo!==false&&(!root._chatDirectorioListo||!!directory[key]);
 }
 function connectedRows(){
  if(!session||!valid(session))return [];
  const rows=[];
  Object.entries(peers).forEach(([uid,connections])=>Object.entries(connections||{}).forEach(([key,p])=>{
   if(!p||p.uid!==uid||p.online!==true||!eligible(p,uid))return;
   const eventConnection=key.startsWith(connectionPrefix);
   if(!eventConnection&&!root.presenciaEstaActiva(p))return;
   // Derived objects alone may bypass the legacy TTL. A marker saved in the
   // legacy channel is not evidence that its cleanup remains authorized.
   const row={...p,nombre:root._chatDirectorio?.[uid]?.nombre||p.nombre};
   if(eventConnection){row.conexionPorEventos=true;derived.set(row,{context:session,uid,key,source:p});}
   rows.push(row);
  }));
  return rows;
 }
 function connectionActive(p){
  const known=p&&derived.get(p);
  return !!known&&known.context===session&&!!session&&valid(session)&&peers[known.uid]?.[known.key]===known.source&&eligible(p,known.uid);
 }
 root.usuariosPresentesUnicos=function(includeSelf){
  if(!session||!valid(session))return [];
  const unique=new Map();
  function add(p,connected){
   if(!p||p.online!==true||(!connected&&!root.presenciaEstaActiva(p)))return;
   const key=identity(p),own=key===root.currentUserUid||(!p.uid&&!!root.currentUserEmail&&normalize(p.email)===normalize(root.currentUserEmail));
   if(!eligible(p,key)||(!includeSelf&&own))return;
   const previous=unique.get(key);
   if(!previous||connected&&!previous.conexionPorEventos||Number(p.ultimaConexion)>Number(previous.ultimaConexion))unique.set(key,p);
  }
  (legacy?legacy(includeSelf):[]).forEach(p=>add(p,false));
  connectedRows().forEach(p=>add(p,connectionActive(p)));
  return [...unique.values()];
 };
 function refresh(){
  const usersNext=JSON.stringify(connectedRows().map(p=>[p.uid,p.nombre,p.rol,p.ultimaConexion]).sort());
  if(usersNext!==usersRendered){usersRendered=usersNext;if(document.getElementById('page-usuarios')?.classList.contains('active'))root.renderTablaUsuarios?.();}
  const people=root.usuariosPresentesUnicos(false),label=document.getElementById('chat-online-label'),count=people.length;
  const text=count?count+(count===1?' persona conectada':' personas conectadas'):'Nadie más conectado';
  if(label&&label.textContent!==text)label.textContent=text;
  if(!document.getElementById('chat-modal')?.classList.contains('open')){rendered='';return;}
  const next=JSON.stringify([root._chatCanal,people.map(p=>[identity(p),p.nombre,p.rol]).sort()]);
  if(next===rendered)return;rendered=next;
  if(root._chatCanal==='directos')root.chatAbrirDirectos?.(true);
  else{document.getElementById('chat-online-banner')?.remove();const html=root.chatOnlineEnCanal?.(root._chatCanal),messages=document.getElementById('chat-messages');if(html&&messages){const banner=document.createElement('div');banner.id='chat-online-banner';banner.innerHTML=html;messages.before(banner);}}
 }
 function cancel(attempt){
  if(!attempt.registered||!attempt.removed||attempt.cancelled)return;
  attempt.cancelled=true;
  try{attempt.disconnect.cancel?.().catch(()=>{});}catch(_){}
 }
 function dispose(attempt){
  if(!attempt)return;attempt.disposed=true;
  if(!attempt.sending){attempt.removed=true;cancel(attempt);return;}
  // Leaving the server cleanup armed is safer if authentication has already
  // changed. Do not issue a write against the previous account's path.
  if(!attempt.cleaning&&attempt.auth===root.fbAuth?.currentUser){
   attempt.cleaning=true;
   try{root.fbRemove(attempt.ref).then(()=>{attempt.removed=true;cancel(attempt);}).catch(()=>{});}catch(_){}
  }
  cancel(attempt);
 }
 function reset(){
  const previous=session;session=null;peers={};rendered='';
  previous?.stops.splice(0).forEach(off=>off());dispose(previous?.connection);refresh();
 }
 function stop(){requested=false;reset();}
 function start(){
  requested=true;
  if(!allowed()||!root.fbDB){if(session)reset();return;}
  if(session&&valid(session))return;
  reset();
  const s={uid:root.currentUserUid,role:root.currentRole,auth:root.fbAuth.currentUser,stops:[],connection:null};session=s;
  const listen=(path,callback,error)=>{
   const off=root.fbOnValue(root.fbRef(root.fbDB,path),callback,error);
   if(session===s)s.stops.push(off);else off();
  };
  listen('.info/connected',snap=>{
   if(!valid(s))return;
   if(snap.val()!==true){if(s.connection)s.connection.connected=false;refresh();return;}
   if(s.connection?.connected)return;
   const ref=root.fbRef(root.fbDB,'sv_chat_presencia/'+s.uid+'/'+connectionPrefix+root.obtenerIdSesionPresencia()+'_'+instance+'_'+(++connectionId));
   const attempt={ref,auth:s.auth,connected:true,disconnect:root.fbOnDisconnect(ref)};s.connection=attempt;
   attempt.disconnect.remove().then(()=>{
    attempt.registered=true;
    if(!valid(s)){if(session===s)reset();dispose(attempt);return;}
    if(s.connection!==attempt||!attempt.connected||attempt.disposed){dispose(attempt);return;}
    attempt.sending=true;
    root.fbSet(ref,{uid:s.uid,nombre:root._chatDirectorio?.[s.uid]?.nombre||root.currentUser||'',rol:s.role,online:true,ultimaConexion:root.fbServerTimestamp()}).catch(()=>dispose(attempt));
   }).catch(()=>{});
  });
  listen('sv_chat_presencia',snap=>{if(!valid(s))return;peers=snap.val()||{};refresh();},()=>{if(session===s)stop();});
 }
 function accessChanged(){if(session&&!valid(session))reset();if(requested&&!session&&allowed())start();else refresh();}
 document.addEventListener('sisventas:session-ready',start);document.addEventListener('sisventas:chat-ready',start);
 document.addEventListener('sisventas:session-ended',stop);document.addEventListener('sisventas:chat-disabled',()=>{if(!allowed())stop();else refresh();});
 document.addEventListener('sisventas:chat-directory-ready',accessChanged);document.addEventListener('sisventas:chat-access-changed',accessChanged);
 document.addEventListener('sisventas:role-changed',accessChanged);
 document.addEventListener('visibilitychange',accessChanged);
 root.SVChatPresence={start,stop,sesionesActivas:connectedRows,esConexionVigente:connectionActive};
})(window);
