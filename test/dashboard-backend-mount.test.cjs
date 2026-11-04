'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module'),os=require('node:os'),crypto=require('node:crypto');
const {createLaborRuntime}=require('../cotizador/labor-runtime'),{fixture}=require('./helpers/dashboard-commercial-activity-fixture.cjs'),{memoryDb}=require('./helpers/dashboard-budget-activity-fixture.cjs'),{budget,authFixture}=require('./helpers/dashboard-budget-reader-fixture.cjs');
const Model=require('../cotizador/dashboard-budget-projection-proposal'),Bootstrap=require('../cotizador/dashboard-budget-activity-bootstrap-proposal'),DTO=require('../cotizador/dashboard-budget-sdk-dto-proposal'),Index=require('../cotizador/dashboard-budget-incremental-plan-proposal');
const {digest}=require('../cotizador/labor-guard');
const root=path.resolve(__dirname,'../cotizador'),routes=['/commercial/dashboard/presupuestos/actividad-v2','/commercial/dashboard/presupuestos/avisos',...['ventas','pagos','ordenes_trabajo'].map(d=>'/commercial/dashboard/'+d+'/actividad-v2')];
const flags={LABOR_SCOPED_ENABLED:'true',COMMERCIAL_PAGES_ENABLED:'true',DASHBOARD_BUDGETS_ENABLED:'true',DASHBOARD_COMMERCIAL_ACTIVITY_ENABLED:'true',DASHBOARD_BUDGET_POLICY_RENEWAL_ENABLED:'true',DASHBOARD_READS_ENABLED:'true'};
async function data(){const f=await fixture(6);for(const r of Object.values(f.data().sv_permisos))r.indiceModulos.presupuesto=true;const records={p:budget()},authority={users:f.read('sv_usuarios'),identities:f.read('sv_chat_roles'),permissions:f.read('sv_permisos')},model=Model.build({records,complete:true,...authority,generation:'mounted-fixture',offsetMinutes:-180}),tree=Bootstrap.buildActivitySnapshot({model,records,timeZone:'America/Argentina/Buenos_Aires',sourceLocale:'es-AR'}).patch[Index.ROOT];f.set('sisventas/presupuestos',records);f.set(Index.ROOT,tree);f.apply(DTO.projectReadViews({tree,...authority}).patch);return f;}
function boot({env={},state={},directory=root,main=false}={}){
 const own=createRequire(path.join(directory,'index.js')),memory=memoryDb(state),reads=[],auth=authFixture('u');let handler,listeners=0,runtime,transport=0;
 const db={ref:p=>{reads.push(p);assert(!p.startsWith('sisventas/'),'No originals in mounted reads');return memory.ref(p);}};
 const module={exports:{}};
 function req(name){if(name==='http')return {createServer:fn=>{handler=fn;return {listen:()=>{listeners++;}};}};if(name==='firebase-admin')return {apps:[{}],database:()=>db,auth:()=>auth,app:()=>({options:{credential:{getAccessToken:async()=>assert.fail('No real credentials')}}})};if(name==='./navegador-compartido')return {adquirirNavegador:()=>assert.fail('No browser')};if(name==='./labor-runtime')return {createLaborRuntime:args=>{runtime=own(name).createLaborRuntime({...args,accessToken:async()=> 'fixture-owner',fetchImpl:async(url,init)=>{if(init.method!=='GET'){transport++;assert.fail('No guard writes for read');}const u=new URL(url),p=decodeURIComponent(u.pathname.slice(1,-5));reads.push(p);assert(!p.startsWith('sisventas/'),'No originals in mounted REST reads');let q=memory.ref(p);if(u.searchParams.has('orderBy')){const order=JSON.parse(u.searchParams.get('orderBy'));q=order==='$key'?q.orderByKey():q.orderByChild(order);}if(u.searchParams.has('equalTo'))q=q.equalTo(JSON.parse(u.searchParams.get('equalTo')));if(u.searchParams.has('startAt'))q=q.startAt(JSON.parse(u.searchParams.get('startAt')));if(u.searchParams.has('limitToFirst'))q=q.limitToFirst(JSON.parse(u.searchParams.get('limitToFirst')));return new Response(JSON.stringify((await q.get()).val()),{status:200});}});return runtime;}};
  // VM literals have foreign prototypes; clone only the context boundary, not DTOs or algorithms.
  const factory={'./dashboard-budget-activity-reader-proposal':'createActivityReader','./dashboard-commercial-activity-reader-proposal':'createReader'}[name];if(factory){const real=own(name);return {...real,[factory]:args=>real[factory]({...args,getLegacyContext:async()=>structuredClone(await args.getLegacyContext())})};}return own(name);}
 if(main)req.main=module;
 const beforeTZ=process.env.TZ,context={require:req,module,process:{env:{FIREBASE_DATABASE_URL:'https://fixture.invalid',...env}},console:{log(){},warn(){},error(){}},Buffer,URL,URLSearchParams,AbortSignal,AbortController,setTimeout,clearTimeout,setInterval:()=>assert.fail('No periodic query'),clearInterval,fetch:()=>assert.fail('No external fetch')};
 vm.runInNewContext(fs.readFileSync(path.join(directory,'index.js'),'utf8'),context,{filename:'mounted-index.js'});assert.equal(process.env.TZ,beforeTZ);
 async function request(url,extra={}){let status,body;const headers={},res={setHeader:(k,v)=>{headers[k]=v;},writeHead:(s,h)=>{status=s;Object.assign(headers,h);},end:v=>{body=v;}};await handler({method:'GET',url,headers:{authorization:'Bearer fixture-token'},...extra},res);return {status,headers,body:JSON.parse(body)};}
 return {request,reads,auth,runtime,listeners,get transport(){return transport;}};
}
test('runtime defaults inert and explicit plugins require coordinated Pages before construction',()=>{
 const args={db:{},databaseURL:'https://fixture.invalid',accessToken:async()=>assert.fail('No token'),commercialPages:false,clientAccounts:false,clientHistory:false,dashboardBudgets:false,dashboardActivity:false,dashboardPolicyRenewal:false};
 const off=createLaborRuntime(args);assert.equal(Object.hasOwn(off.capabilities(),'dashboardBudgets'),false,'Existing public capabilities contract stays unchanged');assert.equal(off.guard.affects('sv_permisos/admin'),false);
 for(const feature of ['dashboardBudgets','dashboardActivity'])for(const prerequisites of [{enabled:false,commercialPages:true},{enabled:true,commercialPages:false}])assert.throws(()=>createLaborRuntime({...args,...prerequisites,[feature]:true}),/coordinado y Pages/);
 assert.throws(()=>createLaborRuntime({...args,dashboardPolicyRenewal:true}),/requiere el escritor/);assert.throws(()=>createLaborRuntime({...args,dashboardActivity:'true'}),/booleanos/);
 const on=createLaborRuntime({...args,enabled:true,commercialPages:true,dashboardBudgets:true,dashboardActivity:true,dashboardPolicyRenewal:true});for(const p of ['sv_permisos/admin','sv_usuarios/u','sisventas/presupuestos/p','sisventas/ordenes_trabajo/o'])assert(on.guard.affects(p));
});
test('actual index boots with flags false and routes refuse reads without Auth/DB/guard work',async()=>{
 const f=boot({main:true});assert.equal(f.listeners,1);assert.equal(f.reads.length,0);for(const route of routes){const r=await f.request(route);assert.equal(r.status,503);assert.equal(r.headers['Cache-Control'],'private, no-store');}assert.equal(f.auth.calls.length,0);assert.equal(f.transport,0);assert.equal(f.reads.length,0);
});
test('budget prepare/assign use the commercial actor fence when its writer is enabled without Accounts',async()=>{
 const config={indiceVersion:2,indiceRevision:7,indiceModulos:{presupuesto:true}},actor={uid:'u',realUid:'u',claims:{uid:'u'},role:'admin',domain:'presupuestos',permissionRevision:7,permissionDigest:digest(config)};
 for(const dashboardBudgets of [false,true]){const runtime=createLaborRuntime({db:{},databaseURL:'https://fixture.invalid',accessToken:async()=>assert.fail('No token'),enabled:true,commercialPages:true,clientAccounts:false,clientHistory:false,dashboardBudgets,dashboardActivity:false,dashboardPolicyRenewal:false});let calls=0;runtime.guard.run=async(c,work)=>{calls++;assert.equal(c.mode,'user');assert.equal(c.commercialContext,true);assert.equal(c.domain,'presupuestos');return work({get:async p=>p.startsWith('sv_chat_roles/')?{activo:true,rol:'admin'}:config});};for(const method of ['prepare','assign'])assert.equal(await runtime.commercialMutation(actor,method,{},async()=>42),42);assert.equal(calls,dashboardBudgets?2:0);}
});
test('actual index refuses read startup without both prepared writer plugins',()=>{
 for(const missing of ['LABOR_SCOPED_ENABLED','COMMERCIAL_PAGES_ENABLED','DASHBOARD_BUDGETS_ENABLED','DASHBOARD_COMMERCIAL_ACTIVITY_ENABLED'])assert.throws(()=>boot({env:{...flags,[missing]:'false'}}),/coordinado|escritor/);
});
test('five actual GET routes read prepared DTOs through existing current Auth without writes',async()=>{
 const fdata=await data(),before=structuredClone(fdata.data()),f=boot({env:flags,state:fdata.data(),main:true});assert.equal(f.listeners,1);assert.equal(f.reads.length,0);
 for(const route of routes){const r=await f.request(route);assert.equal(r.status,200,route+' '+JSON.stringify(r.body));assert.equal(r.body.uid,'u');if(route.endsWith('/avisos')){assert.equal(r.body.complete,true);assert.equal(r.body.rows.length,1);}else{assert.equal(r.body.recent.timeZone,'America/Buenos_Aires');assert.equal(r.body.recent.sourceLocale,'es-AR');assert(r.body.recent.rows.length<=5);}assert(!JSON.stringify(r.body).includes('NEVER_TRANSPORT'));}
 assert(f.auth.calls.length>5);assert.equal(f.transport,0);assert.deepEqual(fdata.data(),before);
 for(const route of routes){assert.equal((await f.request(route,{method:'POST'})).status,405);assert.equal((await f.request(route+'?verComo=v')).status,400);assert.equal((await f.request(route,{body:{scope:'all'}})).status,400);}
});
test('mounted readers reject inactive identity and corrupt coverage without invoking a guard',async()=>{
 const state=await data(),f=boot({env:flags,state:state.data()});state.set('sv_chat_roles/u/activo',false);for(const route of routes)assert.notEqual((await f.request(route)).status,200);state.set('sv_chat_roles/u/activo',true);state.set(Index.ROOT+'/coverage/ready',false);assert.notEqual((await f.request(routes[0])).status,200);assert.equal(f.transport,0);
});
test('mounted readers enforce current Dashboard grants on all five routes without guard writes',async()=>{
 const state=await data(),f=boot({env:flags,state:state.data()});state.set('sv_permisos/vendedor/indiceModulos/dashboard',false);for(const route of routes)assert.notEqual((await f.request(route)).status,200);assert.equal(f.transport,0);
});
test('packaged canonical helpers are byte-identical, including sibling dependencies',()=>{
 for(const name of ['dashboard-activity-model.v2.js','dashboard-activity-instant.v1.js','dashboard-budget-notice-model-proposal.js','dashboard-budget-notice-legacy-proposal.js','permission-index.js'])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'commercial-models',name))).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'../js/core',name))).digest('hex'),name);
});
test('Docker COPY payload alone boots actual index false/true without ../js dependencies',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sv-dashboard-pack-'));
 try{for(const line of fs.readFileSync(path.join(root,'Dockerfile'),'utf8').split(/\r?\n/)){if(!line.startsWith('COPY '))continue;for(const item of line.trim().split(/\s+/).slice(1,-1)){if(item.includes('*'))continue;const src=path.join(root,item),dest=path.join(temp,item);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(src,dest,{recursive:true});}}
  assert.equal(boot({directory:temp,main:true}).listeners,1);const prepared=await data(),on=boot({directory:temp,env:flags,state:prepared.data(),main:true});for(const route of routes)assert.equal((await on.request(route)).status,200);assert.equal(on.transport,0);
 }finally{assert(path.isAbsolute(temp)&&path.dirname(temp)===path.resolve(os.tmpdir())&&path.basename(temp).startsWith('sv-dashboard-pack-'),'Remove only the named fixture directory');fs.rmSync(temp,{recursive:true,force:true});}
});
