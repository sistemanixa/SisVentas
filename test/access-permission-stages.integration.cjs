'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module');
const dep=createRequire(path.resolve('tmp/firebase-security-tools/package.json'));
const {initializeTestEnvironment,assertFails,assertSucceeds}=dep('@firebase/rules-unit-testing');
const {ref,set,get,query,orderByChild,equalTo}=dep('firebase/database');
const {buildStages,stages}=require('../scripts/prepare-access-permission-stages.cjs');
const composed=buildStages();
async function fixture(stage,run){
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9005')throw Error('Solo emulador demo loopback');
 const env=await initializeTestEnvironment({projectId:'demo-sisventas-security',database:{host:'127.0.0.1',port:9005,rules:JSON.stringify(composed.stages[stage])}});
 try{
  await env.withSecurityRulesDisabled(async c=>set(ref(c.database()),{
   sv_chat_roles:{admin:{rol:'admin',activo:true},tech:{rol:'tecnico',activo:true},external:{rol:'distribuidora',activo:true}},
   sv_usuarios:{p:{uid:'tech',empleadoFbKey:'e'}},sv_empleado_uid:{tech:{perfilFbKey:'p',empleadoFbKey:'e'}},
   sv_catalogo_publico_index:{py:true},sv_catalogo_publico:{py:{nombre:'Ficticio',precioUSD:10}},
   sisventas:{clientes:{c:{nombre:'Cliente ficticio'}},config:{version:'v3.11.9-firebase',tipoCambio:{oficial:1500}},
    productos:{py:{categoria:'COMPRAS PARAGUAY',stock:3},other:{categoria:'OTRA',stock:1}},
    ctaemp:{e:{m:{monto:100}},other:{m:{monto:200}}},gastos:{g:{empleadoId:'e',monto:100},h:{empleadoId:'other',monto:200}}}
  }));
  await run(env,async(uid,value)=>env.withSecurityRulesDisabled(c=>set(ref(c.database(),'sv_access_resets/'+uid),value)));
 }finally{await env.cleanup();}
}
for(const stage of stages)test('guard de acceso no se pierde al activar la etapa '+stage,()=>fixture(stage,async(env,marker)=>{
 const normal=env.authenticatedContext('admin').database();
 await assertSucceeds(get(ref(normal,'sisventas/clientes')));
 await assertSucceeds(set(ref(normal,'sisventas/clientes/c/nombre'),'Nombre ficticio corregido'));
 for(const [claims,state]of [
  [{svPasswordChangeRequired:true},null],
  [{},{required:true,version:'v2',phase:'ready'}],
  [{svAccessVersion:'v1'},{required:false,version:'v2',phase:'complete'}],
  [{svAccessVersion:'v2'},{required:true,version:'v2',phase:'failed'}],
  [{},{required:false,version:'v2',phase:'complete'}]
 ]){
  await marker('admin',state);const db=env.authenticatedContext('admin',claims).database();
  for(const p of ['sisventas/clientes','sisventas/config/version'])await assertFails(get(ref(db,p)));
  await assertFails(set(ref(db,'sisventas/clientes/c/nombre'),'No debe guardarse'));
 }
 await marker('admin',{required:false,version:'v2',phase:'complete'});
 const ready=env.authenticatedContext('admin',{svAccessVersion:'v2',svPasswordChangeRequired:false}).database();
 await assertSucceeds(get(ref(ready,'sisventas/clientes')));
 await assertSucceeds(set(ref(ready,'sisventas/clientes/c/nombre'),'Acceso normal recuperado'));
 // El administrador cliente tampoco puede leer o escribir las marcas privadas.
 for(const node of ['sv_access_resets','sv_access_control']){
  await assertFails(get(ref(ready,node)));await assertFails(get(ref(ready,node+'/admin')));
  await assertFails(set(ref(ready,node+'/admin'),{required:false}));
 }
 assert.equal((await get(ref(ready,'sisventas/clientes/c/nombre'))).val(),'Acceso normal recuperado');
}));
for(const stage of ['employee-account-read','audit-final']){
 test(stage+': cuenta propia, consultas y vínculo siguen aislados después de completar acceso',()=>fixture(stage,async(env,marker)=>{
  await marker('tech',{required:false,version:'current',phase:'complete'});
  const tech=env.authenticatedContext('tech',{svAccessVersion:'current'}).database();
  await assertSucceeds(get(ref(tech,'sisventas/ctaemp/e')));
  await assertFails(get(ref(tech,'sisventas/ctaemp/other')));
  await assertSucceeds(get(query(ref(tech,'sisventas/gastos'),orderByChild('empleadoId'),equalTo('e'))));
  await assertFails(get(query(ref(tech,'sisventas/gastos'),orderByChild('empleadoId'),equalTo('other'))));
  await assertFails(set(ref(tech,'sv_usuarios/p/empleadoFbKey'),'other'));
  await assertFails(set(ref(tech,'sv_chat_roles/tech/rol'),'admin'));
  await marker('tech',{required:true,version:'next',phase:'ready'});
  await assertFails(get(ref(tech,'sisventas/ctaemp/e')));
  await assertFails(get(query(ref(tech,'sisventas/gastos'),orderByChild('empleadoId'),equalTo('e'))));
 }));
 test(stage+': Distribuidora y catálogo público conservan la excepción limitada con el guard',()=>fixture(stage,async(env,marker)=>{
  const publicDb=env.unauthenticatedContext().database();
  await assertSucceeds(get(ref(publicDb,'sisventas/config/tipoCambio/oficial')));
  await assertSucceeds(get(ref(publicDb,'sv_catalogo_publico_index')));
  const external=env.authenticatedContext('external').database(),read=db=>query(ref(db,'sisventas/productos'),orderByChild('categoria'),equalTo('COMPRAS PARAGUAY'));
  assert.deepEqual(Object.keys((await assertSucceeds(get(read(external)))).val()),['py']);
  await assertFails(get(ref(external,'sisventas/productos')));
  await assertFails(get(query(ref(external,'sisventas/productos'),orderByChild('categoria'),equalTo('OTRA'))));
  await marker('external',{required:true,version:'temporary'});await assertFails(get(read(external)));
  await marker('external',{required:false,version:'current'});await assertFails(get(read(external)));
  await assertSucceeds(get(read(env.authenticatedContext('external',{svAccessVersion:'current'}).database())));
 }));
}
