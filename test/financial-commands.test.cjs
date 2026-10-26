'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {create}=require('../js/core/financial-commands');
const {create:createRecovery}=require('../js/core/labor-write-recovery');
const copy=value=>value==null?value:structuredClone(value);
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>copy(data),body:{async cancel(){}}});
const flush=()=>new Promise(setImmediate);
// WebCrypto finishes on a worker: a fixed count of setImmediate turns can expire in 1ms under a parallel suite.
async function until(check){const deadline=performance.now()+2000;while(performance.now()<deadline){if(check())return;await new Promise(resolve=>setTimeout(resolve,2));}assert.fail('No llegó el estado esperado del fixture');}
function fixture(options={}){
 const calls=[],receipts=new Map(),storage=new Map(),listeners=new Map(),commits=[],slots={caps:null,command:null};let count=0,holds=0,mode=options.mode||'ok',capMode=options.capMode||'ok';
 const root={currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}},PERMISOS_ROLES:{admin:{indiceRevision:1}},crypto:{subtle:crypto.webcrypto.subtle,randomUUID:()=> '00000000-0000-4000-8000-'+String(++count).padStart(12,'0')},
  SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid/'},navigator:{onLine:true},
  sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  document:{addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener(name,fn){listeners.get(name)?.delete(fn);},dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);}},
  SVServiceAuth:{headers:async base=>({...base,Authorization:'Bearer fixture'})},
  SVForegroundSession:{async waitVisible(){},holdDatabase(){holds++;return ()=>holds--;}},
  async fetch(url,opts){
   const body=JSON.parse(opts.body);calls.push({url,body:copy(body),headers:opts.headers,cache:opts.cache});
   assert.equal(opts.method,'POST');assert.equal(opts.cache,'no-store');assert.equal(opts.headers.Authorization,'Bearer fixture');
   if(url.endsWith('/laboral/capacidades')){
    if(slots.caps)await slots.caps;
    if(capMode==='transport')throw Error('Sin red ficticia');
    if(capMode==='invalid')return response({ok:true,payments:{enabled:true,version:2}});
    if(capMode==='denied')return response({ok:false,mensaje:'Sin permiso'},403);
    if(capMode==='missing')return response(null,404);
    if(capMode==='method')return response(null,405);
    return response({ok:true,payments:{enabled:options.payments!==false,version:1},adminExpense:{enabled:options.expenses!==false,version:1}});
   }
   if(url.endsWith('/laboral/operacion'))return response({ok:true,status:receipts.has(body.id)?'confirmed':'rejected'});
   assert.match(url,/\/(?:cobranzas\/operacion|laboral\/gastos\/crear-administrativo)$/);
   if(slots.command)await slots.command;
   if(mode==='forbidden')return response({ok:false,code:'DENIED',mensaje:'Sin permiso de guardado'},403);
   if(mode==='unavailable')return response({ok:false,code:'SV_PAYMENTS_NOT_ENABLED',mensaje:'Servicio apagado'},503);
   if(mode==='balance-changed')return response({ok:false,code:'SV_PAYMENT_BALANCE_CHANGED',mensaje:'Cambió el saldo'},409);
   if(mode==='index-unready')return response({ok:false,code:'SV_PAYMENT_INDEX_INVALID',mensaje:'Índice no preparado'},503);
   if(mode==='expense-duplicate')return response({ok:false,code:'SV_GASTO_DUPLICATE',mensaje:'Gasto duplicado'},409);
   if(mode==='unknown503')return response({ok:false,code:'INTERNAL_UNAVAILABLE',mensaje:'Estado incierto'},503);
   const before=receipts.get(body.id);
   if(before)assert.equal(JSON.stringify(before.body),JSON.stringify(body),'un replay conserva el comando entero, incluidos adjuntos, claves y timestamps');
   else{
    const data=url.endsWith('/cobranzas/operacion')?{ok:true,committed:true,resultados:[{pago:{fbKey:body.opciones?.solicitudes[0].pago.fbKey||body.pagoKey,monto:40},venta:{fbKey:body.opciones?.solicitudes[0].ventaFbKey||body.ventaKey,totalPagado:40,estadoPago:'seniado'}}]}:{ok:true,committed:true,key:'gasto-fixture'};
    receipts.set(body.id,{body:copy(body),data});commits.push(copy(body));
   }
   if(mode==='loss-once'){mode='ok';throw Error('Respuesta perdida ficticia');}
   if(mode==='uncertain409'){mode='ok';return response({ok:false,code:'SV_LABOR_COMMIT_UNCONFIRMED'},409);}
   return response(receipts.get(body.id).data);
  }
 };
 root.SVLaborWriteRecovery=createRecovery(root);root.SVFinancialCommands=create(root);
 return {root,calls,commits,receipts,storage,slots,listeners,get holds(){return holds;},setMode:value=>mode=value,setCapMode:value=>capMode=value};
}
const options=()=>({grupoPago:'grupo-fixture',origen:'cobranzas',solicitudes:[{ventaFbKey:'venta-fixture',monto:40,pago:{fbKey:'pago-fixture',monto:40,ts:123,moneda:'ARS',fecha:'2026-10-22',medio:'Efectivo'}}],cabecera:{ts:123},comprobante:{nombre:'ficticio.pdf',tipo:'application/pdf',ts:123,data:'data:application/pdf;base64,AA=='}});

test('los comandos no consultan capacidades ni crean tareas al inicializarse',async()=>{const f=fixture();await flush();assert.equal(f.calls.length,0);assert.equal(f.storage.size,0);assert.equal(f.holds,0);});

for(const capMode of ['missing','method','ok'])test('capacidad deshabilitada antes de escribir permite fallback explícito: '+capMode,async()=>{
 const f=fixture({capMode,payments:false,expenses:false});
 assert.equal(await f.root.SVFinancialCommands.register(options()),null);
 assert.equal(await f.root.SVFinancialCommands.annul('p','v',{}),null);
 assert.equal(await f.root.SVFinancialCommands.createExpense({monto:1},null,'expense-only'),null);
 assert.equal(f.calls.length,1);assert.equal(f.commits.length,0);assert.equal(f.storage.size,0);assert.equal(f.holds,0);
});

for(const capMode of ['transport','invalid','denied'])test('error de capacidades no se presenta como capacidad apagada: '+capMode,async()=>{
 const f=fixture({capMode});await assert.rejects(f.root.SVFinancialCommands.register(options()),error=>error.svLaborAttempted===false);assert.equal(f.calls.length,1);assert.equal(f.commits.length,0);assert.equal(f.storage.size,0);assert.equal(f.holds,0);
});

test('capacidades se comparten sólo dentro del mismo contexto y nunca son una caché de permisos',async()=>{
 const f=fixture();await f.root.SVFinancialCommands.register(options());await f.root.SVFinancialCommands.annul('pago-fixture','venta-fixture',{fecha:'2026-10-22'});
 assert.equal(f.calls.filter(c=>c.url.endsWith('/capacidad')||c.url.endsWith('/capacidades')).length,1);
 f.root.PERMISOS_ROLES.admin.indiceRevision=2;await f.root.SVFinancialCommands.register({...options(),grupoPago:'grupo-otro'});
 assert.equal(f.calls.filter(c=>c.url.endsWith('/capacidades')).length,2);assert.equal(f.commits.length,3);assert.equal(f.holds,0);
});

test('dos clics durante capacidades o hash comparten un solo ID, cuerpo y confirmación',async()=>{
 const f=fixture(),o=options();let release;f.slots.caps=new Promise(resolve=>release=resolve);
 const a=f.root.SVFinancialCommands.register(o),b=f.root.SVFinancialCommands.register(o);await until(()=>f.calls.length===1);release();
 const results=await Promise.all([a,b]);assert.equal(f.calls.filter(c=>c.url.endsWith('/cobranzas/operacion')).length,1);assert.equal(f.commits.length,1);assert.deepEqual(results[0],results[1]);assert.equal(f.holds,0);
});

for(const mode of ['loss-once','uncertain409'])test('acuse incierto se consulta explícitamente y se hidrata con MISMO ID/body: '+mode,async()=>{
 const f=fixture({mode}),o=options();let done=false;const running=f.root.SVFinancialCommands.register(o).then(value=>{done=true;return value;});
 await until(()=>f.root.SVLaborWriteRecovery.state());assert.equal(done,false);assert.equal(f.commits.length,1);assert.equal(f.holds,0);
 const first=f.calls.find(c=>c.url.endsWith('/cobranzas/operacion')).body;
 const saved=JSON.parse(f.storage.get(f.root.SVLaborWriteRecovery.STORAGE_KEY));assert.deepEqual(Object.keys(saved[0]).sort(),['digest','id','uid']);assert.ok(!JSON.stringify(saved).includes('ficticio.pdf'));
 await flush();assert.equal(f.calls.filter(c=>c.url.endsWith('/laboral/operacion')).length,0,'no hay sondeo por reloj');
 await f.root.SVLaborWriteRecovery.check();const result=await running;
 const commands=f.calls.filter(c=>c.url.endsWith('/cobranzas/operacion'));assert.equal(commands.length,2);assert.deepEqual(commands[1].body,first);assert.equal(f.commits.length,1);assert.equal(result[0].pago.fbKey,'pago-fixture');assert.equal(f.storage.size,0);assert.equal(f.holds,0);
});

test('editar el payload de un intento en curso no reserva otra operación',async()=>{
 const f=fixture({mode:'loss-once'}),o=options(),running=f.root.SVFinancialCommands.register(o);await until(()=>f.root.SVLaborWriteRecovery.state());
 o.solicitudes[0].monto=41;await assert.rejects(f.root.SVFinancialCommands.register(o),{code:'SV_PAYMENT_ATTEMPT_CHANGED'});assert.equal(f.commits.length,1);
 o.solicitudes[0].monto=40;await f.root.SVLaborWriteRecovery.check();await running;assert.equal(f.commits.length,1);
});

for(const mode of ['forbidden','unavailable','balance-changed','index-unready'])test('un rechazo previo al commit no abre recovery ni habilita fallback: '+mode,async()=>{
 const f=fixture({mode}),running=f.root.SVFinancialCommands.register(options());
 await assert.rejects(running,error=>error.svFinancialRejected===true);assert.equal(f.root.SVLaborWriteRecovery.state(),null);
 assert.equal(f.calls.length,2);assert.equal(f.commits.length,0);assert.equal(f.holds,0);assert.equal(f.storage.size,0);
});

test('rechazo definitivo permite corregir datos del mismo formulario con un ID nuevo',async()=>{
 const f=fixture({mode:'balance-changed'}),o=options();await assert.rejects(f.root.SVFinancialCommands.register(o),{code:'SV_PAYMENT_BALANCE_CHANGED'});
 const first=f.calls[1].body.id;o.solicitudes[0].monto=41;f.setMode('ok');await f.root.SVFinancialCommands.register(o);
 assert.notEqual(f.calls.at(-1).body.id,first);assert.equal(f.commits.length,1);assert.equal(f.root.SVLaborWriteRecovery.state(),null);
});

test('503 desconocido continúa pendiente hasta comprobar que no hubo commit; retry no reusa tombstone',async()=>{
 const f=fixture({mode:'unknown503'}),o=options(),running=f.root.SVFinancialCommands.register(o);await until(()=>f.root.SVLaborWriteRecovery.state());
 const first=f.calls[1].body.id,rejected=assert.rejects(running,{code:'SV_LABOR_REJECTED'});await f.root.SVLaborWriteRecovery.check();await rejected;
 f.setMode('ok');await f.root.SVFinancialCommands.register(o);assert.notEqual(f.calls.at(-1).body.id,first);assert.equal(f.commits.length,1);assert.equal(f.holds,0);
});

test('rechazo DUPLICATE de gasto se devuelve sin lectura legacy ni overlay incierto',async()=>{
 const f=fixture({mode:'expense-duplicate'});await assert.rejects(f.root.SVFinancialCommands.createExpense({monto:40},null,'complete'),error=>error.code==='SV_GASTO_DUPLICATE'&&error.svFinancialRejected===true);
 assert.equal(f.calls.length,2);assert.equal(f.commits.length,0);assert.equal(f.root.SVLaborWriteRecovery.state(),null);assert.equal(f.holds,0);
});

test('sesión cambiada mientras llegan capacidades no inicia un comando financiero',async()=>{
 const f=fixture();let release;f.slots.caps=new Promise(resolve=>release=resolve);const running=f.root.SVFinancialCommands.register(options());await until(()=>f.calls.length===1);
 f.root.fbAuth.currentUser={uid:'otro'};f.root.currentUserUid='otro';release();await assert.rejects(running,{code:'SV_LABOR_SESSION'});assert.equal(f.calls.length,1);assert.equal(f.commits.length,0);assert.equal(f.holds,0);
});

for(const change of [f=>{f.root._impersonacionOriginal={uid:'u'};},f=>{f.root.fbAuth.currentUser={uid:'otro'};},f=>{f.root.currentRole='administrativo';},f=>{f.root.PERMISOS_ROLES.admin.indiceRevision=2;},f=>{f.root._svOperacionesSesionEpoch=1;}])test('un acuse de otro contexto no devuelve resultados para el formulario siguiente',async()=>{
 const f=fixture();let release;f.slots.command=new Promise(resolve=>release=resolve);const running=f.root.SVFinancialCommands.register(options());await until(()=>f.calls.length===2);change(f);release();await assert.rejects(running);assert.equal(f.commits.length,1);assert.equal(f.holds,0);assert.equal(f.storage.size,0);
});

test('gasto conserva foto/proyección y usa sólo su endpoint tipado con acuse real',async()=>{
 const f=fixture(),gasto={fecha:'2026-10-22',descripcion:'Ficticio',monto:40,ts:123},foto='data:image/png;base64,AA==';
 const result=await f.root.SVFinancialCommands.createExpense(gasto,foto,'complete');assert.deepEqual(result,{key:'gasto-fixture'});
 const cmd=f.calls.find(c=>c.url.endsWith('/crear-administrativo'));assert.deepEqual(cmd.body.datos,gasto);assert.deepEqual(cmd.body.foto,foto);assert.equal(cmd.body.projection,'complete');assert.ok(cmd.body.id);assert.equal(f.commits.length,1);assert.equal(f.holds,0);
});

test('offline, Ver como y Auth incongruente rechazan antes de cualquier consulta',async()=>{
 for(const change of [f=>f.root.navigator.onLine=false,f=>f.root._impersonacionOriginal={},f=>f.root.fbAuth.currentUser={uid:'otro'}]){const f=fixture();change(f);await assert.rejects(f.root.SVFinancialCommands.register(options()));assert.equal(f.calls.length,0);assert.equal(f.commits.length,0);assert.equal(f.holds,0);}
});

test('logout conserva sólo metadata incierta y el mismo UID debe resolverla antes de otro guardado',async()=>{
 const f=fixture({mode:'loss-once'}),running=f.root.SVFinancialCommands.register(options());await until(()=>f.root.SVLaborWriteRecovery.state());
 const stopped=assert.rejects(running,{code:'SV_LABOR_SESSION'});f.root.fbAuth.currentUser=null;f.root.currentUserUid='';f.root.document.dispatchEvent({type:'sisventas:session-ended'});await stopped;
 assert.equal(f.storage.size,1);assert.equal(f.holds,0);const sent=f.calls.filter(c=>c.url.endsWith('/cobranzas/operacion')).length;
 f.root.fbAuth.currentUser={uid:'u'};f.root.currentUserUid='u';f.root.document.dispatchEvent({type:'sisventas:session-ready'});await flush();
 assert.equal(f.calls.filter(c=>c.url.endsWith('/cobranzas/operacion')).length,sent,'no se reenvía al recuperar sesión');
 await assert.rejects(f.root.SVFinancialCommands.register({...options(),grupoPago:'otro-grupo'}),{code:'SV_LABOR_PENDING_OPERATION'});assert.equal(f.commits.length,1);
 await f.root.SVLaborWriteRecovery.check();assert.equal(f.storage.size,0);assert.equal(f.commits.length,1);
 await f.root.SVFinancialCommands.register({...options(),grupoPago:'otro-grupo'});assert.equal(f.commits.length,2);assert.equal(f.holds,0);
});

for(const kind of ['annul','expense'])test(kind+': recuperación hidrata el mismo comando sin repetir commit',async()=>{
 const f=fixture({mode:'loss-once'}),running=kind==='annul'?f.root.SVFinancialCommands.annul('pago-fixture','venta-fixture',{motivo:'Ficticio',fecha:'2026-10-22'}):f.root.SVFinancialCommands.createExpense({monto:40,descripcion:'Ficticio'},null,'complete');
 await until(()=>f.root.SVLaborWriteRecovery.state());const initial=copy(f.commits[0]);await f.root.SVLaborWriteRecovery.check();await running;
 assert.equal(f.commits.length,1);const sent=f.calls.filter(c=>c.url.endsWith(kind==='annul'?'/cobranzas/operacion':'/crear-administrativo'));assert.equal(sent.length,2);assert.deepEqual(sent[1].body,initial);assert.equal(f.storage.size,0);assert.equal(f.holds,0);
});
