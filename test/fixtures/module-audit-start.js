'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 isAuthenticated=true;currentRole='admin';currentUserUid='fixture';currentUser='Administrador ficticio';currentUserEmail='fixture@example.invalid';
 window.tienePermiso=()=>true;window.permisoModulo=()=>true;
 clientesData=[{fbKey:'c',id:'c',nombre:'Cliente ficticio',dir:'Dirección ficticia',activo:true}];
 prodData={p:{fbKey:'p',id:'p',codigo:'DEMO-1',cod:'DEMO-1',nombre:'Producto ficticio',categoria:'Ejemplo',gremio:100,pventa:200,activo:true}};
 for(const key of ['productos','clientes','ventas','presupuestos','pagos','gastos','empleados','proveedores','usuarios','ordenes_trabajo'])window.SVDataReadiness?.beginSource(key).ready();
 empData={e:{fbKey:'e',nombre:'Integrante ficticio',activo:true}};
 document.body.classList.add('dark-mode');document.documentElement.classList.add('dark-mode','sv-v3-preview');
 document.body.classList.remove('sv-sesion-cerrada');
 for(const id of ['screen-login','screen-loading'])document.getElementById(id).style.display='none';
 const app=document.getElementById('screen-app');app.style.display='flex';app.classList.add('visible');app.inert=false;
 const auditStyle=document.createElement('style');auditStyle.textContent='body.sv-modal-stack-open #module-audit-tools{display:none}';document.head.append(auditStyle);
 const tools=document.createElement('aside');tools.id='module-audit-tools';tools.style.cssText='position:fixed;bottom:8px;left:8px;z-index:2147483000;max-width:340px;background:#14283e;border:1px solid #54769c;border-radius:9px;padding:8px;font-size:11px';
 tools.innerHTML='<strong>DATOS FICTICIOS · sin Firebase</strong> <button class="btn btn-sm" id="audit-routes">Recorrer módulos</button> <button class="btn btn-sm" id="audit-dialogs">Recorrer ventanas</button><button class="btn btn-sm" id="audit-editors">Recorrer editores</button><button class="btn btn-sm" id="audit-selector">Venta y selector</button><button class="btn btn-sm" id="audit-client">Cliente de prueba</button><button class="btn btn-sm" id="audit-alert">Aviso sobre ventana</button><details><summary>Resultado de auditoría</summary><pre id="module-audit-result" style="max-height:35vh;overflow:auto;white-space:pre-wrap">Preparado</pre></details>';
 document.body.append(tools);
 function gestoLateralFicticio(x){
  for(const [tipo,dx]of [['touchstart',0],['touchmove',90],['touchend',90]]){
   const punto={identifier:1,clientX:x+dx,clientY:160};
   const evento=new Event(tipo,{bubbles:true,cancelable:true});
   Object.defineProperties(evento,{touches:{value:tipo==='touchend'?[]:[punto]},changedTouches:{value:[punto]}});
   document.body.dispatchEvent(evento);
  }
 }
 for(const [label,action]of [
  ['Gesto desde borde (ficticio)',()=>gestoLateralFicticio(6)],
  ['Gesto fuera del borde (ficticio)',()=>gestoLateralFicticio(40)],
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
  for(const id of ids){const before=__moduleAudit.errors.length;try{showPage(id);await new Promise(r=>setTimeout(r,380));const page=document.getElementById('page-'+id);__moduleAudit.pages.push({id,active:page.classList.contains('active'),overflow:document.documentElement.scrollWidth>innerWidth,errors:__moduleAudit.errors.slice(before)});}catch(e){__moduleAudit.pages.push({id,error:e.message});}}
  document.getElementById('module-audit-result').textContent=JSON.stringify(__moduleAudit,null,2);
 };
 const visible=el=>el.isConnected&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&el.getClientRects().length;
 const roots=()=>Array.from(document.querySelectorAll('.modal-overlay,[role=dialog],[role=alertdialog],[id^=modal-],[id$=-modal],dialog[open]')).filter(el=>visible(el)&&getComputedStyle(el).position==='fixed');
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
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
   ['Venta','venta',iniciarNuevaVenta,()=>showPage('detalle'),'#det-body'],
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
   try{showPage(route);await wait(250);await open();await wait(250);const el=document.querySelector(selector);record.opened=!!el&&visible(el);record.overflow=document.documentElement.scrollWidth>innerWidth;record.blocked=document.body.classList.contains('sv-modal-stack-open');await back();await wait(80);record.returned=!document.body.classList.contains('sv-modal-stack-open');}catch(e){record.error=e.message;}
   record.errors=__moduleAudit.errors.slice(before);__moduleAudit.editors.push(record);document.getElementById('module-audit-result').textContent=JSON.stringify(__moduleAudit,null,2);
  }
 };
 document.getElementById('audit-selector').onclick=async()=>{prodData=Object.fromEntries(Array.from({length:20},(_,i)=>['p'+i,{fbKey:'p'+i,id:'p'+i,codigo:'DEMO-'+i,nombre:'Producto ficticio con descripción extensa '+i,categoria:'Ejemplo',gremio:100,pventa:200,activo:true}]));showPage('venta');await wait(250);tools.style.display='none';for(let i=0;i<8;i++)document.querySelector('#det-body').appendChild(crearFilaProducto('','Seleccioná un producto',0,1,0));const target=Array.from(document.querySelectorAll('#det-body .prod-selector')).at(-1);target.dataset.auditSelector='1';target.scrollIntoView({block:'end'});};
 document.getElementById('audit-client').onclick=()=>abrirModalNuevo('cliente');
 document.getElementById('audit-alert').onclick=()=>{showPage('dashboard');window.obtenerNotificacionesSisVentas=()=>[{id:'audit-urgent',titulo:'Aviso urgente ficticio',sub:'Prueba de capas sin datos reales',urgente:true,tipo:'presupuesto',accion:{tipo:'cuentacorriente',label:'Abrir'}}];document.dispatchEvent(new CustomEvent('sisventas:notificaciones-actualizadas'));};
 showPage('dashboard');
});
