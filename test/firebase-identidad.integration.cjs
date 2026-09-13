'use strict';
const {test,after,before}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const dependency=createRequire(require('node:path').resolve('tmp/firebase-security-tools/package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=dependency('@firebase/rules-unit-testing');
const {ref,get,set,update,runTransaction}=dependency('firebase/database');
const {restringirIdentidad}=require('../scripts/generar-reglas-identidad.cjs');
let env;
const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
before(async()=>{
  // Sin emulador explícito se aborta: estas pruebas nunca apuntan a producción.
  if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9005')throw Error('Requiere emulador local en 127.0.0.1:9005');
  const baseline=JSON.parse(fs.readFileSync('docs/auditoria-v3.6.0/reglas-rtdb.json','utf8'));
  env=await initializeTestEnvironment({projectId:'demo-sisventas-security',database:{host:'127.0.0.1',port:9005,rules:JSON.stringify(process.env.SV_RULES_BASELINE==='1'?baseline:restringirIdentidad(baseline))}});
  await env.withSecurityRulesDisabled(async context=>{
    const identities=Object.fromEntries(roles.map(rol=>[rol,{rol,activo:true}]));
    identities.inactivo={rol:'administrativo',activo:false};
    await set(ref(context.database()),{sv_chat_roles:identities,sisventas:{ventas:{v1:{total:106729.56,totalPagado:0}},config:{version:'ficticia'}},sv_chat:{general:{m1:{texto:'ficticio'}},admin:{m1:{texto:'ficticio'}}}});
  });
});
after(async()=>{if(env)await env.cleanup();});
for(const actor of ['anonimo','desconocido','inactivo']){
  test(actor+' no lee ni escribe datos generales',async()=>{
    const db=(actor==='anonimo'?env.unauthenticatedContext():env.authenticatedContext(actor)).database();
    await assertFails(get(ref(db,'sisventas')));
    await assertFails(set(ref(db,'sisventas/ventas/ataque'),{total:1}));
  });
}
for(const rol of roles)test(rol+' conserva lectura y escritura existente',async()=>{
  const db=env.authenticatedContext(rol).database();
  await assertSucceeds(get(ref(db,'sisventas')));
  await assertSucceeds(set(ref(db,'sisventas/prueba/'+rol),{valor:1}));
});
test('cobro multipath conserva atomicidad y centavos',async()=>{
  const db=env.authenticatedContext('administrativo').database();
  const result=await assertSucceeds(runTransaction(ref(db,'sisventas'),root=>{
    if(!root)return root;
    root.ventas.v1.totalPagado=106729.56;
    root.pagos={p1:{monto:106729.56,ventaFbKey:'v1'}};
    return root;
  },{applyLocally:false}));
  assert.equal(result.committed,true);
  assert.equal(result.snapshot.val().ventas.v1.totalPagado,106729.56);
  assert.equal(result.snapshot.val().pagos.p1.monto,106729.56);
});
test('función real de cobro: dos intentos concurrentes no exceden el saldo',async()=>{
  const index=fs.readFileSync('index.html','utf8');
  const active=index.match(/src="\.\/(js\/app\.v[\d.]+\.js)/)[1];
  const app=fs.readFileSync(active,'utf8');
  const start=app.indexOf('function _registrarCobroAtomico(');
  const end=app.indexOf('\nfunction registrarPago(',start);
  assert.ok(start>=0&&end>start);
  await env.withSecurityRulesDisabled(async c=>{
    await set(ref(c.database(),'sisventas/ventas/concurrente'),{id:'V-FICTICIA',total:106729.56,totalPagado:0});
  });
  function client(){
    const sandbox={window:{fbDB:env.authenticatedContext('administrativo').database(),fbRef:ref,fbRunTransaction:runTransaction}};
    vm.runInNewContext(app.slice(start,end),sandbox);
    return sandbox;
  }
  const attempts=await Promise.allSettled([client()._registrarCobroAtomico('concurrente',{fbKey:'concurrente1',monto:106729.56}),client()._registrarCobroAtomico('concurrente',{fbKey:'concurrente2',monto:106729.56})]);
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1,attempts.map(x=>x.reason?.message||'guardado').join('; '));
  const db=env.authenticatedContext('admin').database();
  assert.equal((await get(ref(db,'sisventas/ventas/concurrente/totalPagado'))).val(),106729.56);
  const pagos=(await get(ref(db,'sisventas/pagos'))).val();
  assert.equal(Object.values(pagos).filter(p=>p.ventaFbKey==='concurrente').length,1);
});
test('un usuario no puede habilitarse ni promoverse en la identidad protegida',async()=>{
  const db=env.authenticatedContext('tecnico').database();
  await assertFails(update(ref(db),{'sv_chat_roles/tecnico/rol':'admin','sisventas/prueba/escape':true}));
  assert.equal((await get(ref(db,'sisventas/prueba/escape'))).exists(),false);
  await assertFails(set(ref(env.authenticatedContext('inactivo').database(),'sv_chat_roles/inactivo/activo'),true));
});
test('admin desactiva ficha y acceso en una operación; siguiente lectura es rechazada',async()=>{
  await assertSucceeds(update(ref(env.authenticatedContext('admin').database()),{'sisventas/usuarios/tecnico/activo':false,'sv_chat_roles/tecnico/activo':false,'sv_chat_directorio/tecnico/activo':false}));
  await assertFails(get(ref(env.authenticatedContext('tecnico').database(),'sisventas')));
});
test('borradores continúan privados y chat administrativo rechaza técnicos',async()=>{
  const db=env.authenticatedContext('tecnico_vendedor').database();
  await assertSucceeds(set(ref(db,'sv_borradores/tecnico_vendedor/d1'),{id:'d1',updated:1,schema:1,kind:'presupuesto',data:{nota:'ficticia'}}));
  await assertFails(get(ref(db,'sv_borradores/admin')));
  await assertFails(get(ref(env.authenticatedContext('inactivo').database(),'sv_chat/admin')));
});
test('la fase cambia únicamente las dos condiciones generales',()=>{
  const original=JSON.parse(fs.readFileSync('docs/auditoria-v3.6.0/reglas-rtdb.json','utf8'));
  const generated=restringirIdentidad(original);
  generated.rules.sisventas['.read']=original.rules.sisventas['.read'];
  generated.rules.sisventas['.write']=original.rules.sisventas['.write'];
  assert.deepEqual(generated,original);
});
