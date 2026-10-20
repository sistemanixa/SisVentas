'use strict';
const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const {readActiveApp}=require('./helpers/active-app');
const {build}=require('../scripts/prepare-labor-fence-rules.cjs');
const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store');
const {createLaborGuard}=require('../cotizador/labor-guard');
const {createLaborDb}=require('../cotizador/labor-db');
const {createScopedTransaction}=require('../cotizador/labor-scoped-transaction');
const {createLaborSubmissions}=require('../cotizador/labor-submissions');
const {createPersonalExpenses}=require('../cotizador/personal-expenses');
const {createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
const {createCommissionEvent}=require('../cotizador/commission-event');
const Index=require('../cotizador/labor-index'),Permissions=require('../js/core/permission-index');
const {create:createBrowserWrites}=require('../js/core/labor-writes');
const {porcentaje}=require('../cotizador/commission-calculations');
// The opt-in fixture is fixed to the disposable, local emulator only.
const enabled=process.env.FIREBASE_DATABASE_EMULATOR_HOST==='127.0.0.1:9017'&&!!process.env.SV_LABOR_RULES_BASE;
const options={skip:!enabled,timeout:20000},base='http://127.0.0.1:9017',namespace='demo-sisventas-fence-proof';
const copy=value=>value==null?null:structuredClone(value);
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
let app,raw;
async function rest(method,p,body){
 const url=new URL(p+'.json',base);url.searchParams.set('ns',namespace);
 const response=await fetch(url,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 const text=await response.text();assert.equal(response.status,200,text);return text?JSON.parse(text):null;
}
function fixture(){
 const s={empleados:{e:{nombre:'Empleado ficticio',activo:true}},gastos:{a:{tipoPagable:'comision',ventaFbKey:'sale',pct:4,monto:40,estado:'aprobado',legacyKey:'ctaemp/e/m'},b:{tipoPagable:'comision',ventaFbKey:'sale',pct:4,monto:40,montoPagado:40,estado:'pagado'}},ctaemp:{e:{m:{pct:4,monto:40},next:{pct:7,monto:70}}},config:{maxComisionPct:10}};
 const result={sisventas:s,sv_labor_config:{schema:1,ready:true},sv_chat_roles:{admin:{rol:'admin',activo:true,nombre:'Admin ficticio'}},sv_usuarios:{admin:{uid:'admin',activo:true,empleadoFbKey:'e',nombre:'Admin ficticio'}},sv_chat_directorio:{admin:{nombre:'Admin ficticio'}},sv_permisos:Permissions.build({admin:{bloqueados:[],acciones:{}}})};
 for(const [p,value]of Object.entries(Index.buildIndex(s))){const parts=p.split('/');let node=result;for(const key of parts.slice(0,-1))node=node[key]||={};node[parts.at(-1)]=value;}
 return result;
}
const request={method:'POST',url:'/laboral/escritura',headers:{authorization:'Bearer admin'}};
function runtime({allowContention=false}={}){
 const calls=[];
 const store=createLaborRtdbStore({databaseURL:base+'/?ns='+namespace,accessToken:async()=>'owner',requestMs:8000,fetchImpl:async(url,init)=>{assert.equal(new URL(url).origin,base);calls.push({method:init.method,path:new URL(url).pathname});return fetch(url,init);}});
 const guard=createLaborGuard({store,...(allowContention?{}:{delay:async()=>{throw Error('Unexpected concurrent lease in fixture');}})}),db=createLaborDb({db:raw,guard}),transaction=createScopedTransaction({guard});
 const auth={verifyIdToken:async(token,revoked)=>{assert.equal(token,'admin');assert.equal(revoked,true);return {uid:'admin',name:'Admin ficticio'};}};
 const submissions=createLaborSubmissions({auth,db,transaction}),personal=createPersonalExpenses({authorize:submissions.authorize,transaction}),gateway=createLaborWriteGateway({auth,db,guard,store,enabled:true});
 return {calls,store,guard,db,submissions,personal,gateway};
}
async function browser(f,{afterCollectionRead}={}){
 const actor=await f.gateway.authorize(request),commands=[],reads=[];
 const ref=(_,p='')=>({key:p.split('/').at(-1)||null,toString:()=> 'https://fixture.invalid/'+p});
 const sdk={ref,async get(r){const p=new URL(r.toString()).pathname.slice(1);reads.push(p);const value=await f.store.readAsUser(p,actor);if(p==='sisventas/gastos')await afterCollectionRead?.();return {val:()=>copy(value)};}};
 for(const name of ['set','update','push','remove','runTransaction'])sdk[name]=()=>{throw Error('Unexpected direct SDK write '+name);};
 const root={crypto:crypto.webcrypto,fbDB:{},fbAuth:{currentUser:{uid:'admin'}},currentUserUid:'admin',currentRole:'admin',PERMISOS_ROLES:{admin:{indiceRevision:1}},tienePermiso:()=>true,fbRef:ref,fbGet:sdk.get,
  SVServiceAuth:{headers:async headers=>({...headers,Authorization:'Bearer admin'})},
  async fetch(url,init){assert.equal(url,'https://gateway.invalid');assert.equal(init.method,'POST');const command=JSON.parse(init.body);commands.push(command);try{const data=await f.gateway.write(actor,command);return {ok:true,status:200,json:async()=>data};}catch(error){return {ok:false,status:error.statusCode||500,json:async()=>({code:error.code,mensaje:error.message})};}}
 };
 createBrowserWrites(root).install({sdk,endpoint:'https://gateway.invalid'});
 const source=readActiveApp().source,start=source.indexOf('function _gastoIdentidad('),end=source.indexOf('\nfunction guardarGastoRapido(',start);
 assert.ok(start>=0&&end>start);const context=vm.createContext({window:root,TextEncoder,Uint8Array,Set,JSON});vm.runInContext(source.slice(start,end),context);
 return {create:datos=>context._crearGastoSinDuplicar(copy(datos)),identity:datos=>context._gastoIdentidad(copy(datos)),commands,reads};
}
const expense=(extra={})=>({fecha:'2026-10-20',descripcion:'Reembolso ficticio único',monto:123.45,tipo:'Variable',empleadoId:'e',categoria:'Transporte',proveedor:'Proveedor ficticio',medio:'Efectivo',comprobante:'REC-FICTICIO',vencimiento:'',estado:'pendiente',montoPagado:0,...extra});
function matchingExpenses(saved){return Object.entries(saved.sisventas.gastos).filter(([,value])=>value.descripcion==='Reembolso ficticio único');}
before(async()=>{if(!enabled)return;await rest('PUT','/.settings/rules',build(JSON.parse(fs.readFileSync(process.env.SV_LABOR_RULES_BASE,'utf8'))));const admin=createRequire(path.join(__dirname,'../cotizador/package.json'))('firebase-admin');app=admin.initializeApp({projectId:namespace,databaseURL:'https://'+namespace+'.firebaseio.com',credential:{getAccessToken:async()=>({access_token:'owner',expires_in:3600})}},'labor-expense-race-demo');raw=app.database();},{timeout:15000});
beforeEach(async()=>{if(enabled)await rest('PUT','/',fixture());});
after(async()=>{await app?.delete();},{timeout:10000});

test('admin read before typed command does not duplicate the identical expense after the command commits',options,async()=>{
 const f=runtime(),captured=deferred(),release=deferred(),client=await browser(f,{afterCollectionRead:async()=>{captured.resolve();await release.promise;}}),who=await f.submissions.authorize(request),data=expense();
 const pending=client.create(data);await captured.promise;
 const saved=await f.personal.submit(who,data);release.resolve();await assert.rejects(pending,/Ya existe un gasto/);
 const rows=matchingExpenses(await rest('GET','/'));assert.equal(rows.length,1);assert.equal(rows[0][0],saved.key);assert.equal(client.commands.length,0);
});

test('admin first and typed command after it do not duplicate equal identities or lose original fields',options,async()=>{
 const f=runtime(),client=await browser(f),who=await f.submissions.authorize(request),data=expense({nota:'Conservar historial ficticio'});
 const saved=await client.create(data);await assert.rejects(f.personal.submit(who,data),{statusCode:409});
 const rows=matchingExpenses(await rest('GET','/'));assert.equal(rows.length,1);assert.equal(rows[0][0],saved.key);assert.equal(rows[0][1].nota,data.nota);assert.equal(client.commands.length,1);assert.equal(client.commands[0].kind,'compare');
});

test('the same long optional input is rejected on both paths before any read, lease or business write',options,async()=>{
 const f=runtime(),client=await browser(f),who=await f.submissions.authorize(request),data=expense({proveedor:'P'.repeat(501)}),before=f.calls.length;
 await assert.rejects(f.personal.submit(who,data),error=>error.statusCode===400&&/500/.test(error.message));
 await assert.rejects(client.create(data),error=>/500/.test(error.message));
 assert.equal(f.calls.length,before);assert.deepEqual(client.reads,[]);assert.deepEqual(client.commands,[]);
 assert.equal(matchingExpenses(await rest('GET','/')).length,0);
});

test('gateway partial commission changes obey the global effective percentage and preserve paid history',options,async()=>{
 const cases=[
  {'sisventas/gastos/b/pct':7},
  {'sisventas/ctaemp/e/m/pct':7},
  {'sisventas/gastos/a/legacyKey':'ctaemp/e/next'},
  {'sisventas/gastos/a/pct':null,'sisventas/ctaemp/e/m/pct':null,'sisventas/ctaemp/e/m/descripcion':'Comisión 7%'},
  {'sisventas/gastos/b/ventaFbKey':'different','sisventas/gastos/new':{tipoPagable:'comision',ventaFbKey:'sale',pct:7,monto:70,estado:'aprobado'}}
 ];
 for(const [i,value]of cases.entries()){
  await rest('PUT','/',fixture());const f=runtime(),actor=await f.gateway.authorize(request);await assert.rejects(f.gateway.write(actor,{id:'partial_commission_demo_'+i,kind:'patch',path:'',value}),{code:'SV_LABOR_COMMISSION_LIMIT'});
  assert.deepEqual((await rest('GET','/')).sisventas,fixture().sisventas);assert.equal(f.calls.filter(call=>call.method==='PATCH').length,0);
 }
 await rest('PUT','/',fixture());const f=runtime(),actor=await f.gateway.authorize(request);
 await f.gateway.write(actor,{id:'partial_commission_payment_demo',kind:'patch',path:'',value:{'sisventas/gastos/b/pagos/new':{monto:5,anulado:true},'sisventas/gastos/b/saldoPagadoLegacy':40}});
 const saved=await rest('GET','/');assert.equal(saved.sisventas.gastos.b.montoPagado,40);assert.equal(saved.sisventas.gastos.b.saldoPagadoLegacy,40);assert.equal(porcentaje(saved.sisventas.gastos.b,null),4);
});

test('fiscal server journal is closed to client GET, PUT, DELETE and a mixed gateway patch',options,async()=>{
 const fiscalPath='sv_fiscal_emissions/'+('a'.repeat(64)),journal={estado:'autorizada',resultado:{cae:'CAE-FICTICIO'}};
 await rest('PUT','/'+fiscalPath,journal);
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),stamp=Math.floor(Date.now()/1000);
 const token=encode({alg:'none',typ:'JWT'})+'.'+encode({aud:namespace,iss:'https://securetoken.google.com/'+namespace,sub:'admin',user_id:'admin',iat:stamp-5,exp:stamp+300,firebase:{identities:{},sign_in_provider:'custom'}})+'.';
 for(const method of ['GET','PUT','DELETE']){
  const url=new URL('/'+fiscalPath+'.json',base);url.searchParams.set('ns',namespace);url.searchParams.set('auth',token);
  const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:method==='PUT'?JSON.stringify({estado:'alterada'}):undefined,signal:AbortSignal.timeout(8000)});await response.body?.cancel();assert.ok([401,403].includes(response.status),method+' must be denied');
 }
 const f=runtime(),actor=await f.gateway.authorize(request),before=await rest('GET','/sisventas/gastos');
 await assert.rejects(f.gateway.write(actor,{id:'fiscal_mixed_gateway_demo',kind:'patch',path:'',value:{'sisventas/gastos/forbidden_fiscal':{monto:10},[fiscalPath]:null}}),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});
 assert.deepEqual(await rest('GET','/sisventas/gastos'),before);assert.deepEqual(await rest('GET','/'+fiscalPath),journal);assert.equal(await rest('GET','/sv_labor_receipts'),null);assert.equal(await rest('GET','/sv_labor_guard'),null);
});

test('event failures retain the five-attempt review cutoff inside the full runtime coordinator',options,async()=>{
 const f=runtime();let attempts=0;const identity={email:'worker@example.invalid',email_verified:true,iss:'https://accounts.google.com',aud:'https://fixture.invalid'};
 const event=createCommissionEvent({db:f.db,commissions:{systemGenerate:async()=>{attempts++;await f.db.ref('sisventas/gastos/event_partial').set({monto:999,descripcion:'Must roll back fictitious partial commission'});throw Error('Synthetic private generation failure');}},verifyToken:async()=>identity,audience:identity.aud,caller:identity.email,instance:namespace,enabled:true,coordinate:(input,work)=>f.guard.run({uid:'sv-labor-service',mode:'server',operation:'commission-event',input},work)});
 const req={method:'POST',headers:{authorization:'Bearer FICTICIO','ce-specversion':'1.0','ce-type':'google.firebase.database.ref.v1.written','ce-instance':namespace,'ce-id':'fictitious-event-repeat','ce-source':'//firebasedatabase.googleapis.com/projects/demo/locations/us-central1/instances/'+namespace,'ce-ref':'sisventas/ventas/event_sale'}};
 await rest('PUT','/sisventas/ventas/event_sale',{comisionHabilitada:true});
 for(let i=0;i<5;i++)await assert.rejects(event.handle(req),{statusCode:503});
 assert.equal((await event.handle(req)).status,'ignored');assert.equal(attempts,5);
 const saved=await rest('GET','/');assert.equal(Object.values(saved.sv_commission_events)[0].state,'review');assert.equal(saved.sv_labor_guard,undefined);assert.equal(saved.sisventas.gastos.event_partial,undefined);assert.equal(f.calls.filter(call=>call.method==='PATCH').length,11);
});

test('six deliveries across separate runtime guards cannot exceed five durable generation attempts',options,async()=>{
 const runtimes=[runtime({allowContention:true}),runtime({allowContention:true})];let attempts=0;
 const identity={email:'worker@example.invalid',email_verified:true,iss:'https://accounts.google.com',aud:'https://fixture.invalid'};
 const events=runtimes.map(f=>createCommissionEvent({db:f.db,commissions:{systemGenerate:async()=>{attempts++;await f.db.ref('sisventas/gastos/cross_runtime_partial').set({monto:999});throw Error('Synthetic private failure');}},verifyToken:async()=>identity,audience:identity.aud,caller:identity.email,instance:namespace,enabled:true,coordinate:(input,work)=>f.guard.run({uid:'sv-labor-service',mode:'server',operation:'commission-event',input},work)}));
 const req={method:'POST',headers:{authorization:'Bearer FICTICIO','ce-specversion':'1.0','ce-type':'google.firebase.database.ref.v1.written','ce-instance':namespace,'ce-id':'fictitious-cross-runtime','ce-source':'//firebasedatabase.googleapis.com/projects/demo/locations/us-central1/instances/'+namespace,'ce-ref':'sisventas/ventas/cross_runtime'}};
 await rest('PUT','/sisventas/ventas/cross_runtime',{comisionHabilitada:true});
 const results=await Promise.allSettled(Array.from({length:6},(_,i)=>events[i%2].handle(req)));
 assert.ok(results.every(result=>result.status==='fulfilled'||[423,503].includes(result.reason?.statusCode)));assert.ok(attempts<=5);
 for(let i=0;i<5&&attempts<5;i++)await assert.rejects(events[0].handle(req),{statusCode:503});
 assert.equal(attempts,5);
 assert.equal((await events[1].handle(req)).status,'ignored');assert.equal(attempts,5);
 const saved=await rest('GET','/'),ledger=Object.values(saved.sv_commission_events)[0];assert.equal(ledger.attempts,5);assert.equal(ledger.state,'review');assert.equal(saved.sisventas.gastos.cross_runtime_partial,undefined);assert.equal(saved.sv_labor_guard,undefined);
});
