'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('vm'),fs=require('fs');
const source=fs.readFileSync('js/core/commercial-ownership.js','utf8');
function setup(fetch){const listeners={},c={window:null,currentUserUid:'a',currentRole:'vendedor',fbAuth:{currentUser:{uid:'a',getIdToken:async()=>'fixture'}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'http://fixture'},fetch,AbortSignal,queueMicrotask,document:{hidden:false,addEventListener:(name,fn)=>listeners[name]=fn},setInterval:()=>1,clearInterval(){}};c.window=c;vm.runInNewContext(source,c);return {c,listeners};}
test('cambio de identidad descarta una respuesta comercial tardía y limpia ambas colecciones',async()=>{let resolve,delivered=0;const {c}=setup(()=>new Promise(r=>resolve=r));c.SVCommercialOwnership.onValue('ventas',()=>delivered++);await new Promise(r=>setImmediate(r));c.currentUserUid='b';c.currentRole='administrativo';c.SVCommercialOwnership.contextChanged();resolve({ok:true,json:async()=>({ok:true,records:{private:{total:100}}})});await new Promise(r=>setImmediate(r));assert.equal(delivered,0);assert.equal(c.ventasList.length,0);assert.equal(c.pptoData.length,0);});
test('logout invalida peticiones antes y después de recibir los datos',async()=>{let resolve,delivered=0;const {c,listeners}=setup(()=>new Promise(r=>resolve=r));c.SVCommercialOwnership.onValue('presupuestos',()=>delivered++);await new Promise(r=>setImmediate(r));listeners['sisventas:session-ended']();resolve({ok:true,json:async()=>({ok:true,records:{private:{total:100}}})});await new Promise(r=>setImmediate(r));assert.equal(delivered,0);});
test('error del servidor nunca usa un historial global como fallback',async()=>{let failure=0,delivered=0;const {c}=setup(async()=>({ok:false,status:503,json:async()=>({mensaje:'Cerrado'})}));c.SVCommercialOwnership.onValue('ventas',()=>delivered++,()=>failure++);await new Promise(r=>setImmediate(r));assert.equal(failure,1);assert.equal(delivered,0);});
test('revocación cierra el detalle y vacía la colección ya mostrada',async()=>{const elements={'venta-detalle-view':{style:{display:'block'}},'ventas-list-view':{style:{display:'none'}}};const {c}=setup(async()=>({ok:false,status:403,json:async()=>({mensaje:'Bloqueado'})}));c.document.getElementById=id=>elements[id];c._ventaDetalleActual={fbKey:'private'};let cleared=false;c.SVCommercialOwnership.onValue('ventas',snap=>{cleared=Object.keys(snap.val()).length===0;});await new Promise(r=>setImmediate(r));assert.equal(cleared,true);assert.equal(c._ventaDetalleActual,null);assert.equal(elements['venta-detalle-view'].style.display,'none');});
test('fechaOrden derivada solo para ordenar no se introduce en la base de una edición histórica',()=>{const {c}=setup(async()=>({}));const clean=c.SVCommercialOwnership.clean({fecha:'2020-01-01',fechaOrden:'2020-01-01',_svDerivedFechaOrden:true,total:100});assert.equal(clean.fechaOrden,undefined);assert.equal(clean.fecha,'2020-01-01');assert.equal(clean.total,100);});
function readiness(c){c.URL=URL;c.addEventListener=()=>{};c.requestAnimationFrame=()=>{};vm.runInNewContext(fs.readFileSync('js/core/data-readiness.js','utf8'),c);return c.SVDataReadiness;}
test('Ventas completa la carga de pantalla solo después de procesar su respuesta HTTP',async()=>{
 let finish;const {c}=setup(async()=>({ok:true,json:async()=>({ok:true,records:{demo:{total:100}}})})),load=readiness(c);
 c.SVCommercialOwnership.onValue('ventas',()=>new Promise(resolve=>finish=resolve));await new Promise(r=>setImmediate(r));assert.equal(load.status(['ventas']).ready,false);
 finish();await new Promise(r=>setImmediate(r));assert.equal(load.status(['ventas']).ready,true);assert.equal(load.status(['ventas']).errors.length,0);
});
test('Presupuestos vacío confirmado también libera la carga; un error no la simula completada',async()=>{
 for(const ok of [true,false]){const {c}=setup(async()=>({ok,status:503,json:async()=>ok?({ok:true,records:{}}):({mensaje:'Interrupción ficticia'})})),load=readiness(c);
 c.SVCommercialOwnership.onValue('presupuestos',()=>{});await new Promise(r=>setImmediate(r));assert.equal(load.status(['presupuestos']).ready,ok);assert.equal(load.status(['presupuestos']).errors.length,ok?0:1);}
});
test('cancelar la suscripción comercial descarta su respuesta y su fuente de carga',async()=>{
 let resolve;const {c}=setup(()=>new Promise(r=>resolve=r)),load=readiness(c);let delivered=0;
 const stop=c.SVCommercialOwnership.onValue('ventas',()=>delivered++);await new Promise(r=>setImmediate(r));stop();resolve({ok:true,json:async()=>({ok:true,records:{demo:{total:100}}})});await new Promise(r=>setImmediate(r));assert.equal(delivered,0);assert.equal(load.status(['ventas']).ready,false);
});
test('consulta periódica idéntica no reconstruye la pantalla; cambios reales sí se entregan',async()=>{
 let records={demo:{total:100}},delivered=0;const {c}=setup(async()=>({ok:true,json:async()=>({ok:true,records})}));
 c.SVCommercialOwnership.onValue('ventas',()=>delivered++);await new Promise(r=>setImmediate(r));await c.SVCommercialOwnership.refresh('ventas');assert.equal(delivered,1);
 records={demo:{total:101}};await c.SVCommercialOwnership.refresh('ventas');assert.equal(delivered,2);
});
test('recuperación tras interrupción conserva datos y limpia el estado de error sin repintar lo mismo',async()=>{
 let ok=true,delivered=0;const {c}=setup(async()=>({ok,status:503,json:async()=>ok?({ok:true,records:{demo:{total:100}}}):({mensaje:'Interrupción'})})),load=readiness(c);
 c.SVCommercialOwnership.onValue('ventas',()=>delivered++);await new Promise(r=>setImmediate(r));ok=false;await c.SVCommercialOwnership.refresh('ventas');assert.equal(load.status(['ventas']).errors.length,1);ok=true;await c.SVCommercialOwnership.refresh('ventas');assert.equal(delivered,1);assert.equal(load.status(['ventas']).ready,true);assert.equal(load.status(['ventas']).errors.length,0);
});
test('validador HTTP vive en la suscripción: 304 no relee JSON ni repinta y una respuesta nueva actualiza',async()=>{
 let calls=0,delivered=0;const {c}=setup(async(_,options)=>{calls++;if(calls===1)return {ok:true,status:200,headers:{get:()=> 'W/"demo1"'},json:async()=>({ok:true,records:{demo:{total:100}}})};assert.equal(options.headers['If-None-Match'],'W/"demo1"');if(calls===2)return {status:304,json:()=>{throw Error('304 no tiene JSON');}};return {ok:true,status:200,headers:{get:()=> 'W/"demo2"'},json:async()=>({ok:true,records:{demo:{total:101}}})};}),load=readiness(c);
 c.SVCommercialOwnership.onValue('ventas',()=>delivered++);await new Promise(r=>setImmediate(r));await c.SVCommercialOwnership.refresh('ventas');assert.equal(delivered,1);assert.equal(load.status(['ventas']).ready,true);await c.SVCommercialOwnership.refresh('ventas');assert.equal(delivered,2);
});
test('cambiar cuenta o rol elimina el validador; una revocación no reutiliza la colección anterior',async()=>{
 const headers=[];let allowed=true;const {c}=setup(async(_,options)=>{headers.push(options.headers);return {ok:allowed,status:allowed?200:403,headers:{get:()=> 'W/"privado"'},json:async()=>allowed?({ok:true,records:{demo:{total:100}}}):({ok:false,mensaje:'Revocado'})};});
 c.SVCommercialOwnership.onValue('ventas',()=>{});await new Promise(r=>setImmediate(r));allowed=false;await c.SVCommercialOwnership.refresh('ventas');assert.equal(headers[1]['If-None-Match'],'W/"privado"');await c.SVCommercialOwnership.refresh('ventas');assert.equal(headers[2]['If-None-Match'],undefined);
 c.currentUserUid='b';c.currentRole='administrativo';c.SVCommercialOwnership.contextChanged();c.SVCommercialOwnership.onValue('ventas',()=>{});await new Promise(r=>setImmediate(r));assert.equal(headers.at(-1)['If-None-Match'],undefined);
});
test('un 304 inesperado sin representación local no completa la carga con datos vacíos',async()=>{
 let failures=0,delivered=0;const {c}=setup(async()=>({status:304})),load=readiness(c);c.SVCommercialOwnership.onValue('ventas',()=>delivered++,()=>failures++);await new Promise(r=>setImmediate(r));assert.equal(delivered,0);assert.equal(failures,1);assert.equal(load.status(['ventas']).ready,false);
});

test('304 tras un fallo transitorio restablece readiness sin descartar ni reconstruir los datos',async()=>{
 let state='data',delivered=0;const {c}=setup(async()=>state==='data'?{ok:true,status:200,headers:{get:()=> 'W/"fixture"'},json:async()=>({ok:true,records:{demo:{total:100}}})}:state==='error'?{ok:false,status:503,json:async()=>({mensaje:'Interrupción ficticia'})}:{status:304}),load=readiness(c);
 c.SVCommercialOwnership.onValue('ventas',()=>delivered++);await new Promise(r=>setImmediate(r));state='error';await c.SVCommercialOwnership.refresh('ventas');assert.equal(load.status(['ventas']).errors.length,1);state='unchanged';await c.SVCommercialOwnership.refresh('ventas');assert.equal(load.status(['ventas']).ready,true);assert.equal(load.status(['ventas']).errors.length,0);assert.equal(delivered,1);
});

test('cerrar sesión durante una validación 304 impide reactivar la fuente anterior',async()=>{
 let resolve,calls=0;const {c,listeners}=setup(async()=>++calls===1?{ok:true,status:200,headers:{get:()=> 'W/"fixture"'},json:async()=>({ok:true,records:{demo:{total:100}}})}:new Promise(r=>resolve=r)),load=readiness(c);let delivered=0;
 c.SVCommercialOwnership.onValue('ventas',()=>delivered++);await new Promise(r=>setImmediate(r));const pending=c.SVCommercialOwnership.refresh('ventas');await new Promise(r=>setImmediate(r));listeners['sisventas:session-ended']();resolve({status:304});await pending;assert.equal(delivered,1);assert.equal(load.status(['ventas']).ready,false);assert.equal(c.ventasList.length,0);
});
