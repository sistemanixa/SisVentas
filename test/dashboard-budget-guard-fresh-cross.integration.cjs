'use strict';
// Explicit opt-in: real loopback RTDB reads/rules + real guard writer plugin.
// Owner transport and mock JWTs are fixture authority, not production writer fences.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module');
const sourceRoot=path.resolve(process.env.SV_BUDGET_CROSS_SOURCE_ROOT||path.join(__dirname,'..')),source=createRequire(path.join(sourceRoot,'test','dashboard-budget-guard-fresh-cross.integration.cjs'));
const Index=source('../cotizador/dashboard-budget-incremental-plan-proposal'),Writer=source('../cotizador/dashboard-budget-writer-proposal'),DTO=source('../cotizador/dashboard-budget-sdk-dto-proposal'),{createLaborGuard}=source('../cotizador/labor-guard');
const Direct=source('../js/core/dashboard-budget-sdk-proposal'),Fresh=source('../js/core/dashboard-budget-fresh-rtdb-proposal'),Rules=source('../security/dashboard-budget-sdk-rules.proposal.cjs'),Oracle=source('../cotizador/dashboard-budget-activity-reader-proposal'),NoticeOracle=source('../cotizador/dashboard-budget-notice-candidates-proposal');
const {activitySeed}=source('./helpers/dashboard-budget-activity-fixture.cjs'),{budget,authFixture,request}=source('./helpers/dashboard-budget-reader-fixture.cjs'),{apply}=source('./helpers/labor-ui-flow.cjs');
const enabled=process.env.SV_BUDGET_CROSS_NATIVE==='1',opt={skip:!enabled,timeout:60000},ROOT=Index.ROOT,host='127.0.0.1:9059',base='http://'+host,ns='demo-budget-guard-cross-'+process.pid,BASE=1793800000000;
let mockToken,sequence=0;const observations=[];
async function owner(method,p,value,extra={}){
 const url=new URL(p.replace(/^\//,'')+'.json',base);url.searchParams.set('ns',ns);
 const response=await fetch(url,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json',...extra},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200,'Fixture owner request '+method+' '+p+' status '+response.status);return {value:await response.json(),etag:response.headers.get('etag')};
}
async function get(p){return (await owner('GET',p)).value;}
before(async()=>{
 if(!enabled)return;
 assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,host);assert.equal(Index.ROOT,ROOT);
 const dependencies=createRequire(path.join(process.env.SV_BUDGET_FIREBASE_MODULES||path.join(sourceRoot,'cotizador','node_modules'),'fixture-entry.cjs'));mockToken=dependencies('@firebase/util').createMockUserToken;
 await owner('PUT','.settings/rules',Rules.buildStandalone());
});
after(async()=>{if(enabled){await owner('DELETE','');assert.equal(await get(''),null);console.log('Guard/fresh cross evidence '+JSON.stringify({namespace:ns,observations,cleanup:true,scope:'Loopback emulator only; owner persistence/mock JWTs; no runtime mounting or production fences'}));}},{timeout:20000});
function initialRecords(){
 const rows=Object.fromEntries(Array.from({length:55},(_,i)=>['p'+String(i).padStart(2,'0'),budget({id:'PP-'+String(i).padStart(4,'0'),ts:BASE+i,estado:i===0?'convertido':i===1?'revision':'enviado',vence:i%3?'2026-11-05':'2027-01-01'})]));rows.foreign=budget({responsableUid:'v',ts:BASE+1000});return rows;
}
async function fixture(){
 const data=activitySeed(initialRecords()),tree=data.sv_dashboard_budget_proposal.v1;data.sv_labor_config={schema:1,ready:true};
 apply(data,DTO.projectReadViews({tree,users:data.sv_usuarios,identities:data.sv_chat_roles,permissions:data.sv_permisos}).patch);
 apply(data,{'sisventas/ventas/sentinel/costoTotalCompra':19,'sisventas/productos':{s:{compraARS:19}},'sisventas/inventario_operativo':{s:{general:7,reservado:2,consumido:1}},'sisventas/comisiones':{s:{monto:13}},'sisventas/ctaemp':{s:{monto:17}}});await owner('PUT','',data);
 const domains=['ventas','pagos','productos','inventario_operativo','comisiones','ctaemp'],sentinels=Object.fromEntries(domains.map(k=>[k,data.sisventas[k]])),commits=[],writerReads=[],clients=[];
 const store={
  async read(p){writerReads.push(p);assert(!['sisventas','sisventas/presupuestos',ROOT,ROOT+'/sources'].includes(p),'No full original/source inventory during writer');return get(p);},
  async readAsUser(p){return this.read(p);},
  async acquire(lease){const current=await owner('GET','sv_labor_guard',undefined,{'X-Firebase-ETag':'true'});assert.equal(current.value,null);await owner('PUT','sv_labor_guard',lease,{'if-match':current.etag});},
  async abort(lease){if((await get('sv_labor_guard'))?.fence===lease.fence)await owner('DELETE','sv_labor_guard');},
  async commit(patch,lease){
   assert.equal((await get('sv_labor_guard'))?.fence,lease.fence);assert.equal(patch.sv_labor_guard,null);assert(patch['sv_labor_receipts/'+lease.opId]);
   const coverage=patch[ROOT+'/coverage'];if(coverage){const previous=await get(ROOT+'/read')||{};for(const id of Object.keys(previous))assert(Object.hasOwn(patch,ROOT+'/read/'+id),'Coverage/header atomicity for '+id);for(const [p,h]of Object.entries(patch))if(p.startsWith(ROOT+'/read/')&&h){assert.equal(Object.keys(h).length,23);assert.equal(h.revision,coverage.revision);assert.equal(h.generation,coverage.generation);assert.equal(h.policyHash,coverage.policyHash);}}
   await owner('PATCH','',patch);commits.push(structuredClone(patch));
  }
 };
 const guard=createLaborGuard({store,dashboardBudgets:Writer.create({enabled:true,allowPolicyRenewal:true}),delay:async()=>{}});
 async function mutate(patch,{race}={}){return guard.run({uid:'a',claims:{uid:'a'},role:'admin',mode:'user',operation:'cross-guard-fresh',opId:'cross-operation-'+(++sequence),input:patch},async scope=>{await scope.update(patch);if(race)scope.beforeCommit(race);return {ok:true,committed:true};});}
 async function client(uid='u',override={}){
  const h=await get(ROOT+'/read/'+uid),token=mockToken({sub:uid,user_id:uid,svAccessVersion:1},ns),auth={currentUser:{uid,getIdToken:async()=>token}},calls=[];
  const ctx={uid,role:h?.role||'vendedor',permissionRevision:h?.permissionRevision??7,sessionEpoch:1,connectionEpoch:1,connected:true,auth,db:{fixture:true},timeZone:tree.coverage.activityTimeZone,sourceLocale:tree.coverage.activitySourceLocale,grants:{ventas:null,pagos:null,ordenes_trabajo:null,presupuestos:uid==='a'?'all':'own'},...override};let hook;
  const fresh=Fresh.create({databaseURL:base+'/?ns='+ns,expectedOrigin:base,allowLoopback:true,auth,fetchImpl:async(url,init)=>{const u=new URL(url),p=decodeURIComponent(u.pathname.slice(1,-5));assert(p.startsWith(ROOT+'/'),'Reader must not read originals');assert.equal(init.cache,'no-store');calls.push({path:p,query:Object.fromEntries([...u.searchParams].filter(([k])=>k!=='auth'&&k!=='ns'))});const response=await fetch(url,init);if(hook)await hook(p);return response;}});
  const reader=Direct.create({readFresh:fresh,capture:()=>ctx,valid:()=>ctx.connected,getAsOfDay:()=> '2026-11-04'}),result={uid,ctx,calls,reader,token,setHook:fn=>{hook=fn;}};clients.push(result);return result;
 }
 function oracleDb(reads){function ref(p,spec={}){return {orderByChild:f=>ref(p,{...spec,orderBy:f}),equalTo:v=>ref(p,{...spec,equalTo:v}),orderByKey:()=>ref(p,{...spec,orderBy:'$key'}),startAt:v=>ref(p,{...spec,startAt:v}),startAfter:v=>ref(p,{...spec,startAfter:v}),limitToFirst:v=>ref(p,{...spec,limitToFirst:v}),async get(){assert(!p.startsWith('sisventas/'),'Server reader must not read originals');reads.push(p);const url=new URL(p+'.json',base);url.searchParams.set('ns',ns);for(const [k,v]of Object.entries(spec))url.searchParams.set(k,JSON.stringify(v));const response=await fetch(url,{headers:{Authorization:'Bearer owner'},signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);const value=await response.json();return {val:()=>value,forEach:fn=>{for(const [key,v]of Object.entries(value||{}).sort(([a],[b])=>a<b?-1:a>b?1:0))fn({key,val:()=>v});}};}};}return {ref};}
 async function verify(c){
  const start=c.calls.length,result=await c.reader.read(),notices=await c.reader.notices(),metrics=await c.reader.metrics(),serverReads=[],db=oracleDb(serverReads),activity=Oracle.createActivityReader({auth:authFixture(c.uid),db,enabled:true,getAsOfDay:()=> '2026-11-04'}),noticeReader=NoticeOracle.create({auth:authFixture(c.uid),db,enabled:true});
  const expected=await activity.read(request({url:Oracle.ROUTE})),expectedNotices=await noticeReader.read(request({url:NoticeOracle.ROUTE}));assert.deepEqual(result.counts,expected.counts);assert.deepEqual(result.recent,expected.recent);assert.deepEqual(result.badge,expected.badge);assert.deepEqual(notices.notices.rows,expectedNotices.rows);assert.deepEqual(metrics.counts,result.counts);
  const originals=await get('sisventas/presupuestos')||{},owned=Object.entries(originals).filter(([,r])=>c.uid==='a'||r.responsableUid===c.uid),top=owned.map(([key,r])=>({key,ms:Number(r.ts)})).filter(r=>r.ms).sort((a,b)=>b.ms-a.ms||(a.key<b.key?-1:a.key>b.key?1:0)).slice(0,5);assert.deepEqual(result.recent.rows.map(r=>({key:r.key,ms:r.ms})),top);
  assert.equal(result.counts.active,owned.filter(([,r])=>['enviado','revision'].includes(r.estado)).length);assert.equal(result.counts.converted,owned.filter(([,r])=>r.estado==='convertido').length);assert.equal(notices.notices.rows.length,owned.filter(([,r])=>r.estado!=='convertido').length);
  assert(!JSON.stringify({result,notices}).includes('NEVER_TRANSPORT'));assert(!JSON.stringify(notices).includes('sourceHash'));const calls=c.calls.slice(start);assert(calls.every(r=>!r.path.startsWith('sisventas/')));assert(calls.filter(r=>r.path.includes('/document/')).every(r=>r.query.limitToFirst==='5'));assert(calls.filter(r=>r.path.includes('/noticeCandidates/')).every(r=>r.query.limitToFirst==='50'));assert(serverReads.every(p=>!p.startsWith('sisventas/')));
  const header=await get(ROOT+'/read/'+c.uid),coverage=await get(ROOT+'/coverage');assert.equal(Object.keys(header).length,23);assert.equal(header.revision,coverage.revision);assert.equal(header.policyHash,coverage.policyHash);return {clientGets:calls.length,serverGets:serverReads.length,noticePages:calls.filter(r=>r.path.includes('/noticeCandidates/')).length,revision:header.revision,notices:notices.notices.rows.length};
 }
 async function preserve(){for(const [domain,value]of Object.entries(sentinels))assert.deepEqual(await get('sisventas/'+domain),value,'Preserve '+domain);}
 return {mutate,client,verify,preserve,commits,writerReads,guard,clients};
}
for(const [name,patch]of [
 ['create',{'sisventas/presupuestos/new':budget({ts:BASE+9999})}],['edit',{'sisventas/presupuestos/p54/estado':'convertido','sisventas/presupuestos/p01/ts':BASE+9999}],['reassign',{'sisventas/presupuestos/p54/responsableUid':'v'}],['delete',{'sisventas/presupuestos/p54':null}]
])test('real plugin guarded '+name+' is immediately visible to fresh metrics/prefix/notices without rebuild',opt,async()=>{
 const f=await fixture(),u=await f.client(),a=await f.client('a');await f.verify(u);const before=f.commits.length;await f.mutate(patch);assert.equal(f.commits.length,before+1);const own=await f.verify(u),all=await f.verify(a);await f.preserve();observations.push({case:name,commits:f.commits.length,own,all,originalReaderGets:0});
});
test('permission revision renewal preserves global ready and refreshed readers; old context cannot reuse its header',opt,async()=>{
 const f=await fixture(),old=await f.client();await f.verify(old);await f.mutate({'sv_permisos/vendedor/indiceRevision':8,'sv_permisos/vendedor/acciones/presupuestos/aprobar':false});assert.equal((await get(ROOT+'/coverage')).ready,true);await assert.rejects(old.reader.metrics());const fresh=await f.client();assert.equal(fresh.ctx.permissionRevision,8);const evidence=await f.verify(fresh);await f.preserve();observations.push({case:'permission-renewal',...evidence,staleContextDenied:true});
});
test('module revocation removes UID headers and denies fresh metrics and notices while admin stays readable',opt,async()=>{
 const f=await fixture(),u=await f.client(),a=await f.client('a');await f.verify(u);await f.mutate({'sv_permisos/vendedor/indiceRevision':8,'sv_permisos/vendedor/indiceModulos/dashboard':false});assert.equal((await get(ROOT+'/coverage')).ready,true);assert.equal(await get(ROOT+'/read/u'),null);await assert.rejects(u.reader.metrics());await assert.rejects(u.reader.notices());await f.verify(a);await f.preserve();observations.push({case:'module-revocation',denied:2,adminReadable:true});
});
test('foreign scope and original reads are denied by emulator rules; no claimed role grants authority',opt,async()=>{
 const f=await fixture(),u=await f.client(),forged=mockToken({sub:'u',user_id:'u',svAccessVersion:1,rol:'admin',admin:true,svLaborService:true},ns);for(const p of [ROOT+'/read/v',ROOT+'/document/u_v',ROOT+'/document/all','sisventas/presupuestos']){const url=new URL(p+'.json',base);url.searchParams.set('ns',ns);url.searchParams.set('auth',forged);if(p.includes('/document/')){url.searchParams.set('orderBy',JSON.stringify('$key'));url.searchParams.set('limitToFirst','5');}const r=await fetch(url);assert([401,403].includes(r.status));await r.body?.cancel();}await f.preserve();observations.push({case:'foreign-original-denials',denied:4,forgedRoleIgnored:true});
});
test('identity deactivation retires coverage/headers atomically and prevents reuse of previous successful results',opt,async()=>{
 const f=await fixture(),u=await f.client();await f.verify(u);await f.mutate({'sv_usuarios/u/activo':false,'sv_chat_roles/u/activo':false});assert.equal((await get(ROOT+'/coverage')).ready,false);assert.equal(await get(ROOT+'/read/u'),null);await assert.rejects(u.reader.read());await assert.rejects(u.reader.notices());await f.preserve();observations.push({case:'identity-deactivation',denied:2});
});
test('permission revoked during fresh network read never returns a partial successful DTO',opt,async()=>{
 const f=await fixture(),u=await f.client();let changed=false;u.setHook(async p=>{if(!changed&&p.includes('/document/')){changed=true;await f.mutate({'sv_permisos/vendedor/indiceRevision':8,'sv_permisos/vendedor/indiceModulos/dashboard':false});}});await assert.rejects(u.reader.read());assert.equal(changed,true);assert.equal(await get(ROOT+'/read/u'),null);await f.preserve();observations.push({case:'midread-revocation',partialSuccess:false});
});
test('plugin rejects caller-derived UID writes and concurrent authority drift without a business commit',opt,async()=>{
 const f=await fixture(),before=await get(ROOT+'/coverage');await assert.rejects(f.mutate({[ROOT+'/read/u/active']:99}),/coordinación/);assert.equal(f.commits.length,0);await assert.rejects(f.mutate({'sisventas/presupuestos/p54/estado':'convertido'},{race:async()=>owner('PATCH','',{'sv_usuarios/u/nombre':'Concurrente ficticio'})}));assert.equal(f.commits.length,0);assert.deepEqual(await get(ROOT+'/coverage'),before);assert.equal(await get('sisventas/presupuestos/p54/estado'),'enviado');await f.preserve();observations.push({case:'plugin-and-fresh-fences',commits:0});
});
