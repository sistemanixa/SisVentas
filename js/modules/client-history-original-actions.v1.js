(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVClientHistoryOriginalActions=api;})(typeof window==='object'?window:null,function(){
 'use strict';
 const safe=value=>typeof value==='string'&&value.length>0&&value.length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
 const routes={ordenes_trabajo:{page:'ordentrabajo',open:'verOT',back:'volverDesdeDetalleOT'},reclamos:{page:'soporte',open:'spAbrirModal',back:'spCerrarModal'}};
 function create(root,{capture,canNavigate:permitted,editClientOriginal=root.editarClienteDesdeHistorial}={}){
  if(typeof capture!=='function'||typeof permitted!=='function')throw TypeError('Falta el contexto autorizado de navegación.');
  let excursion=null,disposed=false,pointToken=null,task=Promise.resolve(false),epoch=0,navigating=false;const hooks=[];
  const copyContext=()=>{const value=capture();return value?{...value}:null;};
  function valid(actor,includeRoute=true){const now=capture();return !disposed&&!!actor?.uid&&actor.auth?.uid===actor.uid&&now?.uid===actor.uid&&now.auth===actor.auth&&now.auth?.uid===now.uid&&now.db===actor.db&&now.role===actor.role&&now.permissionRevision===actor.permissionRevision&&now.epoch===actor.epoch&&(!includeRoute||now.route===actor.route)&&!now.hidden&&!now.viewing&&now.online!==false;}
  function canNavigate(domain){const route=routes[domain];return !!route&&typeof root.svNavegarDirecto==='function'&&typeof root[route.open]==='function'&&typeof root[route.back]==='function'&&permitted(domain)===true&&valid(copyContext());}
  async function original(domain,key,actor){if(!safe(key)||!actor?.db||typeof root.fbGet!=='function'||typeof root.fbRef!=='function')throw Error('Referencia puntual no disponible.');const snapshot=await root.fbGet(root.fbRef(actor.db,'sisventas/'+domain+'/'+key));if(!valid(actor))return null;const value=snapshot.val();if(!value||typeof value!=='object'||Array.isArray(value)||value._svListSummary||value._svPagedSummary||value.fbKey!=null&&value.fbKey!==key)throw Error('No se encontró el original autorizado completo.');return {...value,fbKey:key};}
  function upsert(domain,value){if(domain==='reclamos'){if(!root.SP_DATA)root.SP_DATA={};root.SP_DATA[value.fbKey]=value;return;}const name=domain==='ordenes_trabajo'?'otData':'clientesData',rows=root[name]||(root[name]=[]);if(!Array.isArray(rows))throw Error('La colección puntual requiere revisión.');const index=rows.findIndex(row=>row?.fbKey===value.fbKey);if(index<0)rows.push(value);else rows[index]=value;}
  function claimsPointView(page){if(!excursion||routes[excursion.domain].page!==page||!(capture()?.route===page||navigating&&capture()?.route===excursion.actor.route)||!valid(excursion.actor,false)||permitted(excursion.domain)!==true)return false;const selected=excursion.domain==='ordenes_trabajo'?root.otActualId:root.SP_MODAL_KEY,record=excursion.domain==='ordenes_trabajo'?root.otData?.find(row=>row.fbKey===excursion.key):root.SP_DATA?.[excursion.key];return selected===excursion.key&&record===excursion.record;}
  function invalidate(){epoch++;excursion=null;pointToken?.cancel();pointToken=null;root.SVDataReadiness?.invalidate?.(['historyPointDetail']);}
  async function performNavigate(domain,key,origin){
   if(!canNavigate(domain)||!safe(key))return false;invalidate();const at=epoch,actor=copyContext(),route=routes[domain],token=root.SVDataReadiness?.beginSource?.('historyPointDetail','history-point/'+domain+'/'+key);pointToken=token;
   try{const value=await original(domain,key,actor);if(!value||!valid(actor)||!canNavigate(domain))return false;if(domain==='ordenes_trabajo')root.svDetenerLecturaOTs?.();upsert(domain,value);
    if(typeof root.svNavegarDirecto!=='function')throw Error('No está disponible la navegación puntual.');
    if(at!==epoch)return false;excursion={actor,domain,key,origin,record:value};if(domain==='ordenes_trabajo'){root._otOrigenVentaId=null;root.otActualId=key;}else root.SP_MODAL_KEY=key;
    let opened=false,view;navigating=true;try{await root.svNavegarDirecto(route.page,()=>{if(at!==epoch||!claimsPointView(route.page))return;opened=true;view=Promise.resolve(root[route.open](key));return view;},null);}finally{navigating=false;}await view;
    const panel=root.document?.getElementById?.(domain==='ordenes_trabajo'?'ot-detalle-view':'sp-modal');
    if(opened&&at===epoch&&claimsPointView(route.page)&&(!panel||panel.style.display!=='none')){token?.ready();return true;}return false;
   }catch(error){if(at===epoch&&valid(actor,false)){token?.error(error.message);root.notify?.(error.message);}return false;}finally{if(at!==epoch||!claimsPointView(route.page))token?.cancel();}
  }
  function navigate(domain,key,origin){task=performNavigate(domain,key,origin);return task;}
  async function editClient(key){
   const actor=copyContext();if(!valid(actor)||!safe(key)||root.tienePermiso?.('clientes.editar')!==true||root.permisoModulo?.('clientes')!==true||typeof editClientOriginal!=='function')return false;
   try{const value=await original('clientes',key,actor);if(!value||!valid(actor)||root.tienePermiso?.('clientes.editar')!==true||root.permisoModulo?.('clientes')!==true)return false;upsert('clientes',value);root.clienteActualId=key;editClientOriginal.call(root);return true;}catch(error){if(valid(actor))root.notify?.(error.message);return false;}
  }
  for(const [domain,route]of Object.entries(routes)){const previous=root[route.back];if(typeof previous!=='function')continue;const wrapper=async function(...args){const returning=excursion?.domain===domain&&claimsPointView(route.page)?excursion:null;const result=await previous.apply(this,args);invalidate();if(returning&&valid(returning.actor,false))root.showPage?.('historialcliente');return result;};root[route.back]=wrapper;hooks.push({name:route.back,previous,wrapper});}
  const pageChanged=()=>{if(excursion&&!claimsPointView(routes[excursion.domain].page))invalidate();};const events=[['sisventas:session-ended',invalidate],['sisventas:role-changed',invalidate],['sisventas:session-changed',invalidate],['sisventas:page-changed',pageChanged]];events.forEach(([name,handler])=>root.document?.addEventListener(name,handler));
  const instance={canNavigate,navigate,editClient,claimsPointView,ensure:()=>task,refresh:()=>excursion?navigate(excursion.domain,excursion.key,excursion.origin):Promise.resolve(false),reset:invalidate,dispose(){disposed=true;invalidate();events.forEach(([name,handler])=>root.document?.removeEventListener(name,handler));for(const hook of hooks)if(root[hook.name]===hook.wrapper)root[hook.name]=hook.previous;if(root.SVClientHistoryOriginalRuntime===instance)delete root.SVClientHistoryOriginalRuntime;}};root.SVClientHistoryOriginalRuntime=instance;return instance;
 }
 return {create};
});
