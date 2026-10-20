'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 isAuthenticated=true;currentRole='admin';currentUserUid='fixture';currentUser='Administrador ficticio';currentUserEmail='fixture@example.invalid';
 window.SISVENTAS_FUNCTIONS.cotizadorProveedor=location.origin;window.SISVENTAS_FUNCTIONS.asistente=location.origin;
 window.tienePermiso=()=>true;window.permisoModulo=()=>true;
 clientesData=[{fbKey:'c',id:'c',nombre:'Cliente ficticio',dir:'Dirección ficticia',activo:true}];
 prodData={p:{fbKey:'p',id:'p',codigo:'DEMO-1',cod:'DEMO-1',nombre:'Producto ficticio',categoria:'Ejemplo',gremio:100,pventa:200,activo:true}};
 for(const key of ['productos','clientes','ventas','presupuestos','pagos','gastos','empleados','proveedores','usuarios','ordenes_trabajo'])window.SVDataReadiness?.beginSource(key).ready();
 empData={e:{fbKey:'e',nombre:'Integrante ficticio',activo:true}};
 document.body.classList.add('dark-mode');document.documentElement.classList.add('dark-mode','sv-v3-preview');
 document.body.classList.remove('sv-sesion-cerrada');
 for(const id of ['screen-login','screen-loading'])document.getElementById(id).style.display='none';
 const app=document.getElementById('screen-app');app.style.display='flex';app.classList.add('visible');app.inert=false;
 const auditStyle=document.createElement('style');auditStyle.textContent='body.sv-modal-stack-open #module-audit-tools{display:none}#module-audit-tools[hidden],#module-audit-show[hidden]{display:none!important}';document.head.append(auditStyle);
 const tools=document.createElement('aside');tools.id='module-audit-tools';tools.style.cssText='position:fixed;bottom:8px;left:8px;z-index:2147483000;max-width:340px;background:#14283e;border:1px solid #54769c;border-radius:9px;padding:8px;font-size:11px';
 tools.innerHTML='<strong>DATOS FICTICIOS · sin Firebase</strong> <button class="btn btn-sm" id="audit-routes">Recorrer módulos</button> <button class="btn btn-sm" id="audit-dialogs">Recorrer ventanas</button><button class="btn btn-sm" id="audit-editors">Recorrer editores</button><button class="btn btn-sm" id="audit-selector">Venta y selector</button><button class="btn btn-sm" id="audit-client">Cliente de prueba</button><button class="btn btn-sm" id="audit-alert">Aviso sobre ventana</button><details><summary>Resultado de auditoría</summary><pre id="module-audit-result" style="max-height:35vh;overflow:auto;white-space:pre-wrap">Preparado</pre></details>';
 document.body.append(tools);
 const showTools=document.createElement('button');showTools.id='module-audit-show';showTools.className='btn btn-sm';showTools.textContent='Mostrar herramientas';showTools.hidden=true;showTools.style.cssText='position:fixed;bottom:8px;left:8px;z-index:2147483000';
 showTools.onclick=()=>{tools.hidden=false;showTools.hidden=true;};document.body.append(showTools);
 const hideTools=document.createElement('button');hideTools.className='btn btn-sm';hideTools.textContent='Ocultar herramientas';hideTools.onclick=()=>{tools.hidden=true;showTools.hidden=false;};tools.insertBefore(hideTools,tools.querySelector('details'));
 let idleBaseline=null;
 let cerrarProcesoFicticio=null;
 function activity(){const counts={};for(const item of __moduleAudit.reads.slice(idleBaseline?.reads||0)){const key=item.type+' '+item.path;counts[key]=(counts[key]||0)+1;}const active={};for(const sub of __moduleAudit.subscriptions)if(sub.active)active[sub.path]=(active[sub.path]||0)+1;return {seconds:idleBaseline?Math.round((Date.now()-idleBaseline.at)/1000):null,reads:__moduleAudit.reads.length-(idleBaseline?.reads||0),writes:__moduleAudit.writes.length-(idleBaseline?.writes||0),counts,active,errors:__moduleAudit.errors};}
 for(const [label,action]of [
  ['Ingreso completo ficticio',async()=>{fbCargarTodo();await new Promise(r=>setTimeout(r,4800));document.getElementById('module-audit-result').textContent=JSON.stringify(activity(),null,2);}],
  ['Repetir cargas ficticias',async()=>{for(let i=0;i<3;i++){svCargarDatosDePaginaActual();fbCargarCategorias();fbCargarEquipos();fbCargarInformes();fbCargarOrdenes();fbCargarEmpleados();fbCargarProveedores();}await new Promise(r=>setTimeout(r,300));document.getElementById('module-audit-result').textContent=JSON.stringify(activity(),null,2);}],
  ['Limpiar borradores ficticios',()=>{for(const key of Object.keys(localStorage))if(key.startsWith('sv:commercial-draft:v1:fixture:'))localStorage.removeItem(key);document.getElementById('module-audit-result').textContent='Borradores ficticios locales eliminados. Recargá para empezar una medición limpia.';}],
  ['Iniciar reposo',()=>{idleBaseline={at:Date.now(),reads:__moduleAudit.reads.length,writes:__moduleAudit.writes.length};document.getElementById('module-audit-result').textContent=JSON.stringify(activity(),null,2);}],
  ['Aviso de error ficticio',()=>notify('No se pudieron sincronizar los presupuestos')],
  ['Proceso general ficticio',()=>{if(cerrarProcesoFicticio){cerrarProcesoFicticio();cerrarProcesoFicticio=null;}else cerrarProcesoFicticio=window.SisVentas.carga.mostrar('Proceso general ficticio…');}],
  ['Ver actividad',()=>{document.getElementById('module-audit-result').textContent=JSON.stringify(activity(),null,2);}]
 ]){const button=document.createElement('button');button.className='btn btn-sm';button.textContent=label;button.onclick=action;tools.insertBefore(button,tools.querySelector('details'));}
 const demandTools=document.createElement('details');demandTools.id='audit-demand-tools';
 demandTools.innerHTML='<summary>Carga a demanda · datos ficticios</summary><p style="margin:5px 0">Informes empieza con dos registros. Las fuentes quedan retenidas hasta liberarlas.</p><div id="audit-demand-buttons" style="display:flex;gap:4px;flex-wrap:wrap"></div><output id="audit-demand-state" style="display:block;margin-top:5px;white-space:pre-wrap"></output>';
 tools.insertBefore(demandTools,tools.querySelector('details'));
 tools.style.maxHeight='55vh';tools.style.overflow='auto';
 const demandState=demandTools.querySelector('output');
 function showDemandState(){
  const page=document.querySelector('.page.active'),state=window.SVDataReadiness?.statusFor(page?.id.replace(/^page-/,''));
  const subscriptions={};for(const row of __moduleAudit.subscriptions){if(!/\/sisventas\//.test('/'+row.path))continue;const count=subscriptions[row.path]??={opened:0,active:0};count.opened++;if(row.active)count.active++;}
  demandState.textContent=JSON.stringify({page:page?.id,missing:state?.missing,errors:state?.errors,pending:window.__moduleAuditSourceControl.pending(),subscriptions},null,2);
 }
 function beginDemand(page,hold){
  // Sólo cambia esta sesión ficticia; no llama a Firebase Auth ni a servicios.
  document.dispatchEvent(new Event('sisventas:session-ended'));
  window.fbStopAllValueListeners();svDetenerEscuchasModulo();svReiniciarBanderasLectura();svCancelarTrabajoFondo();
  window.SVDataReadiness?.reset();window.__moduleAuditSourceControl.clear();window.__moduleAuditSourceControl.hold(hold);
  clientesData=[{fbKey:'c',id:'c',nombre:'Cliente ficticio',dir:'Dirección ficticia',activo:true}];
  informesData=[];equiposData=[];window._historialTickets=null;
  isAuthenticated=true;currentRole='admin';currentUserUid='fixture';currentUser='Administrador ficticio';currentUserEmail='fixture@example.invalid';
  window._fbCargaTodoActiva=true;
  document.dispatchEvent(new CustomEvent('sisventas:session-ready',{detail:{uid:'fixture',rol:'admin',usuario:currentUser}}));
  svCancelarTrabajoFondo();showPage(page);
  if(page==='dashboard'){fbCargarClientes();fbCargarProductos();fbCargarVentas();fbCargarPagos();}
  if(page==='historialcliente')verHistorialCliente('c');
  showDemandState();
 }
 for(const [label,action]of [
  ['Retener Dashboard',()=>beginDemand('dashboard',['clientes','productos','pagos'])],
  ['Liberar datos Dashboard',()=>{for(const key of ['clientes','productos','pagos'])window.__moduleAuditSourceControl.release(key);}],
  ['Retener Informes',()=>beginDemand('informes',['informes','clientes'])],
  ['Liberar informes',()=>window.__moduleAuditSourceControl.release('informes')],
  ['Liberar clientes',()=>window.__moduleAuditSourceControl.release('clientes')],
  ['Fallar informes',()=>window.__moduleAuditSourceControl.fail('informes')],
  ['Reintentar pantalla',()=>{const button=document.querySelector('#sv-data-status-layer [data-sv-data-status] button')||document.querySelector('.page.active [data-sv-data-status] button');button?.click();}],
  ['Retener Historial',()=>{
   fixtureRoot.sisventas.equipos={eq:{cliente:'Cliente ficticio',clienteFbKey:'c',descripcion:'Equipo ficticio del historial',serie:'SERIE-FICTICIA',fechaInstalacion:'2026-10-01',garantiaMeses:12}};
   fixtureRoot.sisventas.tickets={ticket:{cliente:'Cliente ficticio',clienteFbKey:'c',numero:'T-FICTICIO',descripcion:'Ticket ficticio del historial',estado:'Abierto',prioridad:'Media'}};
   beginDemand('historialcliente',['equipos','tickets']);
  }],
  ['Liberar equipos',()=>window.__moduleAuditSourceControl.release('equipos')],
  ['Liberar tickets',()=>window.__moduleAuditSourceControl.release('tickets')],
  ['Ver carga pendiente',showDemandState]
 ]){const button=document.createElement('button');button.className='btn btn-sm';button.textContent=label;button.onclick=()=>{action();setTimeout(showDemandState,60);};demandTools.querySelector('#audit-demand-buttons').append(button);}
 function gestoLateralFicticio(x){
  for(const [tipo,dx]of [['touchstart',0],['touchmove',90],['touchend',90]]){
   const punto={identifier:1,clientX:x+dx,clientY:160};
   const evento=new Event(tipo,{bubbles:true,cancelable:true});
   Object.defineProperties(evento,{touches:{value:tipo==='touchend'?[]:[punto]},changedTouches:{value:[punto]}});
   document.body.dispatchEvent(evento);
  }
 }
 for(const [label,action]of [
  ['Recorrer configuración',async()=>{
   showPage('configuracion');await new Promise(r=>setTimeout(r,250));__moduleAudit.configuration=[];
   for(const button of Array.from(document.querySelectorAll('#cfg-tabs-main .cfg-tab')).filter(visible)){
    const record={name:button.textContent.trim()};try{button.click();await new Promise(r=>setTimeout(r,180));record.forms=formLayout(document.getElementById('page-configuracion'));record.overflow=document.documentElement.scrollWidth>innerWidth;}catch(e){record.error=e.message;}
    __moduleAudit.configuration.push(record);document.getElementById('module-audit-result').textContent=JSON.stringify(__moduleAudit,null,2);
   }
  }],
  ['Gesto desde borde (ficticio)',()=>gestoLateralFicticio(6)],
  ['Gesto fuera del borde (ficticio)',()=>gestoLateralFicticio(40)],
  ['Cuenta de empleado de prueba',()=>{
   fixtureRoot.sisventas.ctaemp={e:{comisionAntigua:{tipo:'comision',fecha:'2026-07-01',descripcion:'Comisión histórica ficticia',monto:123.45,pct:5,gananciaBase:2469,estado:'pagado',montoPagado:123.45,pagos:{p1:{fecha:'2026-07-02',monto:123.45,medio:'Transferencia'}}},comisionLarga:{tipo:'comision',fecha:'2026-07-01',descripcion:'Comisión ficticia con 24 pagos',monto:2400,pct:10,gananciaBase:24000,estado:'pagado',montoPagado:2400,pagos:Object.fromEntries(Array.from({length:24},(_,i)=>['p'+i,{fecha:'2026-07-'+String(i+1).padStart(2,'0'),monto:100,medio:'Transferencia'}]))}}};
   showPage('ctaemp');document.getElementById('ctaemp-sel').value='e';cargarCtaEmp('e');tools.hidden=true;showTools.hidden=false;
  }],
  ['Cuenta corriente de prueba',async()=>{
   window.TIPO_CAMBIO_CONFIG={oficial:1500,dolarConversion:'oficial'};
   const ventas=[{fbKey:'v1',id:'V-DEMO',clienteFbKey:'c',cliente:'Cliente ficticio',fecha:'2026-10-01',total:1000},{fbKey:'v2',id:'V-OTRA',clienteFbKey:'other',cliente:'Otro cliente ficticio',fecha:'2026-10-01',total:1500}];
   const pagos=[{fbKey:'p1',venta:'V-DEMO',ventaFbKey:'v1',clienteFbKey:'c',cliente:'Cliente ficticio',fecha:'2026-10-17',medio:'Transferencia',monto:200,comprobanteRef:'doc1'},{fbKey:'p2',venta:'V-DEMO',ventaFbKey:'v1',clienteFbKey:'c',cliente:'Cliente ficticio',fecha:'2026-10-16',medio:'Efectivo',monto:100},{fbKey:'p3',venta:'V-DEMO',ventaFbKey:'v1',clienteFbKey:'c',cliente:'Cliente ficticio',fecha:'2026-10-17',medio:'Transferencia',monto:50,comprobanteRef:'doc2'},{fbKey:'other',venta:'V-OTRA',ventaFbKey:'v2',clienteFbKey:'other',cliente:'Otro cliente ficticio',fecha:'2026-10-17',medio:'Transferencia',monto:500}];
   fixtureRoot.sisventas.ventas=Object.fromEntries(ventas.map(v=>[v.fbKey,v]));fixtureRoot.sisventas.pagos=Object.fromEntries(pagos.map(p=>[p.fbKey,p]));
   fixtureRoot.sisventas.cobros_adjuntos=Object.fromEntries([1,2].map(i=>['doc'+i,{nombre:'Comprobante ficticio '+i+'.svg',tipo:'image/svg+xml',data:'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="350"><rect width="500" height="350" fill="white"/><text x="25" y="80" font-size="24">COMPROBANTE FICTICIO '+i+'</text></svg>')}]));
   ventasList=ventas;window._historialPagosCompleto=pagos;window._pagosListaActual=pagos;actualizarConciliacionComercial();showPage('cuentacorriente');await new Promise(r=>setTimeout(r,180));actualizarConciliacionComercial();setFiltroCC('todos');verCuentaClienteReal('c');tools.style.display='none';
  }],
  ['Chat de prueba',async()=>{chatAbrir();await new Promise(r=>setTimeout(r,180));chatRenderMensajes([{fbKey:'audit-message',autor:'Administrador ficticio',autorUid:'fixture',texto:'Mensaje ficticio de auditoría',ts:Date.now(),leido:{}}]);}],
  ['Actualizador de prueba',abrirActualizadorMasivoPrecios],
  ['Lector anidado de prueba',()=>{showPage('presupuesto');abrirNuevoPresupuesto();document.getElementById('pp-obs').value='Observación ficticia que debe conservarse';abrirBusquedaAvanzada(document.querySelector('#pp-body tr'));Array.from(tools.querySelectorAll('button')).find(b=>b.textContent==='Lector activo de prueba').click();}],
  ['Lector de prueba',()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{throw Object.assign(Error('Cámara ficticia sin permiso'),{name:'NotAllowedError'});}});SVSerialCamera.open({kind:'product',onRead:()=>{}});}],
  ['Lector activo de prueba',()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,320,240);Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{const stream=canvas.captureStream(10);stream.getTracks().forEach(track=>{const stop=track.stop.bind(track);track.stop=()=>{stop();tools.dataset.cameraStops=String(Number(tools.dataset.cameraStops||0)+1);};});return stream;}});Object.defineProperty(navigator.mediaDevices,'enumerateDevices',{configurable:true,value:async()=>[]});SVSerialCamera.open({kind:'product',onRead:()=>{}});}]
 ]){const button=document.createElement('button');button.className='btn btn-sm';button.textContent=label;button.onclick=action;tools.insertBefore(button,tools.querySelector('details'));}
 document.getElementById('audit-routes').onclick=async()=>{
  const ids=Array.from(document.querySelectorAll('.page[id^="page-"]')).map(el=>el.id.slice(5));
  __moduleAudit.pages=[];
  for(const id of ids){const before=__moduleAudit.errors.length;try{showPage(id);await new Promise(r=>setTimeout(r,380));const page=document.getElementById('page-'+id);__moduleAudit.pages.push({id,active:page.classList.contains('active'),forms:formLayout(page),overflow:document.documentElement.scrollWidth>innerWidth,errors:__moduleAudit.errors.slice(before)});}catch(e){__moduleAudit.pages.push({id,error:e.message});}}
  document.getElementById('module-audit-result').textContent=JSON.stringify(__moduleAudit,null,2);
 };
 const visible=el=>el.isConnected&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&el.getClientRects().length;
 const roots=()=>Array.from(document.querySelectorAll('.modal-overlay,[role=dialog],[role=alertdialog],[id^=modal-],[id$=-modal],dialog[open]')).filter(el=>visible(el)&&getComputedStyle(el).position==='fixed');
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 function formLayout(root){
  return Array.from(root.querySelectorAll('.form-grid,.px-form-grid')).filter(visible).map(grid=>({
   id:grid.id||grid.closest('[id]')?.id,cols:getComputedStyle(grid).gridTemplateColumns,height:Math.round(grid.getBoundingClientRect().height),width:Math.round(grid.getBoundingClientRect().width),
   fields:Array.from(grid.children).filter(visible).map(field=>{const input=field.querySelector('input:not([type=hidden]),select,textarea');const box=field.getBoundingClientRect();return {id:input?.id||input?.name,label:field.querySelector('label')?.textContent.trim().slice(0,55),x:Math.round(box.x),y:Math.round(box.y),width:Math.round(box.width),controlWidth:input?Math.round(input.getBoundingClientRect().width):0,overflow:input?input.getBoundingClientRect().right>box.right+2:false};})
  }));
 }
 document.getElementById('audit-dialogs').onclick=async()=>{
  __moduleAudit.dialogs=[];
  const cases=Object.keys(FORMS_CFG).map(type=>({name:'Formulario '+type,open:()=>abrirModalNuevo(type),close:cerrarModalNuevoGenerico}));
  cases.push(
   {name:'Gasto rápido',open:abrirGastoRapido,close:cerrarGastoRapido},
   {name:'Bonificación',open:abrirModalBonificacionEmpleado,close:cerrarModalBonificacionEmpleado},
   {name:'Comisión manual',open:abrirModalComisionVenta,close:cerrarModalComisionVenta},
   {name:'Comunicado',open:abrirModalComunicado,close:()=>cerrarModalComunicado(true)},
   {name:'Categorías',open:abrirGestionCategorias},
   {name:'Revisión mano de obra',open:abrirRevisionManoObra},
   {name:'Actualizador',open:abrirActualizadorMasivoPrecios,close:cerrarActualizadorMasivoPrecios},
   {name:'Vacaciones',open:()=>abrirModalVacaciones('e')},
   {name:'Adelanto',open:abrirModalAdelantoGeneral,close:cerrarModalAdelantoGeneral},
   {name:'Chat',open:chatAbrir,close:chatCerrar},
   {name:'Asistente',open:iaAbrir,close:iaCerrar},
   {name:'Imprimir',open:()=>abrirModalImprimir('presupuesto','Documento ficticio')},
   {name:'Visor de comprobante',open:()=>abrirVisorComprobanteSistema({nombre:'ejemplo.svg',tipo:'image/svg+xml',data:'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="white"/><text x="20" y="40">COMPROBANTE FICTICIO</text></svg>')},'Vista previa ficticia'),close:cerrarVisorComprobanteSistema}
  );
  cases.push({name:'Origen de OT',open:nuevaOT},{name:'Selector de kit',open:()=>{abrirNuevoKit();abrirSelectorProductoKit();},close:cerrarSelectorProductoKit});
  for(const item of cases){
   const record={name:item.name},before=__moduleAudit.errors.length;
   try{
    await item.open();await wait(180);
    const candidates=roots(),root=candidates.filter(el=>!candidates.some(other=>other!==el&&other.contains(el))).at(-1);
    if(!root){record.opened=false;}else{
     record.opened=true;const panel=root.querySelector('.modal')||root.firstElementChild||root;
     record.forms=formLayout(root);
     const header=panel.querySelector('.modal-head,.modal-header,[data-modal-header],.sv-modal-drag-handle');
     record.direction=getComputedStyle(panel).flexDirection;
     record.locked=document.body.classList.contains('sv-modal-stack-open');
     record.floatingShortcutsHidden=Array.from(document.querySelectorAll('#fab-container,#chat-fab,#ia-fab')).every(el=>!visible(el));
     record.header=header?getComputedStyle(header).backgroundColor:null;
     const urgent=document.getElementById('sv-important-alert-stack');
     if(urgent)record.urgentDeferred=getComputedStyle(urgent).visibility==='hidden';
     const bg=document.querySelector('.content'),top=bg?.scrollTop;
     if(panel.scrollHeight>panel.clientHeight){panel.scrollTop=100;record.scrollIsolated=bg?.scrollTop===top;}
     const close=Array.from(root.querySelectorAll('button')).find(el=>visible(el)&&/^(Cancelar|Cerrar|Cerrar ventana|Cerrar visor|×)$/i.test((el.getAttribute('aria-label')||el.textContent).trim()));
     if(close){close.scrollIntoView({block:'nearest'});const r=close.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);record.closeReceivesClick=hit===close||close.contains(hit);}
     if(item.close)await item.close();else if(close)close.click();else record.noClose=true;
     await wait(100);record.closed=!visible(root);record.released=!document.body.classList.contains('sv-modal-stack-open');
     if(visible(root)){record.cleanup=true;root.classList.remove('open');root.style.display='none';document.body.classList.remove('modal-secure-open');svSincronizarPilaModales();}
    }
   }catch(e){record.error=e.message;}
   record.errors=__moduleAudit.errors.slice(before);__moduleAudit.dialogs.push(record);
   document.getElementById('module-audit-result').textContent=JSON.stringify(__moduleAudit,null,2);
  }
 };
 document.getElementById('audit-editors').onclick=async()=>{
  __moduleAudit.editors=[];
  const cases=[
   ['Venta','venta',iniciarNuevaVenta,()=>showPage('detalle'),'#page-venta'],
   ['Presupuesto','presupuesto',abrirNuevoPresupuesto,volverListaPpto,'#ppto-form-view'],
   ['Producto','productos',()=>abrirFormProducto(null),()=>showPage('productos'),'#prod-form-view'],
   ['Kit','kits',abrirNuevoKit,volverListaKits,'#kit-form-view'],
   ['Gasto','gastos',()=>abrirFormGasto(null),cerrarFormGasto,'#gasto-form'],
   ['Informe','informes',abrirNuevoInforme,volverListaInformes,'#informes-form-view'],
   ['Equipo','equipos',abrirNuevoEquipo,volverListaEquipos,'#eq-ficha-view'],
   ['Historial cliente','clientes',()=>verHistorialCliente('c','Cliente ficticio'),()=>showPage('clientes'),'#page-historialcliente'],
   ['Relevamiento','relevamientos',()=>{},()=>showPage('dashboard'),'#page-relevamientos']
  ];
  for(const [name,route,open,back,selector]of cases){const record={name},before=__moduleAudit.errors.length;
   try{showPage(route);await wait(250);await open();await wait(250);const el=document.querySelector(selector);record.opened=!!el&&visible(el);record.forms=formLayout(el||document);record.overflow=document.documentElement.scrollWidth>innerWidth;record.blocked=document.body.classList.contains('sv-modal-stack-open');await back();await wait(80);record.returned=!document.body.classList.contains('sv-modal-stack-open');}catch(e){record.error=e.message;}
   record.errors=__moduleAudit.errors.slice(before);__moduleAudit.editors.push(record);document.getElementById('module-audit-result').textContent=JSON.stringify(__moduleAudit,null,2);
  }
 };
 document.getElementById('audit-selector').onclick=async()=>{prodData=Object.fromEntries(Array.from({length:20},(_,i)=>['p'+i,{fbKey:'p'+i,id:'p'+i,codigo:'DEMO-'+i,nombre:'Producto ficticio con descripción extensa '+i,categoria:'Ejemplo',gremio:100,pventa:200,activo:true}]));showPage('venta');await wait(250);tools.style.display='none';for(let i=0;i<8;i++)document.querySelector('#det-body').appendChild(crearFilaProducto('','Seleccioná un producto',0,1,0));const target=Array.from(document.querySelectorAll('#det-body .prod-selector')).at(-1);target.dataset.auditSelector='1';target.scrollIntoView({block:'end'});};
 document.getElementById('audit-client').onclick=()=>abrirModalNuevo('cliente');
 document.getElementById('audit-alert').onclick=()=>{showPage('dashboard');window.obtenerNotificacionesSisVentas=()=>[{id:'audit-urgent',titulo:'Aviso urgente ficticio',sub:'Prueba de capas sin datos reales',urgente:true,tipo:'presupuesto',accion:{tipo:'cuentacorriente',label:'Abrir'}}];document.dispatchEvent(new CustomEvent('sisventas:notificaciones-actualizadas'));};
 showPage('dashboard');
});
