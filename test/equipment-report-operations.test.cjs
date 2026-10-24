'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs');
const settle=()=>new Promise(setImmediate);
function fixture(){
 const events=new Map(),nodes={},transactions=[],uploads=[],urls=[],records=new Map(),notices=[],timers=new Map(),popups=[],reads=[];let seq=0,timerId=0,closedEquipment=0,closedReports=0,activeUploads=0,maxUploads=0;
 class Node{constructor(value=''){this.value=value;this.disabled=false;this.style={display:''};this.isConnected=true;this.attrs={};this.tagName='INPUT';this.dataset={};this.innerHTML='Guardar';}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];if(k==='data-proceso-largo')delete this.dataset.procesoLargo;}querySelector(){return this.button;}querySelectorAll(){return this.controls||[];}}
 const equipmentIds=['eq-f-cat','eq-f-modelo','eq-f-desc','eq-f-serie','eq-f-serie2','eq-f-cliente','eq-f-dir','eq-f-tecnico','eq-f-fecha','eq-f-garantia','eq-f-estado','eq-f-venta','eq-f-obs'];
 const reportIds=['inf-numero','inf-fecha','inf-tipo','inf-tecnico','inf-cliente','inf-dir','inf-equipo','inf-serie','inf-venta','inf-motivo','inf-diagnostico','inf-acciones','inf-materiales','inf-preventivas','inf-obs','inf-receptor','inf-receptor-dni','inf-resultado'];
 for(const id of equipmentIds.concat(reportIds,['eq-ficha-titulo','eq-lista-view','eq-ficha-view','inf-form-titulo','informes-lista-view','informes-form-view','cfg-empresa-dir']))nodes[id]=new Node('');
 nodes['eq-f-desc'].value='Equipo ficticio';nodes['inf-cliente'].value='Cliente ficticio';nodes['inf-numero'].value='IT-FICTICIO';
 for(const [form,ids]of [['eq-ficha-view',equipmentIds],['informes-form-view',reportIds]]){nodes[form].button=new Node();nodes[form].button.tagName='BUTTON';nodes[form].controls=ids.map(id=>nodes[id]).concat(nodes[form].button);}
 const page=new Node(),c={URL,Date,Promise,Map,Set,console:{warn(){}},currentUser:'Técnico ficticio',currentUserUid:'uid-ficticio',currentRole:'admin',fbDB:{},fbStorage:{},fbAuth:{currentUser:{uid:'uid-ficticio'}},PERMISOS_ROLES:{admin:{indiceRevision:1}},navigator:{onLine:true},location:{hash:'#/equipos'},equipoActual:null,eqFotosTemp:[],equiposData:[],informeActualId:null,informesData:[],empData:{},
  document:{baseURI:'http://127.0.0.1/',getElementById:id=>nodes[id]||null,querySelector:()=>page,addEventListener(k,v){if(!events.has(k))events.set(k,new Set());events.get(k).add(v);},removeEventListener(k,v){events.get(k)?.delete(v);}},
  permisoModulo:()=>true,tienePermiso:()=>true,notify:message=>notices.push(message),fbRef:(_db,path)=>({path}),fbPush:ref=>({key:'ficticio-'+(++seq),path:ref.path+'/ficticio-'+seq}),
  fbRunTransaction:(ref,update,options)=>new Promise((resolve,reject)=>transactions.push({ref,update,options,resolve,reject})),
  fbOnValue:(ref,next,error)=>{const read={ref,next,error,stopped:false};reads.push(read);Promise.resolve().then(()=>{if(!read.stopped)next({val:()=>records.get(ref.path)||null});});return()=>{read.stopped=true;};},
  fbStorageRef:(_storage,path)=>({path}),fbUploadBytes:(ref,file)=>{activeUploads++;maxUploads=Math.max(maxUploads,activeUploads);return new Promise((resolve,reject)=>uploads.push({ref,file,resolve(value){activeUploads--;resolve(value);},reject(error){activeUploads--;reject(error);}}));},
  fbGetDownloadURL:ref=>new Promise((resolve,reject)=>urls.push({ref,resolve,reject})),
  SisVentas:{carga:{mostrar(){const close=()=>{};close.actualizar=()=>{};return close;}}},
  setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  renderFotosEquipo(){},renderHistorialEquipo(){},logoImpresionActualUrl:()=> 'https://images.invalid/logo.png',escapeHTML:value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
  open(){const popup={html:'',closed:false,printed:0,close(){this.closed=true;},print(){this.printed++;},document:{write(html){popup.html+=html;},close(){}}};popups.push(popup);return popup;}};
 c.window=c;vm.createContext(c);load(c,['svCapturarContextoOperacion','svCrearProgresoBoton','svPostventaFormulario','svPostventaOperacion','svPostventaPersistir','svTransaccionConEstadoActual','svPostventaEsperar','abrirFichaEquipo','abrirNuevoEquipo','volverListaEquipos','guardarEquipo','subirFotosEquipo','abrirNuevoInforme','editarInforme','volverListaInformes','guardarInforme','imprimirInforme']);
 const realEquipmentBack=c.volverListaEquipos;c.volverListaEquipos=()=>{closedEquipment++;return realEquipmentBack();};const realReportsBack=c.volverListaInformes;c.volverListaInformes=()=>{closedReports++;return realReportsBack();};
 function finish(index,{loseAck=false,reject}={}){const tx=transactions[index];if(reject){tx.reject(Error(reject));return;}const actual=records.has(tx.ref.path)?structuredClone(records.get(tx.ref.path)):null;let next;try{next=tx.update(actual);}catch(error){tx.reject(error);return;}if(next===undefined){tx.resolve({committed:false,snapshot:{val:()=>actual}});return;}records.set(tx.ref.path,structuredClone(next));if(loseAck)tx.reject(Error('Acuse perdido ficticio'));else tx.resolve({committed:true,snapshot:{val:()=>next}});}
 async function upload(index){uploads[index].resolve({ref:uploads[index].ref});await settle();const url=urls.at(-1);url.resolve('https://images.invalid/'+index+'.jpg');await settle();}
 function fire(ms){for(const [id,timer]of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn();}}
 function emit(type){for(const fn of [...(events.get(type)||[])])fn({type});}
 return{c,nodes,transactions,uploads,urls,records,notices,timers,popups,reads,finish,upload,fire,emit,stats:()=>({allocated:seq,closedEquipment,closedReports,maxUploads})};
}
test('Equipo devuelve una promesa única y espera el acuse antes de retornar',async()=>{
 const f=fixture(),task=f.c.guardarEquipo();assert.equal(f.c.guardarEquipo(),task);assert.equal(f.nodes['eq-ficha-view'].button.disabled,true);await settle();assert.equal(f.transactions.length,1);assert.equal(f.stats().closedEquipment,0);f.finish(0);assert.equal(await task,true);assert.equal(f.records.size,1);assert.equal(f.stats().closedEquipment,1);assert.equal(f.nodes['eq-ficha-view'].button.disabled,false);
});
test('Equipo usa la misma identidad de alta tras acuse perdido sin clonar el registro',async()=>{
 const f=fixture(),task=f.c.guardarEquipo();await settle();f.finish(0,{loseAck:true});assert.equal(await task,false);const path=f.transactions[0].ref.path;const retry=f.c.guardarEquipo();await settle();assert.equal(f.transactions[1].ref.path,path);f.finish(1);assert.equal(await retry,true);assert.equal(f.records.size,1);
});
test('Equipo no sobrescribe una edición concurrente, conservando fotos e intervenciones ajenas',async()=>{
 const f=fixture(),base={fbKey:'equipo-original',descripcion:'Equipo base',fotos:{foto:{url:'original'}},intervenciones:{v:{trabajo:'Original'}}};f.c.equiposData=[base];f.c.abrirFichaEquipo('equipo-original');f.nodes['eq-f-desc'].value='Cambio local';f.records.set('sisventas/equipos/equipo-original',{...base,descripcion:'Cambio remoto'});const task=f.c.guardarEquipo();await settle();f.finish(0);assert.equal(await task,false);assert.equal(f.records.get('sisventas/equipos/equipo-original').descripcion,'Cambio remoto');assert.match(f.notices.at(-1),/Otro usuario/);assert.equal(f.stats().closedEquipment,0);
});
test('Equipo conserva evidencia concurrente cuando sólo cambió un campo general',async()=>{
 const f=fixture(),base={fbKey:'equipo-original',descripcion:'Equipo base'};f.c.equiposData=[base];f.c.abrirFichaEquipo('equipo-original');f.nodes['eq-f-desc'].value='Cambio local';f.records.set('sisventas/equipos/equipo-original',{...base,fotos:{remota:{url:'remota'}},intervenciones:{v:{trabajo:'Remoto'}}});const task=f.c.guardarEquipo();await settle();f.finish(0);assert.equal(await task,true);const record=f.records.get('sisventas/equipos/equipo-original');assert.equal(record.fotos.remota.url,'remota');assert.equal(record.intervenciones.v.trabajo,'Remoto');
});
test('Fotos esperan subida, URL y metadatos antes de confirmar; usan ID y usuario capturados',async()=>{
 const f=fixture(),file={name:'foto.jpg'};f.c.eqFotosTemp=[file];const task=f.c.guardarEquipo();await settle();f.finish(0);await settle();assert.equal(f.uploads.length,1);assert.equal(f.stats().closedEquipment,0);f.c.currentUser='Nombre cambiado';await f.upload(0);assert.equal(f.transactions.length,2);assert.match(f.transactions[1].ref.path,/sisventas\/equipos\/ficticio-1\/fotos\//);assert.equal(f.nodes['eq-ficha-view'].button.disabled,true);f.finish(1);assert.equal(await task,true);const metadata=f.records.get(f.transactions[1].ref.path);assert.equal(metadata.tecnico,'Técnico ficticio');assert.equal(f.c.eqFotosTemp.length,0);assert.equal(f.stats().closedEquipment,1);
});
test('Una foto fallida conserva sólo los pendientes y distingue el equipo ya guardado',async()=>{
 const f=fixture(),failed={name:'fallida.jpg'},ok={name:'correcta.jpg'};f.c.eqFotosTemp=[failed,ok];const task=f.c.guardarEquipo();await settle();f.finish(0);await settle();assert.equal(f.uploads.length,2);f.uploads[0].reject(Error('Storage ficticio fallido'));await f.upload(1);f.finish(1);assert.equal(await task,false);assert.deepEqual(f.c.eqFotosTemp,[failed]);assert.equal(f.stats().closedEquipment,0);assert.match(f.notices.at(-1),/equipo se guardó.*1 fotos/);assert.equal(f.nodes['eq-ficha-view'].button.disabled,false);
});
test('Las subidas de fotos tienen concurrencia máxima de dos',async()=>{
 const f=fixture();f.c.eqFotosTemp=[{name:'a'},{name:'b'},{name:'c'}];const task=f.c.guardarEquipo();await settle();f.finish(0);await settle();assert.equal(f.uploads.length,2);await f.upload(0);f.finish(1);await settle();assert.equal(f.uploads.length,3);await f.upload(1);f.finish(2);await settle();await f.upload(2);f.finish(3);assert.equal(await task,true);assert.equal(f.stats().maxUploads,2);
});
test('Metadatos pendientes no adelantan éxito; el timeout preserva la foto para reintento',async()=>{
 const f=fixture(),file={name:'pendiente'};f.c.eqFotosTemp=[file];const task=f.c.guardarEquipo();await settle();f.finish(0);await settle();await f.upload(0);assert.equal(f.transactions.length,2);assert.equal(f.stats().closedEquipment,0);f.fire(20000);assert.equal(await task,false);assert.deepEqual(f.c.eqFotosTemp,[file]);assert.match(f.notices.at(-1),/equipo se guardó/);assert.equal(f.nodes['eq-ficha-view'].button.disabled,false);f.finish(1);await settle();assert.equal(f.stats().closedEquipment,0);
});
test('Abrir otro equipo durante las fotos no retargetea metadatos ni limpia los archivos nuevos',async()=>{
 const f=fixture(),old={name:'anterior'};f.c.eqFotosTemp=[old];const task=f.c.guardarEquipo();await settle();f.finish(0);await settle();f.c.abrirNuevoEquipo();const next={name:'nuevo'};f.c.eqFotosTemp=[next];await f.upload(0);f.finish(1);await task;assert.match(f.transactions[1].ref.path,/equipos\/ficticio-1\/fotos/);assert.equal(f.c.equipoActual,null);assert.deepEqual(f.c.eqFotosTemp,[next]);assert.equal(f.stats().closedEquipment,0);
});
test('Un acuse anterior no vuelve a bloquear el botón del equipo nuevo con el helper de progreso real',async()=>{
 const f=fixture(),button=f.nodes['eq-ficha-view'].button,task=f.c.guardarEquipo();await settle();f.c.abrirNuevoEquipo();button.innerHTML='Guardar equipo nuevo';assert.equal(button.disabled,false);f.finish(0);await task;assert.equal(button.disabled,false);assert.equal(button.innerHTML,'Guardar equipo nuevo');assert.equal(f.stats().closedEquipment,0);
});
test('Cambiar la sesión durante Storage detiene los pasos posteriores sin publicar como otro usuario',async()=>{
 const f=fixture();f.c.eqFotosTemp=[{name:'anterior'}];const task=f.c.guardarEquipo();await settle();f.finish(0);await settle();f.c.currentUserUid='otro';f.c.fbAuth.currentUser={uid:'otro'};f.emit('sisventas:session-ended');f.uploads[0].resolve({ref:f.uploads[0].ref});assert.equal(await task,false);assert.equal(f.urls.length,0);assert.equal(f.transactions.length,1);assert.equal(f.notices.length,0);
});
for(const change of ['uid','auth','role','revision','route'])test('El acuse del equipo no altera otro contexto: '+change,async()=>{
 const f=fixture(),task=f.c.guardarEquipo();await settle();if(change==='uid')f.c.currentUserUid='otro';if(change==='auth')f.c.fbAuth.currentUser={uid:'uid-ficticio'};if(change==='role')f.c.currentRole='tecnico';if(change==='revision')f.c.PERMISOS_ROLES.admin.indiceRevision++;if(change==='route')f.c.location.hash='#/clientes';f.finish(0);await task;assert.equal(f.stats().closedEquipment,0);assert.equal(f.notices.length,0);assert.equal(f.c.equipoActual,null);
});
for(const failure of ['url','metadata'])test('Fallo de '+failure+' conserva archivo y equipo confirmado para reintentar',async()=>{
 const f=fixture(),file={name:'ficticia.jpg'};f.c.eqFotosTemp=[file];const task=f.c.guardarEquipo();await settle();f.finish(0);await settle();if(failure==='url'){f.uploads[0].resolve({ref:f.uploads[0].ref});await settle();f.urls[0].reject(Error('URL ficticia fallida'));}else{await f.upload(0);f.finish(1,{reject:'Metadatos ficticios denegados'});}assert.equal(await task,false);assert.deepEqual(f.c.eqFotosTemp,[file]);assert.equal(f.stats().closedEquipment,0);assert.match(f.notices.at(-1),/equipo se guardó/);
});
test('Retry de metadatos con acuse perdido conserva la URL y no vuelve a subir ni clona foto',async()=>{
 const f=fixture(),file={name:'ficticia.jpg'};f.c.eqFotosTemp=[file];const first=f.c.guardarEquipo();await settle();f.finish(0);await settle();await f.upload(0);f.finish(1,{loseAck:true});assert.equal(await first,false);const photoPath=f.transactions[1].ref.path;
 const retry=f.c.guardarEquipo();await settle();f.finish(2);await settle();assert.equal(f.uploads.length,1);assert.equal(f.urls.length,1);assert.equal(f.transactions[3].ref.path,photoPath);f.finish(3);assert.equal(await retry,true);assert.equal(f.records.size,2);
});
test('Un timeout de subida no dispara otra carga del mismo archivo al reintentar',async()=>{
 const f=fixture();f.c.eqFotosTemp=[{name:'retenida.jpg'}];const first=f.c.guardarEquipo();await settle();f.finish(0);await settle();f.fire(20000);assert.equal(await first,false);const retry=f.c.guardarEquipo();await settle();f.finish(1);await settle();assert.equal(f.uploads.length,1);await f.upload(0);f.finish(2);assert.equal(await retry,true);
});
test('Timeout de dos subidas retenidas no inicia más fotos físicas y conserva las seis pendientes',async()=>{
 const f=fixture(),files=Array.from({length:6},(_,index)=>({name:'retenida-'+index+'.jpg'}));f.c.eqFotosTemp=files.slice();const task=f.c.guardarEquipo();await settle();f.finish(0);await settle();assert.equal(f.uploads.length,2);f.fire(20000);assert.equal(await task,false);assert.equal(f.uploads.length,2);assert.equal(f.stats().maxUploads,2);assert.equal(f.urls.length,0);assert.equal(f.transactions.length,1);assert.equal(f.c.eqFotosTemp.length,6);assert.equal(f.stats().closedEquipment,0);
});
test('Equipos e Informes no guardan cuando Ver como ya está activo',async()=>{
 for(const action of ['guardarEquipo','guardarInforme']){const f=fixture();f.c._impersonacionOriginal={uid:'uid-ficticio'};assert.equal(await f.c[action]('borrador'),false);assert.equal(f.transactions.length,0);assert.equal(f.stats().allocated,0);}
});
for(const action of ['guardarEquipo','guardarInforme'])test('El intento retenido de '+action+' no se reutiliza por una sesión posterior',async()=>{
 const f=fixture(),first=f.c[action]('borrador');await settle();f.finish(0,{loseAck:true});await first;f.c.currentUserUid='otra-sesion';f.c.fbAuth.currentUser={uid:'otra-sesion'};f.emit('sisventas:session-ended');assert.equal(await f.c[action]('borrador'),false);assert.equal(f.transactions.length,1);assert.equal(f.stats().allocated,1);assert.match(f.notices.at(-1),/sesión cambió/);
});
test('Informe devuelve promesa única, preserva formulario ante rechazo y reintenta el mismo ID',async()=>{
 const f=fixture(),task=f.c.guardarInforme('borrador');assert.equal(f.c.guardarInforme('completado'),task);await settle();f.finish(0,{loseAck:true});assert.equal(await task,false);assert.equal(f.stats().closedReports,0);assert.equal(f.nodes['inf-cliente'].value,'Cliente ficticio');const retry=f.c.guardarInforme('borrador');await settle();assert.equal(f.transactions[1].ref.path,f.transactions[0].ref.path);f.finish(1);assert.equal(await retry,true);assert.equal(f.records.size,1);assert.equal(f.stats().closedReports,1);
});
for(const change of ['new-form','uid','auth','role','revision','route'])test('El acuse del informe anterior no afecta el formulario/contexto nuevo: '+change,async()=>{
 const f=fixture(),task=f.c.guardarInforme('completado');await settle();if(change==='new-form'){f.c.abrirNuevoInforme();f.nodes['inf-cliente'].value='Nuevo cliente ficticio';}if(change==='uid')f.c.currentUserUid='otro';if(change==='auth')f.c.fbAuth.currentUser={uid:'uid-ficticio'};if(change==='role')f.c.currentRole='tecnico';if(change==='revision')f.c.PERMISOS_ROLES.admin.indiceRevision++;if(change==='route')f.c.location.hash='#/productos';f.finish(0);await task;assert.equal(f.stats().closedReports,0);assert.equal(f.notices.length,0);assert.equal(f.c.informeActualId,null);
});
test('Informe detecta modificación concurrente y no borra los campos ajenos',async()=>{
 const f=fixture(),base={fbKey:'informe-original',cliente:'Cliente base',numero:'IT-BASE',obs:'Original',extra:{conservar:true}};f.c.informesData=[base];f.c.editarInforme('informe-original');f.nodes['inf-obs'].value='Cambio local';f.records.set('sisventas/informes/informe-original',{...base,obs:'Cambio remoto'});const task=f.c.guardarInforme('completado');await settle();f.finish(0);assert.equal(await task,false);assert.equal(f.records.get('sisventas/informes/informe-original').obs,'Cambio remoto');assert.equal(f.records.get('sisventas/informes/informe-original').extra.conservar,true);
});
test('Imprimir informe escapa campos y título, conservando saltos de línea como presentación',async()=>{
 const f=fixture(),payload='<img src=x onerror="alert(1)">&\'\nSegunda línea';f.nodes['inf-cliente'].value=payload;f.nodes['inf-numero'].value='</title><script>mal()</script>';f.nodes['inf-motivo'].value=payload;f.nodes['cfg-empresa-dir'].value='A & B';const task=f.c.imprimirInforme();const html=f.popups[0].html;assert.ok(!html.includes('<script>mal()'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img src=x'));assert.ok(html.includes('&lt;/title&gt;'));assert.ok(html.includes('&#39;<br>Segunda línea'));assert.ok(html.includes('A &amp; B'));assert.ok(!html.includes('A &amp;amp; B'));f.fire(500);assert.equal(await task,true);
});
test('Informe no inserta un protocolo activo en la URL del logo y explica popup bloqueado',async()=>{
 const f=fixture();f.c.logoImpresionActualUrl=()=> 'javascript:alert(1)';const task=f.c.imprimirInforme();assert.ok(!f.popups[0].html.includes('javascript:'));f.fire(500);assert.equal(await task,true);f.c.open=()=>null;assert.equal(await f.c.imprimirInforme(),false);assert.match(f.notices.at(-1),/ventanas emergentes/);
});

for(const changed of [false,true])test('Informe espera recursos y no imprime tras cambiar la sesión: '+changed,async()=>{
 const f=fixture();let finishResources;f.c.SVPrintLayout={ready:()=>new Promise(resolve=>{finishResources=resolve;})};
 const task=f.c.imprimirInforme();f.fire(500);await settle();assert.equal(f.popups[0].printed,0);assert.equal(f.reads.length,0);assert.equal(f.transactions.length,0);
 if(changed)f.c.fbAuth.currentUser={uid:'otro'};
 finishResources();assert.equal(await task,!changed);assert.equal(f.popups[0].printed,changed?0:1);
});
for(const action of ['guardarEquipo','guardarInforme'])test('Un render fallido después de '+action+' no se informa como escritura rechazada',async()=>{
 const f=fixture(),task=f.c[action]('borrador');await settle();f.c.notify=()=>{throw Error('Vista ficticia fallida');};f.finish(0);assert.equal(await task,true);assert.equal(f.records.size,1);
});
test('La edición espera una escucha puntual, la conserva durante CAS y la retira al confirmar',async()=>{
 const f=fixture(),base={fbKey:'equipo-frio',descripcion:'Anterior'};f.c.equiposData=[base];f.c.abrirFichaEquipo(base.fbKey);f.records.set('sisventas/equipos/'+base.fbKey,{descripcion:'Anterior'});f.nodes['eq-f-desc'].value='Nueva';
 f.c.fbOnValue=(ref,next,error)=>{const read={ref,next,error,stopped:false};f.reads.push(read);return()=>{read.stopped=true;};};
 const task=f.c.guardarEquipo();await settle();assert.equal(f.reads.length,1);assert.equal(f.reads[0].ref.path,'sisventas/equipos/equipo-frio');assert.equal(f.transactions.length,0);f.reads[0].next({val:()=>({descripcion:'Anterior'})});await settle();assert.equal(f.transactions.length,1);assert.equal(f.reads[0].stopped,false);f.finish(0);assert.equal(await task,true);assert.equal(f.reads[0].stopped,true);assert.equal(f.records.size,1);
});
for(const phase of ['waiting','snapshot','transaction'])for(const reason of ['form','session','timeout'])test('La escucha CAS se retira sin tocar otro formulario: '+phase+'/'+reason,async()=>{
 const f=fixture(),base={fbKey:'equipo-frio',descripcion:'Anterior'};f.c.equiposData=[base];f.c.abrirFichaEquipo(base.fbKey);f.records.set('sisventas/equipos/'+base.fbKey,{descripcion:'Anterior'});
 f.c.fbOnValue=(ref,next,error)=>{const read={ref,next,error,stopped:false};f.reads.push(read);return()=>{read.stopped=true;};};
 const task=f.c.guardarEquipo();await settle();const read=f.reads[0];if(phase!=='waiting')read.next({val:()=>({descripcion:'Anterior'})});if(phase==='transaction')await settle();
 if(reason==='form'){f.c.abrirNuevoEquipo();f.nodes['eq-f-desc'].value='Formulario nuevo';}if(reason==='session')f.emit('sisventas:session-ended');if(reason==='timeout')f.fire(20000);
 assert.equal(await task,false);assert.equal(read.stopped,true);assert.equal(f.transactions.length,phase==='transaction'?1:0);assert.equal(f.nodes['eq-ficha-view'].button.disabled,false);const baseSaved=JSON.stringify(f.c._svPostventaFormularios.equipos.base);read.next({val:()=>({descripcion:'Tardía'})});if(phase==='transaction')f.finish(0);await settle();assert.equal(JSON.stringify(f.c._svPostventaFormularios.equipos.base),baseSaved);if(reason==='form')assert.equal(f.nodes['eq-f-desc'].value,'Formulario nuevo');
});
test('La edición CAS denegada o con registro borrado falla cerrada y siempre retira la escucha',async()=>{
 for(const failure of ['read','transaction','deleted']){const f=fixture(),base={fbKey:'equipo-frio',descripcion:'Anterior'};f.c.equiposData=[base];f.c.abrirFichaEquipo(base.fbKey);if(failure!=='deleted')f.records.set('sisventas/equipos/'+base.fbKey,{descripcion:'Anterior'});
  f.c.fbOnValue=(ref,next,error)=>{const read={ref,next,error,stopped:false};f.reads.push(read);return()=>{read.stopped=true;};};const task=f.c.guardarEquipo();await settle();if(failure==='read')f.reads[0].error(Error('PERMISSION_DENIED'));else{f.reads[0].next({val:()=>({descripcion:'Anterior'})});await settle();f.finish(0,failure==='transaction'?{reject:'PERMISSION_DENIED'}:{});}assert.equal(await task,false);assert.equal(f.reads[0].stopped,true);assert.equal(f.stats().closedEquipment,0);assert.equal(f.nodes['eq-ficha-view'].button.disabled,false);if(failure==='deleted')assert.equal(f.records.size,0);
 }
});
