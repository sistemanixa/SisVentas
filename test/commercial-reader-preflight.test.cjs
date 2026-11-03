'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Reader=require('../js/core/commercial-pages-reader.v1'),{create}=require('./helpers/commercial-reader-metrics.cjs');
test('parallel totals and first page share only their initial metadata reads',async()=>{
 const f=await create({latency:2}),r=Reader.create({sdk:f.sdk,capture:()=>f.session});
 const [a,b]=await Promise.all([r.totals(),r.page('sales')]);
 assert.equal(a.revision,b.revision);assert.equal(b.rows.length,50);
 assert.equal(f.calls.filter(c=>c.path==='sv_commercial_pages_config').length,1);
 assert.equal(f.calls.filter(c=>c.path.endsWith('/coverage')).length,3);
 assert.equal(f.calls.length,6);
 const n=f.calls.length;await r.totals();assert.equal(f.calls.length-n,4);
});
for(const change of ['uid','role','permissionRevision','auth','db','online','hidden'])test('shared metadata rejects late results after '+change,async()=>{
 const f=await create({latency:5}),r=Reader.create({sdk:f.sdk,capture:()=>f.session});
 const jobs=[r.totals(),r.page('sales')];await new Promise(resolve=>setImmediate(resolve));
 f.session[change]=['auth','db'].includes(change)?{}:change==='online'?false:change==='hidden'?true:change==='permissionRevision'?2:'another';
 const results=await Promise.allSettled(jobs);assert(results.every(x=>x.status==='rejected'&&x.reason.name==='AbortError'));
 assert.equal(f.calls.filter(c=>c.query).length,0);
});
test('final coverage check is fresh and retries a concurrent source revision',async()=>{
 const f=await create({latency:2}),get=f.sdk.get;let moved=false;
 f.sdk.get=async spec=>{const value=await get(spec);if(spec.path.includes('/totals/')&&!moved){moved=true;f.data[Reader.ROOT+'/coverage'].revision++;}return value;};
 const r=Reader.create({sdk:f.sdk,capture:()=>f.session}),result=await r.totals();
 assert.equal(result.revision,f.data[Reader.ROOT+'/coverage'].revision);
 assert.equal(f.calls.filter(c=>c.path.endsWith('/coverage')).length,4);
});
test('detail is freshly authorized on every open and offline reads do no work',async()=>{
 const f=await create(),r=Reader.create({sdk:f.sdk,capture:()=>f.session});
 await r.detail('sales','s0');await r.detail('sales','s0');
 assert.equal(f.calls.filter(c=>c.path==='sisventas/ventas/s0').length,2);
 f.session.online=false;const n=f.calls.length;await assert.rejects(r.page('sales'),{name:'AbortError'});assert.equal(f.calls.length,n);
});
test('a verified first50 page serves Dashboard5 and the same50 across module routes',async()=>{
 const f=await create(),r=Reader.create({sdk:f.sdk,capture:()=>f.session});
 const first=await r.page('sales',{filters:{text:'',month:'',status:'',cancelled:false}}),queries=()=>f.calls.filter(c=>c.query).length;
 assert.equal(queries(),1);r.reset({retainPages:true});f.session.route='dashboard';
 const recent=await r.page('sales',{take:5,filters:{cancelled:false}});assert.deepEqual(recent.rows,first.rows.slice(0,5));assert.equal(queries(),1);assert.equal(recent.cursor,first.rows[4].sort);assert.equal(recent.hasMore,true);
 r.reset({retainPages:true});f.session.route='detalle';const again=await r.page('sales',{filters:{cancelled:false}});assert.deepEqual(again.rows,first.rows);assert.equal(queries(),1);
 assert.equal(f.calls.filter(c=>c.path.endsWith('/coverage')).length,6);
});
for(const change of ['uid','role','permissionRevision','auth','db','generation','revision','filter','reset'])test('shared summaries are not reused after '+change,async()=>{
 const f=await create(),r=Reader.create({sdk:f.sdk,capture:()=>f.session});await r.page('sales');const before=f.calls.filter(c=>c.query).length;
 r.reset({retainPages:change!=='reset'});f.session.route='dashboard';
 if(change==='generation'){f.data['sv_commercial_pages_config'].generation='new';f.data[Reader.ROOT+'/coverage'].generation='new';}
 else if(change==='revision')f.data[Reader.ROOT+'/coverage'].revision++;
 else if(['auth','db'].includes(change))f.session[change]={};
 else if(change==='permissionRevision')f.session.permissionRevision++;
 else if(change==='uid')f.session.uid='other';
 else if(change==='role')f.session.role='administrativo';
 await r.page('sales',{take:5,...(change==='filter'?{filters:{month:'2020-01'}}:{})});
 assert(f.calls.filter(c=>c.query).length>before);
});
test('a complete small historical search bucket supports combined local filters, with fresh coverage',async()=>{
 const f=await create(),r=Reader.create({sdk:f.sdk,capture:()=>f.session});const result=await r.searchSales({text:'Toyos'});assert.equal(result.rows.length,20);assert.equal(result.hasMore,false);
 const n=f.calls.length;r.reset({retainPages:true});const narrowed=await r.searchSales({text:'Toyo',filters:{month:'2020-01',pending:true}});assert.equal(narrowed.rows.length,20);assert.equal(f.calls.length-n,3);assert(f.calls.slice(n).every(c=>c.path==='sv_commercial_pages_config'||c.path.endsWith('/coverage')));
 const at=f.calls.length;const empty=await r.searchSales({text:'Toyos',filters:{month:'2026-11'}});assert.equal(empty.rows.length,0);assert.equal(empty.hasMore,false);assert.equal(f.calls.length-at,3);
 f.data[Reader.ROOT+'/coverage'].revision++;const before=f.calls.length;await r.searchSales({text:'Toyos'});assert(f.calls.slice(before).some(c=>c.query));
});
test('a partial first50 never answers a historical text filter as a complete search',async()=>{
 const f=await create(),r=Reader.create({sdk:f.sdk,capture:()=>f.session});await r.page('sales');const at=f.calls.length;const old=await r.searchSales({text:'Toyos'});assert.equal(old.rows.length,20);assert(f.calls.slice(at).some(c=>c.query&&c.path.includes('/search/')));
});
