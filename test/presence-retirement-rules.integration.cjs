'use strict';
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9007','Sólo emulador loopback de presencia');
assert.ok(process.env.SV_PRESENCE_RULES_FILE,'Indicar snapshot local; nunca consulta producción');
const dep=require('node:module').createRequire(path.join(process.env.SV_FIREBASE_TOOLS||path.resolve('tmp/firebase-security-tools'),'package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=dep('@firebase/rules-unit-testing');
const {ref,set,update,get,remove,onDisconnect,goOffline,serverTimestamp}=dep('firebase/database');
const {build}=require('../scripts/prepare-presence-retirement.cjs');
let env;const row=uid=>({uid,nombre:uid==='self'?'Ana':'Observador',rol:'admin',online:true,ultimaConexion:Date.now()});
const seed=value=>env.withSecurityRulesDisabled(c=>update(ref(c.database()),value));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function deleted(observer,path){for(let n=0;n<30;n++){if(!(await get(ref(observer,path))).exists())return;await pause(40);}assert.fail('El emulador no ejecutó el retiro');}
before(async()=>{const rules=build(JSON.parse(fs.readFileSync(process.env.SV_PRESENCE_RULES_FILE,'utf8')));env=await initializeTestEnvironment({projectId:'demo-presence-events-current',database:{host:'127.0.0.1',port:9007,rules:JSON.stringify(rules)}});});
beforeEach(async()=>{await env.clearDatabase();await seed({sv_chat_roles:{self:{rol:'admin',activo:true},observer:{rol:'admin',activo:true}},sv_chat_directorio:{self:{nombre:'Ana',activo:true},observer:{nombre:'Observador',activo:true}},sv_chat_presencia:{self:{a:row('self'),b:row('self'),keep:row('self')},observer:{foreign:row('observer')}},'sisventas/presencia/self__history':{uid:'self',nombre:'Ana',online:true,inicioSesion:100,ultimaConexion:100}});});
after(async()=>env?.cleanup());
for(const mode of ['required','version','temporary','inactive'])test('retiro propio después de '+mode+' no habilita lecturas, altas, edición ni identidad ajena',async()=>{
 const claims=mode==='temporary'?{svPasswordChangeRequired:true}:{svAccessVersion:1},db=env.authenticatedContext('self',claims).database(),observer=env.authenticatedContext('observer').database();
 const arm=ref(db,'sv_chat_presencia/self/a');
 // For ordinary sessions, queue the real server cleanup before revocation.
 if(mode!=='temporary')await assertSucceeds(onDisconnect(arm).remove());
 if(mode==='required')await seed({'sv_access_resets/self':{required:true,version:2}});
 if(mode==='version')await seed({'sv_access_resets/self':{required:false,version:2}});
 if(mode==='inactive')await seed({'sv_chat_roles/self/activo':false});
 if(mode==='temporary')await assertSucceeds(onDisconnect(arm).remove());
 await assertSucceeds(remove(ref(db,'sv_chat_presencia/self/b')));
 await assertFails(set(ref(db,'sv_chat_presencia/self/new'),{...row('self'),ultimaConexion:serverTimestamp()}));
 await assertFails(set(ref(db,'sv_chat_presencia/self/keep'),{...row('self'),ultimaConexion:serverTimestamp()}));
 await assertFails(update(ref(db,'sv_chat_presencia/self/keep'),{nombre:'Otra identidad'}));
 await assertFails(update(ref(db,'sv_chat_presencia/self/keep'),{online:false}));
 await assertFails(remove(ref(db,'sv_chat_presencia/observer/foreign')));
 // The existing inactive-account branch already permits no-op own deletions;
 // the new exception itself requires an existing record after access revocation.
 if(mode==='inactive')await assertSucceeds(remove(ref(db,'sv_chat_presencia/self/missing')));
 else await assertFails(remove(ref(db,'sv_chat_presencia/self/missing')));
 await assertFails(get(ref(db,'sv_chat_presencia')));await assertFails(get(ref(db,'sisventas/ventas')));
 await assertFails(set(ref(db,'sv_chat/general/fake'),{autor:'Ana',texto:'Ficticio',ts:serverTimestamp()}));
 await assertFails(update(ref(db,'sisventas/presencia/self__history'),{online:false}));
 await assertFails(update(ref(db),{'sv_chat_presencia/self/keep':null,'sv_chat_presencia/observer/foreign':null}));
 assert.equal((await get(ref(observer,'sv_chat_presencia/self/keep/online'))).val(),true);
 goOffline(db);await deleted(observer,'sv_chat_presencia/self/a');assert.equal((await get(ref(observer,'sv_chat_presencia/self/keep/online'))).val(),true);
 assert.equal((await get(ref(observer,'sisventas/presencia/self__history/online'))).val(),true,'Historial legado intacto; mantiene su TTL');
});
test('fila ajena o corrupta bajo path propio y sesión anónima no aprovechan la excepción',async()=>{
 await seed({'sv_chat_presencia/self/corrupt':row('observer'),'sv_access_resets/self':{required:true}});
 const self=env.authenticatedContext('self').database(),anon=env.unauthenticatedContext().database();
 await assertFails(remove(ref(self,'sv_chat_presencia/self/corrupt')));await assertFails(remove(ref(anon,'sv_chat_presencia/self/keep')));
});
