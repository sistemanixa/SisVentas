'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{createRequire}=require('module');
const dep=createRequire(path.resolve(process.env.SV_SECURITY_TOOLS,'package.json')),{initializeTestEnvironment,assertFails}=dep('@firebase/rules-unit-testing'),{ref,set,get,update}=dep('firebase/database');
const {createPrivateFinance}=require('../cotizador/private-finance'),{actor,now,card,statement,command}=require('./helpers/private-finance-fixtures.cjs');let env,adminApp,db,api;
before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9007')throw Error('Solo emulador demo loopback');
 env=await initializeTestEnvironment({projectId:'demo-sisventas-private-finance',database:{host:'127.0.0.1',port:9007,rules:fs.readFileSync('tmp/private-finance-effective.rules.json','utf8')}});
 await env.withSecurityRulesDisabled(c=>set(ref(c.database()),{sv_chat_roles:{[actor.uid]:{rol:'admin',activo:true},other:{rol:'admin',activo:true},tech:{rol:'tecnico',activo:true}},sisventas:{gastos:{fixture:{importe:123}},pagos:{fixture:{importe:456}}},sv_personal_finance:{'private-proof':{ownerUid:actor.uid,confidential:'FICTICIO'}}}));
 const admin=require(process.env.SV_PRIVATE_FINANCE_ADMIN_MODULE||'firebase-admin');adminApp=admin.initializeApp({projectId:'demo-sisventas-private-finance',databaseURL:'https://demo-sisventas-private-finance.firebaseio.com'},'private-finance-test');db=adminApp.database();api=createPrivateFinance({db,auth:{verifyIdToken:async uid=>({uid})},ownerUid:actor.uid,enabled:true,now:()=>now});
});
after(async()=>{await adminApp?.delete();await env?.cleanup();});
for(const uid of [actor.uid,'other','tech',null])test('reglas efectivas bloquean lectura/escritura directa del espacio: '+(uid||'anónimo'),async()=>{const client=uid?env.authenticatedContext(uid).database():env.unauthenticatedContext().database();for(const p of ['sv_personal_finance','sv_personal_finance/private-proof','sv_personal_finance/private-proof/confidential']){await assertFails(get(ref(client,p)));await assertFails(set(ref(client,p),{ownerUid:uid,value:'No permitido'}));}await assertFails(update(ref(client),{'sv_personal_finance/private-proof/confidential':'No permitido'}));});
test('servicio real emulado conserva centavos, idempotencia y conflicto; datos empresariales intactos',async()=>{
 const before=(await db.ref('sisventas').get()).val(),a=await api.authorize({headers:{authorization:'Bearer '+actor.uid}});let s=(await api.get(a)).state;
 for(const [type,data]of [['card-save',card],['statement-save',statement]])s=(await api.save(a,command(s,type,data))).state;
 const payment=command(s,'payment-save',{id:'payment-emulated',statement:'statement-a',date:'2026-10-03',type:'Parcial',currency:'ARS',amount:10001});
 const results=await Promise.all([api.save(a,payment),api.save(a,payment)]);s=results[1].state;assert.equal(s.payments.length,1);assert.equal(s.payments[0].amount,10001);
 const edits=await Promise.allSettled(['one','two'].map(id=>api.save(a,{...command(s,'card-save',{...card,bank:id}),id})));assert.equal(edits.filter(x=>x.status==='fulfilled').length,1);assert.equal(edits.find(x=>x.status==='rejected').reason.statusCode,409);
 assert.deepEqual((await db.ref('sisventas').get()).val(),before);await assert.rejects(api.authorize({headers:{authorization:'Bearer other'}}),e=>e.statusCode===403);
});
