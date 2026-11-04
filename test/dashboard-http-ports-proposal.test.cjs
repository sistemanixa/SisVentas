'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),HTTP=require('../js/core/dashboard-http-ports-proposal'),Aggregate=require('../js/core/dashboard-activity-aggregate-proposal'),DATA=require('./fixtures/dashboard-http-readers-e24.json');
const BASE='https://trusted.example/cotizadorProveedor',B=HTTP.ROUTES.presupuestos,N=HTTP.ROUTES.avisos,clone=v=>structuredClone(v),turn=()=>new Promise(r=>setImmediate(r));
function fixture(options={}){
 const ctx={...clone(DATA.context),auth:{},db:{}},calls=[],tokenCalls=[],state={status:200,json:0,cancelled:0,hook:null,jsonHook:null},payloads=clone(DATA.responses),host={SISVENTAS_FUNCTIONS:{cotizadorProveedor:BASE}};
 const user={uid:ctx.uid,async getIdToken(force){tokenCalls.push(force);return 'TOKEN_FICTICIO';}};ctx.auth.currentUser=user;
 if(options.monthly===false)delete payloads[B].monthly;
 async function fetchImpl(url,spec){calls.push({url,spec});if(state.hook)await state.hook(url,spec);const path=new URL(url).pathname.slice('/cotizadorProveedor'.length);assert(Object.hasOwn(payloads,path),'Unknown endpoint');return {ok:state.status===200,status:state.status,url:state.responseURL||url,redirected:state.redirected||false,body:{async cancel(){state.cancelled++;}},async json(){state.json++;if(state.jsonHook)return state.jsonHook(path);return clone(payloads[path]);}};}
 const capture=()=>ctx,valid=()=>ctx.connected===true,client=HTTP.create({enabled:true,baseURL:BASE,host,capture,valid,fetchImpl,...options});
 return {client,ctx,capture,valid,calls,tokenCalls,state,payloads,host,user};
}
test('OFF by default: no token or GET',async()=>{const f=fixture({enabled:false});await assert.rejects(f.client.read(),{code:'SV_DASHBOARD_HTTP_DISABLED'});assert.equal(f.calls.length,0);assert.equal(f.tokenCalls.length,0);});
test('dashboard and typed budget each make one activity GET with an ordinary SDK token; center is explicit',async()=>{
 const f=fixture(),dashboard=await f.client.read('dashboard');assert.deepEqual(f.calls.map(r=>r.url),[BASE+B]);assert.deepEqual(f.tokenCalls,[undefined]);assert.equal(Object.hasOwn(dashboard,'notices'),false);const c=Aggregate.snapshot(f.capture()),port=await f.client.ports.budget.read({schema:1,context:c});assert.equal(Object.hasOwn(port.value,'notices'),false);assert.deepEqual(f.calls.map(r=>r.url),[BASE+B,BASE+B]);const center=await f.client.read('notices');assert.equal(center.notices.complete,true);assert.deepEqual(f.calls.map(r=>r.url),[BASE+B,BASE+B,BASE+N]);assert.deepEqual(f.tokenCalls,[undefined,undefined,undefined]);
});
test('five existing direct-result endpoints; unchanged activity and normalized Source notices',async()=>{
 const f=fixture(),dashboard=await f.client.read(),notices=await f.client.read('notices'),c=Aggregate.snapshot(f.capture());assert.deepEqual(dashboard.recent,DATA.responses[B].recent);assert.equal(dashboard.schema,2);assert.equal(notices.schema,2);assert.deepEqual(notices.notices,{complete:true,rows:DATA.responses[N].rows});assert.equal(notices.notificationCenterComplete,false);
 for(const d of ['ventas','pagos','ordenes_trabajo']){const r=await f.client.ports.commercial.read({schema:1,context:c,domain:d});assert.deepEqual(r.value.recent,DATA.responses[HTTP.ROUTES[d]].recent);}
 assert.equal(new Set(f.calls.map(c=>new URL(c.url).pathname)).size,5);assert(f.tokenCalls.every(v=>v===undefined));for(const{url,spec}of f.calls){assert.equal(new URL(url).search,'');assert.equal(spec.method,'GET');assert.equal(spec.cache,'no-store');assert.equal(spec.credentials,'omit');assert.equal(spec.redirect,'error');assert.equal(spec.referrerPolicy,'no-referrer');assert.equal(Object.hasOwn(spec,'body'),false);assert(spec.signal instanceof AbortSignal);assert.equal(spec.headers.Authorization,'Bearer TOKEN_FICTICIO');}
});
test('HTTP ports compose the actual aggregator; own monthly field comes from actual Costos reader e24',async()=>{
 const f=fixture({monthly:true}),r=await Aggregate.create({enabled:true,capture:f.capture,valid:f.valid,ports:f.client.ports,requireNotices:false}).read();assert(r.activity.complete);assert.equal(r.monthly.records,DATA.monthlyOracle.records);assert.equal(r.consumersComplete,false);assert.equal(r.notices,null);assert.equal(r.dashboardComplete,false);assert.equal(r.salesAuthorMonthly,null);assert.equal(f.calls.length,5);assert.equal(f.calls.filter(r=>r.url===BASE+B).length,2);assert.deepEqual(f.calls.filter(r=>r.url!==BASE+B).map(r=>r.url).sort(),[BASE+HTTP.ROUTES.ventas,BASE+HTTP.ROUTES.pagos,BASE+HTTP.ROUTES.ordenes_trabajo].sort());assert(f.calls.every(r=>r.url!==BASE+N));
});
test('current server without monthly fails closed, never reads RTDB or invents a global zero',async()=>{
 const f=fixture({monthly:false});await assert.rejects(f.client.ports.month.read({schema:1,context:Aggregate.snapshot(f.capture())}),{code:'SV_DASHBOARD_HTTP_MONTH_MISSING'});assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,BASE+B);
});
for(const status of [401,403])test(status+' stops immediately without decoding error body or fallback',async()=>{
 const f=fixture();f.state.status=status;await assert.rejects(f.client.read(),e=>e.statusCode===status&&e.code==='SV_DASHBOARD_HTTP_DENIED');assert.equal(f.calls.length,1);assert.equal(f.state.json,0);assert.equal(f.state.cancelled,1);
 const n=fixture();n.state.hook=url=>{if(url===BASE+N)n.state.status=status;};await n.client.read('dashboard');await assert.rejects(n.client.read('notices'),e=>e.statusCode===status);assert.equal(n.calls.length,2);assert.equal(n.state.json,1);
});
for(const kind of ['User','Auth','UID','role','configSignature','permissionSignature','revision','sessionEpoch','dataEpoch','connectionEpoch','db','grants','date','viewing','base'])test('late '+kind+' change discards response before JSON',async()=>{
 const f=fixture();f.ctx.configSignature='config-A';f.state.hook=()=>{if(kind==='User')f.ctx.auth.currentUser={...f.user};if(kind==='Auth')f.ctx.auth={currentUser:f.user};if(kind==='UID')f.ctx.uid='v';if(kind==='role')f.ctx.role='admin';if(kind==='configSignature')f.ctx.configSignature='config-B';if(kind==='permissionSignature')f.ctx.permissionSignature='changed';if(kind==='revision')f.ctx.permissionRevision++;if(['sessionEpoch','dataEpoch','connectionEpoch'].includes(kind))f.ctx[kind]++;if(kind==='db')f.ctx.db={};if(kind==='grants')f.ctx.grants.pagos='all';if(kind==='date')f.ctx.asOfDay='2026-11-05';if(kind==='viewing')f.ctx.viewing=true;if(kind==='base')f.host.SISVENTAS_FUNCTIONS.cotizadorProveedor=BASE+'/other';};await assert.rejects(f.client.read(),{code:'SV_ACTIVITY_CONTEXT_RETIRED'});assert.equal(f.state.json,0);assert.equal(f.calls.length,1);
});
test('late data epoch during JSON rejects and never starts the notices GET',async()=>{
 const f=fixture();let release,started=false;f.state.jsonHook=()=>{started=true;return new Promise(r=>{release=r;});};const p=f.client.read();while(!started)await turn();f.ctx.dataEpoch++;release(clone(DATA.responses[B]));await assert.rejects(p,{code:'SV_ACTIVITY_CONTEXT_RETIRED'});assert.equal(f.calls.length,1);
});
test('SDK token without force remains pinned before starting network',async()=>{
 const f=fixture();let release,forced;f.user.getIdToken=force=>{forced=force;return new Promise(r=>{release=r;});};const p=f.client.read('notices');await turn();f.ctx.asOfDay='2026-11-05';release('TOKEN_FICTICIO');await assert.rejects(p,{code:'SV_ACTIVITY_CONTEXT_RETIRED'});assert.equal(forced,undefined);assert.equal(f.calls.length,0);
});
test('timeout includes token acquisition; late token cannot start another request',async()=>{
 const f=fixture({requestMs:100});let release;f.user.getIdToken=()=>new Promise(r=>{release=r;});const p=f.client.read();await assert.rejects(p,{code:'SV_DASHBOARD_HTTP_TIMEOUT'});release('TOKEN_FICTICIO');await turn();assert.equal(f.calls.length,0);
});
test('timeout bounds a fetch that ignores AbortSignal and discards its late body',async()=>{
 const f=fixture({requestMs:100});let release;f.state.hook=()=>new Promise(r=>{release=r;});const p=f.client.read();await assert.rejects(p,{code:'SV_DASHBOARD_HTTP_TIMEOUT'});assert.equal(f.calls.length,1);assert.equal(f.calls[0].spec.signal.aborted,true);release();await turn();assert.equal(f.state.json,0);assert.equal(f.state.cancelled,1);assert.equal(f.calls.length,1);
});
test('only explicit host-configured trusted base; no user paths or query/body parameters',async()=>{
 for(const bad of ['https://other.example/cotizadorProveedor',BASE+'?verComo=v',BASE+'#x','javascript:alert(1)','http://trusted.example/cotizadorProveedor',BASE+'/../other',BASE+'/%2fother',' https://trusted.example/x'])assert.throws(()=>fixture({baseURL:bad}));
 const f=fixture(),c=Aggregate.snapshot(f.capture());await assert.rejects(f.client.read('/commercial/dashboard/presupuestos/avisos'));await assert.rejects(f.client.read({baseURL:BASE}));await assert.rejects(f.client.ports.commercial.read({schema:1,context:c,domain:'presupuestos'}));await assert.rejects(f.client.ports.commercial.read({schema:1,context:c,domain:'ventas',baseURL:'https://other.example'}));assert.equal(f.calls.length,0);
 for(const requestMs of [0,99,30001,Infinity,1.5])assert.throws(()=>fixture({requestMs}));
});
test('redirect and wrong final URL rejected even if a fetch mock returns HTTP200',async()=>{
 for(const k of ['redirected','responseURL']){const f=fixture();f.state[k]=k==='redirected'?true:'https://other.example/stolen';await assert.rejects(f.client.read(),{code:'SV_DASHBOARD_HTTP_REDIRECT'});assert.equal(f.state.json,0);}
});
test('direct body required: an ok wrapper, other UID, wrong role/revision or domain fails',async()=>{
 for(const kind of ['wrapper','uid','role','revision','domain','scope','sort','amount']){const f=fixture();if(kind==='wrapper')f.payloads[B]={ok:true,result:clone(f.payloads[B])};if(kind==='uid')f.payloads[B].uid='v';if(kind==='role')f.payloads[B].role='admin';if(kind==='revision')f.payloads[B].permissionRevision++;if(kind==='domain')f.payloads[B].recent.domain='ventas';if(kind==='scope')f.payloads[B].recent.scope='all';if(kind==='sort')f.payloads[B].recent.rows[0].sort='wrong';if(kind==='amount')f.payloads[B].recent.rows[0].amountCents=123;await assert.rejects(f.client.read());assert.equal(f.calls.length,1);}
});
test('explicit notices require complete schema1, exact public17 fields, legacy and valid source revision',async()=>{
 for(const kind of ['schema','complete','legacy','private','duplicate','revision']){const f=fixture();if(kind==='schema')f.payloads[N].schema=2;if(kind==='complete')f.payloads[N].complete=false;if(kind==='legacy')delete f.payloads[N].rows[0].noticeLegacy;if(kind==='private')f.payloads[N].rows[0].sourceHash='private';if(kind==='duplicate')f.payloads[N].rows.push(clone(f.payloads[N].rows[0]));if(kind==='revision')f.payloads[N].revision=0;await assert.rejects(f.client.read('notices'));assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,BASE+N);}
});
test('monthly must be own, same date/label/revision and canonical counters; no substitute source',async()=>{
 for(const kind of ['global','month','employee','revision','counter','uid','proof']){const f=fixture({monthly:true}),m=f.payloads[B].monthly;if(kind==='global')m.scope='all';if(kind==='month')m.month='2026-12';if(kind==='employee')m.employeeLabel='otro';if(kind==='revision')m.revision++;if(kind==='counter')m.converted=m.records+1;if(kind==='uid')m.uid='v';if(kind==='proof')delete m.policyHash;await assert.rejects(f.client.ports.month.read({schema:1,context:Aggregate.snapshot(f.capture())}));assert.equal(f.calls.length,1);}
});
test('null grants stop before token; distinct commercial response cannot masquerade as expected domain',async()=>{
 const f=fixture();f.ctx.grants.ventas=null;await assert.rejects(f.client.ports.commercial.read({schema:1,context:Aggregate.snapshot(f.capture()),domain:'ventas'}));assert.equal(f.calls.length,0);assert.equal(f.tokenCalls.length,0);const p=fixture();p.payloads[HTTP.ROUTES.ventas]=clone(p.payloads[HTTP.ROUTES.pagos]);await assert.rejects(p.client.ports.commercial.read({schema:1,context:Aggregate.snapshot(p.capture()),domain:'ventas'}));
});
test('token/network/JSON failures expose no provider error payload or token and never retry',async()=>{
 const secret='NEVER_EXPOSE_PROVIDER_TOKEN';for(const kind of ['token','network','json']){const f=fixture();if(kind==='token')f.user.getIdToken=async()=>{throw Error(secret);};if(kind==='network')f.state.hook=()=>{throw Error(secret);};if(kind==='json')f.state.jsonHook=()=>{throw Error(secret);};await assert.rejects(f.client.read(),e=>e.code==='SV_DASHBOARD_HTTP_UNAVAILABLE'&&!e.message.includes(secret)&&!JSON.stringify(e).includes(secret));assert.equal(f.calls.length,kind==='token'?0:1);}
});
test('admin monthly validates the authorized all scope; label is not an ownership restriction',async()=>{
 const f=fixture(),c=f.ctx;c.role='admin';c.grants={ventas:'all',pagos:'all',ordenes_trabajo:'all',presupuestos:'all'};const b=f.payloads[B];b.role='admin';b.scope='all';b.recent.scope='all';b.monthly.role='admin';b.monthly.scope='all';const request={schema:1,context:Aggregate.snapshot(f.capture())};const value=await f.client.ports.month.read(request);assert.equal(value.value.scope,'all');b.monthly.scope='u_'+c.uid;await assert.rejects(f.client.ports.month.read(request),{code:'SV_DASHBOARD_HTTP_MONTH_CONTRACT'});
});
