/* Relevamientos de campo: borrador por usuario, configuración técnica y adjuntos por ítem. */
(function(){
  'use strict';
  const schemas={
    alarma:{name:'Alarma',icon:'shield-check',hint:'Central, zonas y dispositivos',fields:[['tecnologia','Tecnología','choice',['Cableada','Inalámbrica','Mixta']],['central','Central propuesta','product','central'],['comunicador','Comunicador','product','comunicador'],['zonas','Zonas necesarias','number'],['magneticos','Magnéticos','number'],['pir','Sensores infrarrojos interiores','number'],['exterior','Sensores exteriores','number'],['sirenas','Sirenas','number'],['teclados','Teclados','number']]},
    camaras:{name:'Cámaras',icon:'device-cctv',hint:'Cobertura y tipo de instalación',fields:[['conexion','Conexión','choice',['Cableada','Wi-Fi','Mixta']],['armado','Armado','choice',['Kit','Equipos separados']],['tecnologia','Sistema','choice',['IP','TVI / analógico','A definir']],['domo','Cámaras domo','number'],['bullet','Cámaras bullet','number'],['ptz','Cámaras PTZ','number'],['grabador','Grabador propuesto','product','grabador'],['almacenamiento','Días de grabación requeridos','number'],['recorrido','Recorrido del cable y alimentación','text']]},
    video:{name:'Videoportero',icon:'device-landline-phone',hint:'Accesos, monitores y cerradura',fields:[['sistema','Sistema','choice',['IP','Dos hilos','A definir']],['frentes','Frentes de calle','number'],['monitores','Monitores interiores','number'],['apertura','Apertura de puerta','choice',['Sí','No','A definir']],['recorrido','Recorrido y alimentación','text']]},
    acceso:{name:'Control de acceso',icon:'lock',hint:'Puertas y formas de ingreso',fields:[['puertas','Puertas o accesos','number'],['metodo','Método de ingreso','choice',['Tarjeta','Huella','Rostro','PIN','Combinado']],['cerradura','Cerradura y tipo de puerta','text'],['usuarios','Usuarios estimados','number']]},
    redes:{name:'Redes / Wi-Fi',icon:'router',hint:'Puntos de red y cobertura',fields:[['puntos','Puntos de red','number'],['aps','Puntos Wi-Fi','number'],['internet','Internet existente','choice',['Sí','No','A verificar']],['recorrido','Cobertura, recorridos y gabinete','text']]},
    otro:{name:'Otro servicio',icon:'tools',hint:'Necesidad especial del cliente',fields:[['necesidad','Servicio y alcance solicitado','text']]}
  };
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function products(kind,data){
    const re={central:/\bcentral\b|\b(panel|placa)\b.*(garnet|alonso|pc[- ]|alarma)|kit alarma|hub.*inalambrico/,comunicador:/\bcomunicador\b|\bip-500/,grabador:/\bnvr\b|\bdvr\b/}[kind];
    return Object.entries(data||{}).filter(([,p])=>{
      if(!p||p.activo===false||p.eliminado)return false;
      const name=norm(p.nombre||p.descripcion),cat=norm(p.categoria);
      if(/instalacion|configuracion|mano de obra/.test(cat+' '+name)||!re.test(name))return false;
      if(kind==='central'&&/gabinete para|fuente|sirena|expansor|receptor|comunicador 4g/.test(name))return false;
      if(kind==='comunicador'&&/panel|kit alarma/.test(name))return false;
      if(kind==='grabador'&&/disco|fuente|soporte|accesorio|balun/.test(name))return false;
      return true;
    }).map(([key,p])=>({key,name:p.nombre||p.descripcion||p.codigo}));
  }
  // El borrador mantiene identificadores de interfaz como alarma.central.
  // En RTDB se escriben niveles separados: items/alarma/central.
  function surveyItems(items){
    const flat={};
    for(const [key,item] of Object.entries(items||{})){
      if(key.includes('.')) flat[key]=item;
      else for(const [field,value] of Object.entries(item||{})) flat[key+'.'+field]=value;
    }
    return flat;
  }
  function surveyFromStorage(data){return {...data,items:surveyItems(data.items)};}
  function surveyForStorage(draft){
    const data=JSON.parse(JSON.stringify(draft)),groups={};
    for(const [key,item] of Object.entries(surveyItems(data.items))){
      const separator=key.indexOf('.'),service=key.slice(0,separator),field=key.slice(separator+1);
      if(!data.services.includes(service))continue;
      if(separator<1||!field||Array.from(service+field).some(c=>'.#$[]/'.includes(c)||c.charCodeAt(0)<32||c.charCodeAt(0)===127))throw new Error('Identificador de ítem inválido.');
      if(!Object.hasOwn(groups,service))Object.defineProperty(groups,service,{value:{},enumerable:true});
      Object.defineProperty(groups[service],field,{value:item,enumerable:true});
    }
    data.items=groups;return data;
  }
  function validation(d){d=surveyFromStorage(d);if(!d.cliente.trim())return 'Completá el cliente o contacto.';if(!d.direccion.trim())return 'Completá la dirección del relevamiento.';if(!d.services.length)return 'Elegí al menos un servicio.';for(const s of d.services)for(const f of schemas[s].fields){const v=(d.items[s+'.'+f[0]]||{}).value;if(f[2]==='number'&&v!==undefined&&v!==''&&(!Number.isInteger(Number(v))||Number(v)<0||Number(v)>9999))return 'Revisá la cantidad de '+f[1]+'.';}return '';}
  if(typeof module!=='undefined'&&module.exports){module.exports={schemas,products,validation,surveyItems,surveyFromStorage,surveyForStorage};return;}
  const root=()=>document.getElementById('page-relevamientos');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let draft=null,step=0,busy=false,dbPromise,saveQueue=Promise.resolve(),loadedOwner='',statusTimer,formEpoch=0,pendingSave=null,pendingPhoto=null,pendingCleanup=null,loadedContext=null;
  const owner=()=>String(window.currentUserEmail||window.currentUser||'');
  function draftContext(){
    const uid=window.currentUserUid,user=window.fbAuth?.currentUser,authUid=user?.uid,role=window.currentRole,key=owner(),epoch=formEpoch,sessionEpoch=window._svOperacionesSesionEpoch||0,dataEpoch=window._svDataEpoch||0;
    const revision=window.PERMISOS_ROLES?.[role]?.indiceRevision,view=window._impersonacionOriginal,profile=view?.usuarioFbKey,page=root(),hash=window.location?.hash,moduleAccess=window.permisoModulo;
    const db=window.fbDB,ref=window.fbRef,set=window.fbSet;
    function sameActor(){try{return (typeof isAuthenticated==='undefined'?window.isAuthenticated:isAuthenticated)===true&&!!uid&&!!user&&!!authUid&&authUid===uid&&uid===window.currentUserUid&&user===window.fbAuth?.currentUser&&authUid===user.uid&&role===window.currentRole&&
      key===owner()&&sessionEpoch===(window._svOperacionesSesionEpoch||0)&&dataEpoch===(window._svDataEpoch||0)&&revision===window.PERMISOS_ROLES?.[role]?.indiceRevision&&view===window._impersonacionOriginal&&profile===view?.usuarioFbKey&&
      moduleAccess===window.permisoModulo&&typeof moduleAccess==='function'&&moduleAccess('relevamientos')===true;}catch(_){return false;}}
    function canPaint(){return sameActor()&&epoch===formEpoch&&page===root()&&page?.isConnected!==false&&page?.classList.contains('active')&&hash===window.location?.hash;}
    function valid(){return canPaint()&&listForeground();}
    function canWrite(){return valid()&&!!db&&db===window.fbDB&&ref===window.fbRef&&typeof ref==='function'&&set===window.fbSet&&typeof set==='function';}
    return {key,uid,user,page,sameActor,canPaint,valid,canWrite,db,ref,set};
  }
  function ownsDraft(context){return loadedOwner===context.key&&loadedContext?.sameActor()===true;}
  function cleanupForDraft(){return pendingCleanup&&pendingCleanup.original===draft&&pendingCleanup.context.sameActor()&&pendingCleanup.fingerprint===JSON.stringify(draft)?pendingCleanup:null;}
  function refreshSaveLabel(){const button=root()?.querySelector('[data-save]');if(button&&!busy)button.textContent=cleanupForDraft()?'Completar guardado local':'Guardar relevamiento';}
  function retireDraft(){formEpoch++;pendingSave=pendingPhoto=null;busy=false;}
  function fresh(){return {id:'REL-'+crypto.randomUUID(),cliente:'',direccion:'',contacto:'',services:[],items:{},createdAt:new Date().toISOString(),autor:window.currentUser||'',owner:owner()};}
  function db(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('sv-relevamientos',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));}
  async function local(value,key,valid){const database=await db();if(!valid())throw Object.assign(Error('El contexto del borrador cambió'),{name:'AbortError'});return new Promise((resolve,reject)=>{const tx=database.transaction('drafts',value===undefined?'readonly':'readwrite'),store=tx.objectStore('drafts'),r=value===undefined?store.get(key):value===null?store.delete(key):store.put(value,key);tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Object.assign(Error('Borrador cancelado'),{name:'AbortError'}));});}
  function persist(){if(!draft||busy)return;const context=draftContext();if(!ownsDraft(context))return;refreshSaveLabel();const original=draft,copy=JSON.parse(JSON.stringify(original));saveQueue=saveQueue.then(()=>{if(context.sameActor())return local(copy,context.key,context.sameActor);}).then(()=>{if(!context.valid()||draft!==original)return;const n=document.getElementById('rel-draft-status');if(n)n.textContent='Borrador guardado en este dispositivo';}).catch(()=>{if(!context.valid()||draft!==original)return;const n=document.getElementById('rel-draft-status');if(n)n.textContent='No se pudo guardar el borrador. No cierres esta ventana.';});}
  function field(s,f){const key=s+'.'+f[0],item=draft.items[key]||{},v=item.value??'';let control='';
    if(f[2]==='choice')control='<div class="rel-options">'+f[3].map(x=>'<button type="button" data-choice="'+esc(key)+'" data-value="'+esc(x)+'" aria-pressed="'+(v===x)+'">'+esc(x)+'</button>').join('')+'</div>';
    else if(f[2]==='number')control='<div class="rel-stepper"><button data-delta="-1" data-key="'+key+'" aria-label="Restar '+esc(f[1])+'">−</button><input aria-label="'+esc(f[1])+'" data-value-field="'+key+'" type="number" min="0" max="9999" step="1" inputmode="numeric" value="'+esc(v)+'" placeholder="—"><button data-delta="1" data-key="'+key+'" aria-label="Sumar '+esc(f[1])+'">+</button></div>';
    else if(f[2]==='product'){const opts=products(f[3],window.prodData);control='<select aria-label="'+esc(f[1])+'" data-value-field="'+key+'"><option value="">Seleccionar producto</option><option value="A definir" '+(v==='A definir'?'selected':'')+'>A definir en oficina</option><option value="No requiere" '+(v==='No requiere'?'selected':'')+'>No requiere</option>'+opts.map(p=>'<option value="'+esc(p.key)+'" '+(p.key===v?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select>';if(!opts.length)control+='<small>Sin productos compatibles cargados. Podés dejarlo a definir.</small>';}
    else control='<textarea data-value-field="'+key+'" aria-label="'+esc(f[1])+'" placeholder="Describí lo que encontraste…">'+esc(v)+'</textarea>';
    return '<article class="rel-field"><h3>'+esc(f[1])+'</h3>'+control+'<details '+(item.note||item.photo?'open':'')+'><summary><i class="ti ti-camera"></i> Foto y observaciones'+(item.photo?' · 1 foto':'')+'</summary><textarea data-note="'+key+'" aria-label="Observaciones de '+esc(f[1])+'" placeholder="Ubicación, dificultad o detalle importante…">'+esc(item.note||'')+'</textarea><div class="rel-photo-actions"><label class="btn"><i class="ti ti-camera"></i> Cámara<input type="file" accept="image/*" capture="environment" data-photo="'+key+'" hidden></label><label class="btn"><i class="ti ti-photo"></i> Galería<input type="file" accept="image/*" data-photo="'+key+'" hidden></label></div>'+(item.photo?'<img class="rel-photo" src="'+esc(item.photo.data)+'" alt="Foto de '+esc(f[1])+'"><button class="btn" data-remove-photo="'+key+'">Quitar foto</button>':'')+'</details></article>';
  }
  function summary(d){d=surveyFromStorage(d);return d.services.map(s=>'<section class="rel-summary"><h3>'+esc(schemas[s].name)+'</h3>'+schemas[s].fields.map(f=>{const item=d.items[s+'.'+f[0]]||{};let v=item.label||item.value;return '<div><strong>'+esc(f[1])+'</strong><span>'+esc(v===undefined||v===''?'Sin relevar':v)+'</span>'+(item.note?'<p>'+esc(item.note)+'</p>':'')+(item.photo?'<img class="rel-photo" src="'+esc(item.photo.data)+'" alt="'+esc(f[1])+'">':'')+'</div>';}).join('')+'</section>').join('');}
  function render(){if(!root()||!draft)return;const steps=['Lugar','Servicios','Relevar','Resumen'];root().innerHTML='<div class="rel-shell"><header class="rel-heading"><div><span class="rel-eyebrow">TRABAJO EN CAMPO</span><h1>Relevamientos</h1><p>De la visita a una propuesta bien definida.</p></div><button class="btn" data-list>Ver guardados</button></header><nav class="rel-steps">'+steps.map((x,i)=>'<button data-step="'+i+'" aria-current="'+(step===i?'step':'false')+'"><b>'+ (i+1)+'</b>'+x+'</button>').join('')+'</nav><div id="rel-content">'+(step===0?'<section class="rel-place"><h2>¿Dónde vamos a trabajar?</h2><label>Cliente o contacto<input data-meta="cliente" value="'+esc(draft.cliente)+'" placeholder="Nombre del cliente"></label><label>Dirección / sector<input data-meta="direccion" value="'+esc(draft.direccion)+'" placeholder="Calle, número y sector"></label><label>Teléfono o contacto en el lugar<input data-meta="contacto" value="'+esc(draft.contacto)+'" placeholder="Opcional"></label></section>':step===1?'<h2>¿Qué necesita el cliente?</h2><p class="rel-muted">Podés seleccionar varios servicios.</p><div class="rel-services">'+Object.entries(schemas).map(([s,c])=>'<button data-service="'+s+'" aria-pressed="'+draft.services.includes(s)+'"><i class="ti ti-'+c.icon+'"></i><strong>'+c.name+'</strong><span>'+c.hint+'</span><b>'+ (draft.services.includes(s)?'Seleccionado':'Agregar')+'</b></button>').join('')+'</div>':step===2?(draft.services.length?draft.services.map(s=>'<section class="rel-service-section"><h2><i class="ti ti-'+schemas[s].icon+'"></i> '+schemas[s].name+'</h2><div class="rel-fields">'+schemas[s].fields.map(f=>field(s,f)).join('')+'</div></section>').join(''):'<p>Seleccioná primero los servicios que vas a relevar.</p>'):'<h2>'+esc(draft.cliente||'Sin cliente')+'</h2><p>'+esc(draft.direccion||'Sin dirección')+'</p><p class="rel-muted">Los campos sin completar quedan como “Sin relevar”; no se interpretan como cero.</p>'+summary(draft))+'</div><footer class="rel-footer"><span id="rel-draft-status">Borrador local · se guarda automáticamente</span><div><button class="btn" data-back '+(step===0?'disabled':'')+'>Anterior</button><button class="btn btn-primary" '+(step===3?'data-save':'data-next')+'>'+(step===3?'Guardar relevamiento':'Continuar')+' <i class="ti ti-arrow-right"></i></button></div></footer></div>';}
  let listOff=null,listEpoch=0,listLoadingClose=null,listState=null;
  function listForeground(){return document.hidden!==true&&!['hidden','prerender'].includes(document.visibilityState)&&(!window.SVForegroundSession||window.SVForegroundSession.isVisible()!==false);}
  function listContext(){
    const epoch=listEpoch,uid=window.currentUserUid,user=window.fbAuth?.currentUser,authUid=user?.uid,role=window.currentRole;
    const revision=window.PERMISOS_ROLES?.[role]?.indiceRevision,sessionEpoch=window._svOperacionesSesionEpoch||0,dataEpoch=window._svDataEpoch||0,view=window._impersonacionOriginal,profile=view?.usuarioFbKey;
    const page=root(),hash=window.location?.hash,moduleAccess=window.permisoModulo,db=window.fbDB,ref=window.fbRef,onValue=window.fbOnValue,name=owner();
    const domainConfigured=!!window.SVDomainReads?.domains&&Object.hasOwn(window.SVDomainReads.domains,'relevamientos'),domainAccess=window.svPuedeLeerDominio;
    const authenticated=()=>typeof isAuthenticated==='undefined'?window.isAuthenticated:isAuthenticated;
    function valid(){try{return epoch===listEpoch&&authenticated()===true&&!!uid&&!!user&&!!authUid&&authUid===uid&&uid===window.currentUserUid&&user===window.fbAuth?.currentUser&&authUid===user.uid&&role===window.currentRole&&
      revision===window.PERMISOS_ROLES?.[role]?.indiceRevision&&sessionEpoch===(window._svOperacionesSesionEpoch||0)&&dataEpoch===(window._svDataEpoch||0)&&view===window._impersonacionOriginal&&profile===view?.usuarioFbKey&&name===owner()&&
      page===root()&&page?.isConnected!==false&&page?.classList.contains('active')&&hash===window.location?.hash&&listForeground()&&
      moduleAccess===window.permisoModulo&&typeof moduleAccess==='function'&&moduleAccess('relevamientos')===true&&
      domainConfigured===(!!window.SVDomainReads?.domains&&Object.hasOwn(window.SVDomainReads.domains,'relevamientos'))&&(!domainConfigured||domainAccess===window.svPuedeLeerDominio&&typeof domainAccess==='function'&&domainAccess('relevamientos')===true)&&
      !!db&&db===window.fbDB&&ref===window.fbRef&&typeof ref==='function'&&onValue===window.fbOnValue&&typeof onValue==='function';}catch(_){return false;}}
    return {valid,page,db,ref,onValue};
  }
  function listStatus(page,status){
    page.setAttribute('aria-busy','false');
    const error=status==='error';
    page.innerHTML='<div class="rel-shell"><header class="rel-heading"><h1>Relevamientos guardados</h1></header><p role="'+(error?'alert':'status')+'">'+(error?'No se pudo sincronizar el listado.':'La lectura del listado está pausada. Actualizá para consultar de nuevo.')+'</p><button class="btn" data-list>'+(error?'Reintentar':'Actualizar listado')+'</button><button class="btn" data-resume>Volver al borrador</button></div>';
  }
  function finishList(state){if(state.finished)return;state.finished=true;state.close();if(listLoadingClose===state.close)listLoadingClose=null;state.context.page?.setAttribute('aria-busy','false');}
  function stopList(clear){
    listEpoch++;const state=listState;listState=null;listOff=null;
    if(state){state.closed=true;try{if(typeof state.off==='function')state.off();}finally{state.off=null;finishList(state);}
      if(clear&&state.context.page===root()&&state.context.page.isConnected!==false)listStatus(state.context.page,'paused');}
    else{listLoadingClose?.();listLoadingClose=null;}
  }
  function retireList(state){if(listState===state&&!state.closed)stopList(true);}
  async function open(){stopList(true);retireDraft();const context=draftContext();if(!context.valid()){if(context.page)context.page.innerHTML='';return;}try{if(!draft||loadedOwner!==context.key||!loadedContext?.sameActor()){const saved=await local(undefined,context.key,context.sameActor);if(!context.valid())return;draft=surveyFromStorage(saved||fresh());loadedOwner=context.key;loadedContext=context;step=0;}if(!context.valid())return;render();refreshSaveLabel();if(typeof window.fbCargarProductos==='function')Promise.resolve(window.fbCargarProductos()).catch(()=>{});}catch(e){if(context.valid())root().innerHTML='<div class="card">No se pudo abrir el borrador: '+esc(e.message)+'</div>';}}
  async function save(){
    if(busy||!draft)return;const context=draftContext(),original=draft;if(!context.canWrite()||!ownsDraft(context))return;
    const error=validation(original);if(error){window.notify(error);return;}const confirmed=!!cleanupForDraft();if(!confirmed&&!navigator.onLine){window.notify('Sin conexión. El borrador queda en este dispositivo.');return;}
    const operation={context,original,snapshot:JSON.parse(JSON.stringify(original)),confirmed};pendingSave=operation;busy=true;renderBusy(true);
    try{await saveQueue;if(!context.canWrite()||draft!==original)return;
      if(!operation.confirmed){const data=surveyForStorage(operation.snapshot);data.savedAt=new Date().toISOString();await context.set(context.ref(context.db,'sisventas/relevamientos/'+data.id),data);operation.confirmed=true;
        if(context.sameActor()&&draft===original)pendingCleanup={context,original,fingerprint:JSON.stringify(operation.snapshot)};}
      if(!context.canWrite()||draft!==original)return;await local(null,context.key,()=>context.sameActor()&&draft===original);if(!context.valid()||draft!==original)return;
      pendingCleanup=null;draft=null;window.notify('Relevamiento guardado');await list();
    }catch(e){if(context.valid()&&draft===original)window.notify(operation.confirmed?'El relevamiento ya está guardado. No se pudo limpiar el borrador local; pulsá «Completar guardado local» para reintentar.':'No se pudo guardar: '+e.message+'. El borrador se conserva.');}
    finally{if(pendingSave===operation){pendingSave=null;busy=false;if(context.canPaint()&&draft===original)renderBusy(false);}}
  }
  function renderBusy(value){root().querySelectorAll('button,input,textarea,select').forEach(n=>n.disabled=value);const b=root().querySelector('[data-save]');if(b)b.textContent=value?'Guardando…':cleanupForDraft()?'Completar guardado local':'Guardar relevamiento';}
  async function list(){
    if(listState&&!listState.closed&&listState.context.valid())return;
    stopList(true);retireDraft();const context=listContext(),page=context.page;if(!context.valid()){if(page)page.innerHTML='';return;}
    page.innerHTML='<div class="rel-shell">'+(window.SVScreenLoading?.start?'':'<p role="status">Cargando relevamientos…</p>')+'</div>';
    page.setAttribute('aria-busy','true');
    const close=window.SVScreenLoading?.start(page,'Cargando relevamientos…')||(()=>{});listLoadingClose=close;
    const state={context,close,off:null,closed:false,finished:false};listState=state;
    const current=()=>listState===state&&!state.closed&&context.valid();
    const failure=()=>{if(!current()){retireList(state);return;}stopList();listStatus(page,'error');};
    try{const off=context.onValue(context.ref(context.db,'sisventas/relevamientos'),snap=>{
      if(!current()){retireList(state);return;}
      try{
      const opened=Array.from(root().querySelectorAll('details[open]')).map(n=>n.querySelector('summary')?.textContent);
      const data=snap.val()||{};if(!current()){retireList(state);return;}
      const all=Object.values(data).sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));root().innerHTML='<div class="rel-shell"><header class="rel-heading"><h1>Relevamientos guardados</h1><button class="btn btn-primary" data-resume>'+ (draft?'Volver al borrador':'Nuevo relevamiento')+'</button></header><div class="rel-saved">'+(all.map(d=>'<details class="rel-summary"><summary><strong>'+esc(d.cliente)+'</strong><span>'+esc(d.direccion)+' · '+esc(new Date(d.savedAt).toLocaleDateString('es-AR'))+'</span></summary><p>'+esc(d.id)+' · '+esc(d.autor)+'</p>'+summary(d)+'</details>').join('')||'<p>Todavía no hay relevamientos guardados.</p>')+'</div></div>';
      root().querySelectorAll('details').forEach(n=>{n.open=opened.includes(n.querySelector('summary')?.textContent);});
      }catch(_){failure();}finally{if(current())finishList(state);}
    },failure);if(current()){state.off=off;listOff=off;}else{if(typeof off==='function')off();retireList(state);}}catch(_){failure();}
  }
  document.addEventListener('sisventas:session-ended',()=>{stopList();retireDraft();draft=null;pendingCleanup=null;loadedContext=null;loadedOwner='';if(root())root().innerHTML='';});
  document.addEventListener('sisventas:role-changed',()=>{stopList(true);retireDraft();});
  document.addEventListener('sisventas:page-changed',e=>{if(e.detail.page==='relevamientos')open();else{stopList(true);retireDraft();}});
  function checkList(){if(listState&&!listState.context.valid())retireList(listState);}
  document.addEventListener('visibilitychange',checkList);
  document.addEventListener('sisventas:foreground-paused',checkList);
  window.addEventListener('hashchange',checkList);
  window.addEventListener('pagehide',()=>{if(listState)retireList(listState);});
  document.addEventListener('input',e=>{if(!e.target.closest('#page-relevamientos')||!draft||busy||!ownsDraft(draftContext()))return;const n=e.target;if(n.dataset.meta)draft[n.dataset.meta]=n.value;else{const key=n.dataset.valueField||n.dataset.note;if(!key)return;const item=draft.items[key]||(draft.items[key]={});item[n.dataset.note?'note':'value']=n.value;if(n.tagName==='SELECT')item.label=n.options[n.selectedIndex].textContent;}persist();});
  document.addEventListener('change',async e=>{const n=e.target;if(!n.closest('#page-relevamientos')||!n.dataset.photo||!n.files[0]||busy||!draft)return;const context=draftContext(),original=draft,key=n.dataset.photo;if(!context.valid()||!ownsDraft(context))return;const operation={};pendingPhoto=operation;busy=true;renderBusy(true);try{const photo=await window.svPrepararAdjuntoImagen(n.files[0],{maxBytes:350000});if(!context.valid()||draft!==original)return;const item=original.items[key]||(original.items[key]={});item.photo=photo;}catch(err){if(context.valid()&&draft===original)window.notify(err.message);}finally{if(pendingPhoto===operation){pendingPhoto=null;busy=false;if(context.valid()&&draft===original){persist();render();refreshSaveLabel();}else if(context.canPaint()&&draft===original)renderBusy(false);}}});
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!b.closest('#page-relevamientos')||busy)return;if(b.hasAttribute('data-resume')){open();return;}if(b.hasAttribute('data-list')){list();return;}if(!draft||!ownsDraft(draftContext()))return;
    if(b.dataset.step!==undefined)step=Number(b.dataset.step);else if(b.hasAttribute('data-next'))step=Math.min(3,step+1);else if(b.hasAttribute('data-back'))step=Math.max(0,step-1);else if(b.dataset.service){const s=b.dataset.service;draft.services=draft.services.includes(s)?draft.services.filter(x=>x!==s):draft.services.concat(s);persist();}else if(b.dataset.choice){const item=draft.items[b.dataset.choice]||(draft.items[b.dataset.choice]={});item.value=b.dataset.value;persist();}else if(b.dataset.delta){const key=b.dataset.key,item=draft.items[key]||(draft.items[key]={});item.value=Math.max(0,Math.min(9999,(Number(item.value)||0)+Number(b.dataset.delta)));persist();}else if(b.dataset.removePhoto){delete draft.items[b.dataset.removePhoto].photo;persist();}else if(b.hasAttribute('data-save')){save();return;}else return;const y=window.scrollY;render();refreshSaveLabel();window.scrollTo(0,y);
  });
})();
