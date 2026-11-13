(function(root,factory){
 'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.SVSaleCommissionAssignment=api.create(root);
})(typeof window==='object'?window:null,function(){
 'use strict';
 const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const key=v=>typeof v==='string'&&v.length>0&&new TextEncoder().encode(v).length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
 const clone=v=>JSON.parse(JSON.stringify(v));
 const canonical=v=>v===null?'null':Array.isArray(v)?'['+v.map(canonical).join(',')+']':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
 const clean=v=>Object.fromEntries(Object.entries(v).filter(([k])=>k!=='fbKey'&&!k.startsWith('_sv')));
 const fail=message=>Object.assign(Error(message),{svLaborAttempted:false});
 const active=e=>object(e)&&e.activo!==false&&e.eliminado!==true&&!['inactivo','eliminado'].includes(String(e.estado||'').trim().toLowerCase())&&typeof e.nombre==='string'&&!!e.nombre.trim();
 function employees(data){return object(data)?Object.entries(data).filter(([id,e])=>key(id)&&active(e)&&e.fbKey===id).map(([,e])=>({fbKey:e.fbKey,nombre:e.nombre})).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')):[];}
 function buildChange({saleKey,employeeKey,baseline,values,uid,name,fecha}){
  if(!key(saleKey)||!key(employeeKey)||!key(uid)||typeof name!=='string'||!name.trim()||name.length>300||typeof fecha!=='string'||new Date(fecha).toISOString()!==fecha)throw fail('No se pudo verificar la asignación. Volvé a abrirla.');
  const salePath='sisventas/ventas/'+saleKey,employee=values['sisventas/empleados/'+employeeKey],sale=values[salePath];
  if(!object(sale)||sale.fbKey!=null&&sale.fbKey!==saleKey||!object(baseline)||canonical(clean(sale))!==canonical(clean(baseline)))throw fail('La venta cambió. Volvé a abrirla antes de asignar.');
  if(!active(employee)||employee.fbKey!=null&&employee.fbKey!==employeeKey)throw fail('El empleado ya no está disponible. Volvé a revisar la selección.');
  if(sale.comisionadoPrincipalFbKey===employeeKey)return;
  if(sale.audit!=null&&!Array.isArray(sale.audit))throw fail('El historial de la venta necesita revisión. No se modificó la asignación.');
  const audit=(sale.audit||[]).concat([{tipo:'comisionado_principal_asignado',actorUid:uid,usuario:name,fecha,accion:'Comisionado principal asignado',empleadoFbKey:employeeKey,empleadoNombre:employee.nombre}]);
  return {[salePath+'/comisionadoPrincipalFbKey']:employeeKey,[salePath+'/comisionadoPrincipal']:employee.nombre,[salePath+'/audit']:audit};
 }
 function create(root){
  const doc=root.document;let state=null,sequence=0;
  function authenticated(){return typeof isAuthenticated!=='undefined'?isAuthenticated===true:root.isAuthenticated===true;}
  function allowed(sale){try{return authenticated()&&root.currentRole==='admin'&&!root._impersonacionOriginal&&!!root.currentUserUid&&root.fbAuth?.currentUser?.uid===root.currentUserUid&&root.permisoModulo?.('comisiones')===true&&(root.permisoModulo('venta')===true||root.permisoModulo('detalle')===true)&&root.tienePermiso?.('ventas.editar',{venta:sale})===true&&root.tienePermiso('comisiones.distribuir')===true;}catch(_){return false;}}
  function canOpen(sale){return object(sale)&&key(sale.fbKey)&&!!root.fbDB&&allowed(sale)&&typeof root.SVCommercialOwnership?.request==='function'&&typeof root.SVLaborWrites?.atomic==='function';}
  function capture(sale){
   const auth=root.fbAuth.currentUser,uid=root.currentUserUid,role=root.currentRole,permissions=canonical(root.PERMISOS_ROLES?.[role]||null),epoch=root._svOperacionesSesionEpoch||0,dataEpoch=root._svDataEpoch||0,view=root._impersonacionOriginal;
   const page=doc.querySelector('.page.active'),route=root.location?.hash,db=root.fbDB,owner=root.SVCommercialOwnership,request=owner.request,atomic=root.SVLaborWrites.atomic,detail=root._ventaDetalleActual;
   return ()=>auth===root.fbAuth?.currentUser&&auth.uid===uid&&uid===root.currentUserUid&&role===root.currentRole&&permissions===canonical(root.PERMISOS_ROLES?.[role]||null)&&epoch===(root._svOperacionesSesionEpoch||0)&&dataEpoch===(root._svDataEpoch||0)&&view===root._impersonacionOriginal&&allowed(sale)&&page===doc.querySelector('.page.active')&&!!page&&page.isConnected&&page.classList.contains('active')&&route===root.location?.hash&&db===root.fbDB&&owner===root.SVCommercialOwnership&&request===owner.request&&atomic===root.SVLaborWrites?.atomic&&(!detail||root._ventaDetalleActual?.fbKey===sale.fbKey);
  }
  function valid(s){try{return state===s&&!s.closed&&s.context()&&s.dialog.isConnected&&s.dialog.open;}catch(_){return false;}}
  function status(s,text,error=false){if(!valid(s))return;s.status.textContent=text;s.status.setAttribute('role',error?'alert':'status');s.status.style.color=error?'var(--red)':'var(--text3)';}
  function readyEmployees(){const readiness=root.SVDataReadiness?.status?.(['empleados']);return !root._empleadosCargaError&&(root._empleadosDatosListos===true||readiness?.ready===true)&&!readiness?.errors?.length;}
  function paintEmployees(s){
   if(!valid(s)||s.busy)return;const previous=s.select.value;s.select.replaceChildren();const placeholder=doc.createElement('option');placeholder.value='';placeholder.textContent='Seleccionar empleado…';s.select.append(placeholder);
   const list=readyEmployees()?employees(root.empData):[];for(const e of list){const option=doc.createElement('option');option.value=e.fbKey;option.textContent=e.nombre;s.select.append(option);}
   const selected=previous||s.original?.comisionadoPrincipalFbKey||'';s.select.value=list.some(e=>e.fbKey===selected)?selected:'';s.select.disabled=!s.original||!list.length;s.save.disabled=s.select.disabled;
   if(!s.original)return;
   if(root._empleadosCargaError)status(s,'No se pudieron cargar los empleados. Volvé a abrir esta ventana cuando se recupere la conexión.',true);
   else if(!readyEmployees())status(s,'Cargando empleados…');
   else if(!list.length)status(s,'No hay empleados activos disponibles.');
   else status(s,'Elegí quién comisiona en esta venta.');
  }
  function sync(){try{root.svSincronizarPilaModales?.();}catch(_){}}
  function close(force=false){
   const s=state;if(!s||s.busy&&!force)return false;const restore=valid(s);state=null;s.closed=true;
   for(const [target,type,callback]of s.listeners)target.removeEventListener(type,callback);s.listeners=[];
   // Shared recovery owns an uncertain attempt even when its parent view retires.
   const recovery=doc.getElementById('sv-labor-write-recovery');if(recovery&&s.dialog.contains(recovery))doc.body.append(recovery);
   if(s.dialog.open)s.dialog.close();s.dialog.remove();
   const unlock=()=>{doc.body.style.overflow=s.overflow;doc.documentElement.style.overflow=s.htmlOverflow;sync();};
   if(recovery?.isConnected&&root.SVLaborWriteRecovery?.state?.()){
    const settled=()=>{if(root.SVLaborWriteRecovery.state())return;doc.removeEventListener('sisventas:labor-write-recovery',settled);unlock();};doc.addEventListener('sisventas:labor-write-recovery',settled);
   }else unlock();
   if(restore&&s.focus?.isConnected&&s.focus.getClientRects().length)s.focus.focus({preventScroll:true});return true;
  }
  function setBusy(s,busy){s.busy=busy;s.dialog.setAttribute('aria-busy',String(busy));s.dialog.querySelectorAll('button,select').forEach(n=>{n.disabled=busy;});s.save.replaceChildren();if(busy){const spinner=doc.createElement('span');spinner.className='sv-assignment-spinner';spinner.setAttribute('aria-hidden','true');s.save.append(spinner);}s.save.append(doc.createTextNode(busy?'Guardando…':'Guardar'));if(busy)s.dialog.focus({preventScroll:true});else paintEmployees(s);}
  function review(s){
   if(!valid(s)||s.busy||root.permisoModulo?.('comisiones')!==true)return;
   const expense=(Array.isArray(root.gastosData)?root.gastosData:[]).find(g=>String(g.tipoPagable||g.origen||'').toLowerCase()==='comision'&&(g.ventaFbKey===s.key||!g.ventaFbKey&&g.ventaId&&String(g.ventaId)===String(s.original?.id||s.original?.numero||'')));
   close();if(expense&&typeof root.abrirDetalleComision==='function')root.abrirDetalleComision(expense.ventaFbKey||expense.ventaId);else root.showPage?.('comisiones',doc.querySelector('[onclick*="comisiones"]'));
  }
  async function save(s){
   if(!valid(s)||s.busy||!s.original)return;if(doc.hidden||root.SVForegroundSession?.isVisible?.()===false){status(s,'Volvé a esta ventana para guardar la asignación.');return;}const employeeKey=s.select.value;if(!employees(root.empData).some(e=>e.fbKey===employeeKey)||!readyEmployees()){status(s,'Elegí un empleado activo de la lista.',true);return;}
   if(s.original.comisionadoPrincipalFbKey===employeeKey){status(s,'Ese empleado ya está asignado. No hay cambios para guardar.');return;}
   setBusy(s,true);status(s,'Guardando asignación…');let proposed=null;
   try{
    const result=await root.SVLaborWrites.atomic({purpose:'sale-commission-assignment',paths:['sisventas/ventas/'+s.key,'sisventas/empleados/'+employeeKey],build(values){
     if(!valid(s))throw fail('La ventana o la sesión cambió. No se prepararon cambios.');
     proposed=buildChange({saleKey:s.key,employeeKey,baseline:s.original,values,uid:root.currentUserUid,name:String(root.currentUser||root.currentUserUid).trim(),fecha:new Date().toISOString()});return proposed;
    }});
    if(!valid(s))return;
    if(result?.committed!==true){setBusy(s,false);status(s,'No hay cambios para guardar.');return;}
    const value=result.value||proposed;if(value){s.original={...s.original,comisionadoPrincipalFbKey:value['sisventas/ventas/'+s.key+'/comisionadoPrincipalFbKey'],comisionadoPrincipal:value['sisventas/ventas/'+s.key+'/comisionadoPrincipal'],audit:value['sisventas/ventas/'+s.key+'/audit']};}
    s.busy=false;close();
    const confirmed={...clone(s.original),fbKey:s.key};doc.dispatchEvent(new root.CustomEvent('sisventas:sale-commission-assignment-confirmed',{detail:{key:s.key,sale:confirmed}}));root.notify?.('Comisionado principal actualizado.');
   }catch(error){if(!valid(s))return;setBusy(s,false);status(s,error?.message||'No se pudo confirmar la asignación.',true);}
  }
  function styles(){if(doc.getElementById('sv-sale-commission-assignment-style'))return;const style=doc.createElement('style');style.id='sv-sale-commission-assignment-style';style.textContent='.sv-sale-commission-assignment{position:fixed;inset:0;margin:auto;width:min(560px,calc(100vw - 24px));max-height:calc(100dvh - 24px);padding:0;overflow:auto;overscroll-behavior:contain;border:1px solid var(--border,#34425c);border-radius:16px;background:var(--bg2,#111c2e);color:var(--text,#edf2fa);box-sizing:border-box}.sv-sale-commission-assignment::backdrop{background:#0009}.sv-sale-commission-assignment header,.sv-sale-commission-assignment footer{position:sticky;background:var(--bg2,#111c2e);padding:18px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;z-index:1}.sv-sale-commission-assignment header{top:0;border-bottom:1px solid var(--border,#34425c)}.sv-sale-commission-assignment header h2{margin:0;font-size:18px}.sv-sale-commission-assignment footer{bottom:0;border-top:1px solid var(--border,#34425c);justify-content:flex-end;flex-wrap:wrap}.sv-sale-commission-assignment .sv-assignment-content{padding:20px;min-width:0}.sv-sale-commission-assignment select{display:block;width:100%;min-width:0;min-height:44px;margin-top:8px;padding:10px;border:1px solid var(--border,#34425c);border-radius:8px;background:var(--bg3,#182b46);color:var(--text,#edf2fa);font:inherit;box-sizing:border-box}.sv-sale-commission-assignment button{min-height:44px!important;white-space:normal}.sv-sale-commission-assignment [data-assignment-status]{min-height:22px;font-size:13px;line-height:1.5;overflow-wrap:anywhere}.sv-sale-commission-assignment .sv-assignment-note{font-size:13px;line-height:1.5;color:var(--text2,#b8c6d9)}.sv-assignment-spinner{display:inline-block;width:13px;height:13px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;margin-right:7px;vertical-align:middle;animation:sv-assignment-spin .8s linear infinite}@keyframes sv-assignment-spin{to{transform:rotate(360deg)}}';doc.head.append(style);}
  function open(sale){
   if(!canOpen(sale)){root.notify?.('No tenés permiso para cambiar quién comisiona.');return false;}
   if(state?.busy)return false;if(state&&state.key===sale.fbKey&&valid(state)){state.select.focus({preventScroll:true});return state.loading;}close(true);styles();
   const dialog=doc.createElement('dialog');dialog.className='sv-sale-commission-assignment';dialog.setAttribute('aria-label','Quién comisiona');dialog.setAttribute('data-sv-escape-owner','true');dialog.tabIndex=-1;
   dialog.innerHTML='<form><header><h2>Quién comisiona</h2><button type="button" class="btn btn-sm" data-assignment-close aria-label="Cerrar">×</button></header><div class="sv-assignment-content"><label>Comisionado principal<select aria-label="Comisionado principal" disabled><option value="">Cargando venta…</option></select></label><p data-assignment-status role="status" aria-live="polite">Cargando venta…</p><p class="sv-assignment-note">Las comisiones ya registradas se conservan.</p><button type="button" class="btn btn-sm" data-assignment-review>Revisar comisiones</button></div><footer><button type="button" class="btn" data-assignment-cancel>Cancelar</button><button type="submit" class="btn btn-primary" disabled>Guardar</button></footer></form>';
   const s={id:++sequence,key:sale.fbKey,dialog,focus:doc.activeElement,overflow:doc.body.style.overflow,htmlOverflow:doc.documentElement.style.overflow,context:capture(sale),original:null,busy:false,closed:false,listeners:[],loading:null};state=s;s.select=dialog.querySelector('select');s.save=dialog.querySelector('[type=submit]');s.status=dialog.querySelector('[data-assignment-status]');doc.body.append(dialog);doc.body.style.overflow='hidden';doc.documentElement.style.overflow='hidden';
   const listen=(target,type,fn)=>{target.addEventListener(type,fn);s.listeners.push([target,type,fn]);};
   const retire=()=>{if(state===s&&!valid(s))close(true);};
   for(const name of ['sisventas:session-ended','sisventas:role-changed','sisventas:permissions-changed','sisventas:page-changed','visibilitychange','sisventas:foreground-paused'])listen(doc,name,name==='sisventas:session-ended'?()=>close(true):retire);
   listen(root,'hashchange',retire);listen(root,'pagehide',()=>close(true));listen(doc,'sisventas:data-state-changed',()=>{if(!valid(s)){close(true);return;}paintEmployees(s);});
   listen(dialog,'cancel',e=>{e.preventDefault();e.stopPropagation();close();});listen(dialog,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}else if(e.key==='Tab'){const controls=[...dialog.querySelectorAll('button:not([disabled]),select:not([disabled])')].filter(n=>n.getClientRects().length);const first=controls[0],last=controls.at(-1);if(!first){e.preventDefault();dialog.focus({preventScroll:true});}else if(e.shiftKey&&(doc.activeElement===first||doc.activeElement===dialog)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(doc.activeElement===last||doc.activeElement===dialog)){e.preventDefault();first.focus();}}});
   dialog.querySelector('[data-assignment-close]').onclick=()=>close();dialog.querySelector('[data-assignment-cancel]').onclick=()=>close();dialog.querySelector('[data-assignment-review]').onclick=()=>review(s);dialog.querySelector('form').onsubmit=e=>{e.preventDefault();save(s);};
   dialog.showModal();sync();dialog.querySelector('[data-assignment-close]').focus({preventScroll:true});
   s.loading=Promise.resolve().then(()=>{if(!valid(s))return;return root.SVCommercialOwnership.request('ventas','registro/'+encodeURIComponent(s.key));}).then(result=>{
    if(!valid(s))return false;const original=result?.record;if(!object(original)||original._svListSummary||original._svPagedSummary||original._svDerivedFechaOrden||original.fbKey!=null&&original.fbKey!==s.key)throw fail('No se pudo verificar la venta completa. Volvé a abrirla.');
    s.original=clone(clean(original));paintEmployees(s);if(!s.select.disabled&&!doc.hidden)s.select.focus({preventScroll:true});return true;
   }).catch(error=>{if(valid(s)){status(s,error?.message||'No se pudo consultar la venta.',true);s.select.disabled=true;s.save.disabled=true;}return false;});return s.loading;
  }
  return {open,canOpen,close};
 }
 return {create,employees,buildChange};
});
