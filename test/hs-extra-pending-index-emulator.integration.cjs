'use strict';
// Opt-in rule/query proof only. Never starts an emulator, reads ADC, invokes
// approval endpoints or contacts a provider/production URL. REST snapshots
// after mutations verify membership changes; this is not a push/SSE test.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const Builder=require('../scripts/prepare-hs-extra-pending-index.cjs'),Permissions=require('../js/core/permission-index'),{load}=require('./helpers/app-functions.cjs');
const host='127.0.0.1:9038',base='http://'+host,namespace='demo-hsex-index-proof',sourceFile=process.env.SV_HSEX_RULES_TEST_FILE;
const enabled=process.env.FIREBASE_DATABASE_EMULATOR_HOST===host&&!!sourceFile,opt={skip:!enabled,timeout:30000},requestPath='/sisventas/hsextra_solicitudes',query={orderBy:'estado',equalTo:'pendiente'};
const sdkDir=process.env.SV_HSEX_SDK_DIR,sdkEnabled=enabled&&!!sdkDir,sdkOpt={skip:!sdkEnabled,timeout:30000};
const copy=value=>structuredClone(value),json=value=>JSON.parse(JSON.stringify(value));
let baseline,candidate,seed,SDK,App,nativeFetch,NativeWebSocket,sdkSequence=0;const observations=[],sockets=new Set(),sdkOrigins=new Set();
const canonical={};load(canonical,['_hsexClaveEmpleadoMes','_hsexConsolidarDetalle','_hsexAgruparPendientes']);
function dto(value){return Object.entries(value||{}).map(([key,row])=>Object.assign({},row,{fbKey:key})).filter(row=>row.estado==='pendiente');}
function grouped(value){return json(canonical._hsexAgruparPendientes(dto(value)));}
function selected(value){return Object.fromEntries(Object.entries(value||{}).filter(([,row])=>row?.estado==='pendiente'));}
async function request(method,p,value,{owner=false,uid='admin',claims={},query:selection={}}={}){
 const url=new URL(p+'.json',base);url.searchParams.set('ns',namespace);if(!owner)url.searchParams.set('auth_variable_override',JSON.stringify(uid===null?null:{uid,token:claims}));for(const [key,item]of Object.entries(selection))url.searchParams.set(key,JSON.stringify(item));
 assert.equal(url.origin,base);assert.equal(url.hostname,'127.0.0.1');assert.match(namespace,/^demo-/);
 const response=await fetch(url,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(10000)}),text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch{body=text;}
 return {status:response.status,body};
}
async function owner(method,p,value){const result=await request(method,p,value,{owner:true});assert.equal(result.status,200,JSON.stringify(result.body));return result.body;}
function fixture(){
 const admin={bloqueados:[],acciones:{empleados:{autorizarHoras:true},gastos:{administrar:true}}},office={bloqueados:[],acciones:{empleados:{autorizarHoras:true}}},tech={bloqueados:[],acciones:{empleados:{autorizarHoras:false}}};
 return {sv_chat_roles:{admin:{activo:true,rol:'admin'},office:{activo:true,rol:'administrativo'},tech:{activo:true,rol:'tecnico'},external:{activo:true,rol:'distribuidor'}},sv_permisos:Permissions.build({admin,administrativo:office,tecnico:tech}),sv_labor_config:{schema:1,ready:true},sv_labor_indexes:{sentinel:{keep:true}},sisventas:{hsextra_solicitudes:{
  'z-last':{estado:'pendiente',empFbKey:'e1',empNombre:'Ana ficticia',mes:'2026-10',horas:1,detalleDias:[{fecha:'2026-10-22',horas:1,lugar:' Obra '}]},
  'a-first':{estado:'pendiente',empFbKey:'e1',empNombre:'Ana ficticia',mes:'2026-10',horas:99,detalleDias:[{fecha:'2026-10-22',horas:2,lugar:'obra'}]},
  'm-second':{estado:'pendiente',empFbKey:'e2',empNombre:'Bea ficticia',mes:'2026-09',horas:2.5,descripcion:'Sin detalle por día'},
  '10':{estado:'pendiente',empFbKey:'e3',empNombre:'Carlos ficticio',fecha:'2026-08-09',horas:0.1},
  '2':{estado:'pendiente',empFbKey:'e3',empNombre:'Carlos ficticio',mes:'2026-08',horas:0.2,fbKey:'wrong embedded identity'},
  approved:{estado:'aprobado',empFbKey:'e1',empNombre:'Ana ficticia',mes:'2026-10',horas:20},
  rejected:{estado:'rechazado',empFbKey:'e2',empNombre:'Bea ficticia',mes:'2026-10',horas:4},
  legacyCase:{estado:'Pendiente',empFbKey:'e2',mes:'2026-10',horas:6},legacyMissing:{empFbKey:'e2',mes:'2026-10',horas:8},legacyNumeric:{estado:0,empFbKey:'e2',horas:10}
 },gastos:{salary:{monto:500,montoPagado:500,estado:'pagado',pagos:{p:{monto:500}}}},haberes:{e1:{'2026_10':{sueldo:500}}},ctaemp:{e1:{salary:{monto:500,montoPagado:500,pagos:{p:{monto:500}}}}},pagos:{keep:{monto:72.34,ventaFbKey:'v'}},comisiones_generacion:{keep:{estado:'completada'}}}};
}
async function setup(variant,value=fixture()){await owner('PUT','/.settings/rules',variant==='baseline'?baseline:candidate);seed=copy(value);await owner('PUT','/',seed);}
function denied(result){assert.ok([401,403].includes(result.status),'Expected permission denial: '+JSON.stringify(result));assert.equal(result.body?.['a-first'],undefined);assert.equal(result.body?.['z-last'],undefined);}
async function unchanged(){const saved=await owner('GET','/');assert.deepEqual(saved.sv_labor_indexes,seed.sv_labor_indexes);for(const domain of ['gastos','haberes','ctaemp','pagos','comisiones_generacion'])assert.deepEqual(saved.sisventas[domain],seed.sisventas[domain]);}
async function allowedSnapshot(variant,identity={}){
 const whole=await request('GET',requestPath,undefined,identity);assert.equal(whole.status,200,JSON.stringify(whole.body));const expected=selected(whole.body),filtered=await request('GET',requestPath,undefined,{...identity,query});
 if(variant==='baseline'&&filtered.status===400){
  assert.match(String(filtered.body?.error||filtered.body),/index.*(?:not defined|not found)|indexOn|not indexed/i,'Only an explicit missing-index error may use the full-root test reference');observations.push({variant,status:400,reference:'authorized full-root snapshot',reason:'missing-index'});return expected;
 }
 // REST JSON member order is not a DataSnapshot.val() order guarantee. Compare
 // every key/value here; the SDK-specific cases below prove ordering/formulas.
 assert.equal(filtered.status,200,JSON.stringify(filtered.body));const actual=filtered.body||{};assert.deepEqual(actual,expected);observations.push({variant,status:200,reference:'exact pending membership and values; no REST object-order claim'});return actual;
}
async function prepareSDK(){
 const sha=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(sdkDir,name))).digest('hex');
 // Official10.12.0 app bytes unchanged; database has exactly its app import
 // rewritten from the official absolute URL to ./firebase-app.mjs, privately.
 assert.equal(sha('firebase-app.mjs'),'6cf917206f4da022ef68d66b94ccd41cd253adc6bc84b5a2e4ea0cbde45e7046');assert.equal(sha('firebase-database.mjs'),'4a5899b67d0f28d4ce147e4c4282bda61c730c100eaf4e3247c1d95ed6c70710');
 nativeFetch=globalThis.fetch;NativeWebSocket=globalThis.WebSocket;assert.equal(typeof NativeWebSocket,'function','Node24 native WebSocket required; no external SDK/package fallback');
 globalThis.fetch=async(input,options)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);assert.equal(url.origin,base,'No external fetch during SDK test');sdkOrigins.add(url.origin);return nativeFetch(input,options);};
 globalThis.WebSocket=class extends NativeWebSocket{constructor(input,protocols){const url=new URL(input);assert.equal(url.origin,'ws://127.0.0.1:9038','No external SDK WebSocket');assert.equal(url.searchParams.get('ns'),namespace);super(input,protocols);sockets.add(this);sdkOrigins.add(url.origin);this.addEventListener('close',()=>sockets.delete(this));}};
 App=await import(pathToFileURL(path.join(sdkDir,'firebase-app.mjs')).href);SDK=await import(pathToFileURL(path.join(sdkDir,'firebase-database.mjs')).href);assert.equal(App.SDK_VERSION,'10.12.0');SDK.forceWebSockets();
}
async function sdkSnapshot(filtered){
 assert.equal(App.SDK_VERSION,'10.12.0');const app=App.initializeApp({projectId:namespace,databaseURL:base+'/?ns='+namespace},'hsex-index-sdk-'+(++sdkSequence)),db=SDK.getDatabase(app);SDK.connectDatabaseEmulator(db,'127.0.0.1',9038,{mockUserToken:{sub:'admin',user_id:'admin'}});let timer;
 try{const ref=SDK.ref(db,requestPath.slice(1)),q=filtered?SDK.query(ref,SDK.orderByChild('estado'),SDK.equalTo('pendiente')):ref,snapshot=await Promise.race([SDK.get(q),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('SDK10 local snapshot timed out')),10000);})]),keys=[];snapshot.forEach(child=>{keys.push(child.key);});return{value:snapshot.val(),keys};}
 finally{clearTimeout(timer);SDK.goOffline(db);await App.deleteApp(app);}
}
before(async()=>{if(!enabled)return;baseline=JSON.parse(fs.readFileSync(sourceFile,'utf8'));assert.equal(Builder.hash(baseline),Builder.BASELINE_HASH);candidate=Builder.build(baseline);const original=copy(baseline),comparable=copy(candidate);if(Object.hasOwn(original.rules.sisventas.hsextra_solicitudes,'.indexOn'))comparable.rules.sisventas.hsextra_solicitudes['.indexOn']=copy(original.rules.sisventas.hsextra_solicitudes['.indexOn']);else delete comparable.rules.sisventas.hsextra_solicitudes['.indexOn'];assert.deepEqual(comparable,original);if(sdkEnabled)await prepareSDK();});
after(async()=>{if(!enabled)return;try{await owner('DELETE','/');for(let i=0;i<10&&sockets.size;i++)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(sockets.size,0,'Every SDK client must be disconnected');console.log('HS index demo query coverage '+JSON.stringify({baselineHash:Builder.hash(baseline),candidateHash:Builder.hash(candidate),statuses:[...new Set(observations.map(row=>row.variant+':'+row.status))],sdkVersion:SDK?App.SDK_VERSION:'not-run',sdkReads:sdkSequence,sdkOrigins:[...sdkOrigins],sdkConnectionsRemaining:sockets.size,scope:'REST membership/permissions; SDK10 exact snapshot/aggregation only when explicitly enabled. No approval, push/SSE or financial write'}));}finally{if(nativeFetch)globalThis.fetch=nativeFetch;if(NativeWebSocket)globalThis.WebSocket=NativeWebSocket;}},{timeout:10000});

for(const variant of ['baseline','candidate']){
 test(variant+' REST pending membership retains every Firebase ID and original record value',opt,async()=>{
  await setup(variant);const value=await allowedSnapshot(variant);assert.deepEqual(new Set(Object.keys(value)),new Set(['2','10','a-first','m-second','z-last']));const rows=dto(value);assert.equal(rows.find(row=>row.fbKey==='2').fbKey,'2');assert.ok(!rows.some(row=>row.fbKey==='wrong embedded identity'));await unchanged();
 });
 test(variant+' repeated REST snapshots reflect entries, exits, edits and deletion without altering financial records',opt,async()=>{
  await setup(variant);let value=await allowedSnapshot(variant);assert.equal(Object.keys(value).length,5);
  await owner('PUT',requestPath+'/incoming',{estado:'pendiente',empFbKey:'e2',empNombre:'Bea ficticia',mes:'2026-10',horas:7});value=await allowedSnapshot(variant);assert.equal(value.incoming.horas,7);
  await owner('PUT',requestPath+'/approved/estado','pendiente');value=await allowedSnapshot(variant);assert.equal(value.approved.horas,20);
  await owner('PUT',requestPath+'/a-first/estado','aprobado');value=await allowedSnapshot(variant);assert.equal(value['a-first'],undefined);
  await owner('PUT',requestPath+'/m-second/horas',4.5);value=await allowedSnapshot(variant);assert.equal(value['m-second'].horas,4.5);
  await owner('DELETE',requestPath+'/incoming');value=await allowedSnapshot(variant);assert.equal(value.incoming,undefined);await unchanged();
 });
 test(variant+' explicitly authorized internal role retains the same root/query access',opt,async()=>{
  await setup(variant);const value=await allowedSnapshot(variant,{uid:'office'});assert.deepEqual(value,selected(seed.sisventas.hsextra_solicitudes));await unchanged();
 });
 test(variant+' denied technician, distributor, unknown and anonymous sessions receive no global pending data',opt,async()=>{
  await setup(variant);for(const uid of ['tech','external','unknown',null]){denied(await request('GET',requestPath,undefined,{uid}));denied(await request('GET',requestPath,undefined,{uid,query}));}await unchanged();
 });
 test(variant+' revoked autorizarHoras denies a previously allowed session while other grants stay true',opt,async()=>{
  await setup(variant);await allowedSnapshot(variant);await owner('PUT','/sv_permisos/admin/acciones/empleados/autorizarHoras',false);denied(await request('GET',requestPath));denied(await request('GET',requestPath,undefined,{query}));assert.equal((await owner('GET','/sv_permisos/admin')).acciones.gastos.administrar,true);await unchanged();
 });
 test(variant+' blocked account module denies root and indexed query without changing permissions',opt,async()=>{
  await setup(variant);await owner('PUT','/sv_permisos/admin/indiceModulos/ctaemp',false);denied(await request('GET',requestPath));denied(await request('GET',requestPath,undefined,{query}));await unchanged();
 });
 test(variant+' inactive profile denies existing session under both query shapes',opt,async()=>{
  await setup(variant);await owner('PUT','/sv_chat_roles/admin/activo',false);denied(await request('GET',requestPath));denied(await request('GET',requestPath,undefined,{query}));await unchanged();
 });
 test(variant+' password reset and password-change-required claim remain denied',opt,async()=>{
  await setup(variant);denied(await request('GET',requestPath,undefined,{claims:{svPasswordChangeRequired:true},query}));await owner('PUT','/sv_access_resets/admin',{required:true,version:2});denied(await request('GET',requestPath));denied(await request('GET',requestPath,undefined,{query}));await unchanged();
 });
 test(variant+' access version mismatch stays denied and matching version restores only previous authorization',opt,async()=>{
  await setup(variant);await owner('PUT','/sv_access_resets/admin',{required:false,version:2});denied(await request('GET',requestPath,undefined,{claims:{svAccessVersion:1},query}));const value=await allowedSnapshot(variant,{claims:{svAccessVersion:2}});assert.deepEqual(value,selected(seed.sisventas.hsextra_solicitudes));await unchanged();
 });
}
function floatingFixture(){const value=fixture();for(const [key,hours]of [['float-a',0.1],['float-m',0.2],['float-z',0.4]])value.sisventas.hsextra_solicitudes[key]={estado:'pendiente',empFbKey:'float',empNombre:key,mes:'2026-10',horas:hours};return value;}
test('official SDK10.12 root7 versus query8 preserves exact snapshot order, names, requests, details and IEEE sums',sdkOpt,async()=>{
 const data=floatingFixture();await setup('baseline',data);const before=await sdkSnapshot(false),reference=selected(before.value),expectedGroups=grouped(reference);await setup('candidate',data);const after=await sdkSnapshot(true);
 assert.deepEqual(Object.keys(after.value),Object.keys(reference));assert.equal(JSON.stringify(after.value),JSON.stringify(reference));assert.deepEqual(after.keys,before.keys.filter(key=>before.value[key].estado==='pendiente'));assert.deepEqual(grouped(after.value),expectedGroups);assert.equal(grouped(after.value).find(group=>group.empFbKey==='float').horas,0.7000000000000001);await unchanged();
});
test('official SDK10.12 fresh query snapshots preserve exact canonical grouping after state entries and exits',sdkOpt,async()=>{
 await setup('candidate',floatingFixture());const mutations=[()=>owner('PUT',requestPath+'/approved/estado','pendiente'),()=>owner('PUT',requestPath+'/a-first/estado','aprobado'),()=>owner('PUT',requestPath+'/float-m/horas',0.3),()=>owner('DELETE',requestPath+'/z-last')];
 for(const mutate of mutations){await mutate();const whole=await sdkSnapshot(false),reference=selected(whole.value),filtered=await sdkSnapshot(true);assert.deepEqual(Object.keys(filtered.value),Object.keys(reference));assert.equal(JSON.stringify(filtered.value),JSON.stringify(reference));assert.deepEqual(grouped(filtered.value),grouped(reference));}
 await unchanged();
});
