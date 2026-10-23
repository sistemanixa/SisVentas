'use strict';
// Opt-in demo only. Never starts a provider service or reads ADC/production.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const Builder=require('../scripts/prepare-dashboard-hours-index.cjs'),Reader=require('../cotizador/personal-hours-reader'),Permissions=require('../js/core/permission-index'),{createBusinessAuth}=require('../cotizador/user-access');
const host='127.0.0.1:9039',base='http://'+host,namespace='demo-personal-hours-proof';
const rulesFile=process.env.SV_PERSONAL_HOURS_RULES_FILE,sdkFolder=process.env.SV_PERSONAL_HOURS_SDK_DIR;
const enabled=process.env.FIREBASE_DATABASE_EMULATOR_HOST===host&&!!rulesFile&&!!sdkFolder,opt={skip:!enabled,timeout:30000};
let baseline,candidate,App,SDK,adminApp,adminDb,nativeFetch,NativeWS,sequence=0;
const sockets=new Set(),observations=[],network=new Set();
function fixture(){return{
 sv_chat_roles:{u:{activo:true,rol:'tecnico'},a:{activo:true,rol:'admin'},target:{activo:true,rol:'tecnico'}},
 sv_permisos:Permissions.build({admin:{bloqueados:[],acciones:{dashboard:{miCuenta:true},usuarios:{impersonar:true},empleados:{autorizarHoras:true}}},tecnico:{bloqueados:[],acciones:{dashboard:{miCuenta:true},empleados:{autorizarHoras:false}}}}),
 sv_empleado_uid:{u:{perfilFbKey:'profile-u'},a:{perfilFbKey:'profile-a'},target:{perfilFbKey:'profile-target'}},
 sv_usuarios:{'profile-u':{uid:'u',rol:'tecnico',activo:true,empleadoFbKey:'own'},'profile-a':{uid:'a',rol:'admin',activo:true,empleadoFbKey:'admin-own'},'profile-target':{uid:'target',rol:'tecnico',activo:true,empleadoFbKey:'other'}},
 sisventas:{hsextra_solicitudes:{'10':{empFbKey:'own',estado:'pendiente',horas:0.2,fecha:'2026-10-03'},'2':{empFbKey:'own',estado:'pendiente',horas:0.1},'z-last':{empFbKey:'own',estado:'pendiente',horas:0.4,mes:'2026-10',fbKey:'wrong-embedded',gastoFbKey:'irrelevant'},'a-approved':{empFbKey:'own',estado:'aprobado',horas:'2.25',fecha:'2026-10-01'},'m-legacy':{empFbKey:'own',estado:0,horas:null,fecha:null,mes:null},foreign:{empFbKey:'other',estado:'pendiente',horas:99,observaciones:'Ficticio ajeno',metadataPrivate:{empFbKey:'own',secret:'Ficticio privado'}}},
 gastos:{salary:{monto:500,estado:'pagado',pagos:{p:{monto:500}}}},haberes:{own:{mes:{sueldo:500}}},ctaemp:{own:{salary:{monto:500,pagos:{p:{monto:500}}}}},pagos:{previous:{monto:18.23}},comisiones_generacion:{previous:{estado:'completada'}}}
};}
async function owner(method,location,value){const url=new URL(location+'.json',base);url.searchParams.set('ns',namespace);assert.equal(url.origin,base);const response=await fetch(url,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(10000)});const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;}
async function setup(variant='candidate',data=fixture()){await owner('PUT','/.settings/rules',variant==='baseline'?baseline:candidate);await owner('PUT','/',data);return data;}
function snapshotDto(value,employeeId){return Object.keys(value||{}).filter(key=>value[key]&&value[key].empFbKey===employeeId).map(key=>({key,value:Object.fromEntries(['empFbKey','estado','horas','fecha','mes'].filter(field=>Object.hasOwn(value[key],field)).map(field=>[field,value[key][field]]))}));}
async function client(uid){const app=App.initializeApp({projectId:namespace,databaseURL:base+'/?ns='+namespace},'own-hours-'+(++sequence)),db=SDK.getDatabase(app);SDK.connectDatabaseEmulator(db,'127.0.0.1',9039,{mockUserToken:{sub:uid,user_id:uid}});return{app,db,async close(){SDK.goOffline(db);await App.deleteApp(app);}};}
async function sdkRoot(uid='a'){const c=await client(uid);try{return(await SDK.get(SDK.ref(c.db,'sisventas/hsextra_solicitudes'))).val();}finally{await c.close();}}
function endpoint(uid='u',onQuery){
 const reads=[],writes=[];
 function wrapped(ref,p,field,value){return{orderByChild(next){return wrapped(ref.orderByChild(next),p,next,value);},equalTo(next){return wrapped(ref.equalTo(next),p,field,next);},async get(){reads.push({path:p,...(field?{field,value}:{})});const snapshot=await ref.get();if(field&&onQuery)await onQuery();return snapshot;},set(){writes.push('set');assert.fail('reader write');},update(){writes.push('update');assert.fail('reader write');},remove(){writes.push('remove');assert.fail('reader write');},transaction(){writes.push('transaction');assert.fail('reader write');}};}
 const db={ref:p=>wrapped(adminDb.ref(p),p)};
 const claims={uid};const businessAuth=createBusinessAuth({async verifyIdToken(token,revoked){assert.equal(token,'fixture');assert.equal(revoked,true);return claims;}},db);
 return{reads,writes,reader:Reader.createPersonalHoursReader({auth:businessAuth,db}),req:{method:'GET',url:'/laboral/horas-propias',headers:{authorization:'Bearer fixture'}}};
}
async function intact(seed){for(const key of ['gastos','haberes','ctaemp','pagos','comisiones_generacion'])assert.deepEqual(await owner('GET','/sisventas/'+key),seed.sisventas[key]);}
before(async()=>{
 if(!enabled)return;
 baseline=JSON.parse(fs.readFileSync(rulesFile,'utf8'));assert.equal(Builder.hash(baseline),Builder.BASELINE_HASH);candidate=Builder.build(baseline);
 const hashes={'firebase-app.mjs':'6cf917206f4da022ef68d66b94ccd41cd253adc6bc84b5a2e4ea0cbde45e7046','firebase-database.mjs':'4a5899b67d0f28d4ce147e4c4282bda61c730c100eaf4e3247c1d95ed6c70710'};
 for(const [name,expected]of Object.entries(hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(sdkFolder,name))).digest('hex'),expected);
 nativeFetch=globalThis.fetch;NativeWS=globalThis.WebSocket;assert.equal(typeof NativeWS,'function');
 globalThis.fetch=(input,options)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);assert.equal(url.origin,base,'No nonlocal fetch');network.add(url.origin);return nativeFetch(input,options);};
 globalThis.WebSocket=class extends NativeWS{constructor(input,protocols){const url=new URL(input);assert.equal(url.origin,'ws://127.0.0.1:9039');assert.equal(url.searchParams.get('ns'),namespace);super(input,protocols);network.add(url.origin);sockets.add(this);this.addEventListener('close',()=>sockets.delete(this));}};
 App=await import(pathToFileURL(path.join(sdkFolder,'firebase-app.mjs')).href);SDK=await import(pathToFileURL(path.join(sdkFolder,'firebase-database.mjs')).href);assert.equal(App.SDK_VERSION,'10.12.0');SDK.forceWebSockets();
 // Custom local credential deliberately avoids applicationDefault()/ADC.
 const admin=require('../cotizador/node_modules/firebase-admin');adminApp=admin.initializeApp({projectId:namespace,databaseURL:'https://'+namespace+'.firebaseio.com',credential:{async getAccessToken(){return{access_token:'owner',expires_in:3600};}}},'personal-hours-demo');adminDb=adminApp.database();
});
after(async()=>{
 if(!enabled)return;
 try{if(adminDb)adminDb.goOffline();if(adminApp)await adminApp.delete();await owner('DELETE','/');for(let i=0;i<20&&sockets.size;i++)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(sockets.size,0);console.log('Personal hours demo evidence '+JSON.stringify({baselineHash:Builder.hash(baseline),candidateHash:Builder.hash(candidate),namespace,officialSDK:App.SDK_VERSION,adminSDK:require('../cotizador/node_modules/firebase-admin/package.json').version,observations,network:[...network],connectionsRemaining:sockets.size,cleanup:true,scope:'Fictitious local query/reader/permissions; no ADC, provider/data changes or commercial writes'}));}
 finally{if(nativeFetch)globalThis.fetch=nativeFetch;if(NativeWS)globalThis.WebSocket=NativeWS;}
},{timeout:10000});

test('index-only rules change no read, write, ancestor or validation contract',opt,async()=>{
 const before=structuredClone(baseline),after=structuredClone(candidate);after.rules.sisventas.hsextra_solicitudes['.indexOn']=before.rules.sisventas.hsextra_solicitudes['.indexOn'];assert.deepEqual(after,before);assert.deepEqual(candidate.rules.sisventas.hsextra_solicitudes['.indexOn'],['estado','empFbKey']);await setup();
});
test('SDK9 administrative root enumeration and current Admin query produce identical own IDs, DTO, legacy fields and IEEE totals',opt,async()=>{
 const seed=await setup('baseline'),old=await sdkRoot();await setup();const f=endpoint(),result=await f.reader.read(f.req),expected=snapshotDto(old,'own');
 assert.deepEqual(result,{employeeId:'own',records:expected});assert.equal(result.records.filter(row=>row.value.estado==='pendiente').reduce((sum,row)=>sum+(parseFloat(row.value.horas)||0),0),0.7000000000000001);
 assert.equal(f.reads.length,12);assert.deepEqual(f.reads.filter(row=>row.field),[{path:'sisventas/hsextra_solicitudes',field:'empFbKey',value:'own'}]);assert.deepEqual(f.writes,[]);await intact(seed);observations.push({case:'root9-vs-reader10',keys:result.records.map(row=>row.key),logicalDBReads:12,ownQueries:1});
});
test('dense numeric snapshots keep real array keys and nullable SDK gaps',opt,async()=>{
 const seed=fixture();seed.sisventas.hsextra_solicitudes={'0':{empFbKey:'own',estado:'pendiente',horas:0.1},'1':{empFbKey:'other',estado:'pendiente',horas:99},'2':{empFbKey:'own',estado:'pendiente',horas:0.2}};await setup('baseline',seed);const old=await sdkRoot();await setup('candidate',seed);const f=endpoint();assert.deepEqual((await f.reader.read(f.req)).records,snapshotDto(old,'own'));await intact(seed);
});
test('index-only candidate preserves technical denial for root, indexed query, foreign object and scalar listen',opt,async()=>{
 const seed=await setup(),c=await client('u');const paths=['sisventas/hsextra_solicitudes','sisventas/hsextra_solicitudes/foreign','sisventas/hsextra_solicitudes/foreign/observaciones'];
 try{for(const p of paths){const ref=SDK.ref(c.db,p),query=SDK.query(ref,SDK.orderByChild('empFbKey'),SDK.equalTo('own'));let timer,stop;try{await assert.rejects(()=>new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('listen timeout')),10000);stop=SDK.onValue(query,()=>resolve('FORBIDDEN SNAPSHOT'),reject);}),error=>/permission_denied/i.test(error.code||error.message));}finally{clearTimeout(timer);stop?.();}}
 await assert.rejects(()=>SDK.get(SDK.ref(c.db,paths[0])),/permission[ _]denied/i);}finally{await c.close();}await intact(seed);
});
test('real businessAuth reset gate and late role/action/binding changes withhold output without financial effects',opt,async()=>{
 for(const edit of [()=>owner('PUT','/sv_access_resets/u',{required:true,version:2}),()=>owner('PUT','/sv_permisos/tecnico/acciones/dashboard/miCuenta',false),()=>owner('PUT','/sv_chat_roles/u/activo',false),()=>owner('PUT','/sv_usuarios/profile-u/empleadoFbKey','other'),()=>owner('PUT','/sv_permisos/tecnico/indiceRevision',999)]){
  const seed=await setup(),f=endpoint('u',edit);await assert.rejects(()=>f.reader.read(f.req),error=>[403,409].includes(error.statusCode));assert.deepEqual(f.writes,[]);await intact(seed);
 }
});
test('administrator View as uses exact verified target and remains subject to real root-hours and impersonation permissions',opt,async()=>{
 const seed=await setup(),f=endpoint('a');f.req.url+='?viewProfile=profile-target';assert.equal((await f.reader.read(f.req)).employeeId,'other');
 await owner('PUT','/sv_permisos/admin/acciones/empleados/autorizarHoras',false);await assert.rejects(()=>f.reader.read(f.req),error=>error.statusCode===403);await intact(seed);
});
test('malformed own fields and failed fixed query never become a successful empty list',opt,async()=>{
 const seed=await setup();await owner('PUT','/sisventas/hsextra_solicitudes/bad',{empFbKey:'own',estado:'pendiente',horas:{invalid:1}});const f=endpoint();await assert.rejects(()=>f.reader.read(f.req),error=>error.statusCode===503);await intact(seed);
});
