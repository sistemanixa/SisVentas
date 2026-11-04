'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
test('composición Accounts Operational H7 y veto OT: commit USER y acción SDK',{skip:!process.env.SV_OT_DELETE_RULES,timeout:60000},async()=>{
 assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9057');
 const baseline=JSON.parse(fs.readFileSync(process.env.SV_OT_DELETE_RULES,'utf8')),rules=require('../scripts/lib/operational-write-fence.cjs').prepare(require('../scripts/lib/client-account-cut-rules.cjs').prepare(baseline));
 Object.assign(rules,require('../scripts/lib/ot-delete-action-rules.cjs').prepare(require('../scripts/lib/client-history-write-rules.cjs').prepare(rules)));
 const dep=createRequire('C:/SisVentas/tmp/firebase-security-tools/package.json'),{initializeTestEnvironment,assertSucceeds}=dep('@firebase/rules-unit-testing'),sdk=dep('firebase/database');
 const env=await initializeTestEnvironment({projectId:'demo-ot-user-delete',database:{host:'127.0.0.1',port:9057,rules:JSON.stringify(rules)}});
 try{
 const original={id:'OT-FIC',materiales:[]},summary=require('../cotizador/record-list-model').summary('ordenes_trabajo',original),lease={fence:'fictitious-fence',opId:'fictitious-delete',digest:'a'.repeat(64),actorUid:'u',mode:'user',expiresAt:Date.now()+45000};
 async function seed(role='admin',override=true,busy=false){await env.withSecurityRulesDisabled(async context=>sdk.set(sdk.ref(context.database()),{sv_chat_roles:{u:{activo:true,rol:role}},sv_permisos:{[role]:{indiceVersion:2,indiceModulos:{ordentrabajo:true},acciones:{ot:{eliminar:override}}}},sv_labor_config:{ready:true,schema:1},...(busy?{sv_labor_guard:lease}:{}),sisventas:{ordenes_trabajo:{OT1:original},listados_resumen:{ordenes_trabajo:{OT1:summary}}}}));}
 const patch={'sisventas/ordenes_trabajo/OT1':null,'sisventas/listados_resumen/ordenes_trabajo/OT1':null};
 async function outcome(db,value){try{await sdk.update(sdk.ref(db),value);return 'allowed';}catch(error){return error.code;}}
 for(const role of ['admin','administrativo'])for(const busy of [false,true]){await seed(role,true,busy);const db=env.authenticatedContext('u').database();const result=await outcome(db,patch);assert.equal(result,busy?'PERMISSION_DENIED':'allowed');console.log('OT SDK '+role+' '+(busy?'busy':'idle')+': '+result);}
 await seed('admin',true,true);
 const claims={svLaborService:true,mode:'commit',fence:lease.fence,opId:lease.opId,digest:lease.digest,actorUid:'u'},db=env.authenticatedContext('u',claims).database();
 const receipt={fence:lease.fence,digest:lease.digest,actorUid:'u',result:{ok:true,otKey:'OT1'},confirmedAt:Date.now()},commit={...patch,['sv_labor_receipts/'+lease.opId]:receipt,sv_labor_guard:null};
 assert.equal(await outcome(db,commit),'allowed');console.log('OT USER commit source+summary+receipt: allowed');
 await seed('administrativo',false,false);const deniedAction=env.authenticatedContext('u').database();assert.equal(await outcome(deniedAction,patch),'PERMISSION_DENIED');console.log('SDK administrativo override false: denied');
 await seed('admin',true,true);await assertSucceeds(sdk.update(sdk.ref(db),{...commit,'sv_client_history/v1/sources/ordenes_trabajo/OT1':null,'sv_client_history/v1/proof':{revision:1}}));
 }finally{await env.cleanup();}
});
