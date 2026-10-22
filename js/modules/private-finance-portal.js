(function(root){
 'use strict';
 let capability=false,context='',checked=null,epoch=0,frame=null,overlay=null,previousHash='',oldOverflow='',oldScroll=0,pending=null,pendingContext=null,returnFocus=null;
 const inertElements=new Map();
 const requests=new Set();
 const session=()=>({user:root.fbAuth?.currentUser,view:root._impersonacionOriginal,uid:root.currentUserUid,role:root.currentRole||'',epoch});
 const sameIdentity=(a,b)=>!!a&&!!b&&a.user===b.user&&a.uid===b.uid&&a.role===b.role&&a.view===b.view;
 const sameSession=(a,b)=>sameIdentity(a,b)&&a.epoch===b.epoch;
 const authenticated=()=>typeof isAuthenticated!=='undefined'&&isAuthenticated===true;
 const valid=c=>c.epoch===epoch&&c.user===root.fbAuth?.currentUser&&c.uid===root.currentUserUid&&c.role===(root.currentRole||'')&&c.uid===c.user?.uid&&!root._impersonacionOriginal&&!c.view&&authenticated();
 const menu=()=>document.getElementById('nav-personal-finance');
 const visible=()=>typeof root.SVForegroundSession?.isVisible==='function'?root.SVForegroundSession.isVisible():document.hidden!==true;
 async function waitForeground(c,existingSignal){
  const controller=existingSignal?null:new AbortController(),signal=existingSignal||controller.signal;
  if(controller)requests.add(controller);
  try{
   while(valid(c)&&!signal.aborted&&!visible()){
    if(typeof root.SVForegroundSession?.waitVisible==='function')await root.SVForegroundSession.waitVisible({signal});
    else await new Promise(resolve=>{
     function finish(){if(!signal.aborted&&!visible())return;document.removeEventListener?.('visibilitychange',finish);signal.removeEventListener('abort',finish);resolve();}
     document.addEventListener('visibilitychange',finish);signal.addEventListener('abort',finish,{once:true});finish();
    });
   }
   return valid(c)&&!signal.aborted&&visible();
  }catch(_){return false;}finally{if(controller)requests.delete(controller);}
 }
 function allowed(){const c=session();return capability&&valid(c)&&context===c.user?.uid&&sameSession(checked,c);}
 function close(){
  if(!overlay)return;
  try{frame?.contentWindow?.SVPrivateFinanceUI?.destroy();}catch(_){}
  overlay?.remove();overlay=frame=null;document.body.style.overflow=oldOverflow;
  for(const [element,inert]of inertElements)element.inert=inert;inertElements.clear();
  if(previousHash&&location.hash==='#/gastospersonales')history.replaceState(null,'',location.pathname+location.search+previousHash);
  root.scrollTo?.(0,oldScroll);returnFocus?.isConnected&&returnFocus.focus({preventScroll:true});returnFocus=null;previousHash='';
  document.dispatchEvent(new CustomEvent('sisventas:private-finance-closed'));
 }
 function reset(){epoch++;for(const c of requests)c.abort();requests.clear();pending=pendingContext=checked=null;capability=false;context='';close();const item=menu();if(item){item.hidden=true;item.style.display='none';}}
 async function tokenFor(c,signal){
  if(signal.aborted)throw Error('Análisis cancelado o sesión cambiada');
  let abort;const cancelled=new Promise((_,reject)=>{abort=()=>reject(Error('Análisis cancelado o sesión cambiada'));signal.addEventListener('abort',abort,{once:true});});
  try{return await Promise.race([Promise.resolve().then(()=>c.user.getIdToken()),cancelled]);}finally{signal.removeEventListener('abort',abort);}
 }
 async function request(path='',body,raw=false){
  const c=session();if(!valid(c)||!c.user)throw Error('Volvé a tu sesión propia para abrir el espacio privado');
  if(!['','/acceso','/guardar','/documentos'].includes(path)&&!/^\/documentos\/[a-f0-9]{64}$/.test(path))throw Error('Ruta privada inválida');
  const controller=new AbortController();requests.add(controller);let timer=path==='/acceso'?null:setTimeout(()=>controller.abort(),45000);
  try{
   while(path==='/acceso'&&!visible())if(!await waitForeground(c,controller.signal))throw Error('La sesión cambió');
   const token=await c.user.getIdToken();if(!valid(c))throw Error('La sesión cambió');
   while(path==='/acceso'&&!visible())if(!await waitForeground(c,controller.signal))throw Error('La sesión cambió');
   if(path==='/acceso')timer=setTimeout(()=>controller.abort(),45000);
   const base=root.SISVENTAS_FUNCTIONS?.cotizadorProveedor;if(!base)throw Error('Servicio privado no disponible');
   const response=await fetch(base+'/privado/finanzas'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:controller.signal});
   const data=raw&&response.ok?await response.blob():await response.json().catch(()=>({}));
   if(!valid(c))throw Error('La sesión cambió');if(!response.ok||!raw&&!data.ok){
    if([401,403].includes(response.status)){
     reset();
     // Un rechazo definitivo sólo evita repetir la consulta automática de menú.
     // Abrir/reintentar explícitamente sigue verificando en el servidor.
     const current=session();if(path==='/acceso'&&response.status===403&&valid(current)&&sameIdentity(c,current))checked=current;
    }
    throw Object.assign(Error(data.mensaje||'No se pudo confirmar la operación privada'),{status:response.status});
   }return data;
  }finally{clearTimeout(timer);requests.delete(controller);}
 }
 async function analyzePDF(data,signal){
  const c=session();if(!allowed()||!valid(c))throw Error('Volvé a tu sesión propia para analizar el PDF');
  const controller=new AbortController();requests.add(controller);
  const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  const timer=setTimeout(cancel,180000);
  try{
   const token=await tokenFor(c,controller.signal);if(!valid(c)||controller.signal.aborted)throw Error('Análisis cancelado o sesión cambiada');
   const base=root.SV_IA_ENDPOINT||'https://asistente-171899432710.southamerica-east1.run.app';
   const response=await fetch(base+'/statement-import',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({data}),cache:'no-store',signal:controller.signal});
   const result=await response.json().catch(()=>({}));if(!valid(c)||controller.signal.aborted)throw Error('Análisis cancelado o sesión cambiada');
   if(!response.ok||!result.ok){if([401,403].includes(response.status))reset();throw Object.assign(Error(result.mensaje||'No se pudo completar la lectura con IA'),{status:response.status});}
   return result;
  }finally{clearTimeout(timer);requests.delete(controller);signal?.removeEventListener('abort',cancel);}
 }
 async function check(force=false){
  const c=session();if(!valid(c)||!c.user){reset();return false;}
  if(pending){if(sameSession(pendingContext,c))return pending;reset();return check(force);}
  if(!force&&sameSession(checked,c))return capability;
  checked=null;pendingContext=c;
  const task=(async()=>{try{if(!await waitForeground(c))return false;await request('/acceso');if(!valid(c))return false;capability=true;context=c.user.uid;checked=c;return true;}catch(_){if(valid(c)){capability=false;context='';}return false;}finally{if(valid(c)&&menu()){menu().hidden=!capability;menu().style.display=capability?'':'none';}if(pending===task){pending=pendingContext=null;}}})();pending=task;return task;
 }
 async function open(){
  if(frame)return;
  const c=session();if(!await waitForeground(c))return;
  // La capacidad de esta sesión ya habilita el menú. La lectura del estado
  // vuelve a autorizar en servidor; no hace falta anteponer otro GET /acceso.
  if(!allowed()&&!await check(true)){root.notify?.('Este espacio está reservado al titular y requiere habilitación del servidor.');return;}
  if(!await waitForeground(c)||!allowed())return;
  if(frame)return;
  if(document.getElementById('popup-actualizado'))return;
  oldOverflow=document.body.style.overflow;oldScroll=root.scrollY;previousHash=location.hash==='#/gastospersonales'?'#/dashboard':location.hash||'#/dashboard';
  overlay=document.createElement('div');overlay.id='sv-private-finance-space';overlay.style.cssText='position:fixed;inset:0;z-index:11000;background:#06111f;overflow:hidden;overscroll-behavior:none';
  frame=document.createElement('iframe');frame.title='Gastos personales · espacio privado';frame.src='./personal-finance.html?v=3.14.3-cycle';frame.style.cssText='display:block;border:0;width:100%;height:100%;background:#06111f';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Gastos personales');returnFocus=document.activeElement;
  for(const element of document.body.children){if(['SCRIPT','STYLE','LINK'].includes(element.tagName))continue;inertElements.set(element,element.inert);element.inert=true;}
  overlay.appendChild(frame);document.body.appendChild(overlay);document.body.style.overflow='hidden';history.replaceState(null,'',location.pathname+location.search+'#/gastospersonales');frame.addEventListener('load',()=>frame?.focus(),{once:true});
 }
 document.addEventListener('sisventas:session-ended',reset);
 document.addEventListener('sisventas:release-notice-closed',()=>{if(authenticated()&&location.hash==='#/gastospersonales')open();});
 document.addEventListener('sisventas:session-ready',()=>{if(!pending||!sameSession(pendingContext,session()))reset();check().then(ok=>{if(ok&&location.hash==='#/gastospersonales')open();});});
 // applyRole y Ver como llaman a contextChanged sin esperar temporizadores.
 function contextChanged(){const c=session();if(root._impersonacionOriginal||checked&&!sameSession(checked,c)||pendingContext&&!sameSession(pendingContext,c)||context&&context!==root.fbAuth?.currentUser?.uid)reset();if(authenticated()&&!root._impersonacionOriginal&&!allowed())check();}
 root.SVPrivateFinancePortal={open,close,allowed,check:()=>check(true),reset,contextChanged,request,analyzePDF,identity(){if(!allowed())return null;return {name:String(root.currentUser||root.fbAuth?.currentUser?.displayName||'Usuario')};}};
 root.addEventListener('hashchange',()=>{if(overlay&&location.hash!=='#/gastospersonales')close();});
 // El SDK puede haber recuperado la sesión antes de cargar este módulo.
 if(authenticated())check().then(ok=>{if(ok&&location.hash==='#/gastospersonales')open();});
})(window);
