'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.env.SV_CREATOR_ANCHOR_SOURCE||path.resolve(__dirname,'..'),load=p=>require(path.join(root,p));
const {fixture}=load('test/helpers/dashboard-commercial-activity-fixture.cjs'),{memoryDb}=load('test/helpers/dashboard-budget-activity-fixture.cjs'),{authFixture}=load('test/helpers/dashboard-budget-reader-fixture.cjs');
const Reader=load('cotizador/dashboard-commercial-activity-reader-proposal'),Pages=load('cotizador/commercial-pages-model'),Latest=load('cotizador/commercial-creator-latest');
async function setup(){
 const f=await fixture(0);for(let i=0;i<6;i++)await f.mutate({['sisventas/ventas/s'+i]:{id:'V-'+i,responsableUid:'u',creadaPor:'u',fecha:'2026-11-04',ts:1000+i,cliente:'Ficticio',total:1,subtotal:1,descuento:0,iva:0,items:[{cod:'FICTICIO',qty:1,punit:1,sub:1,costoUnitarioCompra:0.5}]}});
 const memory=memoryDb(f.data()),trace=[],state={hook:null},db={ref(p){assert(!p.startsWith('sisventas/'));function wrap(q){return {orderByChild:k=>wrap(q.orderByChild(k)),equalTo:v=>wrap(q.equalTo(v)),orderByKey:()=>wrap(q.orderByKey()),limitToFirst:n=>wrap(q.limitToFirst(n)),async get(){trace.push(p);const s=await q.get();if(state.hook)await state.hook(p);return s;}};}return wrap(memory.ref(p));}};
 const reader=Reader.createReader({auth:authFixture('u'),db,enabled:true,getLegacyContext:()=>({timeZone:'America/Buenos_Aires',sourceLocale:'es-AR'}),getAsOfDay:()=> '2026-11-04'});
 return {...f,trace,state,readDomain:()=>reader.read({headers:{authorization:'Bearer fixture-token'}},'ventas'),group:Pages.ROOT+'/creatorMonths/u_u/'+Pages.hash(JSON.stringify('u'))+'/2026-11'};
}
test('one GET reads totals/coverage exactly twice while group and five points stay independently verified',async()=>{const f=await setup(),r=await f.readDomain();assert.equal(r.creatorLatest.complete,true);assert.equal(r.creatorMonthly.count,6);for(const p of [Pages.ROOT+'/coverage',Pages.ROOT+'/totals/u_u'])assert.equal(f.trace.filter(v=>v===p).length,2,p);assert.equal(f.trace.filter(v=>v===f.group).length,2);assert.equal(f.trace.filter(v=>v.includes('/records/sales/')).length,10);});
test('two GETs keep four fresh totals reads; no anchor/result cache crosses requests',async()=>{const f=await setup();assert.equal((await f.readDomain()).creatorLatest.complete,true);f.set(Pages.ROOT+'/totals/u_u/creatorLatestSchema',null);const r=await f.readDomain();assert.equal(r.creatorMonthly.complete,true);assert.equal(r.creatorLatest.complete,false);assert.equal(f.trace.filter(v=>v===Pages.ROOT+'/totals/u_u').length,4);});
test('totals or coverage mutation during group/point read is rejected by fresh outer B1',async()=>{
 for(const trigger of ['group','point'])for(const target of ['totals','coverage']){const f=await setup();let done=false;f.state.hook=p=>{if(!done&&(trigger==='group'?p===f.group:p.includes('/records/sales/'))){done=true;f.set(target==='totals'?Pages.ROOT+'/totals/u_u/revision':Pages.ROOT+'/coverage/revision',999);}};await assert.rejects(f.readDomain(),target+' during '+trigger);assert(done);}
});
test('same-revision group/point drift still withdraws optional latest and preserves certified count',async()=>{
 for(const kind of ['group','point']){const f=await setup();let done=false;f.state.hook=p=>{if(!done&&(kind==='group'?p===f.group:p.includes('/records/sales/'))){done=true;if(kind==='group')f.set(f.group+'/s5',null);else f.set(p+'/number','changed during read');}};const r=await f.readDomain();assert.equal(r.creatorMonthly.count,6);assert.equal(r.creatorLatest.complete,false);assert.equal(r.recent.rows.length,5);}
});
test('helper receives independent copies of the request anchors; mutation cannot alter outer B0',async()=>{
 const f=await setup(),original=Latest.readLatest;let checked=false;
 Latest.readLatest=async options=>{const p=Pages.ROOT+'/coverage',t=Pages.ROOT+'/totals/u_u',a=await options.read(p),b=await options.read(t);a.ready=false;b.creatorMonthsSchema=0;assert.equal((await options.read(p)).ready,true);assert.equal((await options.read(t)).creatorMonthsSchema,1);checked=true;return original(options);};
 try{const r=await f.readDomain();assert(checked);assert.equal(r.creatorLatest.complete,true);assert.equal(r.creatorMonthly.complete,true);assert.equal(f.trace.filter(p=>p===Pages.ROOT+'/totals/u_u').length,2);}finally{Latest.readLatest=original;}
});
