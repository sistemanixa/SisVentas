const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const dep=require('node:module').createRequire(require('node:path').resolve('tmp/firebase-security-tools/package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=dep('@firebase/rules-unit-testing');
const {ref,set,get}=dep('firebase/database');let env;
before(async()=>{if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9005')throw Error('Solo emulador');const rules=JSON.parse(fs.readFileSync('security/database.control-access.rules.json'));rules.rules.sv_ia_reglas=require('../scripts/publicar-reglas-ia.cjs');env=await initializeTestEnvironment({projectId:'demo-sisventas-security',database:{host:'127.0.0.1',port:9005,rules:JSON.stringify(rules)}});await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'sv_chat_roles'),{admin:{rol:'admin',activo:true},administrativo:{rol:'administrativo',activo:true},tecnico:{rol:'tecnico',activo:true},inactivo:{rol:'admin',activo:false}}));});
after(async()=>{if(env)await env.cleanup();});
test('solo admin guarda; administrativa aplica reglas persistidas; inactivo no lee',async()=>{
 const rule={categoria:'CAMARAS IP',codigo:'P-50709',cantidad:30,activa:true,actualizadaEn:Date.now(),autor:'admin'};
 await assertSucceeds(set(ref(env.authenticatedContext('admin').database(),'sv_ia_reglas/r1'),rule));
 for(const role of ['administrativo','tecnico','inactivo'])await assertFails(set(ref(env.authenticatedContext(role).database(),'sv_ia_reglas/r1'),{...rule,cantidad:999}));
 await assertFails(get(ref(env.authenticatedContext('inactivo').database(),'sv_ia_reglas')));
 const window={fbDB:env.authenticatedContext('administrativo').database(),fbGet:get,fbRef:ref};vm.runInNewContext(fs.readFileSync('js/modules/ai-learning.js','utf8'),{window});await window.svIaLearning.load();
 const actual=window.svIaLearning.apply([{p:{categoria:'CAMARAS IP'},qty:2}],[{codigo:'P-50709',qty:40,id:'utp'}]);assert.equal(actual.length,1);assert.equal(actual[0].qty,60);
 await assertSucceeds(set(ref(env.authenticatedContext('admin').database(),'sv_ia_reglas/r1/activa'),false));await window.svIaLearning.load();assert.equal(window.svIaLearning.apply([{p:{categoria:'CAMARAS IP'},qty:2}],[]).length,0);
});
