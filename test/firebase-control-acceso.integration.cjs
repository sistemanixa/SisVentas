'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const dependency=require('node:module').createRequire(require('node:path').resolve('tmp/firebase-security-tools/package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=dependency('@firebase/rules-unit-testing');
const {ref,set,get,update,runTransaction,onValue}=dependency('firebase/database');
const {reglasControlAcceso}=require('../scripts/generar-reglas-control-acceso.cjs');
let env;
const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9005')throw Error('Solo emulador local');
 const baseline=JSON.parse(fs.readFileSync('security/database.identity.rules.json','utf8'));
 env=await initializeTestEnvironment({projectId:'demo-sisventas-security',database:{host:'127.0.0.1',port:9005,rules:JSON.stringify(reglasControlAcceso(baseline,{cerrarLegacy:true}))}});
 await env.withSecurityRulesDisabled(async c=>{
  await set(ref(c.database()),{
   sv_chat_roles:Object.fromEntries(roles.map(rol=>[rol,{rol,activo:true}])),
   sv_usuarios:Object.fromEntries(roles.map(rol=>['key_'+rol,{uid:rol,rol,activo:true,nombre:rol}])),
   sv_permisos:{_version:1,vendedor:{acciones:{productos:{gestionarCategorias:true}}}},
   sisventas:{ventas:{v1:{total:1250.75,totalPagado:0}},config:{version:'prueba'}}
  });
 });
});
after(async()=>{if(env)await env.cleanup();});
for(const rol of roles.filter(r=>r!=='admin'))test(rol+' no modifica roles ni fichas de usuarios',async()=>{
 const db=env.authenticatedContext(rol).database();
 await assertSucceeds(get(ref(db,'sv_usuarios')));
 await assertSucceeds(get(ref(db,'sv_permisos')));
 await assertFails(set(ref(db,'sv_permisos/vendedor/acciones/ventas/eliminar'),true));
 await assertFails(set(ref(db,'sv_usuarios/key_'+rol+'/rol'),'admin'));
 await assertFails(set(ref(db,'sv_usuarios/key_'+rol),null));
 await assertFails(set(ref(db,'sv_usuarios/nuevo'),{uid:rol,rol:'admin'}));
 await assertFails(update(ref(db),{['sv_usuarios/key_'+rol+'/rol']:'admin','sisventas/ventas/v1/total':1}));
 assert.equal((await get(ref(db,'sisventas/ventas/v1/total'))).val(),1250.75);
});
test('cada usuario puede actualizar solo sus marcas de acceso',async()=>{
 const db=env.authenticatedContext('tecnico').database();
 await assertSucceeds(update(ref(db,'sv_usuarios/key_tecnico'),{ultimoAcceso:Date.now(),ultimoAccesoEn:Date.now()}));
 await assertFails(update(ref(db,'sv_usuarios/key_admin'),{ultimoAcceso:Date.now()}));
 await assertFails(update(ref(db,'sv_usuarios/key_tecnico'),{ultimoAcceso:Date.now(),activo:false}));
 await assertFails(set(ref(db,'sv_usuarios/key_tecnico/ultimoAcceso'),'ayer'));
});
test('admin guarda permisos personalizados sin normalizarlos ni perderlos',async()=>{
 const db=env.authenticatedContext('admin').database();
 const custom={_version:99,tecnico:{bloqueados:['ventas'],acciones:{catalogo:{solicitarPresupuesto:true},productos:{gestionarCategorias:false}}}};
 await assertSucceeds(set(ref(db,'sv_permisos'),custom));
 assert.deepEqual((await get(ref(db,'sv_permisos'))).val(),custom);
});
test('guardado real de usuario y chat actualiza ambas identidades atómicamente',async()=>{
 const db=env.authenticatedContext('admin').database();
 const window={SV_SECURITY_STORAGE_V2:true,fbDB:db,fbRef:ref,fbGet:get,fbOnValue:onValue,fbUpdate:update,usuariosData:[{fbKey:'key_tecnico',uid:'tecnico',rol:'tecnico',nombre:'tecnico',activo:true}]};
 vm.runInNewContext(fs.readFileSync('js/modules/security-storage.js','utf8'),{window});
 await window.svPrepararRutasSeguridad({uid:'admin'});
 vm.runInNewContext(fs.readFileSync('js/modules/chat-access.js','utf8'),{window,setInterval:()=>{}});
 await assertSucceeds(window.guardarUsuarioConAccesoChat({uid:'tecnico',rol:'tecnico',nombre:'Nombre corregido',activo:true},'key_tecnico'));
 assert.equal((await get(ref(db,'sv_usuarios/key_tecnico/nombre'))).val(),'Nombre corregido');
 assert.equal((await get(ref(db,'sv_chat_directorio/tecnico/nombre'))).val(),'Nombre corregido');
 await assertSucceeds(window.cambiarEstadoUsuarioConAccesoChat('key_tecnico',false));
 await assertFails(get(ref(env.authenticatedContext('tecnico').database(),'sisventas')));
});
test('no se pueden recrear las rutas antiguas ni escribiendo la raíz comercial',async()=>{
 const db=env.authenticatedContext('administrativo').database();
 await assertFails(set(ref(db,'sisventas/usuarios/falso'),{rol:'admin'}));
 await assertFails(set(ref(db,'sisventas/config/permisos'),{admin:true}));
 const root=(await get(ref(db,'sisventas'))).val();
 root.usuarios={falso:{rol:'admin'}};
 await assertFails(set(ref(db,'sisventas'),root));
});
test('transacción comercial raíz sigue funcionando con controles fuera de ella',async()=>{
 const db=env.authenticatedContext('administrativo').database();
 const result=await assertSucceeds(runTransaction(ref(db,'sisventas'),root=>{
  if(root===null)return null;
  root.ventas.v1.totalPagado=50.75;root.pagos={p1:{monto:50.75}};return root;
 },{applyLocally:false}));
 assert.equal(result.committed,true);
 assert.equal(result.snapshot.val().ventas.v1.totalPagado,50.75);
});
test('sesión desconocida no puede leer ni escribir los controles',async()=>{
 const db=env.authenticatedContext('ajeno').database();
 for(const route of ['sv_usuarios','sv_permisos']){
  await assertFails(get(ref(db,route)));
  await assertFails(set(ref(db,route),{valor:1}));
 }
});
test('traslado multipath copia y retira solo los controles bajo reglas finales',async()=>{
 const {planMigration,migrationPatch}=require('../scripts/control-access-migration.cjs');
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.database(),root=(await get(ref(db))).val();
  root.sisventas.usuarios=root.sv_usuarios;root.sisventas.config.permisos=root.sv_permisos;
  delete root.sv_usuarios;delete root.sv_permisos;
  await set(ref(db),root);
  const plan=planMigration(root);
  await update(ref(db),migrationPatch(plan));
  const saved=(await get(ref(db))).val();
  assert.deepEqual(saved.sv_usuarios,plan.users);
  assert.deepEqual(saved.sv_permisos,plan.permissions);
  assert.deepEqual(saved.sisventas.ventas,root.sisventas.ventas);
  assert.equal(saved.sisventas.usuarios,undefined);
  assert.equal(saved.sisventas.config.permisos,undefined);
 });
});
