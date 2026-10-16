(function(root){
 'use strict';
 let capability=false,context='',epoch=0,frame=null,overlay=null,previousHash='',oldOverflow='',oldScroll=0,pending=null,returnFocus=null;
 const inertElements=new Map();
 const requests=new Set();
 const session=()=>({user:root.fbAuth?.currentUser,view:root._impersonacionOriginal,uid:root.currentUserUid,epoch});
 const authenticated=()=>typeof isAuthenticated!=='undefined'&&isAuthenticated===true;
 const valid=c=>c.epoch===epoch&&c.user===root.fbAuth?.currentUser&&c.uid===root.currentUserUid&&!root._impersonacionOriginal&&!c.view&&authenticated();
 const menu=()=>document.getElementById('nav-personal-finance');
 function allowed(){const c=session();return capability&&valid(c)&&context===c.user?.uid;}
 function close(){
  if(!overlay)return;
  try{frame?.contentWindow?.SVPrivateFinanceUI?.destroy();}catch(_){}
  overlay?.remove();overlay=frame=null;document.body.style.overflow=oldOverflow;
  for(const [element,inert]of inertElements)element.inert=inert;inertElements.clear();
  if(previousHash&&location.hash==='#/gastospersonales')history.replaceState(null,'',location.pathname+location.search+previousHash);
  root.scrollTo?.(0,oldScroll);returnFocus?.isConnected&&returnFocus.focus({preventScroll:true});returnFocus=null;previousHash='';
 }
 function reset(){epoch++;for(const c of requests)c.abort();requests.clear();pending=null;capability=false;context='';close();const item=menu();if(item){item.hidden=true;item.style.display='none';}}
 async function request(path='',body,raw=false){
  const c=session();if(!valid(c)||!c.user)throw Error('Volvé a tu sesión propia para abrir el espacio privado');
  if(!['','/acceso','/guardar','/documentos'].includes(path)&&!/^\/documentos\/[a-f0-9]{64}$/.test(path))throw Error('Ruta privada inválida');
  const controller=new AbortController();requests.add(controller);const timer=setTimeout(()=>controller.abort(),45000);
  try{
   const token=await c.user.getIdToken();if(!valid(c))throw Error('La sesión cambió');
   const base=root.SISVENTAS_FUNCTIONS?.cotizadorProveedor;if(!base)throw Error('Servicio privado no disponible');
   const response=await fetch(base+'/privado/finanzas'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:controller.signal});
   const data=raw&&response.ok?await response.blob():await response.json().catch(()=>({}));
   if(!valid(c))throw Error('La sesión cambió');if(!response.ok||!raw&&!data.ok){if([401,403].includes(response.status))reset();throw Object.assign(Error(data.mensaje||'No se pudo confirmar la operación privada'),{status:response.status});}return data;
  }finally{clearTimeout(timer);requests.delete(controller);}
 }
 async function check(){
  const c=session();if(!valid(c)||!c.user){reset();return false;}if(pending)return pending;
  const task=(async()=>{try{await request('/acceso');if(!valid(c))return false;capability=true;context=c.user.uid;return true;}catch(_){if(valid(c)){capability=false;context='';}return false;}finally{if(valid(c)&&menu()){menu().hidden=!capability;menu().style.display=capability?'':'none';}if(pending===task)pending=null;}})();pending=task;return task;
 }
 async function open(){
  if(!await check()){root.notify?.('Este espacio está reservado al titular y requiere habilitación del servidor.');return;}
  if(frame)return;oldOverflow=document.body.style.overflow;oldScroll=root.scrollY;previousHash=location.hash==='#/gastospersonales'?'#/dashboard':location.hash||'#/dashboard';
  overlay=document.createElement('div');overlay.id='sv-private-finance-space';overlay.style.cssText='position:fixed;inset:0;z-index:11000;background:#06111f;overflow:hidden;overscroll-behavior:none';
  frame=document.createElement('iframe');frame.title='Gastos personales · espacio privado';frame.src='./personal-finance.html?v=3.11.12';frame.style.cssText='display:block;border:0;width:100%;height:100%;background:#06111f';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Gastos personales');returnFocus=document.activeElement;
  for(const element of document.body.children){if(['SCRIPT','STYLE','LINK'].includes(element.tagName))continue;inertElements.set(element,element.inert);element.inert=true;}
  overlay.appendChild(frame);document.body.appendChild(overlay);document.body.style.overflow='hidden';history.replaceState(null,'',location.pathname+location.search+'#/gastospersonales');frame.addEventListener('load',()=>frame?.focus(),{once:true});
 }
 document.addEventListener('sisventas:session-ended',reset);
 document.addEventListener('sisventas:session-ready',()=>{reset();check().then(ok=>{if(ok&&location.hash==='#/gastospersonales')open();});});
 // applyRole y Ver como llaman a contextChanged sin esperar temporizadores.
 function contextChanged(){if(root._impersonacionOriginal||context&&context!==root.fbAuth?.currentUser?.uid)reset();else if(authenticated())check();}
 root.SVPrivateFinancePortal={open,close,allowed,check,reset,contextChanged,request};
 root.addEventListener('hashchange',()=>{if(overlay&&location.hash!=='#/gastospersonales')close();});
 // El SDK puede haber recuperado la sesión antes de cargar este módulo.
 if(authenticated())check().then(ok=>{if(ok&&location.hash==='#/gastospersonales')open();});
})(window);
