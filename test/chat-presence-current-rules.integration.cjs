'use strict';
// Explicit emulator-only check against an existing private rules snapshot.
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9007','Sólo emulador de presencia en loopback');
assert.ok(process.env.SV_PRESENCE_RULES_FILE,'Indicar snapshot local de reglas; nunca consulta producción');
const dep=require('node:module').createRequire(path.join(process.env.SV_FIREBASE_TOOLS||path.resolve('tmp/firebase-security-tools'),'package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=dep('@firebase/rules-unit-testing');
const {ref,set,update,get,remove,onDisconnect,goOffline,serverTimestamp}=dep('firebase/database');
let env;
const legacy=()=>({uid:'self',nombre:'Ana',email:'ana@example.test',rol:'admin',online:true,sesionId:'fixture',inicioSesion:Date.now(),ultimaConexion:serverTimestamp(),conexionPorEventos:true});
const modern=()=>({uid:'self',nombre:'Ana',rol:'admin',online:true,ultimaConexion:serverTimestamp()});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(read,check){let value;for(let n=0;n<30;n++){value=await read();if(check(value))return value;await pause(40);}assert.fail('No llegó el cambio esperado del emulador');}
before(async()=>{const rules=fs.readFileSync(process.env.SV_PRESENCE_RULES_FILE,'utf8');JSON.parse(rules);env=await initializeTestEnvironment({projectId:'demo-presence-events-current',database:{host:'127.0.0.1',port:9007,rules}});});
beforeEach(async()=>{await env.clearDatabase();await env.withSecurityRulesDisabled(c=>set(ref(c.database()),{sv_chat_roles:{self:{rol:'admin',activo:true},observer:{rol:'admin',activo:true}},sv_chat_directorio:{self:{nombre:'Ana',activo:true},observer:{nombre:'Observador',activo:true}}}));});
after(async()=>env?.cleanup());
test('regla vigente admite la marca sólo en legado y conserva el esquema del canal compartido',async()=>{
 const db=env.authenticatedContext('self').database();await assertSucceeds(set(ref(db,'sisventas/presencia/self__fixture'),legacy()));
 await assertSucceeds(set(ref(db,'sv_chat_presencia/self/fixture'),modern()));await assertFails(set(ref(db,'sv_chat_presencia/self/marked'),{...modern(),conexionPorEventos:true}));
 const other=env.authenticatedContext('observer').database();await assertFails(set(ref(other,'sv_chat_presencia/self/foreign'),modern()));
 const anon=env.unauthenticatedContext().database();await assertFails(get(ref(anon,'sv_chat_presencia')));await assertFails(set(ref(anon,'sisventas/presencia/anon'),legacy()));
});
test('onDisconnect real marca offline el legado y retira únicamente la conexión propia del canal compartido',async()=>{
 const db=env.authenticatedContext('self').database(),second=env.authenticatedContext('self').database(),observer=env.authenticatedContext('observer').database();
 const oldRef=ref(db,'sisventas/presencia/self__a'),own=ref(db,'sv_chat_presencia/self/a'),other=ref(second,'sv_chat_presencia/self/b');
 await assertSucceeds(onDisconnect(oldRef).update({online:false,ultimaDesconexion:serverTimestamp()}));await assertSucceeds(onDisconnect(own).remove());
 await assertSucceeds(set(oldRef,legacy()));await assertSucceeds(set(own,modern()));await assertSucceeds(set(other,modern()));goOffline(db);
 await waitFor(()=>get(ref(observer,'sv_chat_presencia/self')),s=>!s.child('a').exists());
 assert.equal((await get(ref(observer,'sisventas/presencia/self__a/online'))).val(),false);assert.equal((await get(ref(observer,'sv_chat_presencia/self/b/online'))).val(),true);
});
test('límite vigente: desactivar conserva el legado cuando el servidor ya no autoriza su onDisconnect',async()=>{
 const db=env.authenticatedContext('self').database(),observer=env.authenticatedContext('observer').database();
 const oldRef=ref(db,'sisventas/presencia/self__a'),own=ref(db,'sv_chat_presencia/self/a');
 await assertSucceeds(onDisconnect(oldRef).update({online:false}));await assertSucceeds(onDisconnect(own).remove());
 await assertSucceeds(set(oldRef,legacy()));await assertSucceeds(set(own,modern()));await assertSucceeds(update(ref(observer,'sv_chat_roles/self'),{activo:false}));goOffline(db);
 await waitFor(()=>get(ref(observer,'sv_chat_presencia/self/a')),s=>!s.exists());assert.equal((await get(ref(observer,'sisventas/presencia/self__a/online'))).val(),true);
});
test('límite vigente: la revocación de acceso bloquea también el borrado del canal compartido',async()=>{
 const db=env.authenticatedContext('self').database(),observer=env.authenticatedContext('observer').database(),own=ref(db,'sv_chat_presencia/self/a');
 await assertSucceeds(onDisconnect(own).remove());await assertSucceeds(set(own,modern()));await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'sv_access_resets/self'),{required:true}));
 await assertFails(remove(own));goOffline(db);await pause(150);assert.equal((await get(ref(observer,'sv_chat_presencia/self/a/online'))).val(),true);
});
test('las ocho expresiones comerciales vigentes conservan GUARD dentro de conjunciones restringidas',()=>{
 const {passwordGuardRequired,rulesProtectPasswords}=require('../cotizador/password-policy'),snapshot=JSON.parse(fs.readFileSync(process.env.SV_PRESENCE_RULES_FILE,'utf8')),r=snapshot.rules;
 const expressions=[r.sisventas.ventas.$venta.totalPagado['.write'],r.sisventas.ventas.$venta.estadoPago['.write'],r.sisventas.ventas.$venta['.read'],r.sisventas.ventas.$venta['.write'],r.sisventas.ventas['.read'],r.sisventas.presupuestos['.read'],r.sisventas.presupuestos.$presupuesto['.read'],r.sisventas.presupuestos.$presupuesto['.write']];
 assert.equal(expressions.length,8);for(const expression of expressions){assert.equal(passwordGuardRequired(expression),true);assert.equal(passwordGuardRequired('('+expression+') || true'),false);}
 assert.equal(rulesProtectPasswords(snapshot),true);
});
