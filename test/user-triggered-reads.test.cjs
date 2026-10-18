'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const flush=()=>new Promise(setImmediate);
const {load}=require('./helpers/app-functions.cjs');
function environment(){const events={},document={hidden:false,addEventListener:(name,callback)=>events[name]=callback,getElementById:()=>null};let calls=0,intervals=0;
 const root={document,navigator:{onLine:true},fbAuth:{currentUser:{uid:'ficticio',getIdToken:async()=>'TOKEN_FICTICIO'}},currentUserUid:'ficticio',currentRole:'admin',SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},addEventListener:(name,callback)=>events[name]=callback,dispatchEvent:event=>events[event.type]?.(event)};
 const fetch=async url=>{calls++;return {ok:true,status:200,headers:{get:()=>''},json:async()=>({ok:true,records:{example:{id:'FICTICIO'}},users:[{fbKey:'ficticio',uid:'ficticio',nombre:'Persona ficticia'}]})};};
 const context={window:root,document,fetch,AbortController,AbortSignal,queueMicrotask,Event,setInterval(){intervals++;return 1;},clearInterval(){}};root.fetch=fetch;root.setInterval=context.setInterval;root.clearInterval=context.clearInterval;
 return {root,context,events,get calls(){return calls;},get intervals(){return intervals;}};
}
test('Ventas y Presupuestos no programan consultas por tiempo; actualización explícita sigue funcionando',async()=>{
 const e=environment();vm.runInNewContext(fs.readFileSync('js/core/commercial-ownership.js','utf8'),e.context);let snapshots=0;
 e.root.SVCommercialOwnership.onValue('ventas',()=>snapshots++);e.root.SVCommercialOwnership.onValue('presupuestos',()=>snapshots++);await flush();
 assert.equal(e.calls,2);assert.equal(e.intervals,0);await flush();assert.equal(e.calls,2);
 await e.root.SVCommercialOwnership.refresh('ventas');assert.equal(e.calls,3);assert.equal(snapshots,2);e.root.SVCommercialOwnership.stop();
});
test('el directorio se consulta al abrir y por acciones, sin sondeo periódico',async()=>{
 const e=environment();e.root.SV_USER_DIRECTORY_V2=true;vm.runInNewContext(fs.readFileSync('js/core/user-directory.js','utf8'),e.context);
 const stop=e.root.SVUserDirectory.onValue(()=>{});await flush();assert.equal(e.calls,1);assert.equal(e.intervals,0);await e.root.SVUserDirectory.refresh();assert.equal(e.calls,2);stop();
});
test('la conexión se verifica al ingresar y al reconectar, sin una petición cada diez segundos',async()=>{
 const e=environment();vm.runInNewContext(fs.readFileSync('js/core/connection-monitor.js','utf8'),e.context);e.events['sisventas:session-ready']();await flush();assert.equal(e.calls,1);assert.equal(e.intervals,0);
 e.root.navigator.onLine=false;e.events.offline();assert.equal(e.root.SVConnectionMonitor.view(true).label,'Sin conexión');assert.equal(e.calls,1);
 e.root.navigator.onLine=true;e.events.online();await flush();assert.equal(e.calls,2);assert.equal(e.root.SVConnectionMonitor.view(true).label,'Sincronizado');
});
test('navegar actualiza sólo datos del módulo autorizados; no consulta antes del ingreso',()=>{
 const calls=[],c={isAuthenticated:true,svPuedeLeerDominio:domain=>domain==='ventas',window:{SVCommercialOwnership:{refresh:(domain,options)=>calls.push([domain,options.joinPending])},_svModuleListeners:{directorio:{refresh:()=>calls.push(['directorio'])},proveedoresReducidos:{refresh:()=>calls.push(['proveedores'])}}}};
 load(c,['svActualizarLecturasPorAccion']);c.svActualizarLecturasPorAccion('cuentacorriente');assert.deepEqual(calls,[['ventas',true]]);
 c.svActualizarLecturasPorAccion('productos');assert.deepEqual(calls.at(-1),['proveedores']);
 c.isAuthenticated=false;const before=calls.length;c.svActualizarLecturasPorAccion('dashboard');assert.equal(calls.length,before);
});
