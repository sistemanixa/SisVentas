'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const browser=new EventTarget(),document=new EventTarget(),intervals=[],calls=[],delivered={ventas:0,presupuestos:0,usuarios:0};
 document.hidden=false;document.getElementById=()=>null;
 let revision=1,mode='ok',gate=null;
 const root={SV_USER_DIRECTORY_V2:true,currentUserUid:'fixture',currentRole:'vendedor',navigator:{onLine:true},addEventListener:browser.addEventListener.bind(browser),fbAuth:{currentUser:{uid:'fixture',getIdToken:async()=> 'FICTICIO'}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},permisoModulo:()=>true};
 const context={window:root,document,URL,AbortSignal,queueMicrotask,requestAnimationFrame:()=>{},setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval:()=>{},console:{warn(){}}};
 context.fetch=async url=>{
  assert.equal(new URL(url).origin,'https://fixture.invalid');calls.push(url);
  if(gate)await gate;
  if(mode==='network')throw TypeError('Interrupción ficticia');
  const domain=url.split('/').pop(),status=mode==='denied'&&domain==='ventas'?403:mode==='server'?503:200;
  return {ok:status===200,status,headers:{get:()=>''},json:async()=>status!==200?{mensaje:'Fallo ficticio'}:domain==='directorio'?{ok:true,users:[{fbKey:'u',uid:'fixture',nombre:'Persona ficticia',rol:'vendedor'}]}:{ok:true,records:{demo:{total:revision,responsableUid:'fixture'}}}};
 };
 vm.createContext(context);
 for(const file of ['js/core/data-readiness.js','js/core/commercial-ownership.js','js/core/user-directory.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
 function start(){for(const domain of ['ventas','presupuestos'])root.SVCommercialOwnership.onValue(domain,()=>delivered[domain]++);root.SVUserDirectory.start(()=>delivered.usuarios++);}
 return {root,document,calls,delivered,start,load:root.SVDataReadiness,event:name=>browser.dispatchEvent(new Event(name)),poll:()=>intervals.forEach(fn=>fn()),visibility:()=>document.dispatchEvent(new Event('visibilitychange')),logout:()=>document.dispatchEvent(new Event('sisventas:session-ended')),revision:n=>revision=n,mode:n=>mode=n,hold(){let resolve;gate=new Promise(r=>resolve=r);return ()=>{gate=null;resolve();};}};
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

test('regresos repetidos con peticiones pendientes se agrupan sin duplicar consultas simultáneas',async()=>{
 const f=fixture(),release=f.hold();f.start();await settle();for(let n=0;n<5;n++)f.event('online');await settle();assert.equal(f.calls.length,3);
 release();await settle();await settle();assert.equal(f.calls.length,6);assert.equal(f.delivered.ventas,1);assert.equal(f.delivered.presupuestos,1);
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
