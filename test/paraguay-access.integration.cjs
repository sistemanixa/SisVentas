const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const dependency=require('node:module').createRequire(require('node:path').resolve(process.env.SV_SECURITY_TOOLS_ROOT || 'tmp/firebase-security-tools','package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=dependency('@firebase/rules-unit-testing');
const {ref,set,get,query,orderByChild,equalTo}=dependency('firebase/database');
let env,db;
before(async()=>{
  if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9005')throw Error('Solo emulador local');
  env=await initializeTestEnvironment({projectId:'demo-sisventas-security',database:{host:'127.0.0.1',port:9005,rules:fs.readFileSync('security/database.paraguay.rules.json','utf8')}});
  await env.withSecurityRulesDisabled(async c=>set(ref(c.database()),{
    sv_chat_roles:{...Object.fromEntries(['administrativo','vendedor','tecnico','tecnico_vendedor'].map(rol=>[rol,{rol,activo:true}])),py:{rol:'compras_paraguay',activo:true},otro:{rol:'compras_paraguay',activo:true},admin:{rol:'admin',activo:true},baja:{rol:'compras_paraguay',activo:false}},
    sv_usuarios:{userpy:{uid:'py',rol:'compras_paraguay',nombre:'Prueba'},admin:{uid:'admin',rol:'admin'}},
    sisventas:{productos:{py1:{categoria:'COMPRAS PARAGUAY',nombre:'Patinete'},local1:{categoria:'CAMARAS IP',nombre:'Local'}},clientes:{privado:true},ventas:{privado:true}}
  }));
  db=env.authenticatedContext('py').database();
});
after(async()=>{if(env)await env.cleanup();});
test('query de categoría devuelve exclusivamente Paraguay y bloquea lectura general o individual ajena',async()=>{
  const snap=await assertSucceeds(get(query(ref(db,'sisventas/productos'),orderByChild('categoria'),equalTo('COMPRAS PARAGUAY'))));
  assert.deepEqual(Object.keys(snap.val()),['py1']);
  for(const path of ['sisventas','sisventas/productos','sisventas/productos/local1','sisventas/clientes','sisventas/ventas','sv_chat_directorio','sv_permisos'])await assertFails(get(ref(db,path)));
  await assertFails(get(query(ref(db,'sisventas/productos'),orderByChild('categoria'),equalTo('CAMARAS IP'))));
});
test('lee solo su ficha y no puede cambiar productos, usuarios ni roles',async()=>{
  const snap=await assertSucceeds(get(query(ref(db,'sv_usuarios'),orderByChild('uid'),equalTo('py'))));
  assert.deepEqual(Object.keys(snap.val()),['userpy']);
  await assertFails(get(ref(db,'sv_usuarios')));
  await assertFails(get(query(ref(db,'sv_usuarios'),orderByChild('uid'),equalTo('admin'))));
  for(const path of ['sisventas/productos/py1/nombre','sv_chat_roles/py/rol','sv_usuarios/userpy/rol'])await assertFails(set(ref(db,path),'admin'));
});
const list={nombre:'Viaje',productos:{py1:2},actualizadoEn:Date.now()};
test('guarda y recupera su lista; otra cuenta no puede leerla ni modificarla',async()=>{
  await assertSucceeds(set(ref(db,'sv_listas_paraguay/py/lista1'),list));
  assert.equal((await assertSucceeds(get(ref(db,'sv_listas_paraguay/py/lista1')))).val().productos.py1,2);
  const other=env.authenticatedContext('otro').database();
  await assertFails(get(ref(other,'sv_listas_paraguay/py')));
  await assertFails(set(ref(other,'sv_listas_paraguay/py/lista1'),list));
  await assertSucceeds(get(ref(env.authenticatedContext('admin').database(),'sv_listas_paraguay/py')));
});
test('rechaza productos ajenos, cantidades inválidas, campos extra y usuarios inactivos',async()=>{
  for(const productos of [{local1:1},{py1:0},{py1:1.5},{py1:10000}])await assertFails(set(ref(db,'sv_listas_paraguay/py/invalida'),{...list,productos}));
  await assertFails(set(ref(db,'sv_listas_paraguay/py/invalida'),{...list,rol:'admin'}));
  await assertFails(get(query(ref(env.authenticatedContext('baja').database(),'sisventas/productos'),orderByChild('categoria'),equalTo('COMPRAS PARAGUAY'))));
  await assertSucceeds(get(ref(env.authenticatedContext('admin').database(),'sisventas')));
});

test('roles existentes conservan lectura y escritura comercial',async()=>{
 for(const rol of ['admin','administrativo','vendedor','tecnico','tecnico_vendedor']){
  const other=env.authenticatedContext(rol).database();
  await assertSucceeds(get(ref(other,'sisventas')));
  await assertSucceeds(set(ref(other,'sisventas/compatibilidad/'+rol),true));
 }
});

test('admin crea listas propias y edita las de Paraguay sin habilitar otros roles',async()=>{
 const admin=env.authenticatedContext('admin').database();
 await assertSucceeds(set(ref(admin,'sv_listas_paraguay/admin/propia'),list));
 await assertSucceeds(set(ref(admin,'sv_listas_paraguay/py/lista1'),{...list,nombre:'Editada por admin',productos:{py1:3}}));
 assert.equal((await get(ref(db,'sv_listas_paraguay/py/lista1'))).val().productos.py1,3);
 await assertFails(set(ref(admin,'sv_listas_paraguay/py/invalida'),{...list,productos:{local1:1}}));
 for(const rol of ['administrativo','vendedor','tecnico','tecnico_vendedor','baja','otro']){
   await assertFails(set(ref(env.authenticatedContext(rol).database(),'sv_listas_paraguay/py/lista1'),list));
 }
});
