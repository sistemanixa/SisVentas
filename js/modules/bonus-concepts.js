(function(root,factory){
 'use strict';
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)root.SVBonusConcepts=api.createManager(root,api.createStore(api.browserAdapter(root)));
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const PATH='sisventas/config/bonificaciones',fields=['nombre','montoSugerido','revision','creadoPor','creadoTs','modificadoPor','modificadoTs','operacionId','eliminado'];
 const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const canonical=value=>value==null?'null':typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
 const error=(message,code='SV_BONUS_INVALID')=>Object.assign(Error(message),{code});
 const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,160}$/.test(value);
 const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 function name(value){if(typeof value!=='string'||/[\x00-\x1f\x7f]/.test(value))throw error('Indicá un nombre válido para el concepto.');const result=value.trim().replace(/\s+/g,' ');if(!result||result.length>120)throw error('El nombre debe tener entre 1 y 120 caracteres.');return result;}
 function suggested(value){if(value===undefined||value===null||value==='')return undefined;if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>1e12||Math.abs(value*100-Math.round(value*100))>0.0001)throw error('El monto sugerido debe ser positivo y tener hasta dos decimales.');return value;}
 function parseAmount(value){const text=String(value??'').trim();if(!text)return undefined;if(/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(text)||/^\d{1,3}(?:\.\d{3})+$/.test(text))return suggested(Number(text.replace(/\./g,'').replace(',','.')));if(/^\d+(?:\.\d{1,2})?$/.test(text))return suggested(Number(text));throw error('Revisá el monto sugerido; usá hasta dos decimales.');}
 function record(value){
  if(!plain(value)||Object.keys(value).some(field=>!fields.includes(field))||!Number.isSafeInteger(value.revision)||value.revision<1||!key(value.operacionId)||!['creadoPor','modificadoPor'].every(field=>typeof value[field]==='string'&&value[field].length>0&&value[field].length<=128)||!['creadoTs','modificadoTs'].every(field=>Number.isSafeInteger(value[field])&&value[field]>=0)||value.eliminado!==undefined&&value.eliminado!==true)throw error('Hay un concepto con formato desconocido. No se modificó el catálogo.');
  name(value.nombre);suggested(value.montoSugerido);return copy(value);
 }
 function catalog(value){if(value==null)return {};if(!plain(value)||Object.keys(value).length>500)throw error('El catálogo requiere revisión antes de continuar.');const result={};for(const [id,item]of Object.entries(value)){if(!key(id))throw error('Referencia de concepto inválida.');result[id]=record(item);}return result;}
 function usageName(item){return String(item.bonificacionConceptoNombre||item.motivo||item.descripcion||item.desc||'').replace(/^bonificaci[oó]n\s*[·:–-]?\s*/i,'').trim();}
 function groupUsages(payload,entries={}){
  const groups=new Map(),seen=new Set(),items=Array.isArray(payload?.items)?payload.items:[];
  for(const item of items){if(!plain(item)||String(item.tipoPagable||item.tipo||'').toLowerCase()!=='bonificacion')continue;const source=String(item.fbKey||'');if(source&&seen.has(source))continue;if(source)seen.add(source);
   const id=typeof item.bonificacionConceptoId==='string'?item.bonificacionConceptoId:'',label=usageName(item),groupKey=id?'id:'+id:'legacy:'+norm(label),matched=id?[id,entries[id]]:Object.entries(entries).find(([,entry])=>!entry.eliminado&&norm(entry.nombre)===norm(label)),saved=matched?.[1];
   if(!groups.has(groupKey))groups.set(groupKey,{key:groupKey,id,catalogId:saved?matched[0]:'',nombre:saved?.nombre||label||'Sin motivo informado',inferred:!id,eliminado:!!saved?.eliminado,items:[]});groups.get(groupKey).items.push(copy(item));
  }
  for(const group of groups.values())group.items.sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0)||String(b.fecha||'').localeCompare(String(a.fecha||'')));
  return {groups:[...groups.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')),complete:payload?.complete===true&&Array.isArray(payload.items),scope:String(payload?.scope||'Usos disponibles en esta consulta')};
 }
 function createStore(adapter){
  function check(valid,manage=false){if(typeof valid!=='function'||!valid()||!adapter.canUse()||manage&&!adapter.canManage())throw error('La sesión o el permiso cambió. Volvé a abrir Bonificaciones.','SV_BONUS_ACCESS');}
  return {
   async load(valid){check(valid);const result=await adapter.read(PATH);check(valid);return catalog(result);},
   async select(id,expected,valid){
    check(valid);if(!key(id))throw error('Referencia de concepto inválida.');const previous=record(expected),value=await adapter.read(PATH+'/'+id);check(valid);
    const current=value==null?null:record(value);if(!current||current.eliminado)return {status:'unavailable',id,value:current};
    if(canonical(current)!==canonical(previous))return {status:'changed',id,value:current};
    return {status:'ready',id,value:current,snapshot:{id,nombre:current.nombre,...(current.montoSugerido===undefined?{}:{montoSugerido:current.montoSugerido})}};
   },
   newId(){const id=adapter.makeId(PATH);if(!key(id))throw error('No se pudo reservar el concepto. Reintentá.');return id;},
   prepare({id,expected=null,nombre,montoSugerido,remove=false},valid){
    check(valid,true);if(!key(id))throw error('Referencia de concepto inválida.');const old=expected==null?null:record(expected);if(old?.eliminado)throw error('El concepto fue eliminado. Creá otro concepto para volver a usarlo.','SV_BONUS_CONFLICT');
    const actor=adapter.actor(),stamp=adapter.now(),operation=adapter.operationId();if(typeof actor!=='string'||!actor||actor.length>128||!key(operation)||!Number.isSafeInteger(stamp)||stamp<0)throw error('No se pudo identificar la operación.');
    const value={nombre:remove?old?.nombre:name(nombre),revision:(old?.revision||0)+1,creadoPor:old?.creadoPor||actor,creadoTs:old?.creadoTs??stamp,modificadoPor:actor,modificadoTs:stamp,operacionId:operation};
    if(remove&&!old)throw error('El concepto ya no está disponible.','SV_BONUS_CONFLICT');const amount=remove?old.montoSugerido:suggested(montoSugerido);if(amount!==undefined)value.montoSugerido=amount;if(remove)value.eliminado=true;
    return {id,expected:copy(old),value:record(value)};
   },
   async commit(command,valid){
    check(valid,true);if(!key(command?.id))throw error('Referencia de concepto inválida.');const desired=record(command.value),expected=command.expected==null?null:record(command.expected);
    const result=await adapter.transaction(PATH+'/'+command.id,actual=>{check(valid,true);const current=actual==null?null:record(actual);if(canonical(current)===canonical(desired))return copy(desired);if(canonical(current)!==canonical(expected))throw error('El concepto cambió en otra ventana. Actualizá el listado antes de editar.','SV_BONUS_CONFLICT');return copy(desired);},()=>{try{check(valid,true);return true;}catch(_){return false;}});
    check(valid,true);if(result?.committed!==true||canonical(result.snapshot?.val())!==canonical(desired))throw error('No se confirmó el guardado. Reintentá sin cambiar el formulario.','SV_BONUS_UNCONFIRMED');return {id:command.id,value:copy(desired)};
   }
  };
 }
 function browserAdapter(root){return {
  canUse:()=>!!root.tienePermiso?.('empleados.bonificar')&&!root._impersonacionOriginal,
  canManage:()=>!!root.tienePermiso?.('empleados.bonificar')&&!!root.tienePermiso?.('configuracion.editar')&&!root._impersonacionOriginal,
  actor:()=>String(root.currentUserUid||''),now:()=>Date.now(),operationId:()=>root.crypto.randomUUID(),
  makeId:path=>{if(!root.fbDB||typeof root.fbPush!=='function')throw error('Se necesita conexión segura para reservar el concepto.');return root.fbPush(root.fbRef(root.fbDB,path)).key;},
  read:async path=>{if(!root.fbDB||typeof root.fbGet!=='function')throw error('Se necesita conexión para cargar los conceptos.');if(typeof root.svPostventaEsperar!=='function')throw error('Recargá la aplicación para comprobar los conceptos.');return (await root.svPostventaEsperar(root.fbGet(root.fbRef(root.fbDB,path)))).val();},
  transaction:(path,transform,valid)=>{if(!root.fbDB||typeof root.svTransaccionConEstadoActual!=='function')throw error('Recargá la aplicación para guardar de forma segura.');return root.svTransaccionConEstadoActual(root.fbRef(root.fbDB,path),transform,valid);}
 };}
 const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
 function createManager(root,store){
  const doc=root.document;let active=null;
  const canUse=()=>!!root.tienePermiso?.('empleados.bonificar')&&!root._impersonacionOriginal;
  const canManage=()=>canUse()&&!!root.tienePermiso?.('configuracion.editar');
  const money=value=>value==null?'Sin monto sugerido':'$ '+Number(value).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
  function valid(state){return active===state&&!state.closed&&state.context()&&canUse();}
  function current(state){if(valid(state))return true;if(active===state)close(true);return false;}
  function close(force=false){const state=active;if(!state||state.busy&&!force)return;if(!state.closed){state.closed=true;state.dialog.close();state.dialog.remove();doc.body.style.overflow=state.overflow;if(state.context()&&state.focus?.isConnected)state.focus.focus({preventScroll:true});}active=null;root.svSincronizarPilaModales?.();}
  function usageStatus(state){return state.usageLoading?'Cargando usos…':state.usageError?'Usos sin verificar. '+state.usageError:state.usages.complete?state.usages.scope:'Usos parciales; el total no está verificado.';}
  function usagesFor(state,id,label){return state.usages.groups.filter(group=>group.id?group.id===id:norm(group.nombre)===norm(label)).flatMap(group=>group.items);}
  function regroup(state){state.usages=groupUsages({items:state.usages.groups.flatMap(group=>group.items),complete:state.usages.complete,scope:state.usages.scope},state.entries);}
  function editor(state,entry=null,inferred=null){if(!current(state)||!canManage()||!state.catalogReady)return;state.editor={id:entry?.id||store.newId(),expected:entry?copy(state.entries[entry.id]):null,nombre:entry?.nombre||inferred?.nombre||'',monto:entry?.montoSugerido??(inferred?.items?.[0]?.monto??''),command:null};state.detail=null;state.error='';render(state);state.dialog.querySelector('[name="bonus-name"]')?.focus();}
  function render(state){if(!current(state))return;const focused=doc.activeElement,hadFocus=!!state.dialog.contains?.(focused),focusAction=focused?.dataset?.action,focusId=focused?.dataset?.id,managing=canManage();let body='';
   if(state.confirm){body='<h3 style="font-size:16px">Eliminar concepto</h3><p style="margin:14px 0;overflow-wrap:anywhere">¿Eliminar <strong>'+esc(state.confirm.item.nombre)+'</strong> de las nuevas bonificaciones?</p><p style="font-size:13px;color:var(--text2)">Las bonificaciones ya otorgadas y sus pagos se conservan. El concepto quedará en su historial.</p><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px"><button class="btn" data-action="back">Cancelar</button><button class="btn btn-primary" data-action="confirm-delete">Eliminar concepto</button></div>';
   }else if(state.editor){const draft=state.editor;body='<form data-bonus-form><div style="display:grid;gap:14px"><label class="fg">Concepto<input name="bonus-name" maxlength="120" required value="'+esc(draft.nombre)+'"></label><label class="fg">Monto sugerido ($) · opcional<input name="bonus-amount" inputmode="decimal" value="'+esc(draft.monto)+'" placeholder="Sin monto sugerido"></label><p style="font-size:12px;color:var(--text3)">Se usará para nuevas bonificaciones. Las ya otorgadas conservan su motivo e importe.</p></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button type="button" class="btn" data-action="back">Cancelar</button><button type="submit" class="btn btn-primary" data-action="save">Guardar concepto</button></div></form>';
   }else if(state.detail){const rows=state.detail.items;body='<button class="btn btn-sm" data-action="back">← Volver</button><h3 style="margin:16px 0 8px">'+esc(state.detail.nombre)+'</h3><p style="font-size:12px;color:var(--text3)">'+esc(usageStatus(state))+'</p><div style="display:grid;gap:10px;margin-top:14px">'+(rows.map(item=>'<article style="border:1px solid var(--border);border-radius:10px;padding:12px;overflow-wrap:anywhere"><strong>'+esc(item.empleadoNombre||'Empleado no informado')+'</strong><div>'+esc(money(item.monto))+' · '+esc(item.estado||'Sin estado informado')+'</div><div style="font-size:12px;color:var(--text3)">Fecha: '+esc(item.fecha||'Sin fecha informada')+' · Cómputo: '+esc(item.periodoComputo||'Sin mes informado')+'</div><div style="font-size:12px">'+esc(usageName(item)||'Sin motivo informado')+'</div></article>').join('')||(state.usages.complete?'<p>Sin usos registrados en esta consulta.</p>':'<p>Los usos no están verificados.</p>'))+'</div>';
   }else{const saved=Object.entries(state.entries).filter(([,entry])=>!entry.eliminado).map(([id,entry])=>({id,...entry}));const rows=state.tab==='used'?state.usages.groups:saved;
    body='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px"><button class="btn btn-sm '+(state.tab==='saved'?'btn-primary':'')+'" data-action="saved">Guardadas</button><button class="btn btn-sm '+(state.tab==='used'?'btn-primary':'')+'" data-action="used">Utilizadas</button><span style="flex:1"></span>'+(managing&&state.catalogReady?'<button class="btn btn-primary btn-sm" data-action="new">+ Nuevo concepto</button>':'')+'<button class="btn btn-sm" data-action="refresh">Actualizar</button></div><p role="status" style="font-size:12px;color:var(--text3)">'+esc(state.catalogLoading?'Cargando conceptos…':usageStatus(state))+'</p><div style="display:grid;gap:10px">'+rows.map(row=>{
     const historical=state.tab==='used',savedRow=historical&&(row.id||row.catalogId)?state.entries[row.id||row.catalogId]:null,deleted=historical&&!!savedRow?.eliminado,usable=historical?(savedRow&&!deleted?{id:row.id||row.catalogId,...savedRow}:null):row;
     const uses=historical?row.items:usagesFor(state,row.id,row.nombre),count=state.usages.complete?uses.length+' uso'+(uses.length===1?'':'s'):(uses.length?uses.length+' usos disponibles':'Usos sin verificar');const index=historical?state.usages.groups.indexOf(row):row.id;
     return '<article style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border:1px solid var(--border);border-radius:10px;padding:12px"><div style="min-width:0;flex:1 1 220px;overflow-wrap:anywhere"><strong>'+esc(row.nombre)+'</strong><div style="font-size:12px;color:var(--text3)">'+esc(deleted?'Concepto eliminado':historical&&row.inferred?'Motivo utilizado anteriormente · sin concepto vinculado':money(row.montoSugerido))+' · '+esc(count)+'</div></div><div style="display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap">'+(usable?'<button class="btn btn-sm" data-action="use" data-id="'+esc(usable.id)+'">Usar</button>':'')+'<button class="btn btn-sm" data-action="uses" '+(historical?'data-group="'+index+'"':'data-id="'+esc(row.id)+'"')+'>Usos</button>'+(managing&&usable?'<button class="btn btn-sm" data-action="edit" data-id="'+esc(usable.id)+'">Editar</button><button class="btn btn-sm" data-action="delete" data-id="'+esc(usable.id)+'">Eliminar</button>':managing&&historical&&row.inferred&&row.nombre!=='Sin motivo informado'?'<button class="btn btn-sm" data-action="infer" data-group="'+index+'">Guardar concepto</button>':'')+'</div></article>';
    }).join('')+(rows.length?'':'<p style="padding:16px;color:var(--text3)">'+(state.tab==='saved'?'No hay conceptos guardados.':state.usageLoading?'Esperando la lectura de usos.':state.usageError?'No se pudo verificar el historial.':state.usages.complete?'No hay bonificaciones registradas en esta consulta.':'El historial no está verificado.')+'</p>')+'</div>';
   }
   state.dialog.innerHTML='<div class="modal-head" style="position:sticky;top:0;background:var(--bg2);z-index:2;padding:18px;border-bottom:1px solid var(--border)"><div><h2 id="bonus-concepts-title" style="font-size:17px;margin:0">Bonificaciones</h2><div style="font-size:12px;color:var(--text3);margin-top:5px">Conceptos reutilizables y sus usos. No modifica bonificaciones otorgadas.</div></div><button type="button" class="icon-btn" data-action="close" aria-label="Cerrar">×</button></div><div style="padding:18px">'+body+'<p data-error role="alert" style="color:var(--red);font-size:12px;margin:12px 0 0">'+esc(state.error)+'</p>'+(state.busy?'<p role="status" style="margin-top:12px"><i class="ti ti-loader-2 ti-spin" aria-hidden="true"></i> '+esc(state.busyLabel||'Guardando…')+'</p>':'')+'</div>';
   state.dialog.setAttribute('aria-busy',String(state.busy));state.dialog.querySelectorAll('button,input').forEach(node=>{node.disabled=state.busy;});
   if(hadFocus||state.dialog.open&&doc.activeElement===doc.body){
    const controls=Array.from(state.dialog.querySelectorAll('button:not([disabled]),input:not([disabled])'));
    const next=controls.find(node=>focusAction&&node.dataset.action===focusAction&&node.dataset.id===focusId)||controls[0]||state.dialog;
    if(next===state.dialog)state.dialog.setAttribute('tabindex','-1');next.focus?.({preventScroll:true});
   }
  }
  async function refresh(state){if(!current(state)||state.busy)return;state.catalogReady=false;state.catalogLoading=true;state.usageLoading=!!state.loadUsages;state.error='';state.usageError='';state.entries={};state.usages={groups:[],complete:false,scope:''};render(state);
   function paint(){if(!current(state)||state.editor||state.confirm||state.busy)return;if(state.detail){const detail=state.detail,group=detail._groupKey&&state.usages.groups.find(entry=>entry.key===detail._groupKey);detail.items=group?group.items:usagesFor(state,detail._id,detail.nombre);}render(state);}
   const loadCatalog=store.load(()=>valid(state)).then(entries=>{if(!current(state))return;state.entries=entries;state.catalogReady=true;regroup(state);},failure=>{if(current(state))state.error=failure.message||'No se pudieron cargar los conceptos.';}).finally(()=>{if(current(state)){state.catalogLoading=false;paint();}});
   const loadHistory=Promise.resolve().then(()=>state.loadUsages?state.loadUsages():state.suppliedUsages||{items:[],complete:false}).then(payload=>{if(current(state))state.usages=groupUsages(payload,state.entries);},failure=>{if(current(state))state.usageError=failure.message||'No se pudo comprobar el historial.';}).finally(()=>{if(current(state)){state.usageLoading=false;paint();}});
   await Promise.allSettled([loadCatalog,loadHistory]);
  }
  async function busy(state,label,work){if(!current(state)||state.busy)return;state.busy=true;state.busyLabel=label;state.error='';render(state);try{await work();}catch(failure){if(valid(state))state.error=failure.message||'No se pudo completar la operación.';}finally{if(current(state)){state.busy=false;render(state);}}}
  async function save(state){if(!state.editor||!canManage())return;const draft=state.editor;await busy(state,'Guardando concepto…',async()=>{
   const value=parseAmount(draft.monto);
   const duplicate=Object.entries(state.entries).find(([id,item])=>id!==draft.id&&!item.eliminado&&norm(item.nombre)===norm(draft.nombre));if(duplicate)throw error('Ya existe un concepto con ese nombre. Volvé al listado y elegí Editar para cambiarlo.');
   const signature=canonical({nombre:name(draft.nombre),montoSugerido:suggested(value)});if(draft.command&&draft.signature!==signature)throw error('Reintentá sin cambiar el contenido del guardado pendiente, o cancelá y abrí un formulario nuevo.');
   if(!draft.command){draft.command=store.prepare({id:draft.id,expected:draft.expected,nombre:draft.nombre,montoSugerido:value},()=>valid(state));draft.signature=signature;}
   const result=await store.commit(draft.command,()=>valid(state));if(!current(state))return;state.entries[result.id]=result.value;regroup(state);state.editor=null;state.tab='saved';root.notify?.('Concepto guardado');
  });}
  async function action(state,button){if(!current(state)||state.busy)return;const action=button.dataset.action,id=button.dataset.id,item=id&&state.entries[id],group=button.dataset.group!==undefined?state.usages.groups[Number(button.dataset.group)]:null;
   if(action==='close'){close();return;}if(action==='back'){state.editor=null;state.detail=null;state.confirm=null;state.error='';render(state);return;}if(action==='saved'||action==='used'){state.tab=action;state.error='';render(state);return;}
   if(action==='refresh'){await refresh(state);return;}if(action==='new'){editor(state);return;}if(action==='edit'&&item&&!item.eliminado){editor(state,{id,...item});return;}
   if(action==='infer'&&group?.inferred){editor(state,null,group);return;}if(action==='uses'){state.detail=group?{...group,_groupKey:group.key}:{_id:id,nombre:item?.nombre||'Usos',items:usagesFor(state,id,item?.nombre)};render(state);return;}
   if(action==='use'&&item&&!item.eliminado){let selected=null;await busy(state,'Verificando concepto…',async()=>{const result=await store.select(id,item,()=>valid(state));if(!current(state))return;if(result.value)state.entries[id]=result.value;else delete state.entries[id];regroup(state);if(result.status==='unavailable'){state.error='El concepto fue eliminado o ya no está disponible. Elegí otro concepto.';return;}if(result.status==='changed'){state.error='El concepto cambió en otra ventana. Actualizamos sus datos; revisalos y volvé a pulsar Usar.';return;}selected=result.snapshot;});if(selected&&current(state)){close();state.onUse?.(selected);}return;}
   if(action==='delete'&&item&&!item.eliminado&&canManage()){state.confirm={id,item:copy(item)};state.error='';render(state);state.dialog.querySelector('[data-action="back"]')?.focus();return;}
   if(action==='confirm-delete'&&state.confirm&&canManage())await busy(state,'Eliminando concepto…',async()=>{const target=state.confirm;if(!state.deleteCommands[target.id])state.deleteCommands[target.id]=store.prepare({id:target.id,expected:target.item,remove:true},()=>valid(state));const result=await store.commit(state.deleteCommands[target.id],()=>valid(state));if(!current(state))return;state.entries[target.id]=result.value;regroup(state);state.confirm=null;root.notify?.('Concepto eliminado; se conservan sus usos');});
  }
  async function open({onUse,usages,loadUsages}={}){
   if(!canUse()){root.notify?.('No tenés permiso para usar bonificaciones');return;}if(active?.busy)return;close();const context=root.svCapturarContextoOperacion?.();if(typeof context!=='function'||!context()){root.notify?.('Verificá tu sesión para continuar');return;}
   const dialog=doc.createElement('dialog');dialog.id='sv-bonus-concepts';dialog.setAttribute('aria-labelledby','bonus-concepts-title');dialog.setAttribute('data-sv-escape-owner','true');dialog.style.cssText='position:fixed;inset:0;margin:auto;padding:0;width:min(860px,calc(100vw - 24px));max-height:88vh;max-height:88dvh;overflow:auto;overscroll-behavior:contain;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:14px;box-shadow:0 24px 70px #0008';
   const state=active={dialog,context,onUse,loadUsages,suppliedUsages:usages,catalogReady:false,entries:{},usages:{groups:[],complete:false,scope:''},tab:'saved',busy:false,closed:false,editor:null,detail:null,confirm:null,deleteCommands:{},error:'',focus:doc.activeElement,overflow:doc.body.style.overflow};doc.body.style.overflow='hidden';doc.body.appendChild(dialog);
   dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('click',event=>{const button=event.target.closest('button[data-action]');if(button)action(state,button).catch(failure=>{if(valid(state)){state.error=failure.message;render(state);}});});
   dialog.addEventListener('input',event=>{if(!valid(state)||!state.editor)return;if(event.target.name==='bonus-name')state.editor.nombre=event.target.value;if(event.target.name==='bonus-amount')state.editor.monto=event.target.value;});dialog.addEventListener('submit',event=>{event.preventDefault();save(state);});render(state);dialog.showModal();root.svSincronizarPilaModales?.();await refresh(state);
  }
  for(const event of ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed'])doc.addEventListener(event,()=>close(true));
  return {open,close,refresh:()=>active?refresh(active):Promise.resolve()};
 }
 return {PATH,norm,name,parseAmount,record,catalog,groupUsages,createStore,browserAdapter,createManager};
});
