'use strict';
// Run against the frozen root contract plus the explicit delivery patch.
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.env.SV_CREATOR_TRANSPORT_SOURCE||path.resolve(__dirname,'..'),load=p=>require(path.join(root,p));
const R=load('cotizador/dashboard-commercial-activity-reader-proposal'),Pages=load('cotizador/commercial-pages-model');
const {fixture,legacy}=load('test/helpers/dashboard-commercial-activity-fixture.cjs');
const {memoryDb}=load('test/helpers/dashboard-budget-activity-fixture.cjs'),{authFixture}=load('test/helpers/dashboard-budget-reader-fixture.cjs');
const Aggregate=load('js/core/dashboard-activity-aggregate-proposal'),HTTP=load('js/core/dashboard-http-ports-proposal');
const DATA=load('test/fixtures/dashboard-http-readers-e24.json'),clone=v=>structuredClone(v);
async function backend(uid='u',n=9){
 const f=await fixture(n),trace=[],state={day:'2026-11-04',hook:null},raw=memoryDb(f.data());
 const db={ref(p){function wrap(q,spec={}){return {orderByChild:k=>wrap(q.orderByChild(k),{...spec,field:k}),equalTo:v=>wrap(q.equalTo(v),{...spec,equalTo:v}),limitToFirst:n=>wrap(q.limitToFirst(n),{...spec,limit:n}),orderByKey:()=>wrap(q.orderByKey(),{...spec,order:'key'}),async get(){assert(!p.startsWith('sisventas/'));trace.push({path:p,...spec});const s=await q.get();if(state.hook)await state.hook(p);return s;}};}return wrap(raw.ref(p));}};
 const reader=R.createReader({auth:authFixture(uid),db,enabled:true,getLegacyContext:()=>legacy,getAsOfDay:()=>state.day}),req={headers:{authorization:'Bearer fixture-token'}};
 return {...f,trace,state,readDomain:d=>reader.read(req,d)};
}
test('real reader delivers exact creator/raw-month/cancelled count inside authorized scope, not top5',async()=>{
 const f=await backend('u',0);
 for(const [key,creator,owner,fecha,cancelled]of [['yes','u','u','2026-11-04',false],['cancel','u','u','2026-11',true],['ar','u','u','04/11/2026',false],['other','v','u','2026-11-04',false],['foreign','u','v','2026-11-04',false]])await f.mutate({['sisventas/ventas/'+key]:{id:key,creadaPor:creator,responsableUid:owner,fecha,ts:100,subtotal:1,iva:0,descuento:0,total:1,estado:cancelled?'anulado':'pendiente',items:[{cod:'FICTICIO',qty:1,punit:1,sub:1,costoUnitarioCompra:0.5}]}});
 const r=await f.readDomain('ventas');assert.equal(r.creatorMonthly.complete,true);assert.equal(r.creatorMonthly.count,2);assert.equal(r.creatorMonthly.creator,'u');assert.equal(r.creatorMonthly.scope,'u_u');assert.equal(r.creatorMonthly.generation,f.read(Pages.ROOT+'/coverage').generation);assert.equal(r.creatorMonthly.revision,f.read(Pages.ROOT+'/coverage').revision);assert.equal(r.coverage.records,4);
 assert.equal(f.trace.filter(t=>t.path===Pages.ROOT+'/totals/u_u').length,2);assert(f.trace.filter(t=>t.path.includes('/document/')).every(t=>t.limit===5));
});
test('admin counts exact creator within all scope; certified empty gives zero',async()=>{
 const f=await backend('a',0);const empty=await f.readDomain('ventas');assert.equal(empty.creatorMonthly.count,0);
 await f.mutate({'sisventas/ventas/x':{id:'x',creadaPor:'a',responsableUid:'v',fecha:'2026-11-99',ts:10,subtotal:1,iva:0,descuento:0,total:1,items:[{cod:'FICTICIO',qty:1,punit:1,sub:1,costoUnitarioCompra:0.5}]}});
 const r=await f.readDomain('ventas');assert.equal(r.creatorMonthly.scope,'all');assert.equal(r.creatorMonthly.count,1);
});
test('legacy, missing, corrupt or stale creator facet does not block global activity or manufacture zero',async()=>{
 for(const kind of ['legacy','missing','generation','revision','scope','cardinality']){const f=await backend();const p=Pages.ROOT+'/totals/u_u';if(kind==='legacy')f.set(p+'/creatorMonthsSchema',null);if(kind==='missing')f.set(p,null);if(kind==='generation')f.set(p+'/generation','stale');if(kind==='revision')f.set(p+'/revision',999);if(kind==='scope')f.set(Pages.ROOT+'/coverage/scopes/u_u',null);if(kind==='cardinality')f.set(p+'/creatorMonthsRecords',999);const r=await f.readDomain('ventas');assert.equal(r.recent.rows.length,5,kind);assert.deepEqual(r.creatorMonthly,{schema:1,complete:false},kind);}
});
test('B0/B1 changes to totals, Pages config/coverage, authority, name or month reject late result',async()=>{
 for(const kind of ['totals','pages','config','permission','name','month']){const f=await backend();let changed=false;f.state.hook=p=>{if(p.includes('/document/')&&!changed){changed=true;if(kind==='totals')f.set(Pages.ROOT+'/totals/u_u/creatorMonthsRecords',99);if(kind==='pages')f.set(Pages.ROOT+'/coverage/revision',99);if(kind==='config')f.set('sv_commercial_pages_config/ready',false);if(kind==='permission')f.set('sv_permisos/vendedor/indiceRevision',8);if(kind==='name')f.set('sv_usuarios/u/nombre','otro');if(kind==='month')f.state.day='2026-12-01';}};await assert.rejects(f.readDomain('ventas'),kind);}
});
test('payments/OT do not read sales totals or expose a creator capability',async()=>{const f=await backend();for(const d of ['pagos','ordenes_trabajo'])assert.equal(Object.hasOwn(await f.readDomain(d),'creatorMonthly'),false);assert(!f.trace.some(t=>t.path.includes('/totals/')));});
function client(){
 const c={...clone(DATA.context),auth:{},db:{}},responses=clone(DATA.responses),calls=[],host={SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://trusted.example/cotizadorProveedor'}};
 c.auth.currentUser={uid:c.uid,getIdToken:async()=> 'fictional-token'};
 const sale=responses[HTTP.ROUTES.ventas];sale.creatorMonthly={schema:1,complete:true,creator:c.employeeLabel,month:c.month,scope:'u_'+c.uid,generation:'pages-fixture',revision:1,count:501};
 let hook;const capture=()=>c,valid=()=>c.connected===true,client=HTTP.create({enabled:true,baseURL:host.SISVENTAS_FUNCTIONS.cotizadorProveedor,host,capture,valid,async fetchImpl(url){const route=new URL(url).pathname.slice('/cotizadorProveedor'.length);calls.push(route);if(hook)await hook(route);return {ok:true,status:200,url,json:async()=>clone(responses[route])};}});
 return {c,responses,calls,client,sale,setHook:f=>{hook=f;},run:()=>Aggregate.create({enabled:true,capture,valid,ports:client.ports,requireNotices:false}).read()};
}
test('HTTP -> real aggregate transports monthly count 501 with a second existing ventas GET',async()=>{const f=client(),r=await f.run();assert.equal(r.salesAuthorMonthlyComplete,true);assert.equal(r.salesAuthorMonthly.count,501);assert.equal(r.activity.complete,true);assert.equal(r.dashboardComplete,false);assert.equal(f.calls.filter(p=>p===HTTP.ROUTES.ventas).length,2);assert.equal(f.calls.length,6);assert.equal(f.calls.filter(p=>p===HTTP.ROUTES.presupuestos).length,2);});
test('missing/incomplete/invalid HTTP capability preserves complete activity and explicit monthly absence',async()=>{
 for(const kind of ['absent','legacy','creator','month','scope','generation','revision','negative','extra']){const f=client(),m=f.sale.creatorMonthly;if(kind==='absent')delete f.sale.creatorMonthly;if(kind==='legacy')f.sale.creatorMonthly={schema:1,complete:false};if(kind==='creator')m.creator='other';if(kind==='month')m.month='2026-12';if(kind==='scope')m.scope='all';if(kind==='generation')m.generation='';if(kind==='revision')m.revision=0;if(kind==='negative')m.count=-1;if(kind==='extra')m.private='secret';const r=await f.run();assert.equal(r.activity.complete,true,kind);assert.equal(r.salesAuthorMonthly,null,kind);assert.equal(r.salesAuthorMonthlyComplete,false,kind);assert.equal(f.calls.length,5,kind);assert.equal(f.calls.filter(p=>p===HTTP.ROUTES.presupuestos).length,2,kind);}
});
test('sales B0/B1 count, Pages generation/revision and activity revision changes retire only monthly capability',async()=>{
 for(const kind of ['count','generation','revision','absent','activity']){const f=client();let reads=0;f.setHook(route=>{if(route===HTTP.ROUTES.ventas&&++reads===2){if(kind==='count')f.sale.creatorMonthly.count++;if(kind==='generation')f.sale.creatorMonthly.generation='new';if(kind==='revision')f.sale.creatorMonthly.revision++;if(kind==='absent')delete f.sale.creatorMonthly;if(kind==='activity')f.sale.recent.revision++;}});const r=await f.run();assert.equal(r.activity.complete,true,kind);assert.equal(r.salesAuthorMonthlyComplete,false,kind);assert.equal(r.salesAuthorMonthly,null,kind);}
});
test('authority retirement during second sales GET discards whole result',async()=>{const f=client();let reads=0;f.setHook(route=>{if(route===HTTP.ROUTES.ventas&&++reads===2)f.c.dataEpoch++;});await assert.rejects(f.run(),{code:'SV_ACTIVITY_CONTEXT_RETIRED'});});
test('actual authorized reader -> HTTP decoder -> aggregate: 501 creator sales while recent5 belong to another creator',async()=>{
 const f=await backend('u',511),P=load('cotizador/commercial-pages-projections'),Activity=load('cotizador/dashboard-commercial-activity-proposal');
 for(const [key,sale]of Object.entries(f.data().sisventas.ventas)){sale.creadaPor=Number(key.slice(1))<501?'u':'v';sale.fecha='2026-11-04';sale.responsableUid='u';}
 const prepared=await P.prepare({sales:f.data().sisventas.ventas,payments:f.data().sisventas.pagos,owner:s=>s.responsableUid,generation:'pages-fixture'});f.set(Pages.ROOT,null);f.apply(prepared.patch);
 f.set(Activity.ROOT,null);f.apply((await Activity.build({originals:f.data().sisventas,complete:true,pages:f.read(Pages.ROOT),pagesEvidence:prepared.activitySnapshot,config:f.read('sv_commercial_pages_config'),generation:'activity-fixture',...legacy})).patch);
 const c=client();c.setHook(async route=>{for(const d of ['ventas','pagos','ordenes_trabajo'])if(route===HTTP.ROUTES[d])c.responses[route]=await f.readDomain(d);});
 const r=await c.run();assert.equal(r.salesAuthorMonthlyComplete,true);assert.equal(r.salesAuthorMonthly.count,501);assert.equal(r.activity.complete,true);assert.equal(r.dashboardComplete,false);
 const ventas=c.responses[HTTP.ROUTES.ventas];assert(ventas.recent.rows.every(row=>f.read('sisventas/ventas/'+row.key).creadaPor==='v'));assert.equal(ventas.creatorMonthly.count,501);
 assert.equal(f.trace.filter(t=>t.path===Pages.ROOT+'/totals/u_u').length,4);assert.equal(c.calls.length,6);assert.equal(c.calls.filter(p=>p===HTTP.ROUTES.presupuestos).length,2);
});
