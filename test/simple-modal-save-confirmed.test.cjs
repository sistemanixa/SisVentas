'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs');
const settle=()=>new Promise(setImmediate);
function fixture(tipo='servicio'){
 const notices=[],transactions=[],records=new Map();let sequence=0,allowed=true;
 const button={tagName:'BUTTON',dataset:{},disabled:false,innerHTML:'Guardar',setAttribute(){},removeAttribute(){},get textContent(){return this.innerHTML;},set textContent(value){this.innerHTML=value;}},input={disabled:false,value:'Dato ficticio'},page={id:'page-servicios'};
 const modal={_svFormToken:{},open:true,classList:{contains(){return modal.open;}},querySelector:()=>button,querySelectorAll:()=>[button,input]};
 const c={console:{warn(){}},Date,Promise,setTimeout,clearTimeout,navigator:{onLine:true},location:{hash:'#/servicios'},currentRole:'admin',currentUserUid:'uid-ficticio',currentUser:'Usuario ficticio',fbAuth:{currentUser:{uid:'uid-ficticio'}},fbDB:{},PERMISOS_ROLES:{admin:{indiceRevision:1}},_modalTipo:tipo,
  document:{getElementById:()=>modal,querySelector:()=>page},permisoModulo:()=>allowed,tienePermiso:()=>allowed,notify:v=>notices.push(v),
  fbRef:(_db,path)=>path,fbPush:path=>({key:'ficticio-'+(++sequence),path:path+'/ficticio-'+sequence}),
  fbRunTransaction:(ref,update,options)=>new Promise((resolve,reject)=>transactions.push({ref,update,options,resolve,reject})),
  cerrarModalNuevoGenerico(){modal._registroSimpleSaving?.liberar();modal.open=false;},
  SisVentas:{carga:{mostrar(){const close=()=>{};close.actualizar=()=>{};return close;}}}};
 c.window=c;vm.createContext(c);load(c,['svTextoLegible','escapeHTML','svCrearProgresoBoton','svCapturarContextoOperacion','svEsperarRespuestaGuardado','guardarRegistroSimple','guardarRegistroSimpleDesdeModal','guardarServicio','guardarEvento','guardarTicket']);
 function finish(index,{lost=false}={}){const tx=transactions[index],current=records.get(tx.ref.path)??null,next=tx.update(current);if(next===undefined)return tx.resolve({committed:false,snapshot:{val:()=>current}});records.set(tx.ref.path,structuredClone(next));if(lost)tx.reject(Error('Acuse ficticio perdido'));else tx.resolve({committed:true,snapshot:{val:()=>next}});}
 return{c,modal,page,input,button,notices,transactions,records,finish,allow:v=>allowed=v,allocated:()=>sequence};
}
for(const tipo of ['servicio','evento','ticket'])test(tipo+': una promesa y alta puntual; espera el acuse para cerrar',async()=>{
 const f=fixture(tipo),datos={descripcion:'Ejemplo ficticio'},first=f.c.guardarRegistroSimpleDesdeModal(tipo,datos),double=f.c.guardarRegistroSimpleDesdeModal(tipo,datos);
 assert.equal(first,double);assert.equal(f.button.disabled,true);assert.match(f.button.textContent,/Guardando/);await settle();assert.equal(f.transactions.length,1);assert.equal(f.transactions[0].options.applyLocally,false);assert.equal(f.notices.length,0);assert.equal(f.modal.open,true);f.finish(0);assert.equal(await first,true);assert.equal(f.modal.open,false);assert.equal(f.button.disabled,false);assert.equal(f.records.size,1);assert.equal(datos.ts,undefined);
});
test('fallo conserva datos y reintento con acuse perdido no duplica ni sobrescribe otro equipo',async()=>{
 const f=fixture(),datos={descripcion:'Ficticio'},task=f.c.guardarRegistroSimpleDesdeModal('servicio',datos);await settle();f.finish(0,{lost:true});assert.equal(await task,false);assert.equal(f.modal.open,true);assert.equal(f.input.value,'Dato ficticio');assert.equal(f.button.disabled,false);
 const retry=f.c.guardarRegistroSimpleDesdeModal('servicio',datos);await settle();assert.equal(f.allocated(),1);f.finish(1);assert.equal(await retry,true);assert.equal(f.records.size,1);
});
test('registro modificado por otra PC no se reemplaza tras un acuse ambiguo',async()=>{
 const f=fixture(),datos={descripcion:'Ficticio'},task=f.c.guardarRegistroSimpleDesdeModal('servicio',datos);await settle();f.finish(0,{lost:true});await task;const key=f.transactions[0].ref.path;f.records.get(key).descripcion='Cambio de otra PC';
 const retry=f.c.guardarRegistroSimpleDesdeModal('servicio',datos);await settle();f.finish(1);assert.equal(await retry,false);assert.equal(f.records.get(key).descripcion,'Cambio de otra PC');assert.match(f.notices.at(-1),/cambió/);
});
test('editar datos después de un acuse perdido no cambia la clave ni duplica el alta',async()=>{
 const f=fixture(),datos={descripcion:'Ficticio'},task=f.c.guardarRegistroSimpleDesdeModal('servicio',datos);await settle();f.finish(0,{lost:true});await task;
 assert.equal(await f.c.guardarRegistroSimpleDesdeModal('servicio',{descripcion:'Dato corregido'}),false);assert.equal(f.allocated(),1);assert.equal(f.transactions.length,1);assert.equal(f.records.size,1);assert.match(f.notices.at(-1),/pendiente de confirmar/);
 const retry=f.c.guardarRegistroSimpleDesdeModal('servicio',datos);await settle();f.finish(1);assert.equal(await retry,true);assert.equal(f.records.size,1);
});
test('un número automático distinto no impide confirmar el mismo formulario',async()=>{
 const f=fixture('ticket'),firma=JSON.stringify({descripcion:'Ficticio',numero:''}),first=f.c.guardarRegistroSimpleDesdeModal('ticket',{numero:'TK-0001',descripcion:'Ficticio'},firma);await settle();f.finish(0,{lost:true});await first;
 const retry=f.c.guardarRegistroSimpleDesdeModal('ticket',{numero:'TK-0002',descripcion:'Ficticio'},firma);await settle();assert.equal(f.allocated(),1);f.finish(1);assert.equal(await retry,true);assert.equal(f.records.values().next().value.numero,'TK-0001');
});
test('timeout libera la interfaz, mantiene el intento y descarta el acuse tardío',async()=>{
 const f=fixture(),timers=[];f.c.setTimeout=fn=>{timers.push(fn);return timers.length;};f.c.clearTimeout=()=>{};
 const datos={descripcion:'Ficticio'},first=f.c.guardarRegistroSimpleDesdeModal('servicio',datos);await settle();timers.shift()();assert.equal(await first,false);assert.equal(f.modal.open,true);assert.equal(f.button.disabled,false);assert.match(f.notices.at(-1),/confirmación/);
 const retry=f.c.guardarRegistroSimpleDesdeModal('servicio',datos);await settle();assert.equal(f.allocated(),1);f.finish(0);await settle();assert.equal(f.modal.open,true);assert.equal(f.button.disabled,true);f.finish(1);assert.equal(await retry,true);assert.equal(f.records.size,1);
});
for(const cambio of ['uid','auth','role','revision','view','page','route','token','permission'])test('acuse no afecta otro contexto: '+cambio,async()=>{
 const f=fixture(),task=f.c.guardarRegistroSimpleDesdeModal('servicio',{descripcion:'Ficticio'});await settle();
 if(cambio==='uid')f.c.currentUserUid='otro';if(cambio==='auth')f.c.fbAuth.currentUser={uid:'uid-ficticio'};if(cambio==='role')f.c.currentRole='tecnico';if(cambio==='revision')f.c.PERMISOS_ROLES.admin.indiceRevision++;if(cambio==='view')f.c._impersonacionOriginal={};if(cambio==='page')f.c.document.querySelector=()=>({});if(cambio==='route')f.c.location.hash='#/productos';if(cambio==='permission')f.allow(false);
 if(cambio==='token'){f.modal._registroSimpleSaving.liberar();f.modal._svFormToken={};f.button.disabled=true;f.button.textContent='Otra operación';}
 f.transactions[0].resolve({committed:true,snapshot:{val:()=>({descripcion:'Ficticio'})}});assert.equal(await task,true);assert.equal(f.modal.open,true);assert.equal(f.notices.length,0);if(cambio==='token'){assert.equal(f.button.disabled,true);assert.equal(f.button.textContent,'Otra operación');}
});
for(const condition of ['offline','permission','session','view','auth-mismatch'])test('no escribe con '+condition,async()=>{
 const f=fixture();if(condition==='offline')f.c.navigator.onLine=false;if(condition==='permission')f.allow(false);if(condition==='view')f.c._impersonacionOriginal={};if(condition==='auth-mismatch')f.c.fbAuth.currentUser={uid:'otro'};const task=f.c.guardarRegistroSimpleDesdeModal('servicio',{descripcion:'Ficticio'});if(condition==='session')f.c.currentUserUid='otro';assert.equal(await task,false);assert.equal(f.transactions.length,0);assert.equal(f.allocated(),0);assert.equal(f.button.disabled,false);
});
test('fallo visual después del commit no informa error de persistencia',async()=>{
 const f=fixture(),task=f.c.guardarRegistroSimpleDesdeModal('servicio',{descripcion:'Ficticio'});await settle();f.c.notify=()=>{throw Error('Vista ficticia falló');};f.finish(0);assert.equal(await task,true);assert.equal(f.records.size,1);assert.equal(f.button.disabled,false);
});
test('al finalizar conserva controles previamente deshabilitados con el helper de progreso real',async()=>{
 const f=fixture();f.input.disabled=true;f.button.disabled=true;const task=f.c.guardarRegistroSimpleDesdeModal('servicio',{descripcion:'Ficticio'});await settle();f.finish(0);await task;assert.equal(f.input.disabled,true);assert.equal(f.button.disabled,true);
});
test('primitivas devuelven promesa sin mutar el objeto recibido',async()=>{
 for(const [fn,path]of [['guardarServicio','servicios'],['guardarEvento','agenda'],['guardarTicket','tickets']]){const f=fixture(),datos={descripcion:'Ficticio'},task=f.c[fn](datos);assert.equal(typeof task.then,'function');await settle();assert.match(f.transactions[0].ref.path,new RegExp('/'+path+'/'));f.finish(0);await task;assert.deepEqual(datos,{descripcion:'Ficticio'});assert.equal(f.notices.length,0);}
});
