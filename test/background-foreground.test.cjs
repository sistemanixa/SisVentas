'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const source=require('./helpers/active-app').readActiveApp().source;
const block=source.slice(source.indexOf('var _svTrabajosFondo ='),source.indexOf('var _usoUsuariosCargaModulo'));

function fixture({hidden=false,foreground=true,idle=true}={}){
 class FixtureDocument extends EventTarget{
  constructor(){super();this.hidden=hidden;this.listeners=new Map();}
  addEventListener(name,fn,options){super.addEventListener(name,fn,options);if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
  removeEventListener(name,fn,options){super.removeEventListener(name,fn,options);this.listeners.get(name)?.delete(fn);}
  emit(name){this.dispatchEvent(new Event(name));}
  waiting(){return ['visibilitychange','sisventas:foreground-restored'].reduce((total,name)=>total+(this.listeners.get(name)?.size||0),0);}
 }
 const document=new FixtureDocument(),timers=new Map(),idles=new Map(),warnings=[];let now=0,sequence=0,visible=foreground;
 const context={currentUserUid:'fixture-user',document,window:{SVForegroundSession:{isVisible:()=>visible}},
  console:{warn:(...args)=>warnings.push(args)},setTimeout(fn,delay=0){const id=++sequence;timers.set(id,{fn,due:now+delay,delay});return id;},clearTimeout:id=>timers.delete(id),
  fetch:assert.fail,fbGet:assert.fail,fbSet:assert.fail};
 if(idle){context.requestIdleCallback=(fn,options)=>{const id=++sequence;idles.set(id,{fn,options});return id;};context.cancelIdleCallback=id=>idles.delete(id);}
 vm.createContext(context);vm.runInContext(block,context);
 return {context,document,timers,idles,warnings,setForeground:value=>{visible=value;},
  advance(ms){const until=now+ms;while(true){const next=[...timers].filter(([,task])=>task.due<=until).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;const [id,task]=next;timers.delete(id);now=task.due;task.fn();}now=until;},
  fireIdle(){const next=idles.entries().next().value;assert.ok(next,'Debe existir un callback idle');const [id,task]=next;idles.delete(id);task.fn();},
  clean(permanent=0){assert.equal(context._svTrabajosFondo.size,0);assert.equal(document.waiting(),permanent);assert.equal(timers.size,0);assert.equal(idles.size,0);assert.deepEqual(warnings,[]);}};
}

test('ninguna tarea oculta se ejecuta y dos eventos de regreso la reanudan una sola vez',()=>{
 for(const idle of [false,true]){
  const f=fixture({hidden:true,idle}),runs=[];f.context.svProgramarTrabajoFondo(()=>runs.push('actual'),700);
  f.advance(699);assert.deepEqual(runs,[]);f.advance(1);if(idle)f.fireIdle();
  assert.deepEqual(runs,[]);assert.equal(f.document.waiting(),2);assert.equal(f.context._svTrabajosFondo.size,1);
  f.document.emit('visibilitychange');f.document.emit('sisventas:foreground-restored');assert.deepEqual(runs,[]);assert.equal(f.document.waiting(),2);
  f.document.hidden=false;f.document.emit('visibilitychange');f.document.emit('sisventas:foreground-restored');f.document.emit('visibilitychange');
  assert.deepEqual(runs,['actual']);f.clean();
 }
});

test('cerrar sesión mientras espera elimina listeners y una sesión nueva del mismo UID no resucita trabajo viejo',()=>{
 const f=fixture({hidden:true}),runs=[];f.context.svProgramarTrabajoFondo(()=>runs.push('anterior'),0,{idle:false});f.advance(0);
 const obsolete=[...f.document.listeners.get('visibilitychange')];assert.equal(f.document.waiting(),2);
 f.document.emit('sisventas:session-ended');assert.equal(f.document.waiting(),0);assert.equal(f.context._svTrabajosFondo.size,0);
 f.context.currentUserUid='fixture-user';f.context.svProgramarTrabajoFondo(()=>runs.push('nueva'),0,{idle:false});f.advance(0);
 obsolete.forEach(fn=>fn());assert.deepEqual(runs,[]);assert.equal(f.context._svTrabajosFondo.size,1);
 f.document.hidden=false;f.document.emit('visibilitychange');f.document.emit('sisventas:foreground-restored');obsolete.forEach(fn=>fn());
 assert.deepEqual(runs,['nueva']);f.clean();
});

test('documento visible pero helper congelado conserva la espera hasta foreground-restored',()=>{
 const f=fixture({foreground:false}),runs=[];f.context.svProgramarTrabajoFondo(()=>runs.push('restaurada'),0,{idle:false});f.advance(0);
 assert.equal(f.document.hidden,false);assert.deepEqual(runs,[]);assert.equal(f.document.waiting(),2);
 f.document.emit('visibilitychange');f.document.emit('sisventas:foreground-restored');assert.deepEqual(runs,[]);
 f.setForeground(true);f.document.emit('sisventas:foreground-restored');f.document.emit('visibilitychange');
 assert.deepEqual(runs,['restaurada']);f.clean();
});

test('idle:false conserva la demora mínima y ejecuta sin esperar requestIdleCallback',()=>{
 const f=fixture(),runs=[];f.context.svProgramarTrabajoFondo(()=>runs.push('directa'),220,{idle:false});
 assert.equal([...f.timers.values()][0].delay,220);f.advance(219);assert.deepEqual(runs,[]);assert.equal(f.idles.size,0);
 f.advance(1);assert.deepEqual(runs,['directa']);assert.equal(f.idles.size,0);f.clean();
 f.context.svProgramarTrabajoFondo(()=>runs.push('idle'),30);f.advance(29);assert.equal(f.idles.size,0);f.advance(1);
 assert.deepEqual(runs,['directa']);assert.equal(f.idles.size,1);assert.equal([...f.idles.values()][0].options.timeout,900);
 f.fireIdle();assert.deepEqual(runs,['directa','idle']);f.clean();
});

test('ocultarse entre el temporizador y el callback idle difiere la tarea y salir la cancela',()=>{
 const f=fixture(),runs=[];f.context.svProgramarTrabajoFondo(()=>runs.push('obsoleta'),10);f.advance(10);
 f.document.hidden=true;f.fireIdle();assert.deepEqual(runs,[]);assert.equal(f.document.waiting(),2);
 f.document.emit('sisventas:session-ended');f.document.hidden=false;f.document.emit('visibilitychange');f.document.emit('sisventas:foreground-restored');
 assert.deepEqual(runs,[]);f.clean();
});

function bootstrapFixture(){
 const f=fixture({hidden:true}),root=f.context.window,browser=new EventTarget(),reads=[];
 Object.assign(root,{document:f.document,addEventListener:browser.addEventListener.bind(browser),fbDB:{},fbAuth:{currentUser:{uid:'fixture-user'}},fbGoOnline(){},fbGoOffline(){}});
 root.SVForegroundSession=require('../js/core/foreground-session.js').create(root);
 const permanent=f.document.waiting();
 f.context.currentRole='vendedor';f.context.rolActualNormalizado=()=>f.context.currentRole;
 f.context._svPaginaDesdeRuta=()=> 'dashboard';f.context.svCargarInicioDashboardDemandado=()=>reads.push('dashboardDemand');
 for(const name of ['fbCargarUsuarios','fbCargarClientes','fbCargarProductos','fbCargarVentas','svCargarDatosDePaginaActual','fbCargarClientesUnificados','fbCargarEmpleados','fbCargarCategorias','fbCargarGastos','fbCargarProveedores','fbCargarPagos','fbCargarPresupuestos','fbCargarOTs','fbCargarOrdenes'])f.context[name]=()=>reads.push(name);
 for(const name of ['fbCargarTodo','svCapturarContextoOperacion','svInvalidarOperacionesSesion']){
  const start=source.indexOf('function '+name+'(');assert.ok(start>=0);vm.runInContext(source.slice(start,source.indexOf('\n}',start)+2),f.context);
 }
 f.document.addEventListener('sisventas:session-ended',f.context.svInvalidarOperacionesSesion);
 return {...f,reads,clean:()=>f.clean(permanent)};
}
test('el arranque completo diferido no abre fuentes ocultas y dos intentos se convierten en un solo arranque',async()=>{
 const f=bootstrapFixture();assert.equal(f.context.fbCargarTodo(),false);assert.equal(f.context.fbCargarTodo(),false);
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.reads,[]);assert.equal(f.context.window._fbCargaTodoActiva,undefined);
 f.document.hidden=false;f.document.emit('visibilitychange');await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(f.reads,['dashboardDemand']);
 assert.equal(f.context.window._fbCargaTodoActiva,true);f.advance(1800);assert.equal(f.idles.size,0,'Dashboard no debe programar los dos lotes globales anteriores');
 assert.equal(f.reads.filter(name=>name==='dashboardDemand').length,1);f.clean();
});
test('salir mientras el arranque completo espera impide revivir fuentes incluso al volver con el mismo UID',async()=>{
 const f=bootstrapFixture();f.context.fbCargarTodo();f.document.emit('sisventas:session-ended');
 f.document.hidden=false;f.document.emit('visibilitychange');await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(f.reads,[]);assert.equal(f.context.window._fbCargaTodoActiva,undefined);f.clean();
});
