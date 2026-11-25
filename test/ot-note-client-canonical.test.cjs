'use strict';
// Client contracts only: actual LaborWrites + actual Recovery, memory SDK/HTTP.
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {create}=require('../js/core/labor-writes'),{create:createRecovery}=require('../js/core/labor-write-recovery');
const OT='sisventas/ordenes_trabajo/ot',NOTE=OT+'/notasTecnico/n',EXPENSE='sisventas/gastos/g';
const clone=value=>structuredClone(value),response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>clone(data)});
function fixture(){
 const state={sisventas:{ordenes_trabajo:{ot:{id:'OT-FIC',materiales:[{codigo:'P',instalada:0}],notasTecnico:{otra:{texto:'Conservar'}}}},gastos:{g:{monto:10}}}},commands=[],checks=[],reads=[],direct=[],receipts=new Map(),storage=new Map();
 let onPost=null,onRead=null,onHeaders=null,onCheck=null,prepared=0;
 const get=path=>path.split('/').reduce((value,key)=>value&&Object.hasOwn(value,key)?value[key]:null,state)??null;
 function put(path,value){const keys=path.split('/'),last=keys.pop();let node=state;for(const key of keys)node=node[key]||={};if(value===null)delete node[last];else node[last]=clone(value);}
 const root={currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}},PERMISOS_ROLES:{admin:{indiceRevision:1}},crypto:crypto.webcrypto,fbDB:{},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},
  sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
  SVClientAccountHost:{prepareWrite:async()=>{prepared++;},start:async()=>{},coordinated:()=>true},
  SVServiceAuth:{headers:async base=>{if(onHeaders)await onHeaders();return base;}},
  fetch:async(url,options)=>{
   assert.equal(options.method,'POST');const body=JSON.parse(options.body);
   if(url==='https://fixture.invalid/laboral/escritura'){commands.push(body);return onPost?onPost(body):commit(body);}
   assert.equal(url,'https://fixture.invalid/laboral/operacion');checks.push(body);if(onCheck)return onCheck(body);
   const receipt=receipts.get(body.id);assert.ok(receipt);assert.equal(body.digest,receipt.digest);return response({ok:true,status:'confirmed'});
  }
 };
 const ref=(_,path='')=>({key:path.split('/').at(-1),path,toString:()=> 'https://fixture.invalid/'+path});
 const forbidden=name=>(...args)=>{direct.push({name,args});throw Error('Unexpected SDK write '+name);};
 const sdk={ref,get:async r=>{reads.push(r.path);if(onRead)await onRead(r.path);return {val:()=>clone(get(r.path))};},...Object.fromEntries(['set','update','remove','push','runTransaction'].map(name=>[name,forbidden(name)]))};
 root.SVLaborWriteRecovery=createRecovery(root);const client=create(root);client.install({sdk});root.SVLaborWrites=client;
 async function commit(command,{canonicalNote,canonical=true}={}){
  for(const [path,value]of Object.entries(command.value))put(path,value);
  if(Object.hasOwn(command.value,NOTE)){
   const note=canonicalNote===undefined?(command.value[NOTE]===null?null:{...clone(command.value[NOTE]),autor:'Autor servidor',ts:700}):clone(canonicalNote);put(NOTE,note);
   const ack={ok:true,committed:true,...(canonical?{noteCanonical:true,note:clone(note)}:{})};receipts.set(command.id,{digest:await client.hash(command),ack});return response(ack);
  }
  receipts.set(command.id,{digest:await client.hash(command)});return response({ok:true,committed:true});
 }
 const args={otKey:'ot',otId:'OT-FIC',noteKey:'n',before:null,after:{texto:'Nota ficticia',autor:'Autor local',rol:'admin',ts:1,_firebaseKey:'n'},id:'canonical-note-fixture'};
 return {root,client,args,state,commands,checks,reads,direct,storage,receipts,get,put,commit,onPost:fn=>onPost=fn,onRead:fn=>onRead=fn,onHeaders:fn=>onHeaders=fn,onCheck:fn=>onCheck=fn,get prepared(){return prepared;}};
}
async function unknown(f){for(let i=0;i<1000;i++){if(f.root.SVLaborWriteRecovery.state()?.status==='unknown')return;await new Promise(resolve=>setImmediate(resolve));}assert.fail('Recovery did not retain the uncertain attempt');}
function assertNoSDKWrites(f){assert.equal(f.direct.length,0);}

test('canonical note ACK updates after and returns independent canonical note with zero SDK GET',async()=>{
 const f=fixture(),canonical={texto:'Nota ficticia',autor:'Autor servidor',ts:700,_firebaseKey:'n',serverMeta:{revision:1}};
 f.onPost(command=>f.commit(command,{canonicalNote:canonical}));const after=f.args.after,result=await f.client.writeOTNote(f.args);
 assert.deepEqual(result,{installed:true,committed:true,operationId:f.args.id,noteCanonical:true,note:canonical});assert.deepEqual(after,canonical);assert.equal(Object.hasOwn(after,'rol'),false);assert.equal(f.reads.length,0);assert.equal(f.commands.length,1);assert.equal(f.prepared,1);assert.equal(f.checks.length,0);assertNoSDKWrites(f);
 after.serverMeta.revision=2;assert.equal(result.note.serverMeta.revision,1);result.note.serverMeta.revision=3;assert.equal(canonical.serverMeta.revision,1);assert.equal(f.get(NOTE).serverMeta.revision,1);
 const sent=f.commands[0];assert.deepEqual(Object.keys(sent.value),[NOTE]);assert.deepEqual(Object.keys(sent.expectedHashes).sort(),[OT+'/id',NOTE].sort());assert.equal(sent.expectedHashes[NOTE],await f.client.hash(null));assert.equal(sent.expectedHashes[OT+'/id'],await f.client.hash('OT-FIC'));assert.equal(f.storage.size,0);
});

test('normal acknowledged note keeps three-field result without canonical metadata or SDK reads',async()=>{
 const f=fixture(),before=clone(f.args.after);f.onPost(command=>f.commit(command,{canonical:false}));assert.deepEqual(await f.client.writeOTNote(f.args),{installed:true,committed:true,operationId:f.args.id});assert.deepEqual(f.args.after,before);assert.deepEqual(f.reads,[]);assertNoSDKWrites(f);
});

test('explicit OFF returns uninstalled without HTTP write, canonical mutation or SDK fallback',async()=>{
 const f=fixture(),before=clone(f.args.after);f.root.SVClientAccountHost.coordinated=()=>false;assert.deepEqual(await f.client.writeOTNote(f.args),{installed:false});assert.deepEqual(f.args.after,before);assert.equal(f.commands.length,0);assert.equal(f.reads.length,0);assertNoSDKWrites(f);
});

test('real Recovery: lost ACK -> check -> exactly one note leaf GET, canonical result and no rePOST',async()=>{
 const f=fixture(),before=clone(f.args.after);f.onPost(async command=>{await f.commit(command);throw Error('Fictitious lost ACK');});
 let settled=false;const pending=f.client.writeOTNote(f.args);pending.then(()=>settled=true,()=>settled=true);await unknown(f);assert.equal(settled,false);assert.deepEqual(f.args.after,before);assert.deepEqual(f.reads,[]);
 const journal=JSON.parse(f.storage.get(f.root.SVLaborWriteRecovery.STORAGE_KEY));assert.equal(journal.length,1);assert.deepEqual(Object.keys(journal[0]).sort(),['digest','id','uid']);assert.equal(journal[0].digest,await f.client.hash(f.commands[0]));assert.equal(journal[0].id,f.args.id);assert.equal(JSON.stringify(journal).includes(before.texto),false);
 assert.deepEqual(await f.root.SVLaborWriteRecovery.check(),{status:'confirmed'});const result=await pending;
 assert.deepEqual(result,{installed:true,committed:true,operationId:f.args.id,noteCanonical:true,note:f.get(NOTE)});assert.deepEqual(f.args.after,f.get(NOTE));assert.equal(f.args.after.ts,700);assert.deepEqual(f.reads,[NOTE]);assert.equal(f.commands.length,1);assert.equal(f.checks.length,1);assertNoSDKWrites(f);assert.equal(f.storage.size,0);assert.equal(f.root.SVLaborWriteRecovery.state(),null);
});

for(const phase of ['headers','ack'])test('session change at '+phase+' rejects without projecting canonical data',async()=>{
 const f=fixture(),before=clone(f.args.after);if(phase==='headers')f.onHeaders(()=>{f.root.currentUserUid='other';});else f.onPost(async command=>{const ack=await f.commit(command);f.root.currentRole='tecnico';return ack;});
 const pending=f.client.writeOTNote(f.args),rejection=assert.rejects(pending,{code:'SV_LABOR_SESSION'});
 if(phase==='ack'){await unknown(f);assert.deepEqual(f.args.after,before);assert.deepEqual(f.reads,[]);assert.equal(f.commands.length,1);await f.root.SVLaborWriteRecovery.check();assert.equal(f.checks.length,1);}
 await rejection;assert.deepEqual(f.args.after,before);assert.deepEqual(f.reads,[]);assert.equal(f.commands.length,phase==='headers'?0:1);assertNoSDKWrites(f);
});

test('session change during recovered leaf GET rejects before updating after and never rePOSTs',async()=>{
 const f=fixture(),before=clone(f.args.after);f.onPost(async command=>{await f.commit(command);throw Error('Fictitious lost ACK');});const pending=f.client.writeOTNote(f.args),rejection=assert.rejects(pending,{code:'SV_LABOR_SESSION'});await unknown(f);f.onRead(()=>{f.root.currentUserUid='other';});await f.root.SVLaborWriteRecovery.check();await rejection;assert.deepEqual(f.args.after,before);assert.deepEqual(f.reads,[NOTE]);assert.equal(f.commands.length,1);assert.equal(f.checks.length,1);assertNoSDKWrites(f);
});

test('canonical true with missing note rejects instead of reporting a projected success',async()=>{
 const f=fixture(),before=clone(f.args.after);f.onPost(()=>response({ok:true,committed:true,noteCanonical:true}));await assert.rejects(f.client.writeOTNote(f.args),{code:'SV_OT_NOTE_CANONICAL'});assert.deepEqual(f.args.after,before);assert.deepEqual(f.reads,[]);assert.equal(f.commands.length,1);assertNoSDKWrites(f);
});
for(const note of [null,[],{}, {texto:7}])test('invalid canonical creation '+JSON.stringify(note)+' does not clobber after',async()=>{
 const f=fixture(),before=clone(f.args.after);f.onPost(()=>response({ok:true,committed:true,noteCanonical:true,note}));await assert.rejects(f.client.writeOTNote(f.args),{code:'SV_OT_NOTE_CANONICAL_CHANGED'});assert.deepEqual(f.args.after,before);assert.deepEqual(f.reads,[]);assertNoSDKWrites(f);
});

test('canonical delete returns explicit null, while non-null canonical deletion conflicts',async()=>{
 const f=fixture(),before={texto:'Anterior',autor:'Autor',ts:5,_firebaseKey:'n'};f.put(NOTE,before);const result=await f.client.writeOTNote({...f.args,before,after:null});assert.deepEqual(result,{installed:true,committed:true,operationId:f.args.id,noteCanonical:true,note:null});assert.equal(f.get(NOTE),null);assert.equal(f.reads.length,0);assertNoSDKWrites(f);
 const g=fixture();g.put(NOTE,before);g.onPost(()=>response({ok:true,committed:true,noteCanonical:true,note:before}));await assert.rejects(g.client.writeOTNote({...g.args,before,after:null}),{code:'SV_OT_NOTE_CANONICAL_CHANGED'});assert.deepEqual(g.get(NOTE),before);assert.equal(g.reads.length,0);assertNoSDKWrites(g);
});

test('CAS conflict rejects immediately without SDK GET, implicit retries or canonical mutation',async()=>{
 const f=fixture(),before=clone(f.args.after);f.onPost(()=>response({ok:false,code:'SV_CAS_CONFLICT',mensaje:'Nota modificada'},409));await assert.rejects(f.client.writeOTNote(f.args),{code:'SV_CAS_CONFLICT'});assert.deepEqual(f.args.after,before);assert.equal(f.commands.length,1);assert.deepEqual(f.reads,[]);assert.equal(f.checks.length,0);assert.equal(f.storage.size,0);assertNoSDKWrites(f);
});

test('confirmed Recovery with missing current note requires review after one leaf GET, no replay',async()=>{
 const f=fixture(),before=clone(f.args.after);f.onPost(async command=>{await f.commit(command);throw Error('Fictitious lost ACK');});const pending=f.client.writeOTNote(f.args),rejection=assert.rejects(pending,{code:'SV_OT_NOTE_CANONICAL_CHANGED'});await unknown(f);f.put(NOTE,null);await f.root.SVLaborWriteRecovery.check();await rejection;assert.deepEqual(f.args.after,before);assert.deepEqual(f.reads,[NOTE]);assert.equal(f.commands.length,1);assert.equal(f.checks.length,1);assertNoSDKWrites(f);
});

for(const key of ['notification_1','-safe-key-','a'.repeat(160)])test('ot-materials allows exact safe notification leaf without its baseline: '+key.slice(0,20),async()=>{
 const f=fixture(),path='sisventas/notificaciones_admin/'+key;await f.client.atomic({paths:[OT],purpose:'ot-materials',build:values=>({[OT]:{...values[OT],materiales:[]},[path]:{tipo:'ot_materiales',otKey:'ot'}})});
 assert.deepEqual(f.reads,[OT]);assert.equal(f.commands.length,1);const sent=f.commands[0];assert.equal(sent.purpose,'ot-materials');assert.deepEqual(Object.keys(sent.expectedHashes),[OT]);assert.equal(sent.expectedHashes[OT],await f.client.hash({id:'OT-FIC',materiales:[{codigo:'P',instalada:0}],notasTecnico:{otra:{texto:'Conservar'}}}));assert.equal(Object.hasOwn(sent.expectedHashes,path),false);assert.equal(sent.value[path].otKey,'ot');assertNoSDKWrites(f);
});
for(const suffix of ['', 'safe/child','bad key','ñ','a'.repeat(161),'__proto__','prototype','constructor'])test('ot-materials notification exception rejects non-exact/unsafe key '+JSON.stringify(suffix.slice(0,20)),async()=>{
 const f=fixture(),path='sisventas/notificaciones_admin'+(suffix?'/'+suffix:'');await assert.rejects(f.client.atomic({paths:[OT],purpose:'ot-materials',build:values=>({[OT]:values[OT],[path]:{tipo:'ot_materiales'}})}),{code:'SV_LABOR_ATOMIC'});assert.equal(f.commands.length,0);assertNoSDKWrites(f);
});
for(const omitted of [OT,OT+'/materiales',EXPENSE,'sisventas/inventario_operativo/p','sisventas/ordenes_trabajo/other'])test('ot-materials requires an actual baseline for '+omitted,async()=>{
 const f=fixture(),paths=omitted.startsWith(OT)?[EXPENSE]:[OT];await assert.rejects(f.client.atomic({paths,purpose:'ot-materials',build:()=>({[omitted]:{},'sisventas/notificaciones_admin/safe':{tipo:'ot_materiales'}})}),{code:'SV_LABOR_ATOMIC'});assert.equal(f.commands.length,0);assertNoSDKWrites(f);
});
for(const purpose of ['relationship-normalization','expense-removal','employee-bonus-batch','employee-sac-batch','employee-sac-migration','sale-cost-correction','sale-return-to-budget','commission-participant','sale-commission-assignment'])test(purpose+' cannot inherit the notification missing-baseline exception',async()=>{
 const f=fixture();await assert.rejects(f.client.atomic({paths:[OT],purpose,build:values=>({[OT]:values[OT],'sisventas/notificaciones_admin/safe':{tipo:'ot_materiales'}})}),{code:'SV_LABOR_ATOMIC'});assert.equal(f.commands.length,0);assertNoSDKWrites(f);
});
test('other purpose can carry a notification only with its own original null baseline',async()=>{
 const f=fixture(),path='sisventas/notificaciones_admin/safe';await f.client.atomic({paths:[OT,path],purpose:'relationship-normalization',build:values=>({[OT]:values[OT],[path]:{tipo:'ficticio'}})});assert.equal(f.commands.length,1);assert.equal(f.commands[0].expectedHashes[path],await f.client.hash(null));assert.deepEqual(f.reads.sort(),[OT,path].sort());assertNoSDKWrites(f);
});
