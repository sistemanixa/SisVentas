'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/core/commercial-ownership.js','utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const response=(records,etag='W/"fictitious-list-1"')=>({ok:true,status:200,headers:{get:()=>etag},json:async()=>({ok:true,records:clone(records)})});

function fixture(){
 const records={
  'budget-delete':{id:'PP-DUPLICADO',cliente:'Cliente ficticio',total:100,responsableUid:'owner-demo'},
  'budget-keep':{id:'PP-DUPLICADO',cliente:'Otro cliente ficticio',total:200,responsableUid:'owner-demo'}
 };
 const calls=[],events={},deliveries=[];
 const c={currentUserUid:'owner-demo',currentRole:'admin',PERMISOS_ROLES:{admin:{indiceRevision:3},administrativo:{indiceRevision:7}},fbAuth:{currentUser:{uid:'owner-demo',getIdToken:async()=>'fictitious-token'}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'http://transport.invalid'},pptoData:[],queueMicrotask,AbortSignal,console:{warn(){}},document:{hidden:false,addEventListener:(type,fn)=>events[type]=fn,getElementById:()=>null},addEventListener(){}};
 c.window=c;
 let transport=()=>response(records);
 c.fetch=async(url,options)=>{calls.push({url,options});return transport(url,options);};
 vm.runInNewContext(source,c);
 return {c,records,calls,events,deliveries,api:c.SVCommercialOwnership,transport(fn){transport=fn;},async load(){c.SVCommercialOwnership.onValue('presupuestos',snap=>{const data=clone(snap.val()||{});deliveries.push(data);c.pptoData=Object.entries(data).map(([fbKey,record])=>({...record,fbKey}));});await settle();},list(){return clone(c.pptoData);}};
}

test('acuse de eliminación quita sólo la clave técnica confirmada y su caché, sin consultas adicionales',async()=>{
 const f=fixture();await f.load();const api=f.api,context=api.captureWriteContext('presupuestos');
 const other=f.list().find(record=>record.fbKey==='budget-keep');
 api.confirmDelete('presupuestos','budget-delete',context);
 assert.deepEqual(f.list(),[other],'El número comercial duplicado nunca identifica qué registro se elimina');
 assert.deepEqual(clone(api.cachedRecords('presupuestos')),{'budget-keep':f.records['budget-keep']});
 assert.equal(f.calls.length,1,'El acuse local no consulta de nuevo el listado completo');
 api.confirmDelete('presupuestos','budget-delete',context);
 assert.deepEqual(f.list(),[other],'Repetir un acuse confirmado es inocuo');
 assert.equal(f.calls.length,1);
});

test('el acuse local también quita el registro cuando no hay una suscripción instalada',()=>{
 const f=fixture();f.c.pptoData=Object.entries(f.records).map(([fbKey,record])=>({...clone(record),fbKey}));
 f.api.confirmDelete('presupuestos','budget-delete',f.api.captureWriteContext('presupuestos'));
 assert.deepEqual(f.list().map(record=>record.fbKey),['budget-keep']);
 assert.equal(f.calls.length,0);
});

test('un GET iniciado antes del acuse no repone el registro eliminado ni restaura su ETag',async()=>{
 const f=fixture();await f.load();let finish;
 const oldRecords=clone(f.records),oldDeliveries=f.deliveries.length;
 f.transport(()=>new Promise(resolve=>{finish=resolve;}));
 const read=f.api.refresh('presupuestos');await settle();
 assert.equal(f.calls[1].options.headers['If-None-Match'],'W/"fictitious-list-1"');
 const context=f.api.captureWriteContext('presupuestos');
 delete f.records['budget-delete'];
 f.api.confirmDelete('presupuestos','budget-delete',context);
 finish(response(oldRecords,'W/"stale-list"'));await read;await settle();
 assert.deepEqual(f.list().map(record=>record.fbKey),['budget-keep']);
 assert.equal(f.deliveries.length,oldDeliveries,'La respuesta previa al borrado no se entrega a la vista');
 assert.equal(f.api.cachedRecords('presupuestos')['budget-delete'],undefined);
 assert.equal(f.calls.length,2,'El acuse no programa otro GET');
 f.transport(()=>response(f.records,'W/"fresh-list"'));
 await f.api.refresh('presupuestos');
 assert.equal(f.calls[2].options.headers['If-None-Match'],undefined,'La siguiente lectura explícita no usa el ETag anterior');
 assert.deepEqual(f.list().map(record=>record.fbKey),['budget-keep']);
});

test('dominio, contexto y clave de eliminación inválidos no cambian la proyección',async()=>{
 const f=fixture();await f.load();const context=f.api.captureWriteContext('presupuestos'),before=f.list(),beforeCache=clone(f.api.cachedRecords('presupuestos'));
 for(const key of ['',null,undefined,{},17,'path/to/budget','bad.key','bad#key','bad$key','bad[key','bad]key','bad\u0000key','bad\u007fkey']){
  assert.throws(()=>f.api.confirmDelete('presupuestos',key,context));
  assert.deepEqual(f.list(),before);
 }
 assert.throws(()=>f.api.confirmDelete('ventas','budget-delete',context));
 assert.throws(()=>f.api.confirmDelete('presupuestos','budget-delete',f.api.captureWriteContext('ventas')));
 assert.deepEqual(f.list(),before);assert.deepEqual(clone(f.api.cachedRecords('presupuestos')),beforeCache);assert.equal(f.calls.length,1);
});

for(const [name,change]of[
 ['objeto Auth',f=>{f.c.fbAuth.currentUser={uid:'owner-demo',getIdToken:async()=>'other-fictitious-token'};}],
 ['UID efectivo',f=>{f.c.currentUserUid='other-demo';}],
 ['rol',f=>{f.c.currentRole='administrativo';}],
 ['revisión de permisos',f=>{f.c.PERMISOS_ROLES.admin.indiceRevision++;}],
 ['logout',f=>{f.events['sisventas:session-ended']();}],
 ['Auth ausente',f=>{f.c.fbAuth.currentUser=null;}]
])test('un acuse de otra sesión ('+name+') no elimina la fila de la sesión actual',async()=>{
 const f=fixture();await f.load();const context=f.api.captureWriteContext('presupuestos');change(f);
 f.c.pptoData=[{fbKey:'budget-delete',id:'PP-NUEVO-CONTEXTO',cliente:'Cuenta ficticia nueva'}];const next=f.list();
 assert.throws(()=>f.api.confirmDelete('presupuestos','budget-delete',context),/sesión cambió/i);
 assert.deepEqual(f.list(),next);assert.equal(f.calls.length,1);
});

for(const status of[401,403])test('revocación '+status+' invalida el acuse anterior aunque una lectura posterior vuelva a estar autorizada',async()=>{
 const f=fixture();await f.load();const context=f.api.captureWriteContext('presupuestos');
 f.transport(()=>({ok:false,status,json:async()=>({ok:false,mensaje:'Acceso ficticio revocado'})}));
 await f.api.refresh('presupuestos');
 assert.equal(f.api.isWriteContext(context),false);assert.equal(f.api.cachedRecords('presupuestos'),null);
 f.transport(()=>response(f.records));await f.api.refresh('presupuestos');const restored=f.list();
 assert.throws(()=>f.api.confirmDelete('presupuestos','budget-delete',context),/sesión cambió/i);
 assert.deepEqual(f.list(),restored,'Una respuesta vieja no modifica una proyección nuevamente autorizada');
 f.api.confirmDelete('presupuestos','budget-delete',f.api.captureWriteContext('presupuestos'));
 assert.deepEqual(f.list().map(record=>record.fbKey),['budget-keep']);assert.equal(f.calls.length,3);
});

test('un rechazo al preparar invalida el acuse de eliminación capturado antes del rechazo',async()=>{
 const f=fixture();await f.load();const context=f.api.captureWriteContext('presupuestos'),before=f.list();
 f.transport(()=>({ok:false,status:403,json:async()=>({ok:false,mensaje:'Preparación ficticia revocada'})}));
 await assert.rejects(f.api.prepare('presupuestos','budget-delete'),/revocada/);
 assert.throws(()=>f.api.confirmDelete('presupuestos','budget-delete',context),/sesión cambió/i);
 assert.deepEqual(f.list(),before);assert.equal(f.calls.length,2);
});
