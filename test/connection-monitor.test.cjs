'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../js/core/connection-monitor');
test('corte real de transporte se detecta aunque navegador y Firebase sigan diciendo conectado',async()=>{
 let mode='up',restored=0;const m=create({online:()=>true,probe:async()=>{if(mode==='down')throw TypeError('Sin salida');return 401;},restored:()=>restored++});
 await m.check();assert.equal(m.view(true).label,'Sincronizado');mode='down';await m.check();assert.equal(m.view(true).label,'Sin conexión');assert.equal(m.canSync(),false);
 mode='up';await m.check();assert.equal(restored,1);assert.equal(m.canSync(),true);assert.equal(m.view(true).label,'Sincronizado');
});
test('respuesta de servidor500 se distingue de falta de internet y una lectura pendiente no se da por sincronizada',async()=>{
 let code=503;const m=create({probe:async()=>code});await m.check();assert.equal(m.view(true).label,'Servidor no disponible');assert.equal(m.canSync(),false);
 code=401;await m.check();m.failure('ventas',{status:503});await m.check();assert.equal(m.view(true).label,'Sincronización pendiente');m.success('presupuestos');assert.equal(m.view(true).label,'Sincronización pendiente');m.success('ventas');assert.equal(m.view(true).label,'Sincronizado');assert.equal(m.view(false).label,'Reconectando');
});
test('offline es inmediato, no duplica sondas y una respuesta vieja no pisa la recuperación',async()=>{
 let resolve,count=0;const m=create({probe:()=>{count++;return new Promise(r=>resolve=r);}});const first=m.check();const second=m.check();assert.equal(first,second);await Promise.resolve();assert.equal(count,1);
 m.offline();assert.equal(m.view(true).label,'Sin conexión');m.success('ventas');resolve(503);await first;assert.equal(m.view(true).label,'Sincronizado');
});
test('cerrar sesión invalida una sonda pendiente y no emite recuperación',async()=>{
 let resolve,restored=0;const m=create({probe:()=>new Promise(r=>resolve=r),restored:()=>restored++});const task=m.check();await Promise.resolve();m.offline();m.stop();resolve(401);await task;assert.equal(restored,0);assert.equal(m.view(true).label,'Reconectando');
});
test('perder conexión cancela lecturas pendientes sin cancelar operaciones de escritura',async()=>{
 const fs=require('fs'),vm=require('vm'),events=new EventTarget(),document=new EventTarget();document.hidden=false;document.getElementById=()=>null;const waiting=[];
 const root={navigator:{onLine:true},fbAuth:{currentUser:{uid:'fixture',getIdToken:async()=> 'FICTICIO'}},currentUserUid:'fixture',currentRole:'admin',SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},addEventListener:events.addEventListener.bind(events)};
 const reply=()=>({ok:true,status:200,headers:{get:()=>''},json:async()=>({ok:true,records:{}})});
 const ctx={window:root,document,AbortController,AbortSignal,queueMicrotask,setInterval:()=>1,clearInterval(){},console:{warn(){}},fetch:(_url,options)=>new Promise((resolve,reject)=>{waiting.push({method:options.method,resolve:()=>resolve(reply()),signal:options.signal});options.signal.addEventListener('abort',()=>reject(Error('Abortado')),{once:true});})};
 vm.runInNewContext(fs.readFileSync('js/core/commercial-ownership.js','utf8'),ctx);
 const read=root.SVCommercialOwnership.request('ventas'),write=root.SVCommercialOwnership.request('ventas','guardar',{id:'ficticio'});await new Promise(r=>setImmediate(r));const handledRead=read.catch(e=>e);
 events.dispatchEvent(new Event('sisventas:connection-lost'));assert.equal(waiting.find(x=>x.method==='GET').signal.aborted,true);assert.equal(waiting.find(x=>x.method==='POST').signal.aborted,false);waiting.find(x=>x.method==='POST').resolve();await write;assert.ok(await handledRead instanceof Error);
});
test('errores de transporte marcan pendiente sin borrar datos y sin esconder errores de permisos',async()=>{
 const fs=require('fs'),vm=require('vm'),document=new EventTarget(),events=new EventTarget();document.hidden=false;document.getElementById=()=>null;let mode='up',errors=0,delivered=0,calls=0;const m=create({probe:async()=>{throw TypeError('Sin red');}});
 const root={navigator:{onLine:true},fbAuth:{currentUser:{uid:'fixture',getIdToken:async()=> 'FICTICIO'}},currentUserUid:'fixture',currentRole:'vendedor',SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},SVConnectionMonitor:m,addEventListener:events.addEventListener.bind(events)};
 const context={window:root,document,AbortSignal,queueMicrotask,setInterval:()=>1,clearInterval(){},console:{warn(){}},fetch:async()=>{calls++;if(mode==='down')throw TypeError('Sin red');return {ok:mode!=='denied',status:mode==='denied'?403:200,headers:{get:()=>''},json:async()=>mode==='denied'?{ok:false}:{ok:true,records:{example:{}}}};}};
 vm.runInNewContext(fs.readFileSync('js/core/commercial-ownership.js','utf8'),context);root.SVCommercialOwnership.onValue('ventas',()=>delivered++,()=>errors++);await new Promise(r=>setImmediate(r));
 mode='down';await root.SVCommercialOwnership.refresh('ventas');await m.check();assert.equal(errors,0);assert.equal(delivered,1);assert.equal(m.view(true).label,'Sin conexión');const before=calls;await root.SVCommercialOwnership.refresh('ventas');assert.equal(calls,before);
 m.success('ventas');mode='denied';await root.SVCommercialOwnership.refresh('ventas');assert.equal(errors,1);assert.equal(delivered,2);assert.equal(m.view(true).label,'Sincronización pendiente');
});
