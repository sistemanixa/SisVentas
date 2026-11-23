'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {create}=require('../js/core/labor-writes');
const {createLaborGuard,child,parts,put,digest}=require('../cotizador/labor-guard');
const {createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
function fixture(legacy=false){
 let data={sv_record_list_config:{schema:1,ready:true},sv_labor_config:{schema:1,ready:true},sv_chat_roles:{u:{activo:true,rol:'admin'}},sisventas:{ordenes_trabajo:{o:{id:'OT-FIC',estado:'pendiente',notasTecnico:{old:{texto:'Conservar',autor:'Otro'}},materiales:[{codigo:'P',qty:2}],audit:[]}}}},sequence=0;
 const calls={reads:[],clientReads:0,commits:[],commands:[],preparations:0},read=path=>child(data,parts(path)),set=(path,v)=>{data=put(data,parts(path),v)};
 const store={read:async p=>{calls.reads.push(p);return read(p)},readAsUser:async(p,a)=>{if(a.uid!=='u')throw Error('denied');return read(p)},acquire:async l=>set('sv_labor_guard',l),abort:async()=>set('sv_labor_guard',null),commit:async(patch,l)=>{assert.equal(read('sv_labor_guard/fence'),l.fence);calls.commits.push(structuredClone(patch));for(const[p,v]of Object.entries(patch))set(p,v)}};
 const guard=createLaborGuard({store,otDeleteOperational:true,operationalSummaries:true,uuid:()=> 'fixture-'+(++sequence)}),gateway=createLaborWriteGateway({db:{ref:p=>({get:async()=>({val:()=>read(p)})})},guard,store,enabled:true}),actor={uid:'u',claims:{uid:'u'}};
 let lose=false;const root={crypto:crypto.webcrypto,fbDB:{},fbAuth:{currentUser:{uid:'u'}},currentUserUid:'u',currentRole:'admin',PERMISOS_ROLES:{admin:{indiceRevision:1}},SVClientAccountHost:{start:async()=>{calls.preparations++},coordinated:()=>true},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},SVServiceAuth:{headers:async h=>h},fetch:async(_,opts)=>{const command=JSON.parse(opts.body);calls.commands.push(command);try{const result=await gateway.write(actor,command);if(lose){lose=false;throw Error('ACK perdido')}return{ok:true,status:200,json:async()=>result}}catch(e){if(e.message==='ACK perdido')throw e;return{ok:false,status:e.statusCode||500,json:async()=>({ok:false,code:e.code,mensaje:e.message})}}}};
 let sdk=Object.fromEntries(['set','update','push','remove','runTransaction','get','ref'].map(n=>[n,()=>{calls.clientReads++;throw Error('Unexpected SDK '+n)}]));if(legacy){
  const base={...sdk,ref:(_,p='')=>({key:p.split('/').at(-1),toString:()=>p}),get:async ref=>{calls.clientReads++;return{val:()=>read(ref.toString())}}};
  const Records=require('../js/core/operational-writes').create,Model=require('../js/core/record-list-model');
  root.SVRecordListWrites=Records(root,Model);root.SVRecordListWrites.install({sdk:base});
  sdk={...base,set:root.fbSet,update:root.fbUpdate,push:root.fbPush,remove:root.fbRemove,runTransaction:root.fbRunTransaction};
 }
 root.SVLaborWrites=create(root);root.SVLaborWrites.install({sdk});
 return{root,calls,read,set,gateway,actor,loseNext(){lose=true},args:{otKey:'o',otId:'OT-FIC',noteKey:'new',before:null,after:{texto:'Ficticia',autor:'Autor',rol:'admin',ts:123,_firebaseKey:'new'},id:'note-real-guard-fixture'}};
}
test('narrow note passes actual gateway/guard/summaries and preserves materials, history and other notes',async()=>{const f=fixture(),before=f.read('sisventas/ordenes_trabajo/o');await f.root.SVLaborWrites.writeOTNote(f.args);assert.equal(f.calls.clientReads,0);assert.equal(f.calls.commits.length,1);assert.deepEqual(f.read('sisventas/ordenes_trabajo/o/materiales'),before.materiales);assert.deepEqual(f.read('sisventas/ordenes_trabajo/o/notasTecnico/old'),before.notasTecnico.old);assert.deepEqual(f.read('sisventas/ordenes_trabajo/o/audit'),before.audit);assert.equal(f.read('sisventas/ordenes_trabajo/o/notasTecnico/new/texto'),'Ficticia');assert.ok(Object.keys(f.calls.commits[0]).some(p=>p.startsWith('sisventas/listados_resumen/')));});
test('missing parent or changed note rejects without creating ghost OT or overwriting another note',async()=>{for(const mode of['missing','changed']){const f=fixture();if(mode==='missing')f.set('sisventas/ordenes_trabajo/o',null);else f.set('sisventas/ordenes_trabajo/o/notasTecnico/new',{texto:'Ajena'});await assert.rejects(f.root.SVLaborWrites.writeOTNote(f.args),{code:'SV_CAS_CONFLICT'});assert.equal(f.calls.commits.length,0);assert.equal(f.read('sisventas/ordenes_trabajo/o/notasTecnico/new/texto'),mode==='missing'?null:'Ajena');}});
test('lost acknowledgement resolves through existing receipt and same operation cannot commit twice',async()=>{const f=fixture();f.loseNext();await assert.rejects(f.root.SVLaborWrites.writeOTNote(f.args),/ACK/);const body=f.calls.commands[0];assert.deepEqual(await f.gateway.resolve(f.actor,{id:body.id,digest:digest(body)}),{ok:true,status:'confirmed'});await f.root.SVLaborWrites.writeOTNote(f.args);assert.equal(f.calls.commits.length,1);assert.equal(JSON.stringify(f.calls.commands[0]),JSON.stringify(f.calls.commands[1]));});
test('simultaneous independent note does not conflict or get lost',async()=>{const f=fixture();f.set('sisventas/ordenes_trabajo/o/notasTecnico/concurrent',{texto:'Concurrente'});await f.root.SVLaborWrites.writeOTNote(f.args);assert.equal(f.read('sisventas/ordenes_trabajo/o/notasTecnico/concurrent/texto'),'Concurrente');});
test('delete checks actual note contents and removes just that child',async()=>{const f=fixture(),before=f.read('sisventas/ordenes_trabajo/o/notasTecnico/old');await f.root.SVLaborWrites.writeOTNote({...f.args,noteKey:'old',before,after:null});assert.equal(f.read('sisventas/ordenes_trabajo/o/notasTecnico/old'),null);assert.equal(f.read('sisventas/ordenes_trabajo/o/id'),'OT-FIC');});


test('real legacy adapter comparison removes full OT GET and full payload without changing committed result',async()=>{
 const old=fixture(true),next=fixture();for(const f of[old,next])f.set('sisventas/ordenes_trabajo/o/firma','data:image/png;base64,'+'a'.repeat(200000));
 await old.root.fbUpdate({toString:()=> 'sisventas/ordenes_trabajo/o'},{'notasTecnico/new':old.args.after});
 await next.root.SVLaborWrites.writeOTNote(next.args);
 assert.equal(old.calls.clientReads,1);assert.equal(next.calls.clientReads,0);assert.equal(old.calls.commands.length,1);assert.equal(next.calls.commands.length,1);
 assert.deepEqual(old.read('sisventas/ordenes_trabajo/o/notasTecnico'),next.read('sisventas/ordenes_trabajo/o/notasTecnico'));
 const bytes=c=>Buffer.byteLength(JSON.stringify(c));assert.ok(bytes(old.calls.commands[0])>200000);assert.ok(bytes(next.calls.commands[0])<700);
 console.log('FICTITIOUS comparison: legacy='+bytes(old.calls.commands[0])+'B, narrow='+bytes(next.calls.commands[0])+'B; clientOTReads 1→0; preparation '+old.calls.preparations+'→'+next.calls.preparations);
});
