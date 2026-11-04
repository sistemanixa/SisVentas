'use strict';
// Opt-in: only own demo namespace on loopback. No ADC, real identity provider or deployed rules.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const Reader=require('../cotizador/dashboard-budget-reader-proposal'),Index=require('../cotizador/dashboard-budget-incremental-plan-proposal'),Model=require('../cotizador/dashboard-budget-projection-proposal');
const {createLaborGuard,digest}=require('../cotizador/labor-guard'),{createLaborRtdbStore}=require('../cotizador/labor-rtdb-store');
const {budget,seed,authFixture,request,traceDb}=require('./helpers/dashboard-budget-reader-fixture.cjs');
const enabled=process.env.SV_BUDGET_READER_EMULATOR==='1',opt={skip:!enabled,timeout:60000};
const host='127.0.0.1:9057',base='http://'+host,namespace='demo-budget-reader-'+process.pid,observations=[];
let adminApp,db;
async function localFetch(input,options){const url=new URL(input);assert.equal(url.origin,base);assert.equal(url.searchParams.get('ns'),namespace);return fetch(url,options);}
async function setup(data=seed()){await db.ref().set(data);return data;}
function endpoint(actorUid='u',onRead){const auth=authFixture(actorUid),traced=traceDb(db,{onRead}),reader=Reader.createDashboardBudgetReader({auth,db:traced.db,enabled:true,getAsOfDay:()=> '2026-11-04'});return {auth,reads:traced.reads,reader};}
before(async()=>{
 if(!enabled)return;
 assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,host);assert(process.env.SV_BUDGET_ADMIN_MODULE,'Explicit installed Admin SDK path required');
 const admin=require(process.env.SV_BUDGET_ADMIN_MODULE);
 adminApp=admin.initializeApp({projectId:namespace,databaseURL:'https://'+namespace+'.firebaseio.com',credential:{async getAccessToken(){return {access_token:'owner',expires_in:3600};}}},namespace);db=adminApp.database();
 // Deliberately permissive fictitious namespace: tests query/persistence and server authorization, not rules security.
 const response=await localFetch(new URL('/.settings/rules.json?ns='+namespace,base),{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({rules:{'.read':true,'.write':true,sv_usuarios:{'.indexOn':['uid']}}}),signal:AbortSignal.timeout(5000)});assert.equal(response.status,200);await response.arrayBuffer();
});
after(async()=>{if(!enabled)return;try{if(db)await db.ref().remove();const r=await localFetch(new URL('/.json?ns='+namespace,base),{headers:{Authorization:'Bearer owner'},signal:AbortSignal.timeout(5000)});assert.equal(await r.json(),null);console.log('Budget reader emulator evidence '+JSON.stringify({namespace,host,observations,cleanup:true,scope:'Admin SDK RTDB queries/persistence + real business/commercial authorization with fixture token verifier; not deployed rules or real Auth provider'}));}finally{db?.goOffline();await adminApp?.delete();}},{timeout:10000});

test('native RTDB guard/planner commit and bounded reader preserve 5001 past + 50 future badge without original client reads',opt,async()=>{
 const records=Object.fromEntries(Array.from({length:5001},(_,i)=>['p'+i,budget({vence:'2020-01-01'})]));for(let i=0;i<50;i++)records['f'+i]=budget({vence:'2027-01-01'});
 const data=seed(records);data.sv_labor_config={schema:1,ready:true};await setup(data);
 const store=createLaborRtdbStore({databaseURL:base+'/?ns='+namespace,accessToken:async()=> 'owner',fetchImpl:localFetch}),guard=createLaborGuard({store,delay:async()=>{}}),patch={'sisventas/presupuestos/f0/vence':'2026-11-05'};
 await guard.run({uid:'a',claims:{uid:'a'},role:'admin',mode:'user',operation:'budget-reader-fixture',opId:'reader-native-commit',transportDigest:digest(patch),input:patch},async scope=>{
  await scope.update(patch);const planned=await Index.plan({patch,raw:p=>store.read(p),get:p=>scope.get(p),generation:'reader-fixture-generation',revision:1,beforeCommit:fn=>scope.beforeCommit(fn),projectRecord:Model.projectRecord});await scope.update(planned.patch);return {ok:true,committed:true};
 });
 const f=endpoint(),result=await f.reader.read(request());assert.equal(result.revision,2);assert.equal(result.counts.active,5051);assert.equal(result.badge.badgeCount,5002);assert.equal(result.badge.upcoming48Count,1);assert.equal(result.recent.rows.length,5);assert(result.recent.rows.every(row=>row.amountCents===null));assert(!JSON.stringify(result).includes('NEVER_TRANSPORT'));
 const badgeQueries=f.reads.filter(r=>r.path.includes('/noticeBadge/')),documentQueries=f.reads.filter(r=>r.path.includes('/document/'));assert.equal(badgeQueries.length,2);assert.equal(badgeQueries[0].limit,50);assert(badgeQueries[0].startAt);assert(badgeQueries[1].startAfter);assert.equal(documentQueries.length,1);assert.equal(documentQueries[0].limit,5);assert.equal(f.auth.calls.length,4);
 observations.push({case:'5051-guard-persisted',badgeQueries:badgeQueries.length,documentQueries:1,originalReads:0,responseJSONBytes:Buffer.byteLength(JSON.stringify(result)),authChecks:f.auth.calls.length});
});

test('native inclusive/exclusive key pages retain 100 same-day ties and verified own/admin document prefixes',opt,async()=>{
 const records=Object.fromEntries(Array.from({length:100},(_,i)=>['same'+i,budget()]));records['漢'.repeat(80)]=budget({vence:'z'.repeat(80),fecha:'2026-11-06'});records.foreign=budget({responsableUid:'v',fecha:'2026-11-07'});await setup(seed(records));
 const f=endpoint(),result=await f.reader.read(request());assert.equal(result.badge.badgeCount,100);assert.equal(result.badge.upcoming48Count,100);assert.equal(result.recent.rows[0].key,'漢'.repeat(80));assert(!result.recent.rows.some(row=>row.key==='foreign'));assert.equal(f.reads.filter(r=>r.path.includes('/noticeBadge/')).length,3);
 const admin=await endpoint('a').reader.read(request());assert.equal(admin.scope,'all');assert.equal(admin.counts.active,102);assert.equal(admin.recent.rows[0].key,'foreign');
 observations.push({case:'tie-pages-own-admin',own:result.counts.active,all:admin.counts.active,pages:3});
});

test('bounded digest document keys persist UTF-8 envelope without truncating originals and match independent native-order oracle',opt,async()=>{
 const crypto=require('node:crypto'),keys=['a'.repeat(128),'á'.repeat(128),'漢'.repeat(128),'😀'.repeat(64),'e\u0301'.repeat(64)],records=Object.fromEntries(keys.map(key=>[key,budget()]));await setup(seed(records));
 const f=endpoint(),result=await f.reader.read(request()),expected=keys.map(key=>({key,sort:'79738895_'+crypto.createHash('sha256').update(JSON.stringify(key),'utf8').digest('hex')})).sort((a,b)=>a.sort<b.sort?-1:1);
 assert.deepEqual(result.recent.rows.map(({key,sort})=>({key,sort})),expected);assert.equal(result.recent.order,Model.DOCUMENT_ORDER);
 for(const key of keys){const stored=(await db.ref(Index.ROOT+'/sources/'+key).get()).val();assert.equal(stored.key,key);assert.equal(stored.row.key,key);assert.equal(stored.sourceHash,digest(records[key]));const original=(await db.ref('sisventas/presupuestos/'+key).get()).val();assert.deepEqual(original,records[key]);assert.equal(Buffer.byteLength(Index.ROOT+'/document/u_u/'+Model.documentSort('2026-11-04',key)),118);}
 observations.push({case:'bounded-document-key-envelope',status:'persisted-original-identity-preserved',sourceUnits:128,maxSourceUTF8Bytes:384,indexKeyBytes:73,indexPathBytes:118,oldSDKValidationPathBytes:823});
});

test('native missing metadata/unknown date and late permission/reset/coverage changes withhold all output',opt,async()=>{
 await setup(seed({p:budget({fecha:'unknown'})}));await assert.rejects(endpoint().reader.read(request()),/Fechas desconocidas/);
 await setup();await db.ref(Index.ROOT+'/scopeProof/u_u').remove();await assert.rejects(endpoint().reader.read(request()),/Metadata/);
 for(const mutation of [()=>db.ref('sv_permisos/vendedor/indiceRevision').set(8),()=>db.ref('sv_access_resets/u').set({required:true,version:2}),()=>db.ref(Index.ROOT+'/coverage/revision').set(2),()=>db.ref(Index.ROOT+'/policy/hash').set('0'.repeat(64))]){
  await setup();let changed=false;const f=endpoint('u',async({path})=>{if(!changed&&path.includes('/document/')){changed=true;await mutation();}});await assert.rejects(f.reader.read(request()));assert(changed);
 }
 await setup();const f=endpoint();f.auth.setHook(n=>{if(n>1)throw Error('revoked fixture');});await assert.rejects(f.reader.read(request()));
 observations.push({case:'native-fail-closed',missing:true,unknownDates:true,lateChanges:4,revocationFixture:true});
});

test('native inactive HTTP adapter serves no-store compact DTO and rejects caller scope without database activity',opt,async()=>{
 await setup();const f=endpoint(),server=http.createServer((req,res)=>{f.reader.handle(req,res);});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 try{const url='http://127.0.0.1:'+server.address().port+Reader.ROUTE,r=await fetch(url,{headers:{Authorization:'Bearer fixture-token'}}),body=await r.json();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(body.scope,'own');assert.equal(body.notificationCenterComplete,false);const reads=f.reads.length,bad=await fetch(url+'?scope=all',{headers:{Authorization:'Bearer fixture-token'}});assert.equal(bad.status,400);assert.equal(f.reads.length,reads);await bad.arrayBuffer();}
 finally{await new Promise(resolve=>server.close(resolve));}
 observations.push({case:'native-loopback-http',success:200,scopeInjection:400,noStore:true});
});
