(function(root){
 'use strict';
 let generation=0,own=null,watching=false,signalStop=null,roleStop=null,pending=null,contextKey='',again=false;
 const subscriptions=new Set(),enabled=root.SV_USER_DIRECTORY_V2===true;
 const session=()=>({user:root.fbAuth?.currentUser,view:root.currentUserUid||'',role:root.currentRole||'',epoch:generation});
 const valid=c=>c.epoch===generation&&c.user===root.fbAuth?.currentUser&&c.view===(root.currentUserUid||'')&&c.role===(root.currentRole||'');
 function abortable(task,signal){
  if(!signal)return Promise.resolve(task);
  if(signal.aborted)return Promise.reject(Object.assign(Error('La preparación fue cancelada'),{name:'AbortError'}));
  let abort;const cancelled=new Promise((_,reject)=>{abort=()=>reject(Object.assign(Error('La preparación fue cancelada'),{name:'AbortError'}));signal.addEventListener('abort',abort,{once:true});});
  return Promise.race([Promise.resolve(task),cancelled]).finally(()=>signal.removeEventListener('abort',abort));
 }
 async function request(path,user,check,{signal}={}){
  if(!user)throw Error('No hay sesión de acceso');if(!check())throw Error('La sesión cambió');
  if(signal?.aborted)throw Object.assign(Error('La preparación fue cancelada'),{name:'AbortError'});
  if(root.SVForegroundSession){await root.SVForegroundSession.waitVisible({signal});if(!check())throw Error('La sesión cambió');}
  const tokenTask=abortable(user.getIdToken(),signal),token=await(root.SVSessionRecovery?.deadline?root.SVSessionRecovery.deadline(tokenTask):tokenTask);if(!check())throw Error('La sesión cambió');
  if(root.SVForegroundSession){await root.SVForegroundSession.waitVisible({signal});if(!check())throw Error('La sesión cambió');}
  if(signal?.aborted)throw Object.assign(Error('La preparación fue cancelada'),{name:'AbortError'});
  const base=root.SISVENTAS_FUNCTIONS?.cotizadorProveedor;if(!base)throw Error('Servicio de usuarios no disponible');
  const controller=signal?new AbortController():null,abort=()=>controller?.abort();let timer;
  if(controller){signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();timer=setTimeout(abort,20000);}
  try{
   const r=await abortable(fetch(base+'/usuarios/'+path,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller?.signal||AbortSignal.timeout(20000)}),signal).catch(error=>{if(error.name!=='AbortError')console.warn('[SisVentas] fallo de lectura de usuarios',{resource:path,error:error.name,online:root.navigator?.onLine,time:new Date().toISOString()});throw error;}),data=await abortable(r.json().catch(()=>({})),signal);
   if(!check())throw Error('La sesión cambió');if(!r.ok||!data.ok)throw Object.assign(Error(data.mensaje||'No se pudo cargar el directorio'),{status:r.status});return data;
  }finally{if(controller){clearTimeout(timer);signal.removeEventListener('abort',abort);}}
 }
 async function profile(user,options){
  const epoch=generation;const data=await request('perfil',user,()=>epoch===generation&&user===root.fbAuth?.currentUser,options);
  if(data.profile?.uid!==user.uid)throw Error('Perfil de otra identidad');own=data.profile;watchRole(user);return data.profile;
 }
 const snapshot=users=>({exists:()=>users.length>0,val:()=>Object.fromEntries(users.map(p=>[p.fbKey,p]))});
 async function read(){const c=session(),data=await request('directorio',c.user,()=>valid(c));return snapshot(data.users);}
 async function adminProfile(key){const c=session(),data=await request('administracion',c.user,()=>valid(c));const found=data.users.find(p=>p.fbKey===key);if(!found)throw Error('Usuario no encontrado');return found;}
 function stop(){generation++;own=null;pending=null;again=false;watching=false;signalStop?.();roleStop?.();signalStop=roleStop=null;subscriptions.clear();}
 function ensureContext(){const next=[root.fbAuth?.currentUser?.uid,root.currentUserUid,root.currentRole].join('|');if(next!==contextKey){const previous=own;stop();own=previous?.uid===root.fbAuth?.currentUser?.uid?previous:null;contextKey=next;root.usuariosData=own&&own.uid===root.currentUserUid?[own]:[];}}
 function watchRole(user){
  if(roleStop||!root.fbOnValue||!root.fbDB)return;const epoch=generation;
  roleStop=root.fbOnValue(root.fbRef(root.fbDB,'sv_chat_roles/'+user.uid),snap=>{
   if(epoch!==generation||user!==root.fbAuth?.currentUser)return;const i=snap.val();
   if(i?.activo!==true||(own&&i.rol!==own.rol)){stop();root.usuariosData=[];root._cancelarAutenticacionParcial?.('Tu acceso cambió. Volvé a ingresar.');}
  },e=>{if(epoch!==generation)return;if(String(e.code||'').toLowerCase().includes('permission_denied')){stop();root.usuariosData=[];root._cancelarAutenticacionParcial?.('No se pudo validar tu acceso. Volvé a ingresar.');}});
 }
 async function refresh({joinPending=false}={}){
  if(root.navigator?.onLine===false)return;if(pending){if(!joinPending)again=true;return pending;}if(!subscriptions.size)return;
  const c=session();let task;
  task=(async()=>{
   for(const admin of [...new Set([...subscriptions].map(s=>s.admin))]){
    try{const data=await request(admin?'administracion':'directorio',c.user,()=>valid(c));if(!valid(c))return;
     const users=data.users.map(p=>own&&p.uid===own.uid&&c.view===own.uid?{...own,...p}:p);
     if(own&&c.view===own.uid&&!users.some(p=>p.uid===own.uid))users.push(own);
     const snap=snapshot(users);for(const s of [...subscriptions])if(s.admin===admin)s.callback(snap);
    }catch(e){if(valid(c))for(const s of [...subscriptions])if(s.admin===admin)s.error?.(e);}
   }
  })().finally(()=>{if(pending===task){pending=null;if(again){again=false;refresh();}}});pending=task;return task;
 }
 function subscribe(callback,error,administration=false){
  ensureContext();
  const s={callback,error,admin:administration};subscriptions.add(s);
  if(!watching){watching=true;
   if(root.fbOnValue&&root.fbDB){
    let signalSeen=false,signalValue;
    signalStop=root.fbOnValue(root.fbRef(root.fbDB,'sv_chat_directorio'),snap=>{
     const next=JSON.stringify(snap.val());
     if(signalSeen&&next===signalValue)return;
     signalSeen=true;signalValue=next;refresh();
    },e=>error?.(e));
    if(root.fbAuth?.currentUser)watchRole(root.fbAuth.currentUser);
   }
  }
  // Se programa después de registrar al suscriptor; un refresco compartido
  // entrega la respuesta a todos los interesados de la sesión vigente.
  refresh();return ()=>{subscriptions.delete(s);if(!subscriptions.size){watching=false;signalStop?.();roleStop?.();signalStop=roleStop=null;}};
 }
 let appStop=null;
 function start(callback,error){
  appStop?.();const loading=root.SVDataReadiness?.beginSource('usuarios');
  const unsubscribe=subscribe(snap=>{callback(snap);loading?.ready();},e=>{loading?.error();error?.(e);},root.currentRole==='admin'&&!!root.permisoModulo?.('usuarios'));
  appStop=()=>{unsubscribe();loading?.cancel();};return appStop;
 }
 document.addEventListener('sisventas:session-ended',()=>{stop();appStop=null;});
 // Sólo estos avisos de regreso se unen a una lectura existente. La señal
 // RTDB del directorio y refresh explícito conservan una actualización nueva.
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh({joinPending:true});});
 root.addEventListener?.('online',()=>{if(!document.hidden)refresh({joinPending:true});});
 root.SVUserDirectory={enabled,profile,read,adminProfile,onValue:subscribe,start,refresh,stop};
})(window);
