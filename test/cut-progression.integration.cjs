'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const dep=createRequire(path.resolve('tmp/firebase-security-tools/package.json'));
const {initializeTestEnvironment,assertFails,assertSucceeds}=dep('@firebase/rules-unit-testing');
const {ref,set,get,query,orderByChild,equalTo,runTransaction}=dep('firebase/database');
async function fixture(stage,run){
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9005')throw Error('Solo emulador demo loopback');
 const env=await initializeTestEnvironment({projectId:'demo-sisventas-security',database:{host:'127.0.0.1',port:9005,rules:require('./helpers/security-candidate.cjs').rulesFor(stage)}});
 try{
  await env.withSecurityRulesDisabled(async c=>{const db=c.database();await set(ref(db),{
   sv_chat_roles:{a:{activo:true,rol:'tecnico'},b:{activo:true,rol:'tecnico'},unknown:{activo:true,rol:'inventado'}},
   sv_usuarios:{pa:{uid:'a',empleadoFbKey:'ea'},pb:{uid:'b',empleadoFbKey:'eb'}},
   sv_empleado_uid:{a:{perfilFbKey:'pa',empleadoFbKey:'ea'},b:{perfilFbKey:'pb',empleadoFbKey:'eb'}},
   sisventas:{config:{version:'v3.11.7-firebase'},ctaemp:{ea:{m:{monto:10}},eb:{m:{monto:20}}},
    gastos:{a1:{empleadoId:'ea',monto:1},a2:{empleadoFbKey:'ea',monto:2},b1:{empleadoId:'eb',monto:3}},
    vacaciones:{va:{empleadoId:'ea'},vb:{empleadoId:'eb'}},productos:{p:{stock:10,categoria:'OTRA',venta:100}}}
  });});
  await run(env,env.authenticatedContext('a').database(),env.authenticatedContext('b').database());
 }finally{await env.cleanup();}
}
test('Corte 1 de roles conocidos conserva las lecturas internas actuales, sin afirmar aislamiento por empleado',()=>fixture('known-role-read',async(env,db)=>{
 await assertSucceeds(get(ref(db,'sisventas/config/version')));await assertSucceeds(get(ref(db,'sisventas/ctaemp/ea')));
 await assertSucceeds(get(ref(db,'sisventas/ctaemp/eb'))); // Todavía hereda el padre interno.
 await assertFails(get(ref(env.authenticatedContext('unknown').database(),'sisventas')));
}));
test('El snapshot intermedio de dominios no puede desplegarse solo: rechaza consultas propias necesarias',()=>fixture('domain-read',async(env,db)=>{
 await assertSucceeds(get(ref(db,'sisventas/config/version')));
 await assertFails(get(query(ref(db,'sisventas/gastos'),orderByChild('empleadoId'),equalTo('ea'))));
 await assertFails(get(query(ref(db,'sisventas/vacaciones'),orderByChild('empleadoId'),equalTo('ea'))));
}));
for(const stage of ['employee-account-read','audit-final'])test('Corte combinado '+stage+' conserva las consultas del cliente y aísla ambas cuentas',()=>fixture(stage,async(env,a,b)=>{
 for(const [db,own,other] of [[a,'ea','eb'],[b,'eb','ea']]){
  await assertSucceeds(get(ref(db,'sisventas/config/version')));
  await assertSucceeds(get(ref(db,'sisventas/ctaemp/'+own)));await assertFails(get(ref(db,'sisventas/ctaemp/'+other)));
  await assertFails(get(ref(db,'sisventas/ctaemp')));await assertFails(get(ref(db,'sisventas/gastos')));
  for(const field of ['empleadoId','empleadoFbKey']){
   const snap=await assertSucceeds(get(query(ref(db,'sisventas/gastos'),orderByChild(field),equalTo(own))));
   assert.equal(Object.keys(snap.val()||{}).length,own==='ea'||field==='empleadoId'?1:0);
   await assertFails(get(query(ref(db,'sisventas/gastos'),orderByChild(field),equalTo(other))));
  }
  await assertSucceeds(get(query(ref(db,'sisventas/vacaciones'),orderByChild('empleadoId'),equalTo(own))));
  await assertFails(get(query(ref(db,'sisventas/vacaciones'),orderByChild('empleadoId'),equalTo(other))));
 }
 await env.withSecurityRulesDisabled(async c=>set(ref(c.database(),'sv_chat_roles/a/activo'),false));
 await assertFails(get(ref(a,'sisventas/ctaemp/ea')));await assertSucceeds(get(ref(b,'sisventas/ctaemp/eb')));
}));
test('La candidata final permite transacciones técnicas concurrentes de unidades sin abrir precios',()=>fixture('audit-final',async(env,a,b)=>{
 const result=await Promise.all([runTransaction(ref(a,'sisventas/productos/p/stock'),n=>n-1),runTransaction(ref(b,'sisventas/productos/p/stock'),n=>n-2)]);
 assert.ok(result.every(r=>r.committed));assert.equal((await get(ref(a,'sisventas/productos/p/stock'))).val(),7);
 await assertFails(set(ref(a,'sisventas/productos/p/venta'),1));
}));
