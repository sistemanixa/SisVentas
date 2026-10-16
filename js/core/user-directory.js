(function(root){
 'use strict';
 let generation=0,own=null,timer=null,signalStop=null,roleStop=null,pending=null,contextKey='',again=false;
 const subscriptions=new Set(),enabled=root.SV_USER_DIRECTORY_V2===true;
 const session=()=>({user:root.fbAuth?.currentUser,view:root.currentUserUid||'',role:root.currentRole||'',epoch:generation});
 const valid=c=>c.epoch===generation&&c.user===root.fbAuth?.currentUser&&c.view===(root.currentUserUid||'')&&c.role===(root.currentRole||'');
 async function request(path,user,check){
  if(!user)throw Error('No hay sesión de acceso');const token=await user.getIdToken();if(!check())throw Error('La sesión cambió');
  const base=root.SISVENTAS_FUNCTIONS?.cotizadorProveedor;if(!base)throw Error('Servicio de usuarios no disponible');
  const r=await fetch(base+'/usuarios/'+path,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(20000)}),data=await r.json().catch(()=>({}));
  if(!check())throw Error('La sesión cambió');if(!r.ok||!data.ok)throw Object.assign(Error(data.mensaje||'No se pudo cargar el directorio'),{status:r.status});return data;
 }
 async function profile(user){
  const epoch=generation;const data=await request('perfil',user,()=>epoch===generation&&user===root.fbAuth?.currentUser);
  if(data.profile?.uid!==user.uid)throw Error('Perfil de otra identidad');own=data.profile;watchRole(user);return data.profile;
 }
 const snapshot=users=>({exists:()=>users.length>0,val:()=>Object.fromEntries(users.map(p=>[p.fbKey,p]))});
 async function read(){const c=session(),data=await request('directorio',c.user,()=>valid(c));return snapshot(data.users);}
 async function adminProfile(key){const c=session(),data=await request('administracion',c.user,()=>valid(c));const found=data.users.find(p=>p.fbKey===key);if(!found)throw Error('Usuario no encontrado');return found;}
 function stop(){generation++;own=null;pending=null;again=false;clearInterval(timer);timer=null;signalStop?.();roleStop?.();signalStop=roleStop=null;subscriptions.clear();}
 function ensureContext(){const next=[root.fbAuth?.currentUser?.uid,root.currentUserUid,root.currentRole].join('|');if(next!==contextKey){const previous=own;stop();own=previous?.uid===root.fbAuth?.currentUser?.uid?previous:null;contextKey=next;root.usuariosData=own&&own.uid===root.currentUserUid?[own]:[];}}
 function watchRole(user){
  if(roleStop||!root.fbOnValue||!root.fbDB)return;const epoch=generation;
  roleStop=root.fbOnValue(root.fbRef(root.fbDB,'sv_chat_roles/'+user.uid),snap=>{
   if(epoch!==generation||user!==root.fbAuth?.currentUser)return;const i=snap.val();
   if(i?.activo!==true||(own&&i.rol!==own.rol)){stop();root.usuariosData=[];root._cancelarAutenticacionParcial?.('Tu acceso cambió. Volvé a ingresar.');}
  },e=>{if(epoch!==generation)return;if(String(e.code||'').toLowerCase().includes('permission_denied')){stop();root.usuariosData=[];root._cancelarAutenticacionParcial?.('No se pudo validar tu acceso. Volvé a ingresar.');}});
 }
 async function refresh(){
  if(pending){again=true;return pending;}if(!subscriptions.size)return;
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
  if(!timer){timer=setInterval(()=>{if(!document.hidden)refresh();},30000);
   if(root.fbOnValue&&root.fbDB){
    signalStop=root.fbOnValue(root.fbRef(root.fbDB,'sv_chat_directorio'),()=>refresh(),e=>error?.(e));
    if(root.fbAuth?.currentUser)watchRole(root.fbAuth.currentUser);
   }
  }
  // Se programa después de registrar al suscriptor; un refresco compartido
  // entrega la respuesta a todos los interesados de la sesión vigente.
  refresh();return ()=>{subscriptions.delete(s);if(!subscriptions.size){clearInterval(timer);timer=null;signalStop?.();roleStop?.();signalStop=roleStop=null;}};
 }
 let appStop=null;
 function start(callback,error){appStop?.();appStop=subscribe(callback,error,root.currentRole==='admin'&&!!root.permisoModulo?.('usuarios'));return appStop;}
 document.addEventListener('sisventas:session-ended',()=>{stop();appStop=null;});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 root.SVUserDirectory={enabled,profile,read,adminProfile,onValue:subscribe,start,refresh,stop};
})(window);
