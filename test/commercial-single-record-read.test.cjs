'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/commercial-ownership-fixtures.cjs');
function setup(){const f=fixture(),reads=[],ref=f.db.ref.bind(f.db);f.db.ref=path=>{const target=ref(path);return {...target,get:async()=>{reads.push(path);return target.get();}};};return {...f,reads};}
function noCollections(reads){assert.ok(!reads.includes('sisventas/ventas'),'Una ficha no descarga toda Ventas');assert.ok(!reads.includes('sisventas/presupuestos'),'Una ficha no descarga todo Presupuestos');}
test('acceso a una venta canónica relee la ficha exacta y conserva el registro sin recorrer historiales',async()=>{
 const f=setup();f.db.root.sisventas.ventas.one.responsableUid='a';const actor=await f.auth('a'),before=structuredClone(f.db.root);f.reads.length=0;
 assert.equal((await f.api.assertRecord(actor,'ventas','one')).id,'V-FICTICIA');noCollections(f.reads);
 assert.deepEqual(f.reads.filter(p=>p.startsWith('sisventas/')),['sisventas/ventas/one']);assert.deepEqual(f.db.root,before);
});
test('venta histórica convertida sólo consulta su presupuesto de origen y mantiene al autor como propietario',async()=>{
 const f=setup(),actor=await f.auth('a');f.reads.length=0;assert.equal((await f.api.assertRecord(actor,'ventas','converted')).total,200);noCollections(f.reads);
 assert.deepEqual(f.reads.filter(p=>p.startsWith('sisventas/')).sort(),['sisventas/presupuestos/budget','sisventas/ventas/converted']);
 await assert.rejects(f.api.assertRecord(await f.auth('b'),'ventas','converted'),{statusCode:404});
});
test('admin, presupuesto puntual y Ver como conservan sus accesos usando sólo el registro necesario',async()=>{
 const f=setup();let actor=await f.auth('admin');f.reads.length=0;await f.api.assertRecord(actor,'ventas','converted');noCollections(f.reads);assert.deepEqual(f.reads.filter(p=>p.startsWith('sisventas/')),['sisventas/ventas/converted']);
 actor=await f.auth('a','presupuestos');f.reads.length=0;await f.api.assertRecord(actor,'presupuestos','budget');noCollections(f.reads);assert.deepEqual(f.reads.filter(p=>p.startsWith('sisventas/')),['sisventas/presupuestos/budget']);
 actor=await f.auth('admin','ventas','b');await assert.rejects(f.api.assertRecord(actor,'ventas','one'),{statusCode:404});
});
test('una referencia histórica ausente o inválida no accede a otra ruta y conserva la autoría de la venta',async()=>{
 for(const source of ['desaparecido','../empleados','otro/registro',{},'']){
  const f=setup();f.db.root.sisventas.ventas.other.presupuestoFbKey=source;const actor=await f.auth('b');f.reads.length=0;
  assert.equal((await f.api.assertRecord(actor,'ventas','other')).total,300);noCollections(f.reads);
  assert.ok(!f.reads.some(p=>p.includes('..')||p.endsWith('/[object Object]')));
 }
});
test('otra persona, registro inexistente o identificador inválido no obtienen una ficha',async()=>{
 const f=setup(),actor=await f.auth('a');await assert.rejects(f.api.assertRecord(actor,'ventas','other'),{statusCode:404});
 await assert.rejects(f.api.assertRecord(actor,'ventas','missing'),{statusCode:404});
 for(const id of ['../one','one/nested','',null])await assert.rejects(f.api.assertRecord(actor,'ventas',id),{statusCode:404});
 noCollections(f.reads);
});
test('ficha puntual conserva claves heredadas con espacios o Unicode y sigue comprobando propietario',async()=>{
 const f=setup(),actor=await f.auth('a','presupuestos');
 for(const id of ['presupuesto legado','Presupuesto ñ 日本語']){
  f.db.root.sisventas.presupuestos[id]={responsableUid:'a',total:100};f.reads.length=0;
  assert.equal((await f.api.assertRecord(actor,'presupuestos',id)).total,100);noCollections(f.reads);
  assert.deepEqual(f.reads.filter(p=>p.startsWith('sisventas/')),['sisventas/presupuestos/'+id]);
  await assert.rejects(f.api.assertRecord(await f.auth('b','presupuestos'),'presupuestos',id),{statusCode:404});
 }
});
test('ficha puntual rechaza propiedades especiales y controles sin consultar la base',async()=>{
 const f=setup(),actor=await f.auth('a','presupuestos');f.reads.length=0;
 for(const id of ['__proto__','constructor','prototype','hasOwnProperty','a\u007fb','x'.repeat(129)])await assert.rejects(f.api.assertRecord(actor,'presupuestos',id),{statusCode:404});
 assert.deepEqual(f.reads,[]);
});
test('fallo puntual espera el otro trabajo enviado antes de devolver el error original',async()=>{
 for(const failed of ['sv_usuarios','sisventas/presupuestos/budget']){
  const f=setup(),actor=await f.auth('a','presupuestos'),pending=[],error=Object.assign(Error('Fallo ficticio'),{code:'UNAVAILABLE'}),ref=f.db.ref.bind(f.db);
  f.db.ref=path=>{const target=ref(path);return {...target,get:async()=>{if(path===failed)throw error;await new Promise(resolve=>pending.push(resolve));return target.get();}};};
  let ended=false;const result=f.api.assertRecord(actor,'presupuestos','budget');result.catch(()=>{ended=true;});
  await new Promise(setImmediate);assert.equal(ended,false);assert.equal(pending.length,3);
  for(const release of pending)release();await assert.rejects(result,e=>e===error);
 }
});
