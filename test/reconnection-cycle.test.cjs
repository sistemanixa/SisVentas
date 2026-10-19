'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const browser=new EventTarget(),document=new EventTarget(),intervals=[],calls=[],verbs=[],signals=new Map(),delivered={ventas:0,presupuestos:0,usuarios:0},seen={ventas:[],presupuestos:[],usuarios:[]};let tokenCalls=0;
 document.hidden=false;document.getElementById=()=>null;
 let revision=1,mode='ok',gate=null;
 const root={document,SV_USER_DIRECTORY_V2:true,currentUserUid:'fixture',currentRole:'vendedor',navigator:{onLine:true},addEventListener:browser.addEventListener.bind(browser),fbAuth:{currentUser:{uid:'fixture',getIdToken:async()=>{tokenCalls++;return 'FICTICIO';}}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},permisoModulo:()=>true,
  fbDB:{},fbRef:(_,path)=>path,fbOnValue:(path,callback)=>{signals.set(path,callback);return()=>signals.delete(path);}};
 const context={window:root,document,URL,AbortSignal,queueMicrotask,requestAnimationFrame:()=>{},setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval:()=>{},console:{warn(){}}};
 root.SVForegroundSession=require('../js/core/foreground-session.js').create(root);
 context.fetch=async(url,options={})=>{
  assert.equal(new URL(url).origin,'https://fixture.invalid');calls.push(url);verbs.push(options.method||'GET');const responseRevision=revision;
  if(gate)await gate;
  if(mode==='network')throw TypeError('Interrupción ficticia');
  const domain=url.split('/').pop(),status=mode==='denied'&&domain==='ventas'?403:mode==='server'?503:200;
  return {ok:status===200,status,headers:{get:()=>''},json:async()=>status!==200?{mensaje:'Fallo ficticio'}:domain==='directorio'?{ok:true,users:[{fbKey:'u',uid:'fixture',nombre:'Persona ficticia '+responseRevision,rol:'vendedor'}]}:{ok:true,records:{demo:{total:responseRevision,responsableUid:'fixture'}}}};
 };
 vm.createContext(context);
 for(const file of ['js/core/data-readiness.js','js/core/commercial-ownership.js','js/core/user-directory.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
 function start(){for(const domain of ['ventas','presupuestos'])root.SVCommercialOwnership.onValue(domain,snap=>{delivered[domain]++;seen[domain].push(snap.val()?.demo?.total);});root.SVUserDirectory.start(snap=>{delivered.usuarios++;seen.usuarios.push(snap.val()?.u?.nombre);});}
 return {root,document,calls,verbs,tokenCalls:()=>tokenCalls,delivered,seen,start,load:root.SVDataReadiness,event:name=>browser.dispatchEvent(new Event(name)),signal:()=>signals.get('sv_chat_directorio')?.({val:()=>({revision})}),poll:()=>intervals.forEach(fn=>fn()),visibility:()=>document.dispatchEvent(new Event('visibilitychange')),logout:()=>document.dispatchEvent(new Event('sisventas:session-ended')),revision:n=>revision=n,mode:n=>mode=n,hold(){let resolve;gate=new Promise(r=>resolve=r);return ()=>{gate=null;resolve();};}};
}

test('sin internet al empezar no consulta APIs; al volver carga sólo las suscripciones vigentes',async()=>{
 const f=fixture();f.root.navigator.onLine=false;f.start();await settle();assert.equal(f.calls.length,0);assert.equal(f.load.status(['ventas','presupuestos','usuarios']).ready,false);
 f.root.navigator.onLine=true;f.event('online');await settle();assert.equal(f.calls.length,3);assert.equal(f.load.status(['ventas','presupuestos','usuarios']).ready,true);
});

test('corte y retorno preservan información y no esperan al próximo intervalo',async()=>{
 const f=fixture();f.start();await settle();assert.equal(f.calls.length,3);
 f.root.navigator.onLine=false;f.event('offline');f.poll();await settle();assert.equal(f.calls.length,3);assert.equal(f.delivered.ventas,1);
 f.revision(2);f.root.navigator.onLine=true;f.event('online');await settle();assert.equal(f.calls.length,6);assert.equal(f.delivered.ventas,2);assert.equal(f.delivered.presupuestos,2);assert.equal(f.load.status(['ventas','presupuestos','usuarios']).errors.length,0);
});

test('fallo de transporte conserva datos; retorno limpia el error sin reconstruir las ventas idénticas',async()=>{
 const f=fixture();f.start();await settle();f.mode('network');await f.root.SVCommercialOwnership.refresh('ventas');assert.equal(f.load.status(['ventas']).errors.length,1);assert.equal(f.delivered.ventas,1);
 f.mode('ok');f.event('online');await settle();assert.equal(f.load.status(['ventas']).errors.length,0);assert.equal(f.delivered.ventas,1);
});

test('regresos repetidos con peticiones pendientes se agrupan sin otra tanda al completar',async()=>{
 const f=fixture(),release=f.hold();f.start();await settle();for(let n=0;n<5;n++)f.event('online');await settle();assert.equal(f.calls.length,3);
 release();await settle();await settle();assert.equal(f.calls.length,3);assert.equal(f.delivered.ventas,1);assert.equal(f.delivered.presupuestos,1);
});

test('online, conexión restaurada y visibilidad durante la misma carga comparten las peticiones',async()=>{
 const f=fixture(),release=f.hold();f.start();await settle();
 for(let n=0;n<5;n++){f.event('online');f.event('sisventas:connection-restored');f.visibility();}
 await settle();assert.equal(f.calls.length,3);release();await settle();await settle();assert.equal(f.calls.length,3);assert.equal(f.delivered.usuarios,1);
 f.visibility();await settle();assert.equal(f.calls.length,6,'Una vuelta posterior a la carga sí actualiza las tres fuentes');
});

test('un snapshot idéntico de directorio al reanudar no añade otra consulta detrás del GET visible',async()=>{
 const f=fixture();f.start();await settle();f.signal();await settle();const initial=f.calls.length;
 f.document.hidden=true;f.visibility();const release=f.hold();f.document.hidden=false;f.visibility();await settle();f.signal();await settle();
 assert.equal(f.calls.length,initial+3);release();await settle();await settle();assert.equal(f.calls.length,initial+3,'El replay idéntico no deja un segundo directorio en cola');
});

test('la primera señal del watch durante bootstrap sigue actualizando aunque se repita idéntica',async()=>{
 const f=fixture(),release=f.hold();f.start();await settle();f.signal();f.signal();f.signal();
 release();await settle();await settle();assert.equal(f.calls.length,4,'La primera señal no puede perderse durante la carga inicial');assert.equal(f.delivered.usuarios,2);
});

test('una señal idéntica en otro watch es inicial otra vez y conserva un cambio posterior real durante GET',async()=>{
 const f=fixture();f.start();await settle();f.signal();await settle();f.logout();f.start();await settle();const initial=f.calls.length;
 f.signal();await settle();assert.equal(f.calls.length,initial+1,'La memoria de señal pertenece al watch retirado');
 const release=f.hold();f.document.hidden=true;f.visibility();f.document.hidden=false;f.visibility();await settle();f.revision(2);f.signal();
 release();await settle();await settle();assert.equal(f.calls.length,initial+5);assert.deepEqual(f.seen.usuarios.slice(-2),['Persona ficticia 1','Persona ficticia 2']);
});

test('actualizar explícitamente durante una lectura conserva una tanda nueva aun con avisos de reconexión',async()=>{
 const f=fixture(),release=f.hold();f.start();await settle();f.revision(2);
 f.root.SVCommercialOwnership.refresh('ventas');f.root.SVUserDirectory.refresh();
 for(let n=0;n<5;n++){f.event('online');f.event('sisventas:connection-restored');f.visibility();}
 release();await settle();await settle();assert.equal(f.calls.length,5);
 assert.deepEqual(f.seen.ventas,[1,2]);assert.deepEqual(f.seen.presupuestos,[1]);assert.deepEqual(f.seen.usuarios,['Persona ficticia 1','Persona ficticia 2']);
});

test('la señal real de cambio de directorio durante una lectura no se pierde al agrupar eventos',async()=>{
 const f=fixture(),release=f.hold();f.start();await settle();f.revision(2);f.signal();
 for(let n=0;n<5;n++){f.event('online');f.visibility();}
 release();await settle();await settle();assert.equal(f.calls.length,4);assert.deepEqual(f.seen.usuarios,['Persona ficticia 1','Persona ficticia 2']);
 assert.equal(f.calls.filter(url=>url.endsWith('/ventas')).length,1);assert.equal(f.calls.filter(url=>url.endsWith('/presupuestos')).length,1);
});

test('agrupar avisos no oculta el fallo ni inicia una repetición; el próximo regreso sí recupera',async()=>{
 const f=fixture(),release=f.hold();f.start();await settle();f.mode('network');
 for(let n=0;n<5;n++){f.event('online');f.visibility();}
 release();await settle();await settle();assert.equal(f.calls.length,3);assert.equal(f.load.status(['ventas','presupuestos','usuarios']).errors.length,3);assert.equal(f.delivered.ventas,0);
 f.mode('ok');f.event('online');await settle();assert.equal(f.calls.length,6);assert.equal(f.load.status(['ventas','presupuestos','usuarios']).errors.length,0);assert.equal(f.delivered.ventas,1);
});

test('cerrar sesión durante el corte impide que el retorno reactive datos de la cuenta anterior',async()=>{
 const f=fixture();f.start();await settle();f.root.navigator.onLine=false;f.logout();const previous=f.calls.length;
 f.root.navigator.onLine=true;f.event('online');f.poll();await settle();assert.equal(f.calls.length,previous);assert.equal(f.root.ventasList.length,0);assert.equal(f.root.pptoData.length,0);
});

test('retorno oculto espera a volver a primer plano, sin consultas en segundo plano',async()=>{
 const f=fixture();f.start();await settle();f.document.hidden=true;f.event('online');f.poll();await settle();assert.equal(f.calls.length,3);
 f.document.hidden=false;f.visibility();await settle();assert.equal(f.calls.length,6);
});

test('varios ciclos recuperan la carga y una revocación al volver sigue cerrando el acceso',async()=>{
 const f=fixture();f.start();await settle();for(let n=0;n<3;n++){f.root.navigator.onLine=false;f.event('offline');f.poll();await settle();f.root.navigator.onLine=true;f.revision(n+2);f.event('online');await settle();assert.equal(f.load.status(['ventas','presupuestos','usuarios']).errors.length,0);}
 assert.equal(f.delivered.ventas,4);f.mode('denied');f.event('online');await settle();assert.equal(f.delivered.ventas,5);assert.equal(f.load.status(['ventas']).errors.length,1);
});

test('lecturas iniciales ocultas esperan antes del token y al volver comparten una única tanda',async()=>{
 const f=fixture();f.document.hidden=true;f.visibility();f.start();await settle();assert.equal(f.calls.length,0);assert.equal(f.tokenCalls(),0);
 f.document.hidden=false;f.visibility();f.event('online');await settle();assert.equal(f.calls.length,3);assert.equal(f.tokenCalls(),3);assert.equal(f.delivered.usuarios,1);
});

test('si el token responde oculto las lecturas siguen esperando antes del fetch',async()=>{
 const f=fixture();let release;const token=new Promise(resolve=>release=resolve);f.root.fbAuth.currentUser.getIdToken=()=>token;
 f.start();await settle();f.document.hidden=true;f.visibility();release('FICTICIO');await settle();assert.equal(f.calls.length,0);
 f.document.hidden=false;f.visibility();await settle();assert.equal(f.calls.length,3);assert.equal(f.delivered.ventas,1);
});

test('logout cancela lecturas esperando primer plano y no consulta al regresar ni con el mismo UID',async()=>{
 const f=fixture();f.document.hidden=true;f.visibility();f.start();await settle();f.logout();f.document.hidden=false;f.visibility();f.event('online');await settle();
 assert.equal(f.calls.length,0);assert.equal(f.tokenCalls(),0);assert.equal(f.delivered.usuarios,0);
});

test('ocultar no bloquea un POST explícito ni altera sus validaciones de contexto',async()=>{
 const f=fixture();f.document.hidden=true;f.visibility();await f.root.SVCommercialOwnership.request('ventas','guardar',{id:'ficticio'});
 assert.equal(f.calls.length,1);assert.deepEqual(f.verbs,['POST']);assert.equal(f.tokenCalls(),1);
});
