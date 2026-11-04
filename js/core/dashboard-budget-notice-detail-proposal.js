(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardBudgetNoticeDetail=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const sourceKey='budgetNoticeDetail',safe=k=>typeof k==='string'&&k.length>0&&k.length<=128&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(k)&&!['__proto__','constructor','prototype'].includes(k);
 function create(root,{capture,valid,enabled=()=>root.SV_BUDGET_NOTICES_LOCAL===true}={}){
  if(typeof capture!=='function'||typeof valid!=='function'||typeof enabled!=='function')throw TypeError('Missing budget detail session ports');
  let entry=null,epoch=0,navigating=false,disposed=false;const listeners=[];
  const route=()=>String(root.document?.querySelector('.page.active')?.id||'').replace(/^page-/,'');
  function actor(){try{const c=capture(),user=c?.auth?.currentUser;if(!c||!safe(c.uid)||!user||user.uid!==c.uid||!c.db||typeof c.role!=='string'||!c.role||!Number.isSafeInteger(c.permissionRevision)||c.permissionRevision<0||typeof c.permissionSignature!=='string'||!c.permissionSignature.trim()||!Number.isSafeInteger(c.sessionEpoch)||c.sessionEpoch<0||!Number.isSafeInteger(c.dataEpoch)||c.dataEpoch<0||!valid(c)||c.viewing||c.connected===false||root.permisoModulo?.('presupuesto')!==true)return null;return {...c,user,grantsKey:JSON.stringify(c.grants||{})};}catch(_){return null;}}
  const same=a=>{const b=actor();return !!a&&!!b&&['uid','role','permissionRevision','permissionSignature','sessionEpoch','dataEpoch','auth','user','db','connectionEpoch','grantsKey'].every(k=>a[k]===b[k]);};
  const current=()=>!disposed&&enabled()===true&&entry&&same(entry.actor);
  function display(id,value){const el=root.document?.getElementById(id);if(el)el.style.display=value;}
  function retireEditor(e){const editor=e?.editor;if(editor&&editor.key===e.key&&root._pptoEditandoFbKey===editor.key&&root._pptoEditorBase===editor.base&&root._pptoEditandoId===editor.id){display('ppto-form-view','none');root._pptoEditorBase=null;root._pptoEditandoFbKey=null;root._pptoEditandoId=null;}}
  function reset(){const previous=entry;epoch++;entry=null;previous?.token?.cancel();if(previous){display('ppto-detalle-view','none');retireEditor(previous);if(root.pptoActualId===previous.key)root.pptoActualId=null;root.SVDataReadiness?.invalidate(sourceKey);}}
  function ownsPointView(page){if(!current()){if(entry)reset();return false;}return page==='presupuesto'&&(route()===page||navigating&&route()===entry.origin);}
  const claimsPointView=page=>ownsPointView(page)&&entry.mode==='detail';
  function resolve(key){return ownsPointView('presupuesto')&&key===entry.key?entry.record:null;}
  async function perform(e){
   const live=()=>entry===e&&e.epoch===epoch&&ownsPointView('presupuesto');
   try{
    navigating=true;let opened;try{opened=root.svNavegarDirecto('presupuesto',()=>{display('ppto-list-view','none');display('ppto-form-view','none');display('ppto-detalle-view','block');});}finally{navigating=false;}
    if(opened!==true||route()!=='presupuesto'){if(entry===e)reset();return false;}
    const response=await root.SVCommercialOwnership.request('presupuestos','registro/'+encodeURIComponent(e.key));if(!live()){if(entry===e)reset();return false;}
    const record=response?.record;if(!record||typeof record!=='object'||Array.isArray(record)||record.fbKey!==e.key||record._svListSummary||record._svPagedSummary)throw Error('No se pudo verificar el presupuesto completo.');
    e.record=record;root.verPpto(e.key);if(!live())return false;e.token.ready();return true;
   }catch(error){if(live()){e.record=null;display('ppto-detalle-view','block');e.token.error(error.message||'No se pudo abrir el presupuesto.');root.notify?.(error.message||'No se pudo abrir el presupuesto.');}return false;}
   finally{e.pending=null;}
  }
  function open(key){
   if(!enabled()||root.document?.hidden||!safe(key)||!actor()||typeof root.SVCommercialOwnership?.request!=='function'||typeof root.svNavegarDirecto!=='function'||typeof root.verPpto!=='function'||!root.SVDataReadiness?.beginSource)return Promise.resolve(false);
   if(entry?.key===key&&current()&&entry.pending)return entry.pending;
   const previous=ownsPointView('presupuesto')?entry:null,origin=previous?previous.origin:route(),focus=previous?previous.focus:root.document?.activeElement,scroll=previous?previous.scroll:root.document?.querySelector('.content')?.scrollTop;reset();const e={key,actor:actor(),origin,focus,scroll,epoch,mode:'detail',record:null,pending:null,token:root.SVDataReadiness.beginSource(sourceKey,'authorized-budget-point')};entry=e;e.pending=perform(e);return e.pending;
  }
  function back(){if(!ownsPointView('presupuesto'))return false;const previous=entry;const opened=root.svNavegarDirecto(previous.origin);if(opened!==true)return false;reset();display('ppto-form-view','none');display('ppto-list-view','block');root._pptoEditorBase=null;root._pptoEditandoFbKey=null;root._pptoEditandoId=null;if(same(previous.actor)){const content=root.document?.querySelector('.content');if(content&&Number.isFinite(previous.scroll))content.scrollTop=previous.scroll;if(previous.focus?.isConnected)previous.focus.focus?.({preventScroll:true});}root.document.dispatchEvent(new root.CustomEvent('sisventas:accion-notificacion-cerrada',{detail:{tipo:'presupuesto'}}));return true;}
  function needsFormData(key){return ownsPointView('presupuesto')&&key===entry.key&&!!entry.record&&!entry.formReady;}
  async function enterForm(key,openForm){
   if(!needsFormData(key)||typeof openForm!=='function')return false;const e=entry;if(root.puedeEditarPresupuestoPermiso?.(e.record)!==true){root.notify?.('Sin permisos para editar el presupuesto.');return false;}if(e.formPending)return e.formPending;e.mode='form';
   e.formPending=(async()=>{try{root.svCargarDatosDePaginaActual('presupuesto');await root.SVDataReadiness.waitForPage('presupuesto',{isCurrent:()=>entry===e&&ownsPointView('presupuesto')});if(entry!==e||!ownsPointView('presupuesto'))return false;e.formReady=true;openForm();e.editor={key:root._pptoEditandoFbKey,base:root._pptoEditorBase,id:root._pptoEditandoId};if(entry!==e||!ownsPointView('presupuesto')){retireEditor(e);return false;}return true;}catch(error){if(entry===e&&ownsPointView('presupuesto')){e.mode='detail';e.token.error(error.message||'No se pudo cargar el formulario.');root.notify?.(error.message);}return false;}finally{e.formPending=null;}})();return e.formPending;
  }
  const check=()=>{if(entry&&!current())reset();};
  for(const name of ['sisventas:session-ended','sisventas:role-changed','sisventas:session-changed','sisventas:permissions-changed','sisventas:data-state-changed','visibilitychange']){const handler=()=>{if(name==='sisventas:session-ended')reset();else check();};root.document?.addEventListener(name,handler);listeners.push([name,handler]);}
  const pageChanged=()=>{if(entry&&!navigating&&route()!=='presupuesto')reset();};root.document?.addEventListener('sisventas:page-changed',pageChanged);listeners.push(['sisventas:page-changed',pageChanged]);
  const instance=Object.freeze({open,resolve,ownsPointView,claimsPointView,needsFormData,enterForm,back,refresh:()=>entry?open(entry.key):Promise.resolve(false),reset,dispose(){reset();disposed=true;for(const [name,handler]of listeners)root.document?.removeEventListener(name,handler);if(root._svBudgetNoticeDetailHost===instance)delete root._svBudgetNoticeDetailHost;}});return instance;
 }
 return Object.freeze({create,sourceKey});
});
