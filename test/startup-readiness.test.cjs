'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/core/data-readiness.js','utf8');
function fixture(page='ordentrabajo'){
 const handlers=new Map(),frames=[],timers=new Map();let id=0,now=0;
 const document={body:null,getElementById:()=>null,addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);},removeEventListener(name,fn){handlers.get(name)?.delete(fn);},dispatchEvent(event){for(const fn of [...(handlers.get(event.type)||[])])fn(event);}};
 const root={navigator:{onLine:true},addEventListener(){},permisoModulo:()=>true,svPuedeLeerDominio:()=>true,tienePermiso:()=>true,
  setTimeout(fn,delay){const key=++id;timers.set(key,{fn,at:now+delay});return key;},clearTimeout(key){timers.delete(key);}};
 const context={window:root,document,URL,Promise,CustomEvent:class{constructor(type){this.type=type;}},Date:{now:()=>now},requestAnimationFrame:fn=>frames.push(fn)};
 vm.runInNewContext(source,context);
 function emit(type){document.dispatchEvent({type});}
 function flush(){let left=50;while(frames.length&&left--)frames.shift()();assert.equal(frames.length,0);}
 function tick(ms){now+=ms;for(const [key,timer]of [...timers])if(timer.at<=now){timers.delete(key);timer.fn();}flush();}
 emit('sisventas:session-ready');flush();
 return{api:root.SVDataReadiness,root,document,handlers,timers,emit,flush,tick,now:()=>now,page:()=>page,route(value){page=value;emit('sisventas:page-changed');flush();},count(name){return handlers.get(name)?.size||0;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('el arranque de OT espera sólo sus datos reales y termina al recibir el snapshot completo',async()=>{
 const f=fixture(),states=[];let done=false;
 const task=f.api.waitForPage(f.page,{onState:state=>states.push(state)}).then(result=>{done=true;return result;});f.flush();
 assert.deepEqual(Array.from(states[0].missing),['ordenes_trabajo','clientes','productos']);assert.equal(states[0].total,3);
 f.tick(300);f.api.beginSource('clientes').ready();f.flush();
 f.tick(200);f.api.beginSource('productos').ready();f.flush();await settle();assert.equal(done,false);
 assert.equal(states.at(-1).detail,'Esperando órdenes de trabajo.');
 f.tick(900);f.api.beginSource('ordenes_trabajo').ready();f.flush();
 const result=await task;assert.equal(result.ready,true);assert.equal(result.received,3);assert.equal(f.now(),1400);
 assert.equal(result.missing.includes('ventas'),false);assert.equal(result.missing.includes('pagos'),false);
 assert.equal(f.count('sisventas:data-state-changed'),0);
});

test('pasar3200ms no declara éxito: la misma espera concluye recién con los datos de la pantalla',async()=>{
 const f=fixture(),states=[];let done=false;
 const task=f.api.waitForPage(f.page,{onState:state=>states.push(state)}).then(result=>{done=true;return result;});
 for(const key of ['clientes','productos'])f.api.beginSource(key).ready();f.flush();
 f.tick(3200);await settle();assert.equal(done,false);assert.equal(states.at(-1).received,2);
 f.tick(9800);await settle();assert.equal(done,false);
 f.api.beginSource('ordenes_trabajo').ready();f.flush();const result=await task;
 assert.equal(result.ready,true);assert.equal(f.now(),13000);assert.equal(result.errors.length,0);
});

test('la espera vencida usa el error recuperable compartido y nunca lo transforma en datos completos',async()=>{
 const f=fixture();let done=false;
 const task=f.api.waitForPage(f.page).then(result=>{done=true;return result;});
 for(const key of ['clientes','productos'])f.api.beginSource(key).ready();f.flush();
 f.tick(14999);await settle();assert.equal(done,false);f.tick(2);
 const result=await task;assert.equal(result.ready,false);assert.deepEqual(Array.from(result.errors),['ordenes_trabajo']);
 assert.match(result.title,/No se pudieron cargar/);assert.match(result.detail,/volvé a intentar/);
 const retry=f.api.beginSource('ordenes_trabajo'),next=f.api.waitForPage(f.page);f.flush();
 retry.ready();f.flush();assert.equal((await next).ready,true);
});

test('dos fuentes autorizadas de OT deben terminar antes de retirar el arranque',async()=>{
 const f=fixture(),a=f.api.beginSource('ordenes_trabajo','propias'),b=f.api.beginSource('ordenes_trabajo','equipo');let done=false;
 const task=f.api.waitForPage(f.page).then(result=>{done=true;return result;});
 for(const key of ['clientes','productos'])f.api.beginSource(key).ready();a.ready();f.flush();await settle();assert.equal(done,false);
 b.ready();f.flush();assert.equal((await task).ready,true);
});

test('un error auténtico conserva la información pendiente y permite otra espera tras el reintento',async()=>{
 const f=fixture(),ot=f.api.beginSource('ordenes_trabajo'),task=f.api.waitForPage(f.page);
 f.api.beginSource('clientes').ready();f.api.beginSource('productos').ready();ot.error();ot.cancel();f.flush();
 const error=await task;assert.equal(error.ready,false);assert.deepEqual(Array.from(error.missing),['ordenes_trabajo']);
 const retry=f.api.beginSource('ordenes_trabajo'),next=f.api.waitForPage(f.page);retry.ready();f.flush();assert.equal((await next).ready,true);
});

test('navegar durante el ingreso cambia las fuentes requeridas y las respuestas anteriores no cierran la nueva pantalla',async()=>{
 const f=fixture(),states=[];let done=false;
 const task=f.api.waitForPage(f.page,{onState:state=>states.push(state)}).then(result=>{done=true;return result;});f.flush();
 f.route('presupuesto');f.api.beginSource('ordenes_trabajo').ready();f.api.beginSource('clientes').ready();f.api.beginSource('productos').ready();f.flush();
 await settle();assert.equal(done,false);assert.equal(states.at(-1).page,'presupuesto');assert.deepEqual(Array.from(states.at(-1).missing),['presupuestos']);
 f.api.beginSource('presupuestos').ready();f.flush();assert.equal((await task).page,'presupuesto');
});

for(const event of ['sisventas:session-ended','sisventas:role-changed'])test('un cambio de contexto cancela el arranque anterior: '+event,async()=>{
 const f=fixture();let current=true,calls=0;
 const task=f.api.waitForPage(f.page,{isCurrent:()=>current,onState:()=>calls++});f.flush();current=false;f.emit(event);f.flush();
 const result=await task;assert.equal(result.cancelled,true);assert.equal(result.ready,false);
 f.api.beginSource('ordenes_trabajo').ready();f.flush();assert.equal(calls,1);assert.equal(f.count('sisventas:data-state-changed'),0);
});

test('abortar o revocar el módulo no deja observadores del arranque ni anuncia éxito',async()=>{
 const f=fixture(),controller=new AbortController(),task=f.api.waitForPage(f.page,{signal:controller.signal});controller.abort();
 assert.equal((await task).cancelled,true);assert.equal(f.count('sisventas:data-state-changed'),0);
 const next=f.api.waitForPage(f.page);f.root.permisoModulo=()=>false;f.emit('sisventas:role-changed');assert.equal((await next).cancelled,true);
});

test('datos previamente completos liberan el ingreso sin agregar temporizadores ni lecturas',async()=>{
 const f=fixture();for(const key of ['ordenes_trabajo','clientes','productos'])f.api.beginSource(key).ready();f.flush();
 const timers=f.timers.size,result=await f.api.waitForPage(f.page);
 assert.equal(result.ready,true);assert.equal(f.timers.size,timers);assert.equal(f.count('sisventas:data-state-changed'),0);
});

test('un fallo al dibujar el progreso no cambia el resultado de la carga',async()=>{
 const f=fixture(),task=f.api.waitForPage(f.page,{onState(){throw Error('Vista ficticia');}});
 for(const key of ['ordenes_trabajo','clientes','productos'])f.api.beginSource(key).ready();f.flush();assert.equal((await task).ready,true);
});

test('la espera de permisos no arma un plazo de datos ni crea otro temporizador al liberarse',async()=>{
 const f=fixture(),release=f.api.holdStartup();f.flush();f.tick(20000);
 assert.equal(f.timers.size,0);assert.equal(f.api.statusFor('ordentrabajo').errors.length,0);
 release();const task=f.api.waitForPage(f.page);f.flush();f.tick(14999);
 assert.equal(f.api.statusFor('ordentrabajo').errors.length,0);
 for(const key of ['clientes','productos','ordenes_trabajo'])f.api.beginSource(key).ready();f.flush();assert.equal((await task).ready,true);
});

test('liberar un arranque viejo no retira la espera de permisos de la sesión nueva',()=>{
 const f=fixture(),old=f.api.holdStartup();f.api.reset();f.emit('sisventas:session-ready');const current=f.api.holdStartup();
 old();f.flush();f.tick(20000);assert.equal(f.timers.size,0);
 current();f.flush();assert.equal(f.api.statusFor('ordentrabajo').errors.length,0);
});
