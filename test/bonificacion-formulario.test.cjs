'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs');
const permissionSource=fs.readFileSync(path.join(__dirname,'../js/modules/action-permissions.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function deferred(){let resolve,reject;const promise=new Promise((ok,bad)=>{resolve=ok;reject=bad;});return {promise,resolve,reject};}
function fixture(role='admin'){
 const nodes={},calls={writes:[],messages:[],refresh:[],network:0};let document,transport=()=>Promise.resolve({committed:true});
 function control(id){return nodes[id]={id,value:'',innerHTML:'',disabled:false,isConnected:true,getClientRects:()=>[{}],focus(options){document.activeElement=this;this.focusOptions=options;}};}
 const origin=control('dar-bonificacion'),close=control('cerrar-bonificacion'),employee=control('bonificacion-empleado'),month=control('bonificacion-mes'),date=control('bonificacion-fecha'),reason=control('bonificacion-motivo'),amount=control('bonificacion-monto'),cancel=control('cancelar-bonificacion'),save=control('bonificacion-guardar');
 const fields=[employee,month,date,reason,amount],controls=[close,...fields,cancel,save];
 const modal=nodes['modal-bonificacion-empleado']={style:{display:'none'},querySelectorAll(selector){if(selector==='input,select')return fields;return controls.filter(item=>!item.disabled);}};
 document={activeElement:origin,getElementById:id=>nodes[id]||null};
 const context={window:null,document,Date,Math,console,currentUserUid:'user-demo',currentUser:'Titular ficticio',currentRole:role,fbAuth:{currentUser:{uid:'user-demo'}},_svOperacionesSesionEpoch:0,
  PERMISOS_ROLES:Object.fromEntries(['admin','administrativo','tecnico'].map(name=>[name,{indiceRevision:1,bloqueados:[],acciones:{}}])),
  empData:{active:{fbKey:'employee-demo',nombre:'Persona ficticia',activo:true},inactive:{fbKey:'inactive',nombre:'Inactivo',activo:false},legacy:{fbKey:'legacy',nombre:'Inactivo legacy',estado:'Inactivo'},second:{fbKey:'second',nombre:'Otra persona',estado:'Activo'}},
  _bonificacionEmpleadoGuardando:false,_bonificacionEmpleadoOperacionId:'',_bonificacionEmpleadoContexto:null,_bonificacionEmpleadoFoco:null,ctaEmpActual:'employee-demo',
  svFechaLocalISO:()=> '2026-10-21',escapeHTML:value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
  _setMontoInput:(element,value)=>{element.value=String(value);},getMontoRaw:element=>Number(element.value),notify:message=>calls.messages.push(message),
  fbCargarGastos:()=>calls.refresh.push('gastos'),cargarCtaEmp:key=>calls.refresh.push(key),fetch:()=>{calls.network++;assert.fail('No consultar la red');},fbUpdate:()=>{calls.network++;assert.fail('No guardar datos reales');}};
 context.window=context;vm.createContext(context);vm.runInContext(permissionSource.slice(0,permissionSource.indexOf('  function proteger('))+'})();',context);
 load(context,['svCapturarContextoOperacion','_bonificacionMesValido','_bonificacionTeclado','abrirModalBonificacionEmpleado','cerrarModalBonificacionEmpleado','guardarBonificacionEmpleado']);
 context._guardarBonificacionEmpleadoAtomica=(...args)=>{calls.writes.push(plain(args));return transport(...args);};
 return {context,calls,nodes,modal,origin,fields,controls,save,open:()=>context.abrirModalBonificacionEmpleado(),submit:()=>context.guardarBonificacionEmpleado(),setTransport(fn){transport=fn;},override(value){context.PERMISOS_ROLES[context.currentRole].acciones.empleados={bonificar:value};},
  fill(){employee.value='employee-demo';month.value='2026-09';date.value='2026-10-21';reason.value='Reconocimiento ficticio';amount.value='75.25';},
  key(key,extra={}){const event={key,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};modal.onkeydown?.(event);return event;}};
}

test('abrir bonificación prepara fecha y mes actuales, sólo empleados activos y foco en el selector',()=>{
 const f=fixture();f.open();assert.equal(f.modal.style.display,'flex');assert.equal(f.nodes['bonificacion-fecha'].value,'2026-10-21');assert.equal(f.nodes['bonificacion-mes'].value,'2026-10');
 assert.match(f.nodes['bonificacion-empleado'].innerHTML,/employee-demo/);assert.match(f.nodes['bonificacion-empleado'].innerHTML,/second/);assert.doesNotMatch(f.nodes['bonificacion-empleado'].innerHTML,/value="inactive"|value="legacy"/);
 assert.equal(f.context.document.activeElement,f.nodes['bonificacion-empleado']);assert.equal(f.nodes['bonificacion-empleado'].focusOptions.preventScroll,true);assert.equal(f.calls.network,0);
});

for(const role of ['administrativo','tecnico'])test('el permiso configurable de '+role+' controla la apertura, sin depender sólo de admin',()=>{
 const f=fixture(role);f.open();assert.equal(f.modal.style.display,'none');assert.match(f.calls.messages[0],/No tenés permiso/);
 f.override(true);f.open();assert.equal(f.modal.style.display,'flex');f.context.cerrarModalBonificacionEmpleado();f.override(false);f.open();assert.equal(f.modal.style.display,'none');assert.equal(f.calls.writes.length,0);
});

test('el administrador también respeta una revocación de bonificar',()=>{
 const f=fixture();f.override(false);f.open();assert.equal(f.modal.style.display,'none');assert.equal(f.calls.writes.length,0);
});

for(const month of ['', '2026-00','2026-13','2026-9'])test('mes de cómputo inválido no inicia guardado: '+JSON.stringify(month),async()=>{
 const f=fixture();f.open();f.fill();f.nodes['bonificacion-mes'].value=month;await f.submit();assert.equal(f.calls.writes.length,0);assert.match(f.calls.messages.at(-1),/mes de cómputo/);assert.equal(f.modal.style.display,'flex');assert.equal(f.save.disabled,false);
});

test('presentar conserva fecha de registro distinta del mes elegido y registra un adicional separado',async()=>{
 const f=fixture();f.open();f.fill();const id=f.context._bonificacionEmpleadoOperacionId;await f.submit();assert.equal(f.calls.writes.length,1);
 const [employee,movement,operation]=f.calls.writes[0];assert.equal(employee.fbKey,'employee-demo');assert.equal(movement.tipo,'bonificacion');assert.equal(movement.estado,'aprobado');assert.equal(movement.fecha,'2026-10-21');assert.equal(movement.periodoComputo,'2026-09');assert.equal(movement.monto,75.25);assert.equal(operation,id);
 assert.equal(Object.hasOwn(movement,'sueldo'),false);assert.equal(Object.hasOwn(movement,'pagos'),false);assert.equal(f.modal.style.display,'none');assert.deepEqual(f.calls.refresh,['gastos','employee-demo']);assert.equal(f.context.document.activeElement,f.origin);assert.equal(f.origin.focusOptions.preventScroll,true);assert.equal(f.calls.network,0);
});

test('doble clic, reapertura y Escape durante el guardado no duplican ni descartan el formulario',async()=>{
 const f=fixture(),pending=deferred();f.setTransport(()=>pending.promise);f.open();f.fill();const id=f.context._bonificacionEmpleadoOperacionId,p=f.submit();
 assert.equal(f.context._bonificacionEmpleadoGuardando,true);assert.equal(f.save.disabled,true);assert.ok(f.fields.every(field=>field.disabled));assert.match(f.save.innerHTML,/Guardando/);
 await f.submit();f.open();f.context.cerrarModalBonificacionEmpleado();const escape=f.key('Escape');assert.equal(escape.prevented,true);assert.equal(escape.stopped,true);assert.equal(f.modal.style.display,'flex');assert.equal(f.context._bonificacionEmpleadoOperacionId,id);assert.equal(f.calls.writes.length,1);
 pending.resolve({committed:true});await p;assert.equal(f.modal.style.display,'none');assert.equal(f.calls.network,0);
});

test('un error conserva campos e intento y permite reintentar sin crear otra operación',async()=>{
 const f=fixture();let attempt=0;f.setTransport(()=>++attempt===1?Promise.reject(Error('Falla ficticia')):Promise.resolve({committed:true}));f.open();f.fill();const id=f.context._bonificacionEmpleadoOperacionId,values=f.fields.map(field=>field.value);
 await f.submit();assert.equal(f.modal.style.display,'flex');assert.deepEqual(f.fields.map(field=>field.value),values);assert.ok(f.fields.every(field=>!field.disabled));assert.equal(f.save.disabled,false);assert.equal(f.context._bonificacionEmpleadoOperacionId,id);assert.match(f.calls.messages.at(-1),/Falla ficticia/);
 await f.submit();assert.equal(f.calls.writes.length,2);assert.equal(f.calls.writes[0][2],id);assert.equal(f.calls.writes[1][2],id);assert.equal(f.modal.style.display,'none');
});

test('Tab y Shift+Tab quedan en la ventana y Escape devuelve el foco sin enviar',()=>{
 const f=fixture();f.open();f.save.focus();assert.equal(f.key('Tab').prevented,true);assert.equal(f.context.document.activeElement,f.controls[0]);assert.equal(f.key('Tab',{shiftKey:true}).prevented,true);assert.equal(f.context.document.activeElement,f.save);
 assert.equal(f.key('Enter').prevented,undefined);assert.equal(f.calls.writes.length,0);assert.equal(f.key('Escape').prevented,true);assert.equal(f.modal.style.display,'none');assert.equal(f.context.document.activeElement,f.origin);
});

for(const outcome of ['resolve','reject'])test('respuesta antigua '+outcome+' no altera un nuevo guardado tras cambiar la sesión',async()=>{
 const f=fixture(),old=deferred(),current=deferred();let attempts=0;f.setTransport(()=>++attempts===1?old.promise:current.promise);f.open();f.fill();const oldId=f.context._bonificacionEmpleadoOperacionId,first=f.submit();
 f.context.currentUserUid='other-user';f.context.fbAuth.currentUser={uid:'other-user'};f.context._svOperacionesSesionEpoch++;f.context.document.activeElement=f.origin;f.open();f.fill();const newId=f.context._bonificacionEmpleadoOperacionId,second=f.submit();assert.notEqual(newId,oldId);
 if(outcome==='resolve')old.resolve({committed:true});else old.reject(Error('Falla de la sesión anterior'));await first;
 assert.equal(f.modal.style.display,'flex');assert.equal(f.context._bonificacionEmpleadoOperacionId,newId);assert.equal(f.context._bonificacionEmpleadoGuardando,true);assert.equal(f.save.disabled,true);assert.ok(f.fields.every(field=>field.disabled));assert.deepEqual(f.calls.messages,[]);assert.deepEqual(f.calls.refresh,[]);
 current.resolve({committed:true});await second;assert.equal(f.modal.style.display,'none');assert.equal(f.calls.messages.length,1);assert.deepEqual(f.calls.refresh,['gastos','employee-demo']);assert.equal(f.calls.network,0);
});

test('una revocación antes de enviar no consulta ni guarda la bonificación',async()=>{
 const f=fixture();f.open();f.fill();f.override(false);await f.submit();assert.equal(f.calls.writes.length,0);assert.match(f.calls.messages.at(-1),/No tenés permiso/);assert.equal(f.calls.network,0);
});
