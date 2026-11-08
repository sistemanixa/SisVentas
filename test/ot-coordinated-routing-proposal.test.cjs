'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Labor=require('../js/core/labor-writes'),Operational=require('../js/core/operational-writes'),Lists=require('../js/core/record-list-model'),Stock=require('../js/core/operational-read-model');
const {child,put,parts,createLaborGuard}=require('../cotizador/labor-guard'),{createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
const Delivery=require('./helpers/ot-routing-delivery-policy.cjs');
const clone=v=>v==null?null:structuredClone(v),ot='sisventas/ordenes_trabajo/o';
function fixture({coordinated=true,host=true}={}){
 let state={sv_labor_config:{schema:1,ready:true},sv_record_list_config:{schema:1,ready:true},sv_chat_roles:{u:{activo:true,rol:'admin'}},sisventas:{ordenes_trabajo:{o:{id:'OT-FICTICIA',estado:'pendiente',materiales:[],notasTecnico:{old:{texto:'Conservar'}},_svListRevision:0}},ventas:{s:{id:'V-FICTICIA',total:100}},inventario_operativo:{p:{general:3}}}},seq=0;
 const direct=[],commands=[],reads=[],commits=[],read=p=>clone(child(state,parts(p))),set=(p,v)=>{state=put(state,parts(p),clone(v));};
 const ref=(_,p='')=>({key:p.split('/').at(-1)||null,toString:()=>p});
 let beforeSend,commitError,prepare=async()=>{};
 const store={read:async p=>read(p),readAsUser:async p=>read(p),query:async(p,field,value)=>Object.fromEntries(Object.entries(read(p)||{}).filter(([,row])=>row?.[field]===value)),acquire:async lease=>set('sv_labor_guard',lease),abort:async()=>set('sv_labor_guard',null),commit:async(patch,lease,actor)=>{
  if(commitError)throw commitError;await Delivery.claims({patch,lease,actor,read:async p=>read(p)});commits.push(clone(patch));for(const[p,v]of Object.entries(patch))set(p,v);
 }};
 const guard=createLaborGuard({store,operationalSummaries:true,delay:async()=>{}});
 // H7-enabled affects routing; full H7 projection coverage is verified separately below.
 const gateway=createLaborWriteGateway({guard:{...guard,affects:p=>guard.affects(p)||/^sisventas\/ordenes_trabajo\//.test(p)},store,db:{ref:p=>({get:async()=>({val:()=>read(p)})})},enabled:true});let activeGateway=gateway;
 const root={currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}},fbDB:{},PERMISOS_ROLES:{admin:{indiceRevision:1}},crypto:{subtle:crypto.webcrypto.subtle,randomUUID:()=> 'fiction-operation-'+(++seq)},SVServiceAuth:{headers:async h=>h},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fiction.invalid'},SVOperationalReadModel:Stock};
 if(host)root.SVClientAccountHost={start:async()=>{},prepareWrite:async()=>{await prepare();return coordinated;},coordinated:()=>coordinated};
 const sdk={ref,get:async r=>{const p=String(r);reads.push(p);return {val:()=>read(p)};},set:async(r,v)=>{direct.push(['set',String(r)]);set(String(r),v);},update:async(r,patch)=>{direct.push(['update',String(r)]);for(const[p,v]of Object.entries(patch))set([String(r),p].filter(Boolean).join('/'),v);},remove:async r=>{direct.push(['remove',String(r)]);set(String(r),null);},push(r,...args){const p=[String(r),'key-'+(++seq)].join('/'),plain=ref(null,p),result=ref(null,p);if(args.length){direct.push(['push',p]);set(p,args[0]);}const pending=Promise.resolve(plain);result.then=pending.then.bind(pending);result.catch=pending.catch.bind(pending);return result;},runTransaction:async(r,fn)=>{direct.push(['transaction',String(r)]);const value=fn(read(String(r)));if(value===undefined)return {committed:false};set(String(r),value);return {committed:true,snapshot:{val:()=>read(String(r))}};}};
 const captured=()=>Object.fromEntries(['set','update','push','remove','runTransaction'].map(k=>[k,root['fb'+k[0].toUpperCase()+k.slice(1)]]).concat([['get',sdk.get],['ref',ref]]));
 Object.assign(root,Object.fromEntries(Object.entries(sdk).map(([k,v])=>['fb'+k[0].toUpperCase()+k.slice(1),v])));
 root.SVRecordListWrites=Operational.create(root,Lists);root.SVRecordListWrites.install({sdk:captured()});
 root.SVOperationalWrites=Operational.create(root);root.SVOperationalWrites.install({sdk:captured()});
 root.SVLaborWrites=Labor.create(root);root.SVLaborWrites.install({sdk:captured()});
 root.fetch=async(_,options)=>{const command=JSON.parse(options.body);commands.push(command);if(beforeSend)await beforeSend(command);try{const value=await activeGateway.write({uid:'u',claims:{uid:'u'}},command);return {ok:true,status:200,json:async()=>value};}catch(error){return {ok:false,status:error.statusCode||500,json:async()=>({ok:false,code:error.code,mensaje:error.message})};}};
 return {root,ref:p=>ref(null,p),read,set,direct,commands,reads,commits,store,guard,gateway,useGateway:value=>{activeGateway=value;},setBeforeSend:fn=>{beforeSend=fn;},setCommitError:e=>{commitError=e;},setPrepare:fn=>{prepare=fn;},setMode:v=>{coordinated=v;}};
}
test('coordinated new OT push preserves thenable reference and creates one original/summary commit',async()=>{
 const f=fixture(),p=f.root.fbPush(f.ref('sisventas/ordenes_trabajo'),{id:'OT-NUEVA',estado:'pendiente',materiales:[]});assert.ok(p.key);const plain=await p;assert.equal(plain.key,p.key);assert.notEqual(plain,p);const path='sisventas/ordenes_trabajo/'+p.key;
 assert.equal(f.direct.length,0);assert.equal(f.commands.length,1);assert.equal(f.commands[0].kind,'atomic');assert.equal(f.commands[0].expectedHashes[path],await f.root.SVLaborWrites.hash(null));assert.equal(f.read(path)._svListRevision,1);assert.equal(f.read(path)._svListOperation,f.commands[0].id);assert.equal(f.read('sisventas/listados_resumen/ordenes_trabajo/'+p.key).id,'OT-NUEVA');assert.equal(f.commits.length,1);
});
test('set, update, child push without value + set, transaction and remove fields all route once',async()=>{
 const f=fixture();await f.root.fbSet(f.ref(ot+'/hora'),'09:00');await f.root.fbUpdate(f.ref(ot),{tecnico:'Persona ficticia',direccion:'Domicilio ficticio'});
 const note=f.root.fbPush(f.ref(ot+'/notasTecnico'));assert.ok(note.key);await f.root.fbSet(note,{texto:'Nota ficticia'});
 const tx=await f.root.fbRunTransaction(f.ref(ot+'/checklist'),v=>({...v,a:true}),{applyLocally:false});assert.equal(tx.committed,true);assert.deepEqual(tx.snapshot.val(),{a:true});
 await f.root.fbRemove(f.ref(ot+'/hora'));assert.equal(f.read(ot+'/hora'),null);assert.equal(f.read(ot+'/notasTecnico/old/texto'),'Conservar');assert.equal(f.read(ot+'/notasTecnico/'+note.key+'/texto'),'Nota ficticia');assert.equal(f.direct.length,0);assert.equal(f.commands.length,5);assert.equal(f.commits.length,5);assert.equal(f.read(ot)._svListRevision,5);
});
test('captured record writer bypasses stale SDK and returns server revision/operation for acta correction',async()=>{
 const f=fixture(),result=await f.root.SVRecordListWrites.records([ot],rows=>{rows[ot].nombreConformidad='Persona ficticia';return rows;});assert.equal(result.committed,true);assert.deepEqual(result.values[ot],f.read(ot));assert.equal(result.values[ot]._svListOperation,f.commands[0].id);assert.equal(f.direct.length,0);assert.equal(f.commands.length,1);
 const rest=await f.root.SVLaborWrites.restTransaction(f.ref(ot),value=>({...value,observacionesCierre:'Corrección ficticia'}));assert.equal(rest.committed,true);assert.deepEqual(rest.value,f.read(ot));
});
test('mixed originals and extra fields preserve one atomic command with every precondition',async()=>{
 const f=fixture();await f.root.fbUpdate(f.ref(''),{[ot+'/ventaFbKey']:'s','sisventas/ventas/s/otId':'o','sisventas/notificaciones/n':{texto:'Ficticia'}});
 assert.equal(f.commands.length,1);const c=f.commands[0];assert.deepEqual(Object.keys(c.expectedHashes).sort(),[ot,'sisventas/notificaciones/n','sisventas/ventas/s/otId'].sort());assert.equal(f.read(ot+'/ventaFbKey'),'s');assert.equal(f.read('sisventas/ventas/s/otId'),'o');assert.equal(f.read('sisventas/notificaciones/n/texto'),'Ficticia');assert.equal(f.direct.length,0);
});
test('mixed original records preserve full evidence and return both server summaries consistently',async()=>{
 const f=fixture(),other='sisventas/reclamos/r';f.set(other,{id:'R-FICTICIO',problema:'Antes',evidencias:{foto:{url:'https://fiction.invalid/foto'}},_svListRevision:0});
 const result=await f.root.SVRecordListWrites.records([ot,other],rows=>{rows[ot].reclamoKey='r';rows[other].problema='Actualizado';return rows;},{'sisventas/notificaciones/n':{texto:'Vinculados'}});
 assert.equal(f.commands.length,1);assert.equal(f.direct.length,0);assert.equal(f.commits.length,1);for(const path of [ot,other]){assert.deepEqual(result.values[path],f.read(path));assert.equal(result.values[path]._svListOperation,f.commands[0].id);}
 assert.equal(f.read(other+'/evidencias/foto/url'),'https://fiction.invalid/foto');assert.equal(f.read('sisventas/listados_resumen/reclamos/r/problema'),'Actualizado');assert.deepEqual(Object.keys(f.commands[0].expectedHashes).sort(),[ot,other,'sisventas/notificaciones/n'].sort());
});
test('CAS retry rebuilds only after definite conflict, preserving concurrent note and response stamp',async()=>{
 const f=fixture();let attempts=0;f.setBeforeSend(()=>{if(!attempts++){const value=f.read(ot);value.notasTecnico.concurrente={texto:'Concurrente'};value._svListRevision++;f.set(ot,value);}});
 const result=await f.root.SVRecordListWrites.records([ot],rows=>{rows[ot].tecnico='Técnico ficticio';return rows;});assert.equal(f.commands.length,2);assert.equal(f.commits.length,1);assert.equal(f.read(ot+'/notasTecnico/concurrente/texto'),'Concurrente');assert.deepEqual(result.values[ot],f.read(ot));assert.equal(f.direct.length,0);
});
test('abort and no-op preserve contracts without a command; asynchronous transforms reject',async()=>{
 const f=fixture();const tx=await f.root.fbRunTransaction(f.ref(ot),()=>undefined);assert.equal(tx.committed,false);assert.deepEqual(tx.snapshot.val(),f.read(ot));const no=await f.root.SVRecordListWrites.records([ot],rows=>rows);assert.equal(no.committed,true);assert.deepEqual(no.values[ot],f.read(ot));assert.equal(f.commands.length,0);await assert.rejects(f.root.SVRecordListWrites.records([ot],async rows=>rows),/devolver/);assert.equal(f.direct.length,0);
});
test('policy denies deletion and modification of delivered material without bypass or SDK fallback',async()=>{
 const f=fixture();f.set(ot+'/ventaFbKey','s');f.set(ot+'/materiales',[{cod:'P',productoKey:'p',entregada:1,custodiaActiva:true}]);f.set(ot+'/remitosEntrega',{r:{id:'r',items:[{cantidad:1}]}});const before=f.read(ot);
 await assert.rejects(f.root.fbRemove(f.ref(ot)),e=>e.code==='SV_OT_DELIVERY_PROTOCOL');assert.deepEqual(f.read(ot),before);await assert.rejects(f.root.fbUpdate(f.ref(ot),{materiales:[]}),e=>e.code==='SV_OT_DELIVERY_PROTOCOL');assert.equal(f.commits.length,0);assert.equal(f.direct.length,0);assert.equal(f.commands.length,2);
 await f.root.fbSet(f.ref(ot+'/observaciones'),'Metadato permitido');assert.equal(f.read(ot+'/observaciones'),'Metadato permitido');assert.deepEqual(f.read(ot+'/remitosEntrega'),before.remitosEntrega);
});
test('network, permission and paused readiness failures never fall back to SDK or blindly retry',async()=>{
 for(const error of [Object.assign(Error('Sin permiso'),{statusCode:403,code:'PERMISSION_DENIED'}),Object.assign(Error('Sin conexión'),{statusCode:503,code:'NETWORK_ERROR'})]){const f=fixture();f.setCommitError(error);await assert.rejects(f.root.fbSet(f.ref(ot+'/hora'),'10:00'));assert.equal(f.commands.length,1);assert.equal(f.direct.length,0);assert.equal(f.read(ot+'/hora'),null);}
 const f=fixture();f.setPrepare(async()=>{throw Object.assign(Error('Pausa'),{code:'SV_CLIENT_ACCOUNTS_PAUSED'});});await assert.rejects(f.root.fbSet(f.ref(ot+'/hora'),'10:00'),{code:'SV_CLIENT_ACCOUNTS_PAUSED'});assert.equal(f.commands.length,0);assert.equal(f.direct.length,0);
});
test('legacy OT uses unchanged SDK path until coordination; unrelated domains keep SDK',async()=>{
 for(const options of [{coordinated:false},{host:false}]){const f=fixture(options);await f.root.fbSet(f.ref(ot+'/hora'),'08:00');await f.root.SVRecordListWrites.records([ot],rows=>{rows[ot].tecnico='T';return rows;});assert.equal(f.commands.length,0);assert.equal(f.direct.length,2);assert.equal(f.read(ot)._svListRevision,2);}
 const f=fixture();let prepared=0;f.setPrepare(async()=>{prepared++;});await f.root.fbSet(f.ref('sisventas/agenda/a'),{titulo:'Ficticio'});await f.root.fbSet(f.ref('sisventas/inventario_operativo/p/general'),4);assert.equal(f.commands.length,0);assert.equal(f.direct.length,2);assert.equal(prepared,0);
});
test('readiness is awaited before selecting writer and session changes abort',async()=>{
 const f=fixture({coordinated:false});let resume;f.setPrepare(()=>new Promise(resolve=>{resume=()=>{f.setMode(true);resolve();};}));const saving=f.root.fbSet(f.ref(ot+'/hora'),'11:00');await Promise.resolve();assert.equal(f.direct.length,0);assert.equal(f.commands.length,0);f.setPrepare(async()=>{});resume();await saving;assert.equal(f.commands.length,1);assert.equal(f.direct.length,0);
 const g=fixture();g.setPrepare(async()=>{g.root.currentUserUid='other';});await assert.rejects(g.root.fbSet(g.ref(ot+'/hora'),'12:00'),{code:'SV_LABOR_SESSION'});assert.equal(g.commands.length,0);assert.equal(g.direct.length,0);
});
test('ancestor replacement, collection replacement and root transaction cannot escape to SDK',async()=>{
 const f=fixture();for(const path of ['', 'sisventas','sisventas/ordenes_trabajo']){
  await assert.rejects(Promise.resolve().then(()=>f.root.fbSet(f.ref(path),{})));
  await assert.rejects(Promise.resolve().then(()=>f.root.fbRunTransaction(f.ref(path),()=>({}))));
 }assert.equal(f.direct.length,0);assert.equal(f.commands.length,0);
});
test('missing record adapter under coordination fails closed before SDK',async()=>{
 const f=fixture();delete f.root.SVRecordListWrites;
 for(const write of [()=>f.root.fbSet(f.ref(ot+'/hora'),'08:00'),()=>f.root.fbUpdate(f.ref(ot),{hora:'08:00'}),()=>f.root.fbRunTransaction(f.ref(ot),v=>v),()=>f.root.SVLaborWrites.restTransaction(f.ref(ot),v=>v)])await assert.rejects(Promise.resolve().then(write),{code:'SV_OT_COORDINATED_WRITER'});
 assert.equal(f.direct.length,0);assert.equal(f.commands.length,0);
});
test('real H7/Accounts prepared coverage and record summaries update in the same gateway commit',async()=>{
 const Prep=require('../scripts/lib/commercial-cut-preparation.cjs'),f=fixture();
 const input={schema:1,sources:Object.fromEntries(Prep.SOURCES.map(p=>[p,{}])),destinations:Object.fromEntries(Prep.DESTINATIONS.map(p=>[p,null])),generations:{commercial:'routing-commercial',accounts:'routing-accounts',history:'routing-history',financial:'routing-financial'}};
 Object.assign(input.sources,{'sisventas/clientes':{c:{id:'C-FICTICIO',nombre:'Cliente ficticio'}},'sisventas/ordenes_trabajo':{o:{...f.read(ot),clienteFbKey:'c',responsableUid:'u'}},sv_usuarios:{profile:{uid:'u',nombre:'Persona ficticia',rol:'admin',activo:true}},sv_chat_roles:{u:{rol:'admin',activo:true}},sv_permisos:{admin:{indiceVersion:2,indiceRevision:1,indiceModulos:{cuentacorriente:true,venta:true,detalle:true,ordentrabajo:true}}}});
 input.destinations.sv_labor_config={schema:1,ready:true};input.snapshotManifest={schema:1,complete:true,observedAt:'2026-11-04T11:00:00Z',sources:Object.fromEntries(Prep.SOURCES.map(p=>[p,{complete:true,...Prep.fingerprint(p,input.sources[p])}])),destinations:Object.fromEntries(Prep.DESTINATIONS.map(p=>[p,{observed:true,...Prep.fingerprint(p,input.destinations[p])}]))};
 const artifact=await Prep.prepare(input);for(const[p,v]of Object.entries({...input.sources,...artifact.patch,...artifact.activation}))f.set(p,v);
 const guard=createLaborGuard({store:f.store,commercialPages:true,clientAccounts:true,clientHistory:true,operationalSummaries:true,delay:async()=>{}}),gateway=createLaborWriteGateway({guard,store:f.store,db:{ref:p=>({get:async()=>({val:()=>f.read(p)})})},enabled:true});f.useGateway(gateway);
 const old=f.read('sv_client_history/v1/state/revision');const result=await f.root.SVRecordListWrites.records([ot],rows=>{rows[ot].estado='en_proceso';return rows;});
 assert.equal(f.direct.length,0);assert.equal(f.commands.length,1);assert.equal(f.commits.length,1);assert.equal(f.read('sv_client_history/v1/state/revision'),old+1);assert.equal(f.read('sv_client_history/v1/sources/ordenes_trabajo/o/row/status'),'en_proceso');assert.deepEqual(result.values[ot],f.read(ot));
 const patch=f.commits[0];assert.ok(Object.keys(patch).some(p=>p.startsWith('sv_client_history/v1/')));assert.equal(patch['sisventas/listados_resumen/ordenes_trabajo/o'].estado,'en_proceso');assert.ok(patch['sv_labor_receipts/'+f.commands[0].id]);assert.equal(patch.sv_labor_guard,null);
 const created=f.root.fbPush(f.ref('sisventas/ordenes_trabajo'),{id:'OT-ALTA-FICTICIA',clienteFbKey:'c',responsableUid:'u',estado:'pendiente',materiales:[]});await created;
 const createdPath='sisventas/ordenes_trabajo/'+created.key;await f.root.fbSet(f.ref(createdPath+'/notasTecnico/n'),{texto:'Nota ficticia con H7'});
 // Notes are omitted from the H7 contribution; this third commit must not
 // invent a history revision when its row and dependencies are unchanged.
 assert.equal(f.read('sv_client_history/v1/coverage/all/ordenes_trabajo/originalRecords'),2);assert.equal(f.read('sv_client_history/v1/state/revision'),old+2);assert.equal(f.read(createdPath+'/notasTecnico/n/texto'),'Nota ficticia con H7');assert.equal(f.direct.length,0);assert.equal(f.commands.length,3);assert.equal(f.commits.length,3);
});
test('lost response resolves the same receipt using real recovery without reapplying a note or changing its returned operation',{timeout:15000},async()=>{
 const f=fixture(),storage=new Map();f.root.document=new EventTarget();f.root.CustomEvent=CustomEvent;const becameUnknown=new Promise(resolve=>f.root.document.addEventListener('sisventas:labor-write-recovery',event=>{if(event.detail?.status==='unknown')resolve();}));f.root.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};f.root.SVLaborWriteRecovery=require('../js/core/labor-write-recovery').create(f.root);
 const send=f.root.fetch;let lost=true;f.root.fetch=async(url,options)=>{if(url.endsWith('/laboral/operacion')){const data=await f.gateway.resolve({uid:'u',claims:{uid:'u'}},JSON.parse(options.body));return {ok:true,status:200,json:async()=>data};}const response=await send(url,options);if(lost){lost=false;assert.equal(response.ok,true);throw Error('ACK perdido después del commit real');}return response;};
 const saving=f.root.SVRecordListWrites.records([ot],rows=>{rows[ot].notasTecnico.n={texto:'Guardar una sola vez'};return rows;});
 await Promise.race([becameUnknown,saving.then(()=>{throw Error('Expected an uncertain receipt before confirmation');})]);
 assert.equal(f.root.SVLaborWriteRecovery.state()?.status,'unknown');assert.equal(f.commits.length,1);assert.throws(()=>f.root.SVLaborWriteRecovery.assertAvailable(),{code:'SV_LABOR_PENDING_OPERATION'});
 assert.deepEqual(await f.root.SVLaborWriteRecovery.check(),{status:'confirmed'});const result=await saving;assert.equal(f.commands.length,1);assert.equal(f.commits.length,1);assert.deepEqual(result.values[ot],f.read(ot));assert.equal(f.read(ot)._svListOperation,f.commands[0].id);assert.equal(f.direct.length,0);assert.equal(f.root.SVLaborWriteRecovery.state(),null);
});
