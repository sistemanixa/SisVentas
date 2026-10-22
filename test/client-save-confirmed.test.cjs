'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,functionSource}=require('./helpers/app-functions.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function node(value=''){
 const attrs={},classes=new Set();
 return {value,disabled:false,innerHTML:'Guardar',textContent:'',style:{},isConnected:true,children:[],dataset:{},
  classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)},
  setAttribute:(name,v)=>{attrs[name]=v;},removeAttribute:name=>{delete attrs[name];},getAttribute:name=>attrs[name],
  appendChild(child){this.children.push(child);child.isConnected=true;},remove(){this.isConnected=false;}};
}
function fixture(editing=true){
 const writes=[],reads=[],remote=new Map(),timers=new Map(),subscribedPaths=new Set(),notices=[],activity=[],fields={'nc-nm':node('CLIENTE FICTICIO'),'nc-dir':node('NUEVA 123'),'nc-tel':node('123'),'nc-em':node('demo@example.invalid')};
 const body=node(),save=node(),cancel=node(),modal=node(),page=node(),bodyDocument=node();page.id='page-clientes';modal.classList.add('open');modal._svFormToken={};
 const controls=[save,cancel,...Object.values(fields)];
 modal.querySelectorAll=()=>controls;modal.querySelector=()=>save;
 const state={closed:0,pending:0,peak:0,allocated:0,pointListeners:0,pointStops:0,permission:true,module:true};
 const user={uid:'uid-demo'},client={fbKey:'client-demo',id:'CLI-DEMO',nombre:'CLIENTE FICTICIO',dir:'ANTERIOR 1',activo:true};
 const ctx={console,Promise,Date,Set,Map,Array,Object,String,Number,Math,JSON,
  currentUserUid:'uid-demo',currentRole:'admin',currentUser:'Usuario ficticio',fbAuth:{currentUser:user},fbDB:{},navigator:{onLine:true},location:{hash:'#/clientes'},PERMISOS_ROLES:{admin:{indiceRevision:3}},
  _svOperacionesSesionEpoch:1,_svSolicitudFichaRevision:1,_modalTipo:'cliente',_editingClienteId:editing?'client-demo':null,_clienteEstructuraDestinoKey:'',clienteActualId:'',
  clientesData:[client],clientesUnificadosIndice:{},clientesUnificadosData:{},otData:[],FB_PATHS:{clientes:'sisventas/clientes',ordenesTrabajo:'sisventas/ordenesTrabajo'},FORMS_CFG:{cliente:{fields:Object.keys(fields).map(id=>({id}))}},
  tienePermiso:()=>state.permission,permisoModulo:()=>state.module,
  document:{body:bodyDocument,createElement:()=>node(),getElementById:id=>id==='modal-nuevo'?modal:id==='modal-nuevo-body'?body:fields[id]||null,
    querySelector:selector=>selector==='.page.active'?page:selector==='#page-clientes .search-input'?{value:'filtro conservado'}:null},
  notify:text=>notices.push(text),registrarActividad:(...args)=>activity.push(args),invalidarCacheClientes:()=>{},renderTablaClientes:()=>{},
  _clienteClaveEstructura:()=> 'group-demo',_clienteCategoriaSede:()=> 'Sucursal',
  setTimeout:(fn,ms)=>{const id={};timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  fbRef:(_db,p='')=>p,fetch:()=>{throw Error('Network forbidden');}
 };
 ctx.window=ctx;
 function write(path,data,kind){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});const op={path,data:JSON.parse(JSON.stringify(data)),kind,done:false,resolve(value){if(op.done)return;op.done=true;resolve(value);},reject(error=Error('PERMISSION_DENIED')){if(op.done)return;op.done=true;reject(error);}};writes.push(op);state.pending++;state.peak=Math.max(state.peak,state.pending);promise.then(()=>{state.pending--;},()=>{state.pending--;});return promise;}
 ctx.fbUpdate=(path,data)=>write(path,data,'update');ctx.fbPush=(path,data)=>{if(data!==undefined)return write(path,data,'push');state.allocated++;return{key:'new-client-demo',path:path+'/new-client-demo'};};
 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const current=path=>{if(!remote.has(path)){const key=path.split('/').at(-1);remote.set(path,clone(ctx.otData.find(ot=>ot.fbKey===key)||null));}return clone(remote.get(path));};
 ctx.fbGet=async path=>{reads.push(path);const value=current(path);return{val:()=>value};};
 ctx.fbOnValue=(path,next)=>{let active=true;reads.push(path);state.pointListeners++;subscribedPaths.add(path);Promise.resolve().then(()=>{if(active){const value=current(path);next({val:()=>value});}});return()=>{if(active){active=false;state.pointListeners--;state.pointStops++;subscribedPaths.delete(path);}};};
 ctx.fbRunTransaction=(ref,transform,options)=>{const path=typeof ref==='string'?ref:ref.path;assert.equal(options.applyLocally,false);const before=current(path),next=transform(before);if(next===undefined)return Promise.resolve({committed:false,snapshot:{val:()=>current(path)}});return write(path,next,'transaction').then(()=>{const actual=current(path),value=JSON.stringify(actual)===JSON.stringify(before)?next:transform(actual);if(value===undefined)return{committed:false,snapshot:{val:()=>actual}};remote.set(path,clone(value));return{committed:true,snapshot:{val:()=>clone(value)}};});};
 load(ctx,['_clienteContextoPersistencia','_clienteFirmaAlta','svEsperarRespuestaGuardado','svPostventaEsperar','svTransaccionConEstadoActual','sincronizarDireccionClienteEnOTs','sincronizarClienteEnEstructura','fbGuardarCliente','guardarClienteDesdeModal','guardarNuevoGenerico','cerrarModalNuevoGenerico']);
 const close=ctx.cerrarModalNuevoGenerico;ctx.cerrarModalNuevoGenerico=()=>{state.closed++;return close();};
 async function drain(){for(let loop=0;loop<30;loop++){await tick();const pending=writes.filter(op=>!op.done);if(!pending.length)break;pending.forEach(op=>op.resolve(op.kind==='push'?{key:'new-client-demo'}:undefined));}await tick();}
 function fire(ms){for(const [id,timer]of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn();}}
 return {ctx,modal,fields,body,page,save,cancel,controls,writes,reads,remote,subscribedPaths,notices,activity,state,drain,fire};
}

test('cliente devuelve promesa, ocupa el formulario y sólo cierra/registra después de acuses',async()=>{
 const f=fixture();const first=f.ctx.guardarNuevoGenerico(),second=f.ctx.guardarNuevoGenerico();assert.equal(first,second);assert.equal(f.state.closed,0);assert.equal(f.activity.length,0);assert.ok(f.controls.every(c=>c.disabled));assert.match(f.save.innerHTML,/Guardando/);
 await tick();assert.equal(f.writes.length,1);assert.equal(f.writes[0].path,'sisventas/clientes/client-demo');assert.equal(f.state.closed,0);f.writes[0].resolve();await tick();assert.equal(f.writes.length,2);assert.equal(f.writes[1].path,'');assert.equal(f.activity.length,0);
 f.writes[1].resolve();assert.equal(await first,true);assert.equal(f.state.closed,1);assert.equal(f.activity.length,1);assert.ok(f.notices.at(-1).includes('Cliente guardado'));assert.ok(f.controls.every(c=>!c.disabled));assert.equal(f.save.innerHTML,'Guardar');
});
test('rechazo principal conserva datos e identidad de edición y permite reintentar sin falso éxito',async()=>{
 const f=fixture();const first=f.ctx.guardarNuevoGenerico();await tick();f.writes[0].reject();assert.equal(await first,false);assert.equal(f.state.closed,0);assert.equal(f.ctx._editingClienteId,'client-demo');assert.equal(f.fields['nc-dir'].value,'NUEVA 123');assert.equal(f.activity.length,0);assert.match(f.notices.at(-1),/No se pudo confirmar.*PERMISSION_DENIED/);assert.ok(f.controls.every(c=>!c.disabled));
 const retry=f.ctx.guardarNuevoGenerico();await f.drain();assert.equal(await retry,true);assert.equal(f.writes.filter(w=>w.path==='sisventas/clientes/client-demo').length,2);
});
test('fbGuardarCliente propaga rechazo a su consumidor y no modifica el objeto de entrada',async()=>{
 const f=fixture();const input={fbKey:'client-demo',id:'CLI-DEMO',dir:'NUEVA 123',_clienteEstructuraDestinoKey:'group-demo'};const p=f.ctx.fbGuardarCliente(input);assert.equal(typeof p.then,'function');await tick();f.writes[0].reject();await assert.rejects(p,/PERMISSION_DENIED/);assert.equal(input._clienteEstructuraDestinoKey,'group-demo');assert.equal(f.writes[0].data._clienteEstructuraDestinoKey,undefined);
});
test('secundaria fallida informa cliente confirmado, no rollback ni repetición del alta',async()=>{
 const f=fixture(false);const p=f.ctx.guardarNuevoGenerico();await tick();assert.equal(f.writes[0].kind,'transaction');assert.equal(f.state.allocated,1);f.writes[0].resolve();await tick();f.writes[1].reject();assert.equal(await p,true);assert.equal(f.state.closed,1);assert.equal(f.activity.length,1);assert.equal(f.ctx.clientesData.filter(c=>c.fbKey==='new-client-demo').length,1);assert.match(f.notices.at(-1),/Cliente guardado.*pendiente sincronizar.*estructura/);assert.ok(!f.notices.some(n=>/No se pudo guardar el cliente/.test(n)));
});
test('alta confirmada con acuse perdido conserva la clave y reintenta sin duplicar ni escribir a ciegas',async()=>{
 const f=fixture(false);const first=f.ctx.guardarNuevoGenerico();await tick();const original=f.writes[0];f.remote.set(original.path,structuredClone(original.data));original.reject(Error('Acuse perdido ficticio'));assert.equal(await first,false);assert.equal(f.state.closed,0);assert.equal(f.activity.length,0);assert.equal(f.state.allocated,1);
 const retry=f.ctx.guardarNuevoGenerico();await f.drain();assert.equal(await retry,true);assert.equal(f.state.allocated,1);assert.equal(f.writes.filter(w=>w.path===original.path).length,2);assert.equal(f.remote.size,1);assert.equal(f.ctx.clientesData.filter(c=>c.fbKey==='new-client-demo').length,1);assert.equal(f.activity.length,1);
});
test('editar después de resultado ambiguo no crea otra clave y exige confirmar el mismo contenido',async()=>{
 const f=fixture(false);const first=f.ctx.guardarNuevoGenerico();await tick();f.remote.set(f.writes[0].path,structuredClone(f.writes[0].data));f.writes[0].reject(Error('Acuse perdido ficticio'));await first;f.fields['nc-nm'].value='OTRO NOMBRE';assert.equal(await f.ctx.guardarNuevoGenerico(),false);assert.equal(f.writes.length,1);assert.equal(f.state.allocated,1);assert.equal(f.state.closed,0);assert.match(f.notices.at(-1),/cliente sin confirmar/);
});
test('reintento de alta no sobrescribe un cliente cambiado remotamente tras perder el acuse',async()=>{
 const f=fixture(false);const first=f.ctx.guardarNuevoGenerico();await tick();const op=f.writes[0];f.remote.set(op.path,{...structuredClone(op.data),nombre:'EDICIÓN REMOTA',notaRemota:'conservar'});op.reject(Error('Acuse perdido ficticio'));await first;assert.equal(await f.ctx.guardarNuevoGenerico(),false);assert.equal(f.writes.length,1);assert.equal(f.remote.get(op.path).nombre,'EDICIÓN REMOTA');assert.equal(f.remote.get(op.path).notaRemota,'conservar');assert.equal(f.state.allocated,1);assert.equal(f.state.closed,0);
});
test('plazo20s no declara fracaso definitivo ni deja acuse tardío cerrar; retry conserva misma clave',async()=>{
 const f=fixture(false);const first=f.ctx.guardarNuevoGenerico();await tick();f.fire(20000);assert.equal(await first,false);assert.equal(f.state.closed,0);assert.equal(f.state.allocated,1);assert.match(f.notices.at(-1),/No recibimos la confirmación/);assert.ok(f.controls.every(c=>!c.disabled));f.writes[0].resolve();await tick();assert.equal(f.state.closed,0);assert.equal(f.activity.length,0);assert.equal(f.writes.length,1);
 const retry=f.ctx.guardarNuevoGenerico();await f.drain();assert.equal(await retry,true);assert.equal(f.state.allocated,1);assert.equal(f.remote.size,1);assert.equal(f.state.closed,1);
});
test('intento de alta retenido no se confirma con otra sesión aunque no cambie el formulario',async()=>{
 const f=fixture(false);const first=f.ctx.guardarNuevoGenerico();await tick();f.writes[0].reject();await first;f.ctx.fbAuth.currentUser={uid:'uid-demo'};assert.equal(await f.ctx.guardarNuevoGenerico(),false);assert.equal(f.state.allocated,1);assert.equal(f.writes.length,1);assert.match(f.notices.at(-1),/cliente sin confirmar/);
});
test('un error OT parcial no impide confirmar la estructura ni declara fallido el cliente',async()=>{
 const f=fixture();f.ctx.otData=[{fbKey:'ot-demo',clienteFbKey:'client-demo',dir:'ANTERIOR 1'}];const p=f.ctx.guardarNuevoGenerico();await tick();f.writes[0].resolve();await tick();assert.equal(f.writes[1].kind,'transaction');f.writes[1].reject();await tick();assert.equal(f.writes[2].path,'');f.writes[2].resolve();assert.equal(await p,true);assert.match(f.notices.at(-1),/Cliente guardado.*pendiente sincronizar: direcciones de OT/);assert.equal(f.activity.length,1);assert.equal(f.ctx.otData[0].dir,'ANTERIOR 1');
});
test('alta conserva permiso de módulo y edición respeta overrides sin rol fijo nuevo',async()=>{
 const create=fixture(false);create.ctx.currentRole='vendedor';create.state.permission=false;const a=create.ctx.guardarNuevoGenerico();await create.drain();assert.equal(await a,true);assert.equal(create.writes[0].kind,'transaction');assert.equal(create.state.allocated,1);
 const edit=fixture();edit.ctx.currentRole='vendedor';edit.state.permission=true;const b=edit.ctx.guardarNuevoGenerico();await edit.drain();assert.equal(await b,true);assert.equal(edit.writes[0].kind,'update');
 const denied=fixture(false);denied.state.module=false;assert.equal(await denied.ctx.guardarNuevoGenerico(),false);assert.equal(denied.writes.length,0);
});
for(const kind of ['UID','Auth','rol','revisión','epoch','ruta','página','token','cierre','permiso'])test('acuse antiguo no afecta formulario ni dispara secundarias al cambiar '+kind,async()=>{
 const f=fixture();const p=f.ctx.guardarNuevoGenerico();await tick();
 if(kind==='UID')f.ctx.currentUserUid='other';if(kind==='Auth')f.ctx.fbAuth.currentUser={uid:'uid-demo'};if(kind==='rol')f.ctx.currentRole='administrativo';if(kind==='revisión')f.ctx.PERMISOS_ROLES.admin.indiceRevision++;if(kind==='epoch')f.ctx._svOperacionesSesionEpoch++;if(kind==='ruta')f.ctx.location.hash='#/productos';if(kind==='página')f.ctx.document.querySelector=()=>({});if(kind==='token')f.modal._svFormToken={};if(kind==='cierre')f.modal.classList.remove('open');if(kind==='permiso')f.state.permission=false;
 f.writes[0].resolve();assert.equal(await p,true);assert.equal(f.writes.length,1);assert.equal(f.state.closed,0);assert.equal(f.activity.length,0);assert.equal(f.notices.length,0);
});
test('contexto válido pero permiso perdido antes del envío falla sin encolar',async()=>{
 const f=fixture();const p=f.ctx.guardarNuevoGenerico();f.state.permission=false;assert.equal(await p,false);assert.equal(f.writes.length,0);assert.equal(f.state.closed,0);
});
test('offline y Auth incongruente no crean ni cierran ni borran datos del formulario',async()=>{
 for(const kind of ['offline','auth']){const f=fixture(false);if(kind==='offline')f.ctx.navigator.onLine=false;else f.ctx.fbAuth.currentUser={uid:'otro'};const p=f.ctx.guardarNuevoGenerico();assert.equal(await p,false);assert.equal(f.writes.length,0);assert.equal(f.state.closed,0);assert.equal(f.fields['nc-nm'].value,'CLIENTE FICTICIO');}
});
test('Cliente deniega altas y ediciones desde Ver como aunque el UID siga siendo el admin',async()=>{
 for(const editing of [false,true]){const f=fixture(editing);f.ctx._impersonacionOriginal={uid:'uid-demo'};assert.equal(await f.ctx.guardarNuevoGenerico(),false);assert.equal(f.writes.length,0);assert.equal(f.state.closed,0);assert.equal(f.fields['nc-dir'].value,'NUEVA 123');}
});
test('limpiar operación específica al abrir otro formulario evita heredar bloqueo y respuesta tardía',async()=>{
 const f=fixture(),p=f.ctx.guardarNuevoGenerico();await tick();f.modal._clienteSaving.liberar();assert.ok(f.controls.every(c=>!c.disabled));f.modal._svFormToken={};f.ctx._modalTipo='proveedor';f.save.innerHTML='Guardar proveedor';f.save.disabled=true;f.writes[0].resolve();await p;assert.equal(f.save.innerHTML,'Guardar proveedor');assert.equal(f.save.disabled,true);assert.equal(f.state.closed,0);assert.match(functionSource('abrirModalNuevo'),/_clienteSaving\.liberar/);
});
test('error de vista tras cliente confirmado no invita a repetir alta y conserva clave para editar',async()=>{
 const f=fixture(false);f.ctx.renderTablaClientes=()=>{throw Error('Fictitious render failure');};const p=f.ctx.guardarNuevoGenerico();await f.drain();assert.equal(await p,true);assert.equal(f.ctx._editingClienteId,'new-client-demo');assert.match(f.notices.at(-1),/cliente se guardó/);assert.equal(f.state.closed,0);const retry=f.ctx.guardarNuevoGenerico();await f.drain();assert.equal(await retry,true);assert.equal(f.state.allocated,1);
});
test('cola OT mantiene6 vuelos como máximo y memoria sólo cambia tras cada acuse',async()=>{
 const f=fixture();f.ctx.otData=Array.from({length:40},(_,i)=>({fbKey:'ot-'+i,clienteFbKey:'client-demo',estado:'Abierta',dir:'ANTERIOR 1'}));
 const p=f.ctx.sincronizarDireccionClienteEnOTs(f.ctx.clientesData[0],{fbKey:'client-demo',id:'CLI-DEMO',dir:'NUEVA 123'},{vigente:()=>true});await tick();assert.equal(f.writes.length,6);assert.equal(f.state.peak,6);assert.equal(f.ctx.otData.filter(ot=>ot.dir==='NUEVA 123').length,0);
 f.writes[0].resolve();await tick();assert.equal(f.ctx.otData.filter(ot=>ot.dir==='NUEVA 123').length,1);assert.equal(f.writes.length,7);await f.drain();assert.equal(await p,40);assert.equal(f.state.peak,6);assert.equal(f.ctx.otData.filter(ot=>ot.dir==='NUEVA 123').length,40);
});
test('fallo parcial OT detiene nuevos envíos y espera los5 vuelos restantes antes de informar',async()=>{
 const f=fixture();f.ctx.otData=Array.from({length:20},(_,i)=>({fbKey:'ot-'+i,clienteFbKey:'client-demo',estado:'Abierta',dir:'ANTERIOR 1'}));
 const p=f.ctx.sincronizarDireccionClienteEnOTs(f.ctx.clientesData[0],{fbKey:'client-demo',id:'CLI-DEMO',dir:'NUEVA 123'},{vigente:()=>true});let settled=false;p.then(()=>{settled=true;},()=>{settled=true;});await tick();f.writes[0].reject();await tick();assert.equal(settled,false);assert.equal(f.writes.length,6);assert.equal(f.ctx.otData.filter(ot=>ot.dir==='NUEVA 123').length,0);for(const write of f.writes.slice(1))write.resolve();await assert.rejects(p,error=>error.otConfirmadas===5&&error.otPendientes===15);assert.equal(f.writes.length,6);assert.equal(f.ctx.otData.filter(ot=>ot.dir==='NUEVA 123').length,5);
});
test('si falla una escucha puntual OT no inicia transacciones nuevas y espera todas las lecturas enviadas',async()=>{
 const f=fixture();f.ctx.otData=Array.from({length:12},(_,i)=>({fbKey:'ot-'+i,clienteFbKey:'client-demo',dir:'ANTERIOR 1'}));const reads=[];
 f.ctx.fbOnValue=(path,next,error)=>{const read={path,next,error,closed:false};reads.push(read);return()=>{read.closed=true;};};
 const p=f.ctx.sincronizarDireccionClienteEnOTs(f.ctx.clientesData[0],{fbKey:'client-demo',id:'CLI-DEMO',dir:'NUEVA 123'},{vigente:()=>true});let settled=false;p.then(()=>{settled=true;},()=>{settled=true;});assert.equal(reads.length,6);reads[0].error(Error('READ_DENIED'));await tick();assert.equal(settled,false);for(const read of reads.slice(1))read.next({val:()=>({})});await assert.rejects(p,/READ_DENIED/);assert.equal(f.writes.length,0);assert.equal(reads.length,6);assert.ok(reads.every(read=>read.closed));
});
test('direcciones particulares, sede distinta, cerradas y nombres/IDs ambiguos se conservan',async()=>{
 const f=fixture();f.ctx.clientesData.push({fbKey:'other',id:'DUP',nombre:'NOMBRE DUPLICADO'},{fbKey:'third',id:'DUP',nombre:'NOMBRE DUPLICADO'});
 f.ctx.otData=[{fbKey:'ok',clienteFbKey:'client-demo',dir:'ANTERIOR 1'},{fbKey:'private',clienteFbKey:'client-demo',dir:'PARTICULAR 9'},{fbKey:'closed',clienteFbKey:'client-demo',estado:'Cerrada',dir:'ANTERIOR 1'},{fbKey:'sede',clienteFbKey:'client-demo',domicilioFbKey:'other',dir:'ANTERIOR 1'},{fbKey:'ambiguous-name',cliente:'NOMBRE DUPLICADO',dir:'ANTERIOR 1'},{fbKey:'ambiguous-id',clienteId:'DUP',dir:'ANTERIOR 1'}];
 const p=f.ctx.sincronizarDireccionClienteEnOTs(f.ctx.clientesData[0],{fbKey:'client-demo',id:'CLI-DEMO',nombre:'CLIENTE FICTICIO',dir:'NUEVA 123'},{vigente:()=>true});await tick();assert.equal(f.writes.length,1);assert.equal(f.writes[0].path,'sisventas/ordenesTrabajo/ok');await f.drain();assert.equal(await p,1);assert.equal(f.ctx.otData[1].dir,'PARTICULAR 9');assert.equal(f.ctx.otData[3].dir,'ANTERIOR 1');
 f.ctx.otData=f.ctx.otData.filter(ot=>/^ambiguous-/.test(ot.fbKey));
 const a=f.ctx.sincronizarDireccionClienteEnOTs({fbKey:'other',id:'DUP',nombre:'NOMBRE DUPLICADO',dir:'ANTERIOR 1'},{fbKey:'other',id:'DUP',nombre:'NOMBRE DUPLICADO',dir:'NUEVA 123'},{vigente:()=>true});assert.equal(await a,0);
});
test('cola OT revalida domicilio antes del envío y no pisa la memoria de otra sesión al confirmar',async()=>{
 const f=fixture();f.ctx.otData=Array.from({length:8},(_,i)=>({fbKey:'ot-'+i,clienteFbKey:'client-demo',dir:'ANTERIOR 1'}));let current=true;
 const p=f.ctx.sincronizarDireccionClienteEnOTs(f.ctx.clientesData[0],{fbKey:'client-demo',id:'CLI-DEMO',dir:'NUEVA 123'},{vigente:()=>current});await tick();f.ctx.otData[6].dir='PRIVADA NUEVA';f.writes[0].resolve();await tick();assert.ok(!f.writes.some(w=>w.path.endsWith('/ot-6')));assert.ok(f.writes.some(w=>w.path.endsWith('/ot-7')));current=false;for(const write of f.writes.filter(w=>!w.done))write.resolve();assert.equal(await p,7);assert.equal(f.ctx.otData.filter(ot=>ot.dir==='NUEVA 123').length,1);assert.equal(f.ctx.otData[6].dir,'PRIVADA NUEVA');
});

test('transacción OT revalida cambio remoto de sede/dirección y preserva campos concurrentes',async()=>{
 const f=fixture();f.ctx.otData=[{fbKey:'changed',clienteFbKey:'client-demo',dir:'ANTERIOR 1'},{fbKey:'notes',clienteFbKey:'client-demo',dir:'ANTERIOR 1',notas:['anterior'],fotos:{img:'fixture'}}];
 const p=f.ctx.sincronizarDireccionClienteEnOTs(f.ctx.clientesData[0],{fbKey:'client-demo',id:'CLI-DEMO',dir:'NUEVA 123'},{vigente:()=>true});await tick();
 f.remote.set('sisventas/ordenesTrabajo/changed',{clienteFbKey:'client-demo',dir:'DIRECCIÓN PARTICULAR REMOTA',notas:['remota']});f.remote.set('sisventas/ordenesTrabajo/notes',{clienteFbKey:'client-demo',dir:'ANTERIOR 1',notas:['nueva remota'],fotos:{img:'fixture',concurrente:'otra fixture'},pagos:{ficticio:123.45}});
 await f.drain();assert.equal(await p,1);assert.equal(f.remote.get('sisventas/ordenesTrabajo/changed').dir,'DIRECCIÓN PARTICULAR REMOTA');assert.deepEqual(f.remote.get('sisventas/ordenesTrabajo/notes').notas,['nueva remota']);assert.equal(f.remote.get('sisventas/ordenesTrabajo/notes').fotos.concurrente,'otra fixture');assert.equal(f.remote.get('sisventas/ordenesTrabajo/notes').pagos.ficticio,123.45);assert.ok(f.reads.every(p=>/^sisventas\/ordenesTrabajo\/[^/]+$/.test(p)));
});
test('OT con caché SDK fría conserva listener puntual hasta CAS y libera al terminar',async()=>{
 const f=fixture(),path='sisventas/ordenesTrabajo/ot-cold';f.ctx.otData=[{fbKey:'ot-cold',clienteFbKey:'client-demo',dir:'ANTERIOR 1'}];f.remote.set(path,{clienteFbKey:'client-demo',dir:'ANTERIOR 1',fotos:{guardar:'fixture'},notas:['remota']});const transaction=f.ctx.fbRunTransaction;
 f.ctx.fbRunTransaction=(ref,transform,options)=>{const p=typeof ref==='string'?ref:ref.path;if(!f.subscribedPaths.has(p)){transform(null);return Promise.resolve({committed:false,snapshot:{val:()=>null}});}return transaction(ref,transform,options);};
 const p=f.ctx.sincronizarDireccionClienteEnOTs(f.ctx.clientesData[0],{fbKey:'client-demo',id:'CLI-DEMO',dir:'NUEVA 123'},{vigente:()=>true});await tick();assert.equal(f.state.pointListeners,1);await f.drain();assert.equal(await p,1);assert.equal(f.remote.get(path).dir,'NUEVA 123');assert.equal(f.remote.get(path).fotos.guardar,'fixture');assert.equal(f.state.pointListeners,0);assert.equal(f.state.pointStops,1);assert.deepEqual(f.reads,[path]);
});
test('borrar una OT entre primer snapshot y CAS no la recrea ni modifica memoria',async()=>{
 const f=fixture(),path='sisventas/ordenesTrabajo/ot-deleted';f.ctx.otData=[{fbKey:'ot-deleted',clienteFbKey:'client-demo',dir:'ANTERIOR 1'}];f.remote.set(path,{clienteFbKey:'client-demo',dir:'ANTERIOR 1'});let stops=0;
 f.ctx.fbOnValue=(ref,next)=>{next({val:()=>f.remote.get(path)});f.remote.set(path,null);return()=>{stops++;};};
 const p=f.ctx.sincronizarDireccionClienteEnOTs(f.ctx.clientesData[0],{fbKey:'client-demo',id:'CLI-DEMO',dir:'NUEVA 123'},{vigente:()=>true});assert.equal(await p,0);assert.equal(f.remote.get(path),null);assert.equal(f.writes.length,0);assert.equal(f.ctx.otData[0].dir,'ANTERIOR 1');assert.equal(stops,1);
});
test('plazo de escucha OT libera su fuente y conserva cliente confirmado con secundaria pendiente',async()=>{
 const f=fixture();f.ctx.otData=[{fbKey:'ot-wait',clienteFbKey:'client-demo',dir:'ANTERIOR 1'}];let callback,stops=0;
 f.ctx.fbOnValue=(ref,next)=>{callback=next;return()=>{stops++;};};const p=f.ctx.guardarNuevoGenerico();await tick();f.writes[0].resolve();await tick();assert.equal(f.writes.length,1);f.fire(20000);await tick();assert.equal(stops,1);assert.equal(f.writes.length,2);f.writes[1].resolve();assert.equal(await p,true);assert.match(f.notices.at(-1),/Cliente guardado.*direcciones de OT/);callback({val:()=>({})});await tick();assert.equal(f.writes.length,2);assert.equal(f.ctx.otData[0].dir,'ANTERIOR 1');
});
