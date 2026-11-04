'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
const idle="(!root.child('sv_labor_guard').exists() || (root.child('sv_labor_guard/expiresAt').isNumber() && root.child('sv_labor_guard/expiresAt').val() <= now))";
function proposal(baseline){const rules=structuredClone(baseline);for(const parent of [rules.rules,rules.rules.sisventas])if(parent['.write']!=null&&parent['.write']!==false)throw Error('Autoridad padre requiere revisión');const domain=rules.rules.sisventas.remitos;if(typeof domain['.write']!=='string')throw Error('Falta autoridad original');function restrict(node){for(const [key,value]of Object.entries(node))if(key==='.write'&&typeof value==='string')node[key]='('+idle+') && ('+value+')';else if(value&&typeof value==='object')restrict(value);}restrict(domain);return rules;}
test('propuesta local conserva autoridad y bloquea remito manual durante lease',{skip:!process.env.SV_MANUAL_REMITO_RULES,timeout:60000},async()=>{
 assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9057');const dep=createRequire('C:/SisVentas/tmp/firebase-security-tools/package.json'),{initializeTestEnvironment,assertFails,assertSucceeds}=dep('@firebase/rules-unit-testing'),sdk=dep('firebase/database');
 const rules=proposal(JSON.parse(fs.readFileSync(process.env.SV_MANUAL_REMITO_RULES,'utf8'))),env=await initializeTestEnvironment({projectId:'demo-remito-lease',database:{host:'127.0.0.1',port:9057,rules:JSON.stringify(rules)}});
 try{await env.withSecurityRulesDisabled(async context=>sdk.set(sdk.ref(context.database()),{sv_chat_roles:{fiction:{activo:true,rol:'admin'}},sv_permisos:{admin:{indiceVersion:2,indiceModulos:{remitos:true}}},sv_labor_guard:{expiresAt:Date.now()+60000,opId:'OT-ficticia'}}));
 const db=env.authenticatedContext('fiction').database(),reference=sdk.ref(db,'sisventas/remitos/R1'),record={numero:'R-FICTICIO',_svManualDeliveryUid:'fiction'};
 await assertFails(sdk.runTransaction(reference,current=>current||record,{applyLocally:false}));
 await env.withSecurityRulesDisabled(async context=>sdk.remove(sdk.ref(context.database(),'sv_labor_guard')));
 await assertSucceeds(sdk.runTransaction(reference,current=>current||record,{applyLocally:false}));
 }finally{await env.cleanup();}
});
module.exports={proposal};
