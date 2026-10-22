'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCommercialOwnership}=require('../cotizador/commercial-ownership');
const {fixture}=require('./helpers/commercial-ownership-fixtures.cjs');

function setup(){
 const initial=fixture(),db=initial.db,reads=[],transactions=[],verifications=[],getRef=db.ref.bind(db);
 let failPath='',beforeTransaction=null,revoked=false;
 db.ref=path=>{
  const ref=getRef(path);
  return {...ref,
   get:async()=>{reads.push(path);if(path===failPath)throw Error('Lectura ficticia rechazada');return ref.get();},
   on:(event,callback,error)=>{reads.push(path+' [on]');return ref.on(event,callback,error);},
   transaction:async(...args)=>{transactions.push(path);if(beforeTransaction){const hook=beforeTransaction;beforeTransaction=null;hook(path);}return ref.transaction(...args);}
  };
 };
 const api=createCommercialOwnership({db,auth:{verifyIdToken:async(token,checkRevoked)=>{verifications.push({token,checkRevoked});if(revoked)throw Error('Token ficticio revocado');return {uid:token};}},enabled:true,now:()=>1000});
 const authorize=(uid='a',domain='presupuestos',viewUid)=>api.authorize({headers:{authorization:'Bearer '+uid}},domain,viewUid);
 return {db,api,reads,transactions,verifications,authorize,setFailure:path=>{failPath=path;},revoke:()=>{revoked=true;},beforeTransaction:hook=>{beforeTransaction=hook;}};
}
const contexts=reads=>reads.filter(path=>['sv_usuarios','sv_chat_roles','sv_permisos'].includes(path));
const noFullRecords=reads=>assert.ok(!reads.includes('sisventas/ventas')&&!reads.includes('sisventas/presupuestos'),'Preparar un presupuesto no descarga colecciones comerciales');

test('preparar presupuesto canónico usa un contexto autorizado: tres lecturas de identidad y una del registro',async()=>{
 const f=setup();f.db.root.sisventas.presupuestos.budget.responsableUid='a';
 const before=structuredClone(f.db.root.sisventas.presupuestos.budget),actor=await f.authorize();
 const result=await f.api.prepare(actor,{id:'budget'});
 assert.deepEqual(result.record,before);assert.deepEqual(contexts(f.reads),['sv_usuarios','sv_chat_roles','sv_permisos']);
 assert.deepEqual(f.reads.filter(path=>path.startsWith('sisventas/')),['sisventas/presupuestos/budget [on]']);
 assert.equal(f.transactions.length,1);assert.deepEqual(f.verifications,[{token:'a',checkRevoked:true}]);noFullRecords(f.reads);
});

test('listado conserva sus cuatro lecturas y no consume otro contexto de preparar',async()=>{
 const f=setup();await f.api.list(await f.authorize());
 assert.deepEqual(f.reads,['sv_usuarios','sv_chat_roles','sv_permisos','sisventas/presupuestos']);
 f.reads.length=0;await f.api.prepare(await f.authorize(),{id:'budget'});
 assert.equal(contexts(f.reads).length,3);assert.equal(f.reads.length,4);assert.equal(f.verifications.length,2);
});

test('preparar identidad histórica preserva valores y autoría y sigue siendo idempotente',async()=>{
 const f=setup(),before=structuredClone(f.db.root.sisventas.presupuestos.budget);
 const first=(await f.api.prepare(await f.authorize(),{id:'budget'})).record;
 assert.equal(first.responsableUid,'a');assert.equal(first.total,before.total);assert.equal(first.fecha,before.fecha);
 assert.equal(first.creadoPor,before.creadoPor);assert.equal(first.creadorOriginalNombre,'Persona a');assert.equal(first.audit.length,before.audit.length+1);
 const second=(await f.api.prepare(await f.authorize(),{id:'budget'})).record;
 assert.deepEqual(second,first);assert.equal(contexts(f.reads).length,6);noFullRecords(f.reads);
});

test('la instantánea autorizada es de un solo uso, aunque un consumidor interno reutilice el mismo actor',async()=>{
 const f=setup(),actor=await f.authorize();await f.api.prepare(actor,{id:'budget'});f.reads.length=0;
 f.db.root.sisventas.presupuestos.budget.responsableUid='b';
 await assert.rejects(f.api.prepare(actor,{id:'budget'}),{statusCode:403});
 assert.equal(contexts(f.reads).length,3);noFullRecords(f.reads);
});

for(const change of ['inactivo','módulo bloqueado','token revocado'])test('otra solicitud revalida el acceso después de '+change,async()=>{
 const f=setup();await f.api.prepare(await f.authorize(),{id:'budget'});
 const before=structuredClone(f.db.root.sisventas.presupuestos.budget);f.reads.length=0;f.transactions.length=0;
 if(change==='inactivo')f.db.root.sv_chat_roles.a.activo=false;
 if(change==='módulo bloqueado')for(const module of ['presupuesto','venta','detalle','balancecompra'])f.db.root.sv_permisos.vendedor.indiceModulos[module]=false;
 if(change==='token revocado')f.revoke();
 await assert.rejects(async()=>f.api.prepare(await f.authorize(),{id:'budget'}),{statusCode:change==='token revocado'?401:403});
 assert.equal(f.verifications.length,2);assert.equal(f.transactions.length,0);assert.deepEqual(f.db.root.sisventas.presupuestos.budget,before);
 assert.ok(!f.reads.some(path=>path.startsWith('sisventas/')));
});

test('una solicitud nueva falla cerrada si no se puede leer el contexto',async()=>{
 const f=setup();await f.api.prepare(await f.authorize(),{id:'budget'});const before=structuredClone(f.db.root.sisventas);f.reads.length=0;
 f.setFailure('sv_permisos');await assert.rejects(async()=>f.api.prepare(await f.authorize(),{id:'budget'}),/Lectura ficticia rechazada/);
 assert.deepEqual(contexts(f.reads),['sv_usuarios','sv_chat_roles','sv_permisos']);assert.deepEqual(f.db.root.sisventas,before);
});

test('registro ajeno y Ver como no se pueden preparar para escribir',async()=>{
 const f=setup();f.db.root.sisventas.presupuestos.budget.responsableUid='b';const before=structuredClone(f.db.root.sisventas);
 await assert.rejects(f.api.prepare(await f.authorize(),{id:'budget'}),{statusCode:403});
 const actor=await f.authorize('admin','presupuestos','a');f.transactions.length=0;
 await assert.rejects(f.api.prepare(actor,{id:'budget'}),{statusCode:403});assert.equal(f.transactions.length,0);assert.deepEqual(f.db.root.sisventas,before);
});

test('una reasignación posterior a la lectura inicial se comprueba dentro de la transacción',async()=>{
 const f=setup(),actor=await f.authorize();
 f.beforeTransaction(()=>{f.db.root.sisventas.presupuestos.budget.responsableUid='b';});
 await assert.rejects(f.api.prepare(actor,{id:'budget'}),{statusCode:403});
 assert.equal(f.db.root.sisventas.presupuestos.budget.responsableUid,'b');assert.equal(f.db.root.sisventas.presupuestos.budget.audit.length,1);
});

test('preparaciones concurrentes no duplican vinculación ni auditoría',async()=>{
 const f=setup(),a=await f.authorize(),b=await f.authorize(),before=structuredClone(f.db.root.sisventas.presupuestos.budget);
 await Promise.all([f.api.prepare(a,{id:'budget'}),f.api.prepare(b,{id:'budget'})]);
 const record=f.db.root.sisventas.presupuestos.budget;
 assert.equal(record.responsableUid,'a');assert.equal(record.audit.length,before.audit.length+1);assert.equal(record.total,before.total);assert.equal(contexts(f.reads).length,6);
});

test('reasignar conserva su revalidación de contexto y rechaza destino deshabilitado después de autorizar',async()=>{
 const f=setup(),actor=await f.authorize('admin'),before=structuredClone(f.db.root.sisventas.presupuestos.budget);
 f.db.root.sv_chat_roles.b.activo=false;
 await assert.rejects(f.api.assign(actor,{id:'budget',uid:'b',revision:0,owner:''}),{statusCode:403});
 assert.equal(contexts(f.reads).length,6);assert.equal(f.transactions.length,0);assert.deepEqual(f.db.root.sisventas.presupuestos.budget,before);
});

test('reasignación concurrente conserva la primera decisión y rechaza una revisión vieja',async()=>{
 const f=setup(),actor=await f.authorize('admin'),before=structuredClone(f.db.root.sisventas.presupuestos.budget);
 await f.api.assign(actor,{id:'budget',uid:'b',revision:0,owner:''});
 await assert.rejects(f.api.assign(await f.authorize('admin'),{id:'budget',uid:'a',revision:0,owner:''}),{statusCode:409});
 const record=f.db.root.sisventas.presupuestos.budget;
 assert.equal(record.responsableUid,'b');assert.equal(record.responsableRevision,1);assert.equal(record.total,before.total);assert.equal(record.fecha,before.fecha);assert.equal(record.creadoPor,before.creadoPor);assert.equal(record.audit.length,before.audit.length+1);
});

test('preparar Ventas usa el contexto de su solicitud y conserva su resolución histórica de presupuestos',async()=>{
 const f=setup(),before=structuredClone(f.db.root.sisventas.ventas.converted);
 const result=await f.api.prepare(await f.authorize('admin','ventas'),{id:'converted'});
 assert.equal(contexts(f.reads).length,3);assert.equal(result.record.responsableUid,'a');assert.equal(result.record.total,before.total);
 assert.equal(result.record.presupuestoFbKey,before.presupuestoFbKey);assert.equal(result.record.usuario,before.usuario);assert.equal(result.record.creadorOriginalNombre,'Persona a');
 assert.deepEqual(f.reads.filter(path=>path.startsWith('sisventas/')),['sisventas/ventas/converted [on]','sisventas/presupuestos/budget']);
});
