'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),{createRequire}=require('module'),path=require('path');
const dep=createRequire(path.resolve('tmp/firebase-security-tools/package.json'));
const {initializeTestEnvironment,assertFails,assertSucceeds}=dep('@firebase/rules-unit-testing'),{ref,set,get}=dep('firebase/database');let env;
before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9005')throw Error('Solo emulador local');
 env=await initializeTestEnvironment({projectId:'demo-sisventas-security',database:{host:'127.0.0.1',port:9005,rules:fs.readFileSync('security/database.known-role-read.candidate.json','utf8')}});
 await env.withSecurityRulesDisabled(async ctx=>{
  const roles={};for(const rol of ['admin','administrativo','vendedor','tecnico_vendedor','tecnico','inventado','distribuidora','compras_paraguay'])roles[rol]={activo:true,rol};roles.inactivo={activo:false,rol:'admin'};
  await set(ref(ctx.database()),{sv_chat_roles:roles,sisventas:{clientes:{ficticio:{nombre:'Prueba'}},ventas:{ficticia:{total:1}},config:{tipoCambio:{oficial:100}}}});
 });
});
after(async()=>{await env?.cleanup();});
test('La candidata cambia únicamente el permiso de lectura padre',()=>{
 const base=JSON.parse(fs.readFileSync('security/database.domain-write.candidate.json','utf8')),candidate=JSON.parse(fs.readFileSync('security/database.known-role-read.candidate.json','utf8'));
 candidate.rules.sisventas['.read']=base.rules.sisventas['.read'];assert.deepEqual(candidate,base);
});
test('Todos los roles internos activos conservan sus lecturas actuales',async()=>{
 for(const role of ['admin','administrativo','vendedor','tecnico_vendedor','tecnico'])for(const node of ['sisventas','sisventas/clientes','sisventas/ventas'])await assertSucceeds(get(ref(env.authenticatedContext(role).database(),node)));
});
test('Identidades desconocidas, externas, inactivas y anónimas no leen datos comerciales',async()=>{
 for(const ctx of [env.unauthenticatedContext(),...['inventado','distribuidora','compras_paraguay','inactivo','sin-identidad'].map(r=>env.authenticatedContext(r))]){const db=ctx.database();for(const node of ['sisventas','sisventas/clientes','sisventas/ventas'])await assertFails(get(ref(db,node)));}
});
test('La cotización deliberadamente pública conserva su lectura',async()=>{await assertSucceeds(get(ref(env.unauthenticatedContext().database(),'sisventas/config/tipoCambio/oficial')));});
