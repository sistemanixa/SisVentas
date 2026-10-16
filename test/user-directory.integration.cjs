'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{createRequire}=require('module');
const tools=createRequire(path.resolve('tmp/firebase-security-tools/package.json'));
const {initializeTestEnvironment,assertFails,assertSucceeds}=tools('@firebase/rules-unit-testing'),{ref,get,query,orderByChild,equalTo,set}=tools('firebase/database');
const {createUserDirectory}=require('../cotizador/user-directory');let env,adminApp,service;
const identities={admin:{rol:'admin',activo:true},worker:{rol:'tecnico',activo:true},seller:{rol:'vendedor',activo:true},portal:{rol:'distribuidora',activo:true}};
before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9005')throw Error('Solo RTDB demo loopback');
 env=await initializeTestEnvironment({projectId:'demo-sisventas-security',database:{host:'127.0.0.1',port:9005,rules:fs.readFileSync('security/database.user-directory.candidate.json','utf8')}});
 await env.withSecurityRulesDisabled(c=>set(ref(c.database()),{sv_chat_roles:identities,sv_usuarios:{a:{uid:'admin',rol:'admin',activo:true,nombre:'Admin',mail:'admin@example.test',claveAdmin:'FAKE_PRIVATE'},w:{uid:'worker',rol:'tecnico',activo:true,nombre:'Trabajador',password:'FAKE_PRIVATE',empleadoFbKey:'e'},s:{uid:'seller',rol:'vendedor',activo:true,nombre:'Ventas'},p:{uid:'portal',rol:'distribuidora',activo:true,nombre:'Portal'}},sisventas:{clientes:{c:{nombre:'Cliente ficticio'}}}}));
 const admin=require('../cotizador/node_modules/firebase-admin');adminApp=admin.initializeApp({projectId:'demo-sisventas-security',databaseURL:'https://demo-sisventas-security.firebaseio.com'},'user-directory-demo');
 service=createUserDirectory({db:adminApp.database(),auth:{verifyIdToken:async uid=>({uid})},enabled:true});
});
after(async()=>{await adminApp?.delete();await env?.cleanup();});
for(const uid of Object.keys(identities))test(uid+': no lee fichas completas, pero su perfil filtrado sigue funcionando',async()=>{
 const db=env.authenticatedContext(uid).database();for(const p of ['sv_usuarios','sv_usuarios/w','sv_usuarios/w/password'])await assertFails(get(ref(db,p)));
 await assertFails(get(query(ref(db,'sv_usuarios'),orderByChild('uid'),equalTo(uid))));
 const actor=await service.authorize({headers:{authorization:'Bearer '+uid}}),p=await service.profile(actor);
 assert.equal(p.profile.uid,uid);assert.equal(JSON.stringify(p).includes('FAKE_PRIVATE'),false);
 if(uid!=='portal')await assertSucceeds(get(ref(db,'sv_chat_roles/'+uid)));
});
test('admin ve lista filtrada, técnico solo directorio y nunca fichas ajenas por el API',async()=>{
 const admin=await service.authorize({headers:{authorization:'Bearer admin'}}),worker=await service.authorize({headers:{authorization:'Bearer worker'}});
 const all=await service.directory(admin,true),min=await service.directory(worker);
 assert.equal(all.users.length,4);assert.equal(min.users.length,3);assert.equal(JSON.stringify(all).includes('FAKE_PRIVATE'),false);assert.equal(JSON.stringify(min).includes('example.test'),false);
 await assert.rejects(service.directory(worker,true),e=>e.statusCode===403);
});
test('el corte conserva los campos de último acceso y las lecturas comerciales previas',async()=>{
 const db=env.authenticatedContext('worker').database();await assertSucceeds(set(ref(db,'sv_usuarios/w/ultimoAcceso'),Date.now()));
 await assertFails(set(ref(db,'sv_usuarios/w/rol'),'admin'));await assertSucceeds(get(ref(db,'sisventas/clientes')));
});
