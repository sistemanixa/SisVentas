'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Reader=require('../js/core/commercial-pages-reader.v1'),{create}=require('./helpers/commercial-reader-metrics.cjs');
test('warm totals reuse the complete aggregate across routes only after fresh coverage checks',async()=>{
 const f=await create({count:120}),reader=Reader.create({sdk:f.sdk,capture:()=>f.session}),first=await reader.totals();
 reader.reset({retainPages:true});f.session.route='dashboard';const at=f.calls.length,again=await reader.totals();assert.deepEqual(again,first);
 assert.equal(f.calls.length-at,3);assert(f.calls.slice(at).every(call=>call.path==='sv_commercial_pages_config'||call.path.endsWith('/coverage')));
 again.totals.debtCents=0;assert.equal((await reader.totals()).totals.debtCents,first.totals.debtCents);
});
for(const change of ['uid','role','permissionRevision','auth','db','revision','generation','reset'])test('warm aggregate never survives '+change+' as an authorized cache hit',async()=>{
 const f=await create({count:120}),reader=Reader.create({sdk:f.sdk,capture:()=>f.session});await reader.totals();reader.reset({retainPages:change!=='reset'});f.session.route='dashboard';
 if(['auth','db'].includes(change))f.session[change]={};else if(change==='permissionRevision')f.session.permissionRevision++;else if(change==='uid')f.session.uid='other';else if(change==='role')f.session.role='administrativo';else if(change==='revision')f.data[Reader.ROOT+'/coverage'].revision++;else if(change==='generation'){f.data['sv_commercial_pages_config'].generation='new';f.data[Reader.ROOT+'/coverage'].generation='new';f.data[Reader.ROOT+'/totals/all'].generation='new';}
 const at=f.calls.length;await reader.totals();assert(f.calls.slice(at).some(call=>call.path.includes('/totals/')));
});
test('an invalid final coverage cannot certify cached totals',async()=>{
 const f=await create({count:120}),reader=Reader.create({sdk:f.sdk,capture:()=>f.session});await reader.totals();const get=f.sdk.get;let coverageReads=0;
 f.sdk.get=async spec=>{if(spec.path.endsWith('/coverage')&&++coverageReads===2)f.data[Reader.ROOT+'/coverage'].ready=false;return get(spec);};
 await assert.rejects(reader.totals(),/cobertura/);
});
test('original and summary are requested in parallel and returned only after final verification',async()=>{
 const f=await create({count:120});let release,started;const began=new Promise(resolve=>started=resolve),held=new Promise(resolve=>release=resolve);
 const reader=Reader.create({sdk:f.sdk,capture:()=>f.session,detailRead:async()=>{started();await held;return f.sales.s0;}}),pending=reader.detail('sales','s0');
 await began;await new Promise(resolve=>setImmediate(resolve));assert(f.calls.some(call=>call.path===Reader.ROOT+'/records/sales/s0'));
 release();const result=await pending;assert.equal(result.record.id,'V-0');assert.equal(f.calls.filter(call=>call.path.endsWith('/coverage')).length,2);
});
test('session changes during the parallel original request reject rather than revealing a detail',async()=>{
 const f=await create({count:120});let release,started;const began=new Promise(resolve=>started=resolve),held=new Promise(resolve=>release=resolve);
 const reader=Reader.create({sdk:f.sdk,capture:()=>f.session,detailRead:async()=>{started();await held;return f.sales.s0;}}),pending=reader.detail('sales','s0');
 await began;f.session.uid='other';release();await assert.rejects(pending,{name:'AbortError'});
});
function hostFixture(role,{denied=false}={}){
 let options;const reads=[],http=[],record={id:'V-FICTICIA',responsableUid:'u',total:100};
 const document={readyState:'loading',hidden:false,addEventListener(){},getElementById(){return null;}},root={document,currentUserUid:'u',currentRole:role,fbAuth:{currentUser:{uid:'u'}},fbDB:{},PERMISOS_ROLES:{},location:{hash:'#/detalle'},navigator:{onLine:true},addEventListener(){},_svPaginaDesdeRuta:()=> 'detalle',fbRef:(_,path)=>({path}),fbGet:async({path})=>{reads.push(path);if(path==='sv_commercial_pages_config')return{val:()=>({ready:true,searchReady:true,searchSchema:1})};if(denied)throw Error('Permission denied');return{val:()=>record};},SVCommercialPagesReader:{create:input=>{options=input;return{};}},SVCommercialOwnership:{request:async(domain,path)=>{http.push([domain,path]);return{record};}}};
 vm.runInNewContext(fs.readFileSync('js/modules/sales-indexed-host.v1.js','utf8'),{window:root,document,location:root.location});
 return{root,reads,http,async detail(){await root.SVCommercialPagesHost.start(()=>{});return options.detailRead('sales','fictitious',{role,db:root.fbDB});}};
}
test('the actual active host reads an admin original directly and keeps nonadmin transport unchanged',async()=>{
 const admin=hostFixture('admin');assert.equal((await admin.detail()).id,'V-FICTICIA');assert(admin.reads.includes('sisventas/ventas/fictitious'));assert.equal(admin.http.length,0);
 const staff=hostFixture('administrativo');await staff.detail();assert.equal(staff.http.length,1);assert(!staff.reads.some(path=>path.startsWith('sisventas/ventas/')));
});
test('a rejected admin SDK read has no server or broader-root fallback',async()=>{
 const fixture=hostFixture('admin',{denied:true});await assert.rejects(fixture.detail(),/Permission denied/);assert.equal(fixture.http.length,0);assert(!fixture.reads.includes('sisventas/ventas'));
});
