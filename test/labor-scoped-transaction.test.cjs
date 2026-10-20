'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createScopedTransaction}=require('../cotizador/labor-scoped-transaction');
const Index=require('../cotizador/labor-index');
const {createLaborSubmissions}=require('../cotizador/labor-submissions');
const {createLaborOperations}=require('../cotizador/labor-operations');
const {createPersonalExpenses,identity:expenseIdentity}=require('../cotizador/personal-expenses');
const {createCommissionOperations}=require('../cotizador/commission-operations');
const {createLaborGuard}=require('../cotizador/labor-guard');
const clone=value=>structuredClone(value),unchanged=Symbol('root-fixture-unchanged');
function valueAt(root,path){return path.split('/').reduce((node,k)=>node?.[k],root)??null;}
function apply(root,patch){
 for(const [path,value]of Object.entries(patch)){
  const parts=path.split('/');let node=root;
  for(const part of parts.slice(0,-1)){
   if(!Object.hasOwn(node,part)||!node[part]||typeof node[part]!=='object')Object.defineProperty(node,part,{value:{},writable:true,enumerable:true,configurable:true});
   node=node[part];
  }
  if(value===null)delete node[parts.at(-1)];
  else Object.defineProperty(node,parts.at(-1),{value:clone(value),writable:true,enumerable:true,configurable:true});
 }
}
function io(initial,{getHook,beforeCommit}={}){
 const store={sisventas:clone(initial),sv_labor_config:{ready:true,schema:1}};
 apply(store,Index.buildIndex(initial));let queue=Promise.resolve(),active=0,epoch=0,finish=0;
 const reads=[],writes=[],actors=[];
 const guard={run(actor,fn){
  const job=queue.then(async()=>{
   const token=++epoch;active=token;actors.push(actor);const staged={};
   try{
    const result=await fn({
     get:async path=>{
      assert.equal(active,token,'lectura fuera del fence');
      assert.ok(!['sisventas','sisventas/gastos','sisventas/ctaemp','sisventas/hsextra_solicitudes','sisventas/empleados','sisventas/config'].includes(path),'No leer ramas completas');
      reads.push(path);await getHook?.(path,store);return clone(valueAt(store,path));
     },
     update:async patch=>{
      if(active!==token)throw Object.assign(Error('Fence vencido'),{statusCode:409});
      Object.assign(staged,clone(patch));
     }
    });
    // El guard real también confirma UNCHANGED bajo fence antes de responder.
    await beforeCommit?.(store,{expire(){active=0;}});
    if(active!==token)throw Object.assign(Error('Fence vencido'),{statusCode:409});
    if(Object.keys(staged).length){
     const changes=[];for(const [path,after]of Object.entries(staged)){const parts=path.split('/');if(parts.length===3&&parts[0]==='sisventas'&&['gastos','hsextra_solicitudes'].includes(parts[1]))changes.push({domain:parts[1],key:parts[2],before:valueAt(store,path),after});}
     Object.assign(staged,Index.planIndexDelta(changes));writes.push(clone(staged));apply(store,staged);
    }
    finish++;return result;
   }finally{if(active===token)active=0;}
  });
  queue=job.catch(()=>{});return job;
 }};
 const transaction=createScopedTransaction({guard});
 return {guard,transaction,store,reads,writes,actors,finished:()=>finish,state:()=>clone(store.sisventas),expire:()=>{active=0;},mutate(fn){fn(store.sisventas);delete store.sv_labor_indexes;apply(store,Index.buildIndex(store.sisventas));}};
}
function rootIo(initial){
 let state=clone(initial),queue=Promise.resolve();
 return {state:()=>clone(state),mutate:fn=>fn(state),transaction(fn){const job=queue.then(()=>{const next=fn(clone(state),{UNCHANGED:unchanged});if(next===unchanged)return{committed:true,unchanged:true};if(next==null)return{committed:false};state=next;return{committed:true};});queue=job.catch(()=>{});return job;}};
}
function service(factory,transaction){return factory({auth:{},db:{},transaction,now:()=>1791806400000});}
const employee={uid:'fixture-user',nombre:'Empleado ficticio',empleadoFbKey:'e',manager:false,role:'tecnico',permissionDigest:require('../cotizador/labor-guard').digest({})},admin={uid:'fixture-admin',nombre:'Admin ficticio',role:'admin',permissionDigest:require('../cotizador/labor-guard').digest({})};
const contribution=(id='ap_fixture')=>({empFbKey:'e',mes:'2026-10',aporteId:id,detalleDias:[{fecha:'2026-10-12',horas:2,lugar:'Obra ficticia'}],observaciones:'Nota ficticia'});
const expense={fecha:'2026-10-12',descripcion:'Gasto ficticio',monto:123.45};
const initial=()=>({empleados:{e:{nombre:'Empleado ficticio',cargoId:'c'},other:{nombre:'Otro empleado',cargoId:'c'}},config:{cargos:{c:{valorHoraExtra:100}},maxComisionPct:10},hsextra_solicitudes:{},gastos:{},ctaemp:{},ventas:{noTocar:{importe:123456.78}},presupuestos:{noTocar:{nota:'Ficticio'}}});
function assertIndices(f){for(const [path,value]of Object.entries(Index.buildIndex(f.state())))assert.equal(valueAt(f.store,path),value,path);}
function pending(){const state=initial();state.hsextra_solicitudes.a={empFbKey:'e',empNombre:'Empleado ficticio',mes:'2026-10',fecha:'2026-10-12',horas:2,estado:'pendiente'};return state;}

test('Aportes concurrentes y repetidos equivalen al reducer raíz sin leer historiales ajenos',async()=>{
 const f=io(initial()),old=rootIo(initial()),api=service(createLaborSubmissions,f.transaction),reference=service(createLaborSubmissions,old.transaction);
 for(const target of [api,reference])await Promise.all([target.submit(employee,contribution('ap_a')),target.submit(employee,contribution('ap_b'))]);
 await api.submit(employee,contribution('ap_a'));await reference.submit(employee,contribution('ap_a'));
 assert.deepEqual(f.state(),old.state());assert.equal(f.writes.length,2);assert.equal(f.finished(),3);assertIndices(f);
 assert.equal(f.actors[0].operation,'solicitar-horas');
 for(const patch of f.writes){assert.ok(Object.keys(patch).some(k=>k.startsWith('sv_labor_indexes/')));assert.ok(Object.keys(patch).filter(k=>k.startsWith('sisventas/')).every(k=>k.startsWith('sisventas/hsextra_solicitudes/')));}
});

test('Aporte global de otro empleado/UID y empleado inactivo conservan rechazos sin writes',async()=>{
 const state=initial();state.hsextra_solicitudes.foreign={empFbKey:'other',mes:'2026-10',estado:'pendiente',aportes:{ap_fixture:{detalleDias:contribution().detalleDias,observaciones:'Nota ficticia',enviadoUid:'other'}}};
 const f=io(state),api=service(createLaborSubmissions,f.transaction);
 await assert.rejects(api.submit(employee,contribution()),{statusCode:409});assert.deepEqual(f.state(),state);
 f.mutate(r=>{r.empleados.e.activo=false;});const inactive=f.state();
 await assert.rejects(api.submit(employee,contribution()),{statusCode:409});assert.deepEqual(f.state(),inactive);assert.equal(f.writes.length,0);
});

test('La reserva de clave respeta una solicitud de otro empleado con normalización coincidente',async()=>{
 const state=initial();state.empleados['á']={nombre:'Empleado Unicode'};
 const base='pend___202610';state.hsextra_solicitudes[base]={empFbKey:'_',mes:'2026-10',estado:'pendiente',horas:1};
 const f=io(state),old=rootIo(state),body={...contribution(),empFbKey:'á'},who={...employee,empleadoFbKey:'á'};
 await service(createLaborSubmissions,f.transaction).submit(who,body);await service(createLaborSubmissions,old.transaction).submit(who,body);
 assert.deepEqual(f.state(),old.state());assertIndices(f);
 assert.ok(f.reads.some(p=>p.includes('sisventas/hsextra_solicitudes/pend_')));
});

test('Aprobar horas crea gasto y estados en un mismo PATCH; reenvío conserva autor/importes',async()=>{
 const state=pending(),f=io(state),old=rootIo(state),body={claves:['a'],monto:200};
 for(const [backend,reference]of [[f,false],[old,true]]){
  const api=service(createLaborOperations,backend.transaction);await api.approve(admin,body);await api.approve({...admin,nombre:'Otro aprobador'},body);
 }
 assert.deepEqual(f.state(),old.state());assert.equal(f.writes.length,1);assert.equal(f.finished(),2);assertIndices(f);
 assert.ok(Object.hasOwn(f.writes[0],'sisventas/gastos/hextra_a'));assert.ok(Object.hasOwn(f.writes[0],'sisventas/hsextra_solicitudes/a'));
});

test('Aprobación individual conserva destino legacy y no reescribe gasto pagado existente',async()=>{
 const state=pending();state.gastos.legacy={legacyKey:'hsextra_solicitudes/a',monto:200,montoPagado:200,estado:'pagado',aprobadoPor:'Autor original'};
 const f=io(state),old=rootIo(state),body={claves:['a'],monto:200,individual:true};
 await service(createLaborOperations,f.transaction).approve(admin,body);await service(createLaborOperations,old.transaction).approve(admin,body);
 assert.deepEqual(f.state(),old.state());assert.deepEqual(f.state().gastos.legacy,state.gastos.legacy);assertIndices(f);
 assert.equal(Object.keys(f.writes[0]).some(p=>p==='sisventas/gastos/legacy'),false);
});

test('Gasto faltante, solicitud rechazada y tarifa cambiada no confirman aprobación',async()=>{
 for(const change of [s=>{s.config.cargos.c.valorHoraExtra=101;},s=>{s.hsextra_solicitudes.a.estado='rechazado';}]){
  const state=pending();change(state);const f=io(state);await assert.rejects(service(createLaborOperations,f.transaction).approve(admin,{claves:['a'],monto:200}),{statusCode:409});assert.equal(f.writes.length,0);assert.deepEqual(f.state(),state);
 }
 const f=io(pending()),api=service(createLaborOperations,f.transaction);await api.approve(admin,{claves:['a'],monto:200});f.mutate(s=>{delete s.gastos.hextra_a;});const before=f.state();
 await assert.rejects(api.approve(admin,{claves:['a'],monto:200}),{statusCode:409});assert.deepEqual(f.state(),before);assert.equal(f.writes.length,1);
});

test('Gasto nuevo usa firma normalizada real, conserva adjunto y repeticiones no duplican',async()=>{
 const f=io(initial()),old=rootIo(initial()),body={...expense,descripcion:'  Gasto ficticio  ',proveedor:'x'.repeat(500),fotoBase64:'data:image/png;base64,QQ==',fotoAdjunta:true};
 const api=service(createPersonalExpenses,f.transaction),reference=service(createPersonalExpenses,old.transaction);
 const result=await api.submit(employee,body);assert.deepEqual(result,await reference.submit(employee,body));assert.deepEqual(await api.submit(employee,body),await reference.submit(employee,body));
 assert.deepEqual(f.state(),old.state());assert.equal(f.writes.length,1);assertIndices(f);assert.equal(f.state().gastos[result.key].proveedor.length,500);
});

for(const [emp,legacyId]of [['e',' e '],['1',1]])test('Índice de identidad preserva duplicado legacy con empleadoId '+JSON.stringify(legacyId),async()=>{
 const state=initial();state.empleados[emp]={nombre:'Empleado ficticio'};state.gastos.legacy={...expense,tipo:'Variable',empleadoId:legacyId,usuarioUid:'otro'};
 const who={...employee,empleadoFbKey:emp},f=io(state);
 await assert.rejects(service(createPersonalExpenses,f.transaction).submit(who,expense),{statusCode:409});assert.deepEqual(f.state(),state);assert.equal(f.writes.length,0);
});

test('Gasto legacy propio se reutiliza y revalida empleado vivo',async()=>{
 const state=initial();state.gastos.legacy={...expense,tipo:'Variable',empleadoId:'e',usuarioUid:employee.uid,montoPagado:123.45,estado:'pagado'};
 const f=io(state),api=service(createPersonalExpenses,f.transaction);assert.deepEqual(await api.submit(employee,expense),{committed:true,key:'legacy'});assert.equal(f.writes.length,0);assert.equal(f.finished(),1);
 f.mutate(s=>{s.empleados.e.activo=false;});const before=f.state();await assert.rejects(api.submit(employee,expense),{statusCode:403});assert.deepEqual(f.state(),before);
});

test('Lecturas paralelas mantienen la primera coincidencia del índice aunque respondan en otro orden',async()=>{
 const state=initial();state.gastos.a={...expense,tipo:'Variable',empleadoId:'e',usuarioUid:employee.uid};state.gastos.b={...state.gastos.a,usuarioUid:'otro'};
 const f=io(state,{getHook:async path=>{if(path==='sisventas/gastos/a')await new Promise(setImmediate);}}),old=rootIo(state);
 assert.deepEqual(await service(createPersonalExpenses,f.transaction).submit(employee,expense),await service(createPersonalExpenses,old.transaction).submit(employee,expense));assert.equal(f.writes.length,0);
 const requests=initial();requests.hsextra_solicitudes.a={empFbKey:'e',mes:'2026-10',fecha:'2026-10-12',estado:'pendiente',horas:1};requests.hsextra_solicitudes.b={...requests.hsextra_solicitudes.a};
 const hours=io(requests,{getHook:async path=>{if(path==='sisventas/hsextra_solicitudes/a')await new Promise(setImmediate);}}),reference=rootIo(requests);
 await service(createLaborSubmissions,hours.transaction).submit(employee,contribution());await service(createLaborSubmissions,reference.transaction).submit(employee,contribution());assert.deepEqual(hours.state(),reference.state());assert.equal(hours.state().hsextra_solicitudes.b.horas,1);
});

function commissionState(){
 const state=initial();state.gastos.a={tipoPagable:'comision',ventaFbKey:'v',ventaId:'V FICTICIA',gananciaBase:1000,pct:4,monto:40,estado:'pendiente_aprobacion',legacyKey:'ctaemp/e/m'};
 state.gastos.b={tipoPagable:'comision',ventaFbKey:'v',ventaId:'V FICTICIA',gananciaBase:1000,pct:4,monto:40,montoPagado:40,estado:'pagado'};
 state.ctaemp.e={m:{pct:4,monto:40,gananciaBase:1000}};
 const body={grupo:{clave:'v',items:Object.entries(state.gastos).map(([fbKey,g])=>({...g,fbKey}))},valores:[{fbKey:'a',pct:5}],movimientos:{a:clone(state.ctaemp.e.m)}};
 return {state,body};
}
test('Redistribuir conserva pagados, base e historial y actualiza movimiento/índices juntos',async()=>{
 const {state,body}=commissionState(),f=io(state),old=rootIo(state);
 await service(createCommissionOperations,f.transaction).redistribute(admin,body);await service(createCommissionOperations,old.transaction).redistribute(admin,body);
 assert.deepEqual(f.state(),old.state());assert.deepEqual(f.state().gastos.b,state.gastos.b);assertIndices(f);assert.equal(f.writes.length,1);
 for(const p of ['sisventas/gastos/a','sisventas/ctaemp/e/m'])assert.ok(Object.hasOwn(f.writes[0],p));
});

for(const reference of [7,true])test('Membresía normalizada incluye referencias legacy '+JSON.stringify(reference),async()=>{
 const state=initial(),group=String(reference);state.gastos.a={tipoPagable:'comision',ventaFbKey:group,monto:40,pct:4,gananciaBase:1000,estado:'pendiente_aprobacion'};state.gastos.b={...state.gastos.a,ventaFbKey:reference};
 const f=io(state),body={grupo:{clave:group,items:[{...state.gastos.a,fbKey:'a'}]},valores:[{fbKey:'a',pct:7}],movimientos:{}};
 await assert.rejects(service(createCommissionOperations,f.transaction).redistribute(admin,body),{statusCode:409});assert.equal(f.writes.length,0);assert.deepEqual(f.state(),state);
});

test('Pago concurrente reflejado antes del lock invalida reparto y no reescribe pagos',async()=>{
 const {state,body}=commissionState();state.ctaemp.e.m.pagos={p:{monto:10}};const f=io(state);
 await assert.rejects(service(createCommissionOperations,f.transaction).redistribute(admin,body),{statusCode:409});assert.deepEqual(f.state(),state);assert.equal(f.writes.length,0);
});

test('Índice no preparado o corrupto falla cerrado antes del callback y de escribir',async()=>{
 for(const change of [f=>{f.store.sv_labor_config.ready=false;},f=>{f.store.sv_labor_config.schema=2;},f=>{apply(f.store,{[Index.bucketPath('hsextra_solicitudes','aporteId','ap_fixture')+'/ghost']:true});},f=>{apply(f.store,{[Index.bucketPath('hsextra_solicitudes','aporteId','ap_fixture')+'/ghost']:false});}]){
  const f=io(initial());change(f);const before=f.state();await assert.rejects(service(createLaborSubmissions,f.transaction).submit(employee,contribution()),e=>[409,503].includes(e.statusCode));assert.deepEqual(f.state(),before);assert.equal(f.writes.length,0);
 }
});

test('Referencia de gasto determinista ocupada no se sobrescribe para reparar datos',async()=>{
 const normalized={...expense,tipo:'Variable',empleadoId:'e'},target='gasto_'+crypto.createHash('sha256').update(expenseIdentity(normalized)).digest('hex');
 const state=initial();state.gastos[target]={descripcion:'Gasto distinto pagado',monto:999,estado:'pagado'};const f=io(state);
 await assert.rejects(service(createPersonalExpenses,f.transaction).submit(employee,expense),{statusCode:409});assert.deepEqual(f.state(),state);assert.equal(f.writes.length,0);
});

test('Callback no puede modificar empleado/configuración ni otra rama fuera de su readset',async()=>{
 for(const change of [root=>{root.config.maxComisionPct=100;},root=>{root.gastos.inventado={monto:1};},root=>{root.ventas={borrado:true};}]){
  const f=io(initial()),before=f.state();await assert.rejects(f.transaction(root=>{change(root);return root;},{kind:'solicitar-horas',identity:employee,body:contribution()}),{statusCode:409});assert.deepEqual(f.state(),before);assert.equal(f.writes.length,0);
 }
});

test('El guard vuelve a confirmar el fence también cuando el reducer devuelve UNCHANGED',async()=>{
 const f=io(initial()),api=service(createLaborSubmissions,f.transaction);await api.submit(employee,contribution());
 await assert.rejects(f.transaction((root,control)=>{f.expire();return control.UNCHANGED;},{kind:'solicitar-horas',identity:employee,body:contribution()}),{statusCode:409});assert.equal(f.writes.length,1);assert.equal(f.finished(),1);
});

test('Error de una lectura espera a las ya enviadas antes de abandonar el fence',async()=>{
 let complete,slowStarted=false,finished=false;
 const deferred=new Promise(resolve=>{complete=resolve;}),state=pending();state.hsextra_solicitudes.b={...state.hsextra_solicitudes.a};
 const f=io(state,{getHook:async path=>{if(path==='sisventas/hsextra_solicitudes/a'){await Promise.resolve();throw Error('Error ficticio');}if(path==='sisventas/hsextra_solicitudes/b'){slowStarted=true;await deferred;}}});
 const promise=service(createLaborOperations,f.transaction).approve(admin,{claves:['a','b'],monto:400}).finally(()=>{finished=true;});
 for(let i=0;i<20&&!slowStarted;i++)await Promise.resolve();assert.equal(slowStarted,true);assert.equal(finished,false);
 complete();await assert.rejects(promise,/Error ficticio/);assert.equal(f.writes.length,0);assert.equal(f.finished(),0);
});

test('El volumen de ventas/fotos ajenas no aparece en las lecturas ni en el PATCH laboral',async()=>{
 const state=pending();state.ventas.ajena={imagen:'x'.repeat(2*1024*1024)};state.gastos.ajeno={descripcion:'Ajeno',fotoBase64:'x'.repeat(2*1024*1024),monto:999};
 const f=io(state);await service(createLaborOperations,f.transaction).approve(admin,{claves:['a'],monto:200});
 assert.equal(f.reads.includes('sisventas/ventas/ajena'),false);assert.equal(f.reads.includes('sisventas/gastos/ajeno'),false);assert.ok(Buffer.byteLength(JSON.stringify(f.writes[0]))<10000);
 assert.deepEqual(f.state().ventas,state.ventas);assert.deepEqual(f.state().gastos.ajeno,state.gastos.ajeno);
});

test('Los cuatro servicios integran guard real: negocio, índices y recibo comparten un único commit fenced',async()=>{
 const {state,body}=commissionState();state.hsextra_solicitudes=pending().hsextra_solicitudes;
 const store={sisventas:clone(state),sv_labor_config:{ready:true,schema:1}};apply(store,Index.buildIndex(state));
 const calls={reads:[],commits:[],aborts:[]};let seq=0;
 const guard=createLaborGuard({now:()=>1000,uuid:()=> 'fixture-operation-'+(++seq),delay:async()=>{},store:{
  async read(path){assert.ok(!['sisventas','sisventas/gastos','sisventas/ctaemp','sisventas/empleados','sisventas/hsextra_solicitudes'].includes(path),path);calls.reads.push(path);return clone(valueAt(store,path));},
  async acquire(lease){assert.equal(store.sv_labor_guard??null,null);store.sv_labor_guard=clone(lease);},
  async commit(patch,lease){assert.equal(store.sv_labor_guard.fence,lease.fence);assert.ok(store.sv_labor_guard.expiresAt>1000);assert.equal(patch.sv_labor_guard,null);assert.ok(Object.hasOwn(patch,'sv_labor_receipts/'+lease.opId));calls.commits.push(clone(patch));apply(store,patch);},
  async abort(lease){calls.aborts.push(lease.fence);if(store.sv_labor_guard?.fence===lease.fence)delete store.sv_labor_guard;}
 }}),transaction=createScopedTransaction({guard}),old=rootIo(state);
 async function run(factory,method,actor,input){
  const result=await service(factory,transaction)[method](actor,input),reference=await service(factory,old.transaction)[method](actor,input);
  assert.deepEqual(result,reference);assert.deepEqual(store.sisventas,old.state());
 }
 await run(createLaborSubmissions,'submit',employee,contribution());
 await run(createLaborOperations,'approve',admin,{claves:['a'],monto:400});
 await run(createPersonalExpenses,'submit',employee,expense);
 await run(createCommissionOperations,'redistribute',admin,body);
 assert.equal(calls.commits.length,4);assert.equal(calls.aborts.length,0);
 for(const patch of calls.commits){assert.ok(Object.keys(patch).some(p=>p.startsWith('sisventas/')));assert.ok(Object.keys(patch).some(p=>p.startsWith('sv_labor_indexes/')));}
 const before=clone(store.sisventas);
 await run(createLaborSubmissions,'submit',employee,contribution());
 assert.deepEqual(store.sisventas,before);assert.equal(calls.commits.length,5);
 assert.deepEqual(Object.keys(calls.commits.at(-1)).filter(p=>p.startsWith('sisventas/')),[]);
 for(const [path,value]of Object.entries(Index.buildIndex(store.sisventas)))assert.equal(valueAt(store,path),value);
 const operations=backend=>[
  service(createLaborSubmissions,backend).submit(employee,contribution('ap_more_a')),
  service(createLaborSubmissions,backend).submit(employee,contribution('ap_more_b')),
  service(createPersonalExpenses,backend).submit(employee,expense),
  service(createPersonalExpenses,backend).submit(employee,expense)
 ];
 await Promise.all(operations(transaction));await Promise.all(operations(old.transaction));
 assert.deepEqual(store.sisventas,old.state());assert.equal(calls.commits.length,9);
 for(const [path,value]of Object.entries(Index.buildIndex(store.sisventas)))assert.equal(valueAt(store,path),value);
});

test('Los cuatro comandos pasan al guard los claims originales verificados y nunca los guardan en el negocio',async()=>{
 const token={uid:'fixture-admin',name:'Titular ficticio',passwordAccessVersion:7,marker:'fixture-claims-only'};
 let verifications=0;
 const auth={verifyIdToken:async(value,revoked)=>{assert.equal(value,'fixture-token');assert.equal(revoked,true);verifications++;return token;}},db={ref(path){
  const ref={get:async()=>({val:()=>path.startsWith('sv_chat_roles/')?{activo:true,rol:'admin'}:path.startsWith('sv_permisos/')?{indiceRevision:12}:{p:{uid:token.uid,empleadoFbKey:'e'}}}),orderByChild(){return ref;},equalTo(){return ref;}};return ref;
 }};
 const authorizers=[createLaborSubmissions,createLaborOperations,createCommissionOperations].map(factory=>factory({auth,db}));
 const personal=createPersonalExpenses({authorize:authorizers[0].authorize});
 const identities=await Promise.all([...authorizers.map(api=>api.authorize({headers:{authorization:'Bearer fixture-token'}})),personal.authorize({headers:{authorization:'Bearer fixture-token'}})]);
 assert.equal(verifications,4);for(const identity of identities)assert.equal(identity.claims,token);
 const {state,body}=commissionState();state.hsextra_solicitudes=pending().hsextra_solicitudes;
 const f=io(state);
 await service(createLaborSubmissions,f.transaction).submit(identities[0],contribution());
 await service(createLaborOperations,f.transaction).approve(identities[1],{claves:['a'],monto:400});
 await service(createCommissionOperations,f.transaction).redistribute(identities[2],body);
 await service(createPersonalExpenses,f.transaction).submit(identities[3],expense);
 assert.equal(f.actors.length,4);for(const actor of f.actors){assert.equal(actor.claims,token);assert.equal(actor.uid,token.uid);assert.equal(actor.mode,'command');assert.equal(actor.role,'admin');assert.equal(actor.permissionRevision,12);assert.equal(actor.permissionDigest,require('../cotizador/labor-guard').digest({indiceRevision:12}));}
 assert.equal(JSON.stringify(f.state()).includes(token.marker),false);
 assert.equal(JSON.stringify(f.writes).includes('passwordAccessVersion'),false);
});

test('El fence vencido al commit no persiste el PATCH preparado ni los índices',async()=>{
 const state=pending(),f=io(state,{beforeCommit:async(_store,control)=>control.expire()});
 await assert.rejects(service(createLaborOperations,f.transaction).approve(admin,{claves:['a'],monto:200}),{statusCode:409});
 assert.equal(f.writes.length,0);assert.deepEqual(f.state(),state);
});
