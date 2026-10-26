'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync('js/core/labor-writes.js','utf8');
const clone=value=>value==null?null:structuredClone(value);
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>clone(data)});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function fixture(){
 const state={sisventas:{gastos:{g:{monto:10,estado:'pendiente'}},ctaemp:{emp:{m:{monto:10}}},ventas:{v:{total:100}},pagos:{},config:{cargos:{c:{valorHora:100}}}}};
 const commands=[],direct=[],reads=[],headers=[];let sequence=0,handler=null,beforeGet=null,headerTask=null,holds=0,releases=0,viewProof=null;const proofMap=new WeakMap();
 const get=path=>path.split('/').filter(Boolean).reduce((node,key)=>node&&Object.hasOwn(node,key)?node[key]:null,state)??null;
 function put(path,value){const parts=path.split('/').filter(Boolean),last=parts.pop();let target=state;for(const key of parts)target=target[key]||={};if(value===null)delete target[last];else target[last]=clone(value);}
 const ref=(_,path='')=>({key:path.split('/').filter(Boolean).at(-1)||null,toString:()=> 'https://fixture.invalid/'+path});
 const sdk={ref,
  set(r,value){direct.push(['set',r.toString(),value]);return Promise.resolve();},update(r,value){direct.push(['update',r.toString(),value]);return Promise.resolve();},remove(r){direct.push(['remove',r.toString()]);return Promise.resolve();},
  push(r,value){const child=ref(null,new URL(r.toString()).pathname.replace(/^\//,'')+'/push-'+(++sequence)),plain=ref(null,new URL(child.toString()).pathname.replace(/^\//,''));if(value!=null)direct.push(['push',child.toString(),value]);const pending=Promise.resolve(plain);child.then=pending.then.bind(pending);child.catch=pending.catch.bind(pending);return child;},
  async get(r){const path=new URL(r.toString()).pathname.replace(/^\//,'');reads.push(path);if(beforeGet)await beforeGet(path);const snap={key:r.key,ref:r,val:()=>clone(get(path)),exists:()=>get(path)!==null};if(viewProof)proofMap.set(snap,viewProof(path));return snap;},
  runTransaction(r,fn,options){direct.push(['transaction',r.toString(),fn,options]);return Promise.resolve({committed:false});}
 };
 const user={uid:'u'},root={fbDB:{},fbAuth:{currentUser:user},currentUserUid:'u',currentRole:'admin',PERMISOS_ROLES:{admin:{indiceRevision:1}},crypto:{subtle:crypto.webcrypto.subtle,randomUUID:()=> '00000000-0000-4000-8000-'+String(++sequence).padStart(12,'0')},
  SVForegroundSession:{holdDatabase(){holds++;return ()=>{holds--;releases++;};}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://gateway.invalid'},
  SVServiceAuth:{async headers(base){headers.push(base);if(headerTask)await headerTask();return {...base,Authorization:'Bearer fixture-token'};}},
  async fetch(url,options){assert.ok(/^https:\/\/gateway\.invalid\/laboral\/(escritura|(?:cuenta|gastos|empleados|movimientos|haberes|liquidacion)\/comando)$/.test(url));assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer fixture-token');const command=JSON.parse(options.body);commands.push(command);if(handler)return handler(command,options);return commit(command);}
 };
 function commit(command){if(command.kind==='patch')for(const [path,value]of Object.entries(command.value))put(path,value);else put(command.path,command.value);return response({ok:true,committed:true,...(command.kind==='compare'?{value:get(command.path)}:{})});}
 const context={window:root,URL,TextEncoder,Uint8Array,AbortSignal,Promise};vm.createContext(context);vm.runInContext(source,context);root.SVLaborWrites.install({sdk});
 return {root,sdk,state,commands,direct,reads,headers,ref:path=>ref(null,path),get,put,commit,enableViews(fn){viewProof=fn;root.SVEmployeeAccountViews={proofs:snap=>clone(proofMap.get(snap)||{}),isProtected:ref=>!!fn(new URL(ref.toString()).pathname.slice(1)),isWriteProtected:ref=>/^sisventas\/(?:ctaemp|gastos|pagos_realizados|auditoria_pagos)(?:\/|$)/.test(new URL(ref.toString()).pathname.slice(1))};},setHandler(fn){handler=fn;},setBeforeGet(fn){beforeGet=fn;},setHeaders(fn){headerTask=fn;},get holds(){return holds;},get releases(){return releases;}};
}

test('instalar es idempotente y las rutas ajenas conservan el SDK sin llamadas al gateway',async()=>{
 const f=fixture(),wrapped=f.root.fbSet;f.root.SVLaborWrites.install({sdk:f.sdk});assert.equal(f.root.fbSet,wrapped);
 await f.root.fbSet(f.ref('sisventas/clientes/c'),{nombre:'Ficticio'});await f.root.fbUpdate(f.ref('sisventas/config'),{tipoCambio:{usd:100}});
 await f.root.fbRemove(f.ref('sv_chat/c/m'));await f.root.fbRunTransaction(f.ref('sv_chat/c/m'),()=>undefined,{applyLocally:false});
 assert.deepEqual(f.direct.map(x=>x[0]),['set','update','remove','transaction']);assert.equal(f.commands.length,0);assert.equal(f.holds,0);
 for(const path of ['sisventas/gastos/g','sisventas/ventas/v','sisventas/pagos/p','sisventas/config/cargos/c','sisventas',''])assert.equal(f.root.SVLaborWrites.intersects(f.ref(path)),true);
 assert.equal(f.root.SVLaborWrites.intersects(f.ref('sisventas/gastos_extra/g')),false);
});

test('set y remove vigilados sólo usan gateway y admiten valores de servidor',async()=>{
 const f=fixture();await f.root.fbSet(f.ref('sisventas/gastos/g'),{monto:20,ts:{'.sv':'timestamp'}});await f.root.fbRemove(f.ref('sisventas/ctaemp/emp/m'));
 assert.deepEqual(f.commands.map(c=>[c.kind,c.path]),[['set','sisventas/gastos/g'],['set','sisventas/ctaemp/emp/m']]);assert.equal(f.commands[1].value,null);
 assert.equal(f.direct.length,0);assert.equal(f.get('sisventas/gastos/g').monto,20);assert.equal(f.get('sisventas/ctaemp/emp/m'),null);assert.equal(f.releases,2);
});

test('push reserva una clave local y mantiene ThenableReference sin escritura SDK ni ciclo de promesa',async()=>{
 const f=fixture(),reserved=f.root.fbPush(f.ref('sisventas/gastos'));assert.ok(reserved.key);assert.equal((await reserved).key,reserved.key);assert.equal(f.commands.length,0);
 const started=deferred(),finish=deferred();f.setHandler(async command=>{started.resolve();await finish.promise;return f.commit(command);});
 const pending=f.root.fbPush(f.ref('sisventas/gastos'),{monto:30});assert.ok(pending.key);assert.equal(typeof pending.then,'function');assert.equal(typeof pending.catch,'function');await started.promise;
 assert.equal(f.holds,1);assert.equal(f.get('sisventas/gastos/'+pending.key),null);finish.resolve();const saved=await pending;
 assert.equal(saved.key,pending.key);assert.equal(saved.then,undefined);assert.equal(f.get('sisventas/gastos/'+pending.key).monto,30);assert.equal(f.direct.length,0);assert.equal(f.holds,0);
});

test('patch de raíz expande rutas relativas y conserva una sola escritura con todos sus acompañantes',async()=>{
 const f=fixture();await f.root.fbUpdate(f.ref(''),{'sisventas/gastos/g/monto':25,'sisventas/ctaemp/emp/m/monto':25,'sisventas/ventas/v/comisionesGeneradas':true,'sisventas/clientes/c/nota':'Conservar junto'});
 assert.equal(f.commands.length,1);assert.equal(f.commands[0].kind,'patch');assert.equal(f.commands[0].path,'');assert.equal(f.commands[0].value['sisventas/clientes/c/nota'],'Conservar junto');
 await f.root.fbUpdate(f.ref('sisventas/config'),{'cargos/c/valorHora':150,tipoCambio:{usd:100}});
 assert.deepEqual(f.commands[1].value,{'sisventas/config/cargos/c/valorHora':150,'sisventas/config/tipoCambio':{usd:100}});assert.equal(f.direct.length,0);
});

test('root replace y transacción de ancestro fallan antes de GET y sin fallback directo',async()=>{
 const f=fixture();for(const path of ['','sisventas','sisventas/config']){
  await assert.rejects(f.root.fbSet(f.ref(path),{}),{code:'SV_LABOR_SCOPED_REQUIRED'});await assert.rejects(f.root.fbRunTransaction(f.ref(path),()=>({})),{code:'SV_LABOR_SCOPED_REQUIRED'});
 }
 await assert.rejects(f.root.fbUpdate(f.ref(''),{sisventas:{gastos:{}}}),{code:'SV_LABOR_SCOPED_REQUIRED'});
 assert.deepEqual(f.reads,[]);assert.deepEqual(f.commands,[]);assert.deepEqual(f.direct,[]);assert.equal(f.holds,0);
});

test('compare hashea el snapshot previo canónico antes de un callback que muta y devuelve el valor confirmado',async()=>{
 const f=fixture();f.put('sisventas/gastos/g',{z:2,a:1});f.setHandler(command=>{assert.equal(command.expectedHash,crypto.createHash('sha256').update('{"a":1,"z":2}').digest('hex'));return response({ok:true,committed:true,value:{...command.value,ts:500}});});
 const result=await f.root.fbRunTransaction(f.ref('sisventas/gastos/g'),current=>{current.a++;return current;});
 assert.equal(result.committed,true);assert.deepEqual(clone(result.snapshot.val()),{z:2,a:2,ts:500});assert.equal(result.snapshot.child('a').val(),2);
 assert.equal(result.snapshot.key,'g');assert.equal(result.snapshot.size,3);const children=[];result.snapshot.forEach(child=>{children.push(child.key);});assert.deepEqual(children.sort(),['a','ts','z']);
 result.snapshot.val().a=99;assert.equal(result.snapshot.val().a,2);assert.equal(f.commands.length,1);assert.equal(f.direct.length,0);
});

test('compare permite snapshot null y callback undefined aborta sin POST',async()=>{
 const f=fixture(),aborted=await f.root.fbRunTransaction(f.ref('sisventas/gastos/missing'),current=>{assert.equal(current,null);return undefined;});
 assert.equal(aborted.committed,false);assert.equal(aborted.snapshot.val(),null);assert.equal(f.commands.length,0);
 const created=await f.root.fbRunTransaction(f.ref('sisventas/gastos/new'),current=>current||{monto:5});assert.equal(created.snapshot.val().monto,5);
 assert.equal(f.commands[0].expectedHash,crypto.createHash('sha256').update('null').digest('hex'));
});

test('sólo un conflicto CAS explícito relee y vuelve a ejecutar el callback con ID nuevo',async()=>{
 const f=fixture();let callbacks=0;f.setHandler(command=>{if(f.commands.length===1){f.put(command.path,{monto:50,ajeno:true});return response({ok:false,code:'SV_CAS_CONFLICT'},409);}return f.commit(command);});
 const result=await f.root.fbRunTransaction(f.ref('sisventas/gastos/g'),current=>{callbacks++;return {...current,monto:current.monto+1};});
 assert.equal(result.snapshot.val().monto,51);assert.equal(result.snapshot.val().ajeno,true);assert.equal(callbacks,2);assert.equal(f.reads.length,2);
 assert.notEqual(f.commands[0].id,f.commands[1].id);assert.equal(f.holds,0);
});

test('CAS se limita a tres intentos y red, permisos u otros409 no se reintentan ni caen al SDK',async()=>{
 for(const mode of ['cas','red','permiso','otro409']){
  const f=fixture();f.setHandler(()=>{if(mode==='red')throw Error('Failed to fetch');return response({ok:false,code:mode==='cas'?'SV_CAS_CONFLICT':'OTRO',mensaje:'Fallo ficticio'},mode==='permiso'?403:409);});
  await assert.rejects(f.root.fbRunTransaction(f.ref('sisventas/gastos/g'),current=>({...current,monto:20})));
  assert.equal(f.commands.length,mode==='cas'?3:1);assert.equal(f.reads.length,mode==='cas'?3:1);assert.equal(f.direct.length,0);assert.equal(f.holds,0);
 }
});

test('callbacks con error o asincrónicos no envían cambios ni modifican el snapshot original',async()=>{
 for(const callback of [()=>{throw Error('Validación ficticia');},async()=>({monto:20}),async()=>{throw Error('Asíncrono inválido');}]){
  const f=fixture();await assert.rejects(f.root.fbRunTransaction(f.ref('sisventas/gastos/g'),callback));assert.equal(f.commands.length,0);assert.equal(f.get('sisventas/gastos/g').monto,10);assert.equal(f.holds,0);
 }
});

test('sesión ajena, ausente o Ver como no leen ni escriben',async()=>{
 for(const change of [r=>{r.currentUserUid='otro';},r=>{r.fbAuth.currentUser=null;},r=>{r._impersonacionOriginal={uid:'u'};}]){
  const f=fixture();change(f.root);await assert.rejects(f.root.fbSet(f.ref('sisventas/gastos/g'),{monto:20}));await assert.rejects(f.root.fbRunTransaction(f.ref('sisventas/gastos/g'),()=>({monto:20})));
  assert.equal(f.reads.length,0);assert.equal(f.commands.length,0);assert.equal(f.direct.length,0);
 }
});

test('cambiar sesión, rol o permisos durante headers impide iniciar el POST',async()=>{
 for(const change of [r=>{r.currentUserUid='otro';},r=>{r.currentRole='vendedor';},r=>{r.PERMISOS_ROLES.admin.indiceRevision++;},r=>{r._impersonacionOriginal={uid:'u'};}]){
  const f=fixture(),started=deferred(),finish=deferred();f.setHeaders(async()=>{started.resolve();await finish.promise;});const pending=f.root.fbSet(f.ref('sisventas/gastos/g'),{monto:20});await started.promise;change(f.root);finish.resolve();
  await assert.rejects(pending);assert.equal(f.commands.length,0);assert.equal(f.holds,0);
 }
});

test('respuesta tardía de otra sesión no confirma UI ni reintenta un guardado ya enviado',async()=>{
 for(const change of [r=>{r.fbAuth.currentUser=null;},r=>{r.currentRole='vendedor';},r=>{r._svOperacionesSesionEpoch=1;}]){
  const f=fixture(),started=deferred(),finish=deferred();f.setHandler(async command=>{started.resolve();await finish.promise;return f.commit(command);});
  const pending=f.root.fbRunTransaction(f.ref('sisventas/gastos/g'),current=>({...current,monto:20}));await started.promise;change(f.root);finish.resolve();
  await assert.rejects(pending,{code:'SV_LABOR_SESSION'});assert.equal(f.commands.length,1);assert.equal(f.get('sisventas/gastos/g').monto,20);assert.equal(f.holds,0);
 }
});

test('ocultar la pantalla no cancela una escritura iniciada y mantiene el hold hasta su confirmación',async()=>{
 const f=fixture(),started=deferred(),finish=deferred();f.setHandler(async(command,options)=>{started.resolve();await finish.promise;assert.equal(options.signal.aborted,false);return f.commit(command);});
 const pending=f.root.fbSet(f.ref('sisventas/pagos/p'),{monto:100});await started.promise;f.root.document={hidden:true};assert.equal(f.holds,1);finish.resolve();await pending;assert.equal(f.holds,0);assert.equal(f.commands.length,1);
});

test('restTransaction comercial delegable conserva resultado y no necesita descargar sisventas',async()=>{
 const f=fixture(),result=await f.root.SVLaborWrites.restTransaction(f.ref('sisventas/ventas/v'),sale=>({...sale,costoTotal:40}));
 assert.equal(result.committed,true);assert.equal(result.value.costoTotal,40);assert.deepEqual(f.reads,['sisventas/ventas/v']);assert.equal(f.commands[0].kind,'compare');
 const all=await f.root.fbRunTransaction(f.ref('sisventas/ventas'),sales=>({...sales,other:{total:50}}));assert.equal(all.snapshot.val().other.total,50);assert.ok(!f.reads.includes('sisventas'));
});

test('datos inválidos, rutas superpuestas y tamaño excesivo no llegan al gateway',async()=>{
 const f=fixture();for(const value of [undefined,{monto:NaN},{monto:undefined},{'clave/inválida':1},{foto:'x'.repeat(17*1024*1024)}])await assert.rejects(f.root.fbSet(f.ref('sisventas/gastos/g'),value));
 assert.throws(()=>f.root.fbUpdate(f.ref(''),{'sisventas/gastos/g':{},'sisventas/gastos/g/monto':1}),{code:'SV_LABOR_PATH'});
 assert.equal(f.commands.length,0);assert.equal(f.direct.length,0);assert.equal(f.holds,0);
});

test('compare sin snapshot confirmado rechaza y el fallo al liberar hold no cambia un éxito',async()=>{
 const f=fixture();f.setHandler(()=>response({ok:true,committed:true}));await assert.rejects(f.root.fbRunTransaction(f.ref('sisventas/gastos/g'),g=>g),{code:'SV_LABOR_UNCONFIRMED'});
 f.root.SVForegroundSession.holdDatabase=()=>()=>{throw Error('UI retirada');};await f.root.fbSet(f.ref('sisventas/gastos/g'),{monto:20});assert.equal(f.commands.length,2);
});

test('metadatos laborales y trabajos de comisión exclusivos de servidor nunca pasan al SDK ni al gateway',async()=>{
 const f=fixture();for(const path of ['sv_labor_guard','sv_labor_config','sv_labor_indexes/gastos','sv_labor_receipts/id','sv_commission_generation/v','sv_commission_events/id']){
  assert.equal(f.root.SVLaborWrites.intersects(f.ref(path)),true);
  await assert.rejects(f.root.fbSet(f.ref(path),{}),{code:'SV_LABOR_SERVICE_ONLY'});await assert.rejects(f.root.fbRemove(f.ref(path)),{code:'SV_LABOR_SERVICE_ONLY'});
  await assert.rejects(f.root.fbRunTransaction(f.ref(path),()=>({})),{code:'SV_LABOR_SERVICE_ONLY'});
  assert.throws(()=>f.root.fbPush(f.ref(path),{}),{code:'SV_LABOR_SERVICE_ONLY'});assert.throws(()=>f.root.fbPush(f.ref(path)),{code:'SV_LABOR_SERVICE_ONLY'});
 }
 await assert.rejects(f.root.fbUpdate(f.ref(''),{'sisventas/gastos/g/monto':20,'sv_labor_config/ready':true}),{code:'SV_LABOR_SERVICE_ONLY'});
 assert.equal(f.get('sisventas/gastos/g').monto,10);assert.equal(f.commands.length,0);assert.equal(f.direct.length,0);assert.equal(f.reads.length,0);assert.equal(f.holds,0);
});

test('atomic verifica todos los snapshots antes de build mutable y envía un PATCH único',async()=>{
 const f=fixture(),a='sisventas/gastos/g',b='sisventas/ctaemp/emp/m';let buildCalls=0;
 const result=await f.root.SVLaborWrites.atomic({paths:[a,b],build(values){buildCalls++;values[a].monto=20;values[b].monto=20;return {[a]:values[a],[b]:values[b]};}});
 assert.equal(result.committed,true);assert.equal(result.value[a].monto,20);assert.equal(buildCalls,1);assert.equal(f.commands.length,1);assert.equal(f.commands[0].kind,'atomic');
 for(const [path,value]of [[a,{monto:10,estado:'pendiente'}],[b,{monto:10}]])assert.equal(f.commands[0].expectedHashes[path],crypto.createHash('sha256').update(f.root.SVLaborWrites.canonical(value)).digest('hex'));
 assert.equal(f.direct.length,0);assert.ok(!f.reads.includes('sisventas'));
});

test('atomic reejecuta lecturas y build sólo ante CAS y conserva un cambio concurrente',async()=>{
 const f=fixture(),path='sisventas/gastos/g';let builds=0;f.setHandler(command=>{if(f.commands.length===1){f.put(path,{monto:50,externo:true});return response({ok:false,code:'SV_CAS_CONFLICT'},409);}return f.commit({...command,kind:'patch'});});
 const result=await f.root.SVLaborWrites.atomic({paths:[path],build(values){builds++;return {[path]:{...values[path],monto:values[path].monto+1}};}});
 assert.equal(result.value[path].monto,51);assert.equal(result.value[path].externo,true);assert.equal(builds,2);assert.equal(f.reads.length,2);assert.notEqual(f.commands[0].id,f.commands[1].id);
});

test('atomic rechaza cambios vigilados sin precondición, ancestros, duplicados y más de128 fuentes',async()=>{
 for(const options of [
  {paths:['sisventas/ventas/v'],build:()=>({'sisventas/gastos/g':{monto:20}})},
  {paths:['sisventas'],build:()=>({})},
  {paths:['sisventas/gastos/g','sisventas/gastos/g'],build:()=>({})},
  {paths:Array.from({length:129},(_,i)=>'sisventas/gastos/g'+i),build:()=>({})},
  {paths:['sisventas/gastos/g'],build:async()=>({'sisventas/gastos/g':{monto:20}})}
 ]){const f=fixture();await assert.rejects(f.root.SVLaborWrites.atomic(options));assert.equal(f.commands.length,0);assert.equal(f.direct.length,0);}
 const f=fixture(),result=await f.root.SVLaborWrites.atomic({paths:['sisventas/gastos/g'],build:()=>undefined});assert.equal(result.committed,false);assert.equal(f.commands.length,0);
});

test('atomic pool seis frena fuentes nuevas ante error y espera las ya iniciadas',async()=>{
 const f=fixture(),paths=Array.from({length:20},(_,i)=>'sisventas/gastos/g'+i),gates=[];let settled=false;
 f.setBeforeGet(()=>new Promise((resolve,reject)=>gates.push({resolve,reject})));
 const pending=f.root.SVLaborWrites.atomic({paths,build:()=>({})}).then(value=>({value}),error=>({error})).finally(()=>{settled=true;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(f.reads.length,6);const failure=Error('Fuente ficticia falló');gates.shift().reject(failure);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);assert.equal(f.reads.length,6);for(const gate of gates)gate.resolve();
 const result=await pending;assert.equal(result.error,failure);assert.equal(f.reads.length,6);assert.equal(f.commands.length,0);assert.equal(f.holds,0);
});

test('compare espera primer plano antes del primer GET y no retiene DB mientras espera',async()=>{
 const f=fixture(),visible=deferred();f.root.SVForegroundSession.waitVisible=()=>visible.promise;
 const pending=f.root.fbRunTransaction(f.ref('sisventas/gastos/g'),value=>value);
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.reads,[]);assert.equal(f.holds,0);visible.resolve();await pending;assert.equal(f.reads.length,1);
});

const VIEW='sv_employee_account_views/v1/',REV='opaque-revision-1234567890';
test('view compare sends only an opaque revision and accepts a receipt without original data',async()=>{
 const f=fixture();f.enableViews(path=>path==='sisventas/gastos/g'?{[VIEW+'globalExpenses/rows/g']:REV}:null);f.setHandler(c=>response({ok:true,committed:true}));
 const result=await f.root.fbRunTransaction(f.ref('sisventas/gastos/g'),m=>({...m,estado:'aprobado'}));const c=f.commands[0];
 assert.equal(c.kind,'view-compare');assert.deepEqual(c.expectedViews,{[VIEW+'globalExpenses/rows/g']:REV});assert.equal(Object.hasOwn(c,'expectedHash'),false);assert.equal(result.snapshot.val().estado,'aprobado');assert.equal(f.direct.length,0);
});
test('projected set and scalar patch use versioned writes, never an unverified financial set',async()=>{
 const f=fixture();f.enableViews(path=>path.startsWith('sisventas/gastos/g')?{[VIEW+'globalExpenses/rows/g']:REV}:null);f.setHandler(()=>response({ok:true,committed:true}));
 await f.root.fbSet(f.ref('sisventas/gastos/g/estado'),'aprobado');await f.root.fbUpdate(f.ref('sisventas/gastos/g'),{estado:'aprobado',requiereAprobacion:false});assert.deepEqual(f.commands.map(c=>c.kind),['view-compare','view-atomic']);assert.equal(f.direct.length,0);
});
test('a projected source missing its proof cannot fall back to hashing its DTO',async()=>{
 const f=fixture();f.enableViews(()=>({}));await assert.rejects(f.root.fbRunTransaction(f.ref('sisventas/gastos/g'),()=>({estado:'aprobado'})),{code:'SV_ACCOUNT_VIEW_UNREADY'});assert.equal(f.commands.length,0);assert.equal(f.direct.length,0);
});
test('atomic keeps HR as read-only view preconditions, raw attachments as hashes, and nullable new receipt proofs',async()=>{
 const f=fixture();f.enableViews(path=>path==='sisventas/empleados/e'?{[VIEW+'globalEmployeeDirectory/rows/e']:REV}:path==='sisventas/pagos_realizados/new'?{[VIEW+'globalPaymentBatches/rows/new']:null}:path==='sisventas/gastos/g'?{[VIEW+'globalExpenses/rows/g']:REV}:null);f.setHandler(()=>response({ok:true,committed:true}));
 await f.root.SVLaborWrites.atomic({paths:['sisventas/gastos/g','sisventas/empleados/e','sisventas/pagos_realizados/new','sisventas/gastos_adjuntos/g'],build:()=>({'sisventas/gastos/g/estado':'pagado','sisventas/pagos_realizados/new':{monto:10}})});
 const c=f.commands[0];assert.equal(c.kind,'view-atomic');assert.equal(c.expectedViews[VIEW+'globalPaymentBatches/rows/new'],null);assert.equal(c.expectedViews[VIEW+'globalEmployeeDirectory/rows/e'],REV);assert.deepEqual(Object.keys(c.expectedHashes),['sisventas/gastos_adjuntos/g']);
});
test('collection nonce covers its rows without exhausting the 128 source cap',async()=>{
 const f=fixture();f.enableViews(path=>{if(path!=='sisventas/gastos')return null;const proofs={[VIEW+'globalExpenses']:REV};for(let i=0;i<200;i++)proofs[VIEW+'globalExpenses/rows/'+i]=REV;return proofs;});f.setHandler(()=>response({ok:true,committed:true}));
 await f.root.SVLaborWrites.atomic({paths:['sisventas/gastos'],build:()=>({'sisventas/gastos/g/estado':'aprobado'})});assert.deepEqual(f.commands[0].expectedViews,{[VIEW+'globalExpenses']:REV});
});
test('different revisions of a shared envelope retire the read before building or sending',async()=>{
 const f=fixture();let calls=0,builds=0;f.enableViews(()=>({[VIEW+'employees/emp']:'revision-'+(++calls)}));await assert.rejects(f.root.SVLaborWrites.atomic({paths:['sisventas/ctaemp/emp/m','sisventas/ctaemp/emp/n'],build:()=>{builds++;return {'sisventas/ctaemp/emp/m/estado':'aprobado'};}}),{code:'SV_CAS_CONFLICT'});assert.equal(builds,0);assert.equal(f.commands.length,0);assert.equal(f.reads.length,6);
});
test('HR metadata field updates retain the scoped patch while originals remain unread',async()=>{
 const f=fixture();f.enableViews(()=>null);await f.root.fbUpdate(f.ref('sisventas/empleados/e'),{nombre:'Ficticio'});assert.equal(f.commands[0].kind,'patch');assert.equal(f.reads.length,0);
});
test('reserved derived views cannot be written by set, patch, push or atomic',async()=>{
 const f=fixture();for(const run of [()=>f.root.fbSet(f.ref(VIEW+'employees/e'),{}),()=>f.root.fbUpdate(f.ref(''),{[VIEW+'employees/e/meta/revision']:'forged'}),()=>f.root.fbPush(f.ref(VIEW+'employees'),{}),()=>f.root.SVLaborWrites.atomic({paths:[VIEW+'employees/e'],build:()=>({})})])await assert.rejects(async()=>run(),{code:'SV_LABOR_SERVICE_ONLY'});assert.equal(f.commands.length,0);assert.equal(f.direct.length,0);
});
test('narrow commands share confirmation and recovery contract without receiving originals',async()=>{
 const f=fixture();f.setHandler(()=>response({ok:true,committed:true,gastoKey:'g'}));const result=await f.root.SVLaborWrites.command('cuenta',{action:'approve',employeeId:'emp',movementKey:'m',expectedRevision:REV});assert.equal(result.gastoKey,'g');assert.equal(f.commands[0].kind,undefined);assert.equal(f.commands[0].action,'approve');assert.equal(f.reads.length,0);assert.equal(f.direct.length,0);
 for(const resource of ['../raw','configuracion','escritura'])await assert.rejects(f.root.SVLaborWrites.command(resource,{action:'approve'}),{code:'SV_LABOR_COMMAND'});await assert.rejects(f.root.SVLaborWrites.command('cuenta',{id:'forged'}),{code:'SV_LABOR_COMMAND'});
});
test('permission changes without revision and data epochs fence commands during headers',async()=>{
 for(const change of [r=>{r.PERMISOS_ROLES.admin.acciones={empleados:{pagarMovimiento:false}};},r=>{r._svDataEpoch=1;}]){const f=fixture(),started=deferred(),end=deferred();f.setHeaders(async()=>{started.resolve();await end.promise;});const task=f.root.SVLaborWrites.command('cuenta',{action:'approve'});await started.promise;change(f.root);end.resolve();await assert.rejects(task,{code:'SV_LABOR_SESSION'});assert.equal(f.commands.length,0);}
});
