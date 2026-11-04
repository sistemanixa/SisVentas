'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
test('caracterización OT: vínculo fuera de memoria no es veto de reglas copiadas',{skip:!process.env.SV_MANUAL_REMITO_RULES,timeout:60000},async()=>{
 assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9057');const dep=createRequire('C:/SisVentas/tmp/firebase-security-tools/package.json'),{initializeTestEnvironment}=dep('@firebase/rules-unit-testing'),sdk=dep('firebase/database');
 const env=await initializeTestEnvironment({projectId:'demo-ot-delete-characterization',database:{host:'127.0.0.1',port:9057,rules:fs.readFileSync(process.env.SV_MANUAL_REMITO_RULES,'utf8')}});
 try{
 const original={id:'OT-FICTICIA',cliente:'Cliente ficticio',materiales:[{cod:'FIC',instalada:1,entregada:1}]};
 const Model=require('../js/core/record-list-model.js');
 await env.withSecurityRulesDisabled(async context=>sdk.set(sdk.ref(context.database()),{sv_chat_roles:{fiction:{activo:true,rol:'admin'}},sv_permisos:{admin:{indiceVersion:2,indiceModulos:{ordentrabajo:true}}},sisventas:{ordenes_trabajo:{OT1:original},reclamos:{R1:{otKey:'OT1',cliente:'Cliente ficticio'}}}}));
 const db=env.authenticatedContext('fiction').database(),notices=[];let pending;
 const root={fbDB:db,fbAuth:{currentUser:{uid:'fiction'}},currentUserUid:'fiction',currentRole:'admin',crypto:require('node:crypto').webcrypto};
 const writer=require('../js/core/operational-writes.js').create(root,Model);writer.install({sdk:{set:sdk.set,update:sdk.update,push:sdk.push,remove:sdk.remove,runTransaction:sdk.runTransaction,get:sdk.get,ref:sdk.ref}});
 const context={window:root,otData:[],SP_DATA:{},FB_PATHS:{ordenesTrabajo:'sisventas/ordenes_trabajo'},svConfirm:async()=>true,notify:value=>notices.push(value),volverListaOT(){},_buscarOTCanonicaPorClave(){throw Error('Caché vacía');},_coincideReclamoExacto(){throw Error('Caché vacía');}};
 root.fbRef=sdk.ref;const remove=root.fbRemove;root.fbRemove=reference=>(pending=remove(reference));vm.createContext(context);
 const app=require('./helpers/active-app').readActiveApp().source;vm.runInContext(app.slice(app.indexOf('async function eliminarOT('),app.indexOf('function buscarProveedor(')),context);
 await context.eliminarOT('OT1');await pending;await new Promise(setImmediate);
 await env.withSecurityRulesDisabled(async actor=>{const audit=actor.database();assert.equal((await sdk.get(sdk.ref(audit,'sisventas/ordenes_trabajo/OT1'))).exists(),false);assert.equal((await sdk.get(sdk.ref(audit,'sisventas/reclamos/R1'))).exists(),true);});
 assert.ok(notices.includes('OT eliminada'));
 }finally{await env.cleanup();}
});
