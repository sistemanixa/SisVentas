'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Fresh=require('../js/core/dashboard-budget-fresh-rtdb-proposal'),Plan=require('../js/core/dashboard-budget-transport-plan-proposal'),Own=require('../cotizador/commercial-ownership');
const origin='https://fiction-default-rtdb.firebaseio.com',root='sv_dashboard_budget_proposal/v1';
function auth(){const token=crypto.randomBytes(24).toString('base64url');return {currentUser:{uid:'u',getIdToken:async()=>token}};}
test('fresh adapter pins Firebase origin before obtaining token; no arbitrary hosts, redirects or private paths',async()=>{
 const a=auth();let tokens=0;a.currentUser.getIdToken=async()=>{tokens++;return 'local-fixture';};for(const url of ['https://elsewhere.invalid','http://fiction-default-rtdb.firebaseio.com','https://fiction-default-rtdb.firebaseio.com:8443','https://fixture@fiction-default-rtdb.firebaseio.com','http://127.0.0.1:9058'])assert.throws(()=>Fresh.create({databaseURL:url,expectedOrigin:url,auth:a}));assert.equal(tokens,0);
 const read=Fresh.create({databaseURL:origin,expectedOrigin:origin,auth:a,fetchImpl:()=>assert.fail('No request')});for(const spec of [{path:'sisventas/presupuestos'},{path:root+'/coverage'},{path:root+'/read/v'},{path:root+'/document/u_u',orderByKey:true,limitToFirst:1}])await assert.rejects(read(spec),{code:'SV_BUDGET_FRESH_DENIED'});assert.equal(tokens,0);
});
test('header, event and range reads all use no-store server requests with a fixed typed query',async()=>{
 const a=auth(),requests=[],read=Fresh.create({databaseURL:origin,expectedOrigin:origin,auth:a,fetchImpl:async(url,options)=>{requests.push({path:new URL(url).pathname,options});return {ok:true,json:async()=>({'z':{key:'z'},'a':{key:'a'}})};}});
 await read({path:root+'/read/u'});const snap=await read({path:root+'/document/u_u',orderByKey:true,limitToFirst:5});await read({path:root+'/noticeBadge/u_u',orderByKey:true,startAt:'0032003000320036002d00310031002d00300034!',limitToFirst:50});const keys=[];snap.forEach(s=>keys.push(s.key));assert.deepEqual(keys,['a','z']);assert.equal(requests.length,3);for(const r of requests){assert.equal(r.options.cache,'no-store');assert.equal(r.options.redirect,'error');assert.equal(r.options.credentials,'omit');assert.equal(r.options.referrerPolicy,'no-referrer');}
});
test('HTTP failure, changed User object and malformed index responses fail without retry or secret-bearing errors',async()=>{
 const a=auth();let calls=0;const read=Fresh.create({databaseURL:origin,expectedOrigin:origin,auth:a,fetchImpl:async()=>{calls++;return {ok:false,body:{cancel:async()=>{}}};}});await assert.rejects(read({path:root+'/read/u'}),{code:'SV_BUDGET_FRESH_DENIED'});assert.equal(calls,1);
 let resolve;const b=auth();b.currentUser.getIdToken=()=>new Promise(r=>{resolve=r;});const blocked=Fresh.create({databaseURL:origin,expectedOrigin:origin,auth:b,fetchImpl:()=>assert.fail('Retired User cannot send token')}),promise=blocked({path:root+'/read/u'});b.currentUser={uid:'u'};resolve('local-fixture');await assert.rejects(promise,{code:'SV_BUDGET_FRESH_DENIED'});
 const malformed=Fresh.create({databaseURL:origin,expectedOrigin:origin,auth:auth(),fetchImpl:async()=>({ok:true,json:async()=>[]})});await assert.rejects(malformed({path:root+'/document/u_u',orderByKey:true,limitToFirst:5}),{code:'SV_BUDGET_FRESH_DENIED'});
});
test('explicit routing matches current Own permissions for legacy maps, arrays and primitives; never an error fallback',()=>{
 for(const blocks of [undefined,null,false,[],['usuarios'],{'63':'configuracion'},{legacy:'otro'},['presupuesto'],{legacy:'presupuesto'},['dashboard']]){
  const cfg={indiceVersion:2,indiceRevision:7,indiceModulos:{dashboard:true,presupuesto:true},...(blocks===undefined?{}:{bloqueados:blocks})},before=structuredClone(cfg),expected=Own.moduleAllowed('vendedor','dashboard',{vendedor:cfg})&&Own.eligible('vendedor','presupuestos',{vendedor:cfg}),p=Plan.plan({role:'vendedor',config:cfg});assert.equal(p.kind!=='denied',expected);if(expected)assert.equal(p.kind,blocks===undefined?'direct-rtdb':'authorized-server');assert.deepEqual(cfg,before);
 }
});
test('selected direct or authorized path runs exactly once; failure never selects the other path',async()=>{
 let direct=0,server=0;const error=Error('unavailable');await assert.rejects(async()=>Plan.read({decision:{kind:'direct-rtdb'},direct:async()=>{direct++;throw error;},authorized:()=>{server++;}}),e=>e===error);assert.equal(direct,1);assert.equal(server,0);assert.equal(Plan.read({decision:{kind:'authorized-server'},direct:()=>{direct++;},authorized:()=>{server++;return 7;}}),7);assert.equal(direct,1);assert.equal(server,1);assert.throws(()=>Plan.read({decision:{kind:'denied'},direct:()=>{direct++;},authorized:()=>{server++;}}),{code:'SV_BUDGET_PLAN_DENIED'});assert.equal(direct,1);assert.equal(server,1);
});
test('normalized empty containers select direct only with raw absence; persisted falsy/scalar values never become empty',()=>{
 const cfg={indiceVersion:2,indiceRevision:7,indiceModulos:{dashboard:true,presupuesto:true}};
 for(const value of [[],{},null,{nested:null},[null,{}]]){const config={...cfg,bloqueados:value},before=structuredClone(config);assert.equal(Plan.plan({role:'vendedor',config,rawBlockedExists:false}).kind,'direct-rtdb');assert.equal(Plan.plan({role:'vendedor',config}).kind,'authorized-server');assert.equal(Plan.plan({role:'vendedor',config,rawBlockedExists:true}).kind,'authorized-server');assert.deepEqual(config,before);}
 for(const value of [false,0,'','invalid',['usuarios'],{legacy:'otro'}])assert.equal(Plan.plan({role:'vendedor',config:{...cfg,bloqueados:value},rawBlockedExists:false}).kind,'authorized-server');
 assert.equal(Plan.plan({role:'vendedor',config:cfg,rawBlockedExists:true}).kind,'authorized-server');
});
