'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
test('reglas copiadas: transacción puntual de remito y revocación',{skip:!process.env.SV_MANUAL_REMITO_RULES,timeout:60000},async()=>{
 assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9057');
 const dep=createRequire('C:/SisVentas/tmp/firebase-security-tools/package.json'),{initializeTestEnvironment,assertFails}=dep('@firebase/rules-unit-testing'),sdk=dep('firebase/database');
 const env=await initializeTestEnvironment({projectId:'demo-manual-remito',database:{host:'127.0.0.1',port:9057,rules:fs.readFileSync(process.env.SV_MANUAL_REMITO_RULES,'utf8')}});
 try{
 await env.withSecurityRulesDisabled(async context=>sdk.set(sdk.ref(context.database()),{sv_chat_roles:{fiction:{activo:true,rol:'admin'}},sv_permisos:{admin:{indiceVersion:2,indiceModulos:{remitos:true}}}}));
 const db=env.authenticatedContext('fiction').database(),root={fbDB:db,fbAuth:{currentUser:{uid:'fiction'}},currentUserUid:'fiction',currentRole:'admin',currentUser:'Ficticio',permisoModulo:()=>true,fbRef:sdk.ref,fbPush:sdk.push,fbRunTransaction:sdk.runTransaction};
 const writer=require('../js/core/manual-delivery-writer.v1.js').create(root),form={};await writer.save(form,{numero:'R'});await writer.save(form,{numero:'R'});
 assert.equal(Object.keys((await sdk.get(sdk.ref(db,'sisventas/remitos'))).val()).length,1);
 await env.withSecurityRulesDisabled(async context=>sdk.set(sdk.ref(context.database(),'sv_chat_roles/fiction/activo'),false));
 await assert.rejects(writer.save({},{numero:'S'}),{code:'SV_REMITO_REJECTED'});
 await assertFails(sdk.get(sdk.ref(db,'sisventas/remitos')));
 }finally{await env.cleanup();}
});
