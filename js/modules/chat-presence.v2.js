(function(root){
 'use strict';
 let session=null,peers={},rendered='',usersRendered='',requested=false;
 // Only foreground connections from this protocol count as currently online.
 const derived=new WeakMap();
 const connectionPrefix='cx2_';
 // A saved row proves a recent connection, not perpetual liveness.
 const evidenceWindow=15*60*1000;
 let expiryTimer=null,suspended=false;
 function recent(p){const time=Number(p?.ultimaConexion),now=Date.now();return Number.isFinite(time)&&time>0&&time<=now+30000&&now-time<evidenceWindow;}
 function cancelExpiry(){if(expiryTimer!==null){root.clearTimeout(expiryTimer);expiryTimer=null;}}
 function scheduleExpiry(){
  cancelExpiry();if(!session||!valid(session)||!session.connected||!session.snapshotReady)return;
  let delay=Infinity;for(const [uid,rows]of Object.entries(peers))for(const [key,p]of Object.entries(rows||{})){
   if(uid!==session.uid&&key.startsWith(connectionPrefix)&&p?.uid===uid&&p.online===true&&eligible(p,uid)&&recent(p))delay=Math.min(delay,Number(p.ultimaConexion)+evidenceWindow-Date.now());
  }
  if(Number.isFinite(delay))expiryTimer=root.setTimeout(()=>{expiryTimer=null;refresh();},Math.max(1,delay));
 }
 // A connection owns a distinct path, even after a same-account login or a
 // duplicated tab. A late cleanup can therefore never remove its successor.
 const instance=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
 let connectionId=0;
 const roles=['admin','administrativo','vendedor','tecnico','tecnico_vendedor','distribuidora'];
 function allowed(){
  const uid=root.currentUserUid,access=root._chatAccesoPresencia,directory=root._chatDirectorio||{};
  return !suspended&&root.document.hidden!==true&&root.document.visibilityState!=='hidden'&&(!root.SVForegroundSession||root.SVForegroundSession.isVisible())&&!root._impersonacionOriginal&&!!uid&&!!root.currentUser&&root.fbAuth?.currentUser?.uid===uid&&roles.includes(root.currentRole)&&
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
  if(!session||!valid(session)||!session.connected||!session.snapshotReady)return [];
  const rows=[];
  Object.entries(peers).forEach(([uid,connections])=>Object.entries(connections||{}).forEach(([key,p])=>{
   if(!p||p.uid!==uid||p.online!==true||!eligible(p,uid))return;
   const eventConnection=key.startsWith(connectionPrefix);
   if(!eventConnection||!recent(p))return;
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
  return !!known&&known.context===session&&!!session&&valid(session)&&peers[known.uid]?.[known.key]===known.source&&eligible(p,known.uid)&&recent(known.source);
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
  // Legacy rows may survive a stopped browser; they are not live proof.
  connectedRows().forEach(p=>add(p,connectionActive(p)));
  return [...unique.values()];
 };
 function refresh(){
  scheduleExpiry();
  const usersNext=JSON.stringify(connectedRows().map(p=>[p.uid,p.nombre,p.rol,p.ultimaConexion]).sort());
  if(usersNext!==usersRendered){usersRendered=usersNext;if(document.getElementById('page-usuarios')?.classList.contains('active'))root.renderTablaUsuarios?.();}
  const people=root.usuariosPresentesUnicos(false),label=document.getElementById('chat-online-label'),count=people.length;
  const ready=!!session&&valid(session)&&session.connected&&session.snapshotReady;
  const text=!ready?'Conexión del chat sin confirmar':count?count+(count===1?' conexión reciente':' conexiones recientes'):'Sin conexiones recientes confirmadas';
  if(label&&label.textContent!==text)label.textContent=text;
  root.SVChatContacts?.updateHeader(root._chatCanal);
  if(!document.getElementById('chat-modal')?.classList.contains('open')){rendered='';return;}
  const next=JSON.stringify([root._chatCanal,people.map(p=>[identity(p),p.nombre,p.rol]).sort()]);
  if(next===rendered)return;rendered=next;
  if(root._chatCanal==='directos')root.chatAbrirDirectos?.(true);
  else{document.getElementById('chat-online-banner')?.remove();const html=root.chatOnlineEnCanal?.(root._chatCanal),messages=document.getElementById('chat-messages');if(html&&messages){const banner=document.createElement('div');banner.id='chat-online-banner';banner.innerHTML=html.replace('En línea:','Conexión reciente:');messages.before(banner);}}
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
  cancelExpiry();const previous=session;session=null;peers={};rendered='';
  previous?.peerStop?.();previous?.stops.splice(0).forEach(off=>off());dispose(previous?.connection);refresh();
 }
 function stop(){requested=false;reset();}
 function start(){
  requested=true;
  if(!allowed()||!root.fbDB){if(session)reset();return;}
  if(session&&valid(session))return;
  reset();
  const s={uid:root.currentUserUid,role:root.currentRole,auth:root.fbAuth.currentUser,stops:[],connection:null,connected:false,snapshotReady:false,peerStop:null,peerEpoch:0};session=s;
  const listen=(path,callback,error)=>{
   const off=root.fbOnValue(root.fbRef(root.fbDB,path),callback,error);
   if(session===s)s.stops.push(off);else off();
  };
  listen('.info/connected',snap=>{
   if(!valid(s))return;
   if(snap.val()!==true){s.connected=false;s.snapshotReady=false;s.peerEpoch++;peers={};s.peerStop?.();s.peerStop=null;if(s.connection)s.connection.connected=false;refresh();return;}
   if(s.connection?.connected)return;
   s.connected=true;s.snapshotReady=false;s.peerStop?.();const peerEpoch=++s.peerEpoch;
   s.peerStop=root.fbOnValue(root.fbRef(root.fbDB,'sv_chat_presencia'),snap=>{if(!valid(s)||!s.connected||s.peerEpoch!==peerEpoch)return;peers=snap.val()||{};s.snapshotReady=true;refresh();},()=>{if(session===s)stop();});
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

 }
 function accessChanged(){if(session&&!valid(session))reset();if(requested&&!session&&allowed())start();else refresh();}
 document.addEventListener('sisventas:session-ready',start);document.addEventListener('sisventas:chat-ready',start);
 document.addEventListener('sisventas:session-ended',stop);document.addEventListener('sisventas:chat-disabled',()=>{if(!allowed())stop();else refresh();});
 document.addEventListener('sisventas:chat-directory-ready',accessChanged);document.addEventListener('sisventas:chat-access-changed',accessChanged);
 document.addEventListener('sisventas:role-changed',accessChanged);
 document.addEventListener('visibilitychange',accessChanged);
 document.addEventListener('sisventas:foreground-paused',accessChanged);document.addEventListener('sisventas:foreground-restored',accessChanged);
 const pausePage=()=>{suspended=true;reset();};
 const resumePage=()=>{suspended=false;accessChanged();};
 root.addEventListener?.('pagehide',pausePage);root.addEventListener?.('pageshow',resumePage);
 document.addEventListener('freeze',pausePage);document.addEventListener('resume',resumePage);
 const originalBanner=root.chatOnlineEnCanal;
 if(typeof originalBanner==='function')root.chatOnlineEnCanal=function(...args){return originalBanner.apply(this,args).replace('En línea:','Conexión reciente:');};
 root.SVChatPresence={evidenceWindow,foregroundOnly:true,status:()=>({ready:!!session&&valid(session)&&session.connected&&session.snapshotReady}),start,stop,sesionesActivas:connectedRows,esConexionVigente:connectionActive};
})(window);
