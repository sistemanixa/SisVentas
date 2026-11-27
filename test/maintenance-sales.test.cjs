'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{create}=require('../js/modules/maintenance-sales');
function fixture({sales=[{key:'s',number:'V-FICTICIA'}],payments=[{key:'p',saleKey:'s',cancelled:true}],points={},histories={},pageOverride,totalsOverride}={}){
 let alive=true,active=0,peak=0;const calls=[],progress=[];let totalsCalls=0;
 const pin={revision:1,generation:'fiction'},count={sales:sales.length,payments:payments.length};
 const reader={totals:async()=>{calls.push('totals');return totalsOverride?totalsOverride(++totalsCalls):{...pin,totals:count};},page:async(kind,options)=>{calls.push({kind,options});const list=kind==='sales'?sales:payments,offset=Number(options.cursor||0),rows=list.slice(offset,offset+50);return pageOverride?pageOverride(kind,options):{...pin,rows,cursor:String(offset+rows.length),hasMore:offset+rows.length<list.length};}};
 const history=async id=>{calls.push('history:'+id);active++;peak=Math.max(peak,active);try{await new Promise(r=>setImmediate(r));if(histories[id] instanceof Error)throw histories[id];return histories[id]||{ok:true,record:{fbKey:id},paymentHistory:{schema:1,source:'global',complete:true,paidAmount:10,payments:payments.filter(p=>p.saleKey===id).map(p=>({fbKey:p.key,monto:10,hasReceipt:false,anulado:p.cancelled===true}))}};}finally{active--;}};
 const read=async p=>{calls.push(p);return Object.hasOwn(points,p)?points[p]:null;};
 const model=create({reader,history,read,valid:()=>alive,onProgress:p=>progress.push(p)});
 return{model,calls,progress,reader,history,read,stop:()=>{alive=false;},peak:()=>peak,active:()=>active};
}
test('enumerates sales and payments through EOF, memoizes server histories and includes cancelled payments',async()=>{
 const sales=Array.from({length:51},(_,i)=>({key:'s'+i,number:'FICTICIA-'+i})),payments=[{key:'p',saleKey:'s0',cancelled:true},{key:'p2',saleKey:'s0'}],f=fixture({sales,payments});
 const result=await f.model.run();assert.equal(result.complete,true);assert.equal(result.checked,53);assert.equal(result.total,53);assert.ok(result.results.every(r=>r.status==='ok'));assert.equal(f.calls.filter(x=>x==='history:s0').length,1);assert.ok(f.peak()<=6&&f.peak()>1);assert.equal(f.active(),0);
 assert.equal(f.calls.filter(x=>x?.kind==='sales').length,2);assert.ok(f.calls.filter(x=>x?.kind).every(x=>x.options.scopeName==='all'&&x.options.take===50&&Object.keys(x.options.filters).length===0));assert.equal(f.calls.find(x=>x?.kind==='payments').options.native,true);assert.equal(f.calls.filter(x=>typeof x==='string'&&x.startsWith('sisventas/ventas')).length,0);assert.equal(result.reads,f.calls.length);
});
test('progress reports only constant-size counters, not repeated result arrays',async()=>{
 const f=fixture({sales:Array.from({length:80},(_,i)=>({key:'s'+i})),payments:[]});await f.model.run();assert.ok(f.progress.length>=80);assert.ok(f.progress.every(p=>!Object.hasOwn(p,'results')&&JSON.stringify(p).length<130));
});

test('declared technical client, OT and budget links use only point originals; contradictions are review',async()=>{
 const histories={s:{ok:true,record:{fbKey:'s',clienteFbKey:'c',otKey:'ot',presupuestoFbKey:'b'},paymentHistory:{schema:1,source:'global',complete:true,paidAmount:0,payments:[]}}};
 const f=fixture({payments:[],histories,points:{'sisventas/clientes/c':{nombre:'Cliente ficticio'},'sisventas/ordenes_trabajo/ot':{ventaFbKey:'other',clienteFbKey:'other-client'},'sisventas/presupuestos/b':null}}),r=await f.model.run();assert.equal(r.complete,true);assert.equal(r.results[0].status,'review');assert.ok(r.results[0].issues.some(v=>v.includes('otra venta')));assert.ok(r.results[0].issues.some(v=>v.includes('Cliente distinto')));assert.ok(r.results[0].issues.some(v=>v.includes('No existe')));assert.deepEqual(f.calls.filter(x=>typeof x==='string'&&x.startsWith('sisventas/')).sort(),['sisventas/clientes/c','sisventas/ordenes_trabajo/ot','sisventas/presupuestos/b']);
});
test('legacy, incomplete or denied histories never become verified green',async()=>{
 const base={ok:true,record:{fbKey:'s'},paymentHistory:{schema:1,source:'global',complete:true,paidAmount:0,payments:[]}};
 for(const answer of [{...base,record:{fbKey:'s',otId:'OT-LEGACY'}},{...base,paymentHistory:{...base.paymentHistory,complete:false}},{...base,paymentHistory:{...base.paymentHistory,source:'legacy',paidAmount:10}},Object.assign(Error('private failure must not leak'),{status:403})]){const f=fixture({payments:[],histories:{s:answer}}),r=await f.model.run();assert.equal(r.complete,false);assert.equal(r.results[0].status,'unavailable');assert.ok(!JSON.stringify(r).includes('private failure'));}
 const back=fixture({payments:[],histories:{s:{...base,record:{fbKey:'s',otKey:'ot'}}},points:{'sisventas/ordenes_trabajo/ot':{ventaId:'LEGACY'}}}),result=await back.model.run();assert.equal(result.complete,false);assert.equal(result.results[0].status,'unavailable');
});
test('missing saleKey uses only unambiguous original technical FK, never rematches legacy aliases',async()=>{
 const h={ok:true,record:{fbKey:'s'},paymentHistory:{schema:1,source:'global',complete:true,paidAmount:10,payments:[{fbKey:'p',monto:10,hasReceipt:false,anulado:true}]}};
 for(const raw of [{ventaFbKey:'s'},{ventaId:'LEGACY'},{ventaFbKey:'s',ventaKey:'other'}]){const f=fixture({sales:[],payments:[{key:'p'}],points:{'sisventas/pagos/p':raw},histories:{s:h}}),r=await f.model.run();assert.equal(r.results[0].status,raw.ventaFbKey==='s'&&!raw.ventaKey?'ok':'review');if(raw.ventaId||raw.ventaKey)assert.ok(!f.calls.includes('history:s'));}
});
test('exact global membership is mandatory, including a payment marked cancelled',async()=>{const f=fixture({histories:{s:{ok:true,record:{fbKey:'s'},paymentHistory:{schema:1,source:'global',complete:true,paidAmount:0,payments:[]}}}}),r=await f.model.run();assert.equal(r.results.find(x=>x.key==='p').status,'review');});
test('coverage revision, count mismatch or repeated page identity prevents complete result',async()=>{
 const cases=[{pageOverride:()=>({revision:2,generation:'fiction',rows:[{key:'s'}],hasMore:false})},{totalsOverride:n=>({revision:n===1?1:2,generation:'fiction',totals:{sales:1,payments:0}})},{pageOverride:()=>({revision:1,generation:'fiction',rows:[],hasMore:false})},{pageOverride:()=>({revision:1,generation:'fiction',rows:[{key:'s'},{key:'s'}],hasMore:false})}];
 for(const options of cases){const f=fixture({...options,payments:[]}),r=await f.model.run();assert.equal(r.complete,false);if(r.checked>0){assert.equal(r.partial,true);assert.equal(r.interrupted,true);}else assert.equal(r.results.length,0);}
});
test('cancellation drains in-flight workers, schedules no new work and emits no stale progress',async()=>{
 const f=fixture({sales:Array.from({length:10},(_,i)=>({key:'s'+i})),payments:[]});const pending=f.model.run();await new Promise(r=>setImmediate(r));f.stop();const last=f.progress.length,r=await pending;assert.equal(r.complete,false);assert.equal(f.active(),0);assert.ok(f.calls.filter(x=>typeof x==='string'&&x.startsWith('history:')).length<=6);assert.equal(f.progress.length,last);assert.ok(!f.calls.some(x=>x?.kind==='payments'));
});
test('same run shares work; a later run gets new request-only memos',async()=>{const f=fixture();const a=f.model.run(),b=f.model.run();assert.equal(a,b);await a;await f.model.run();assert.equal(f.calls.filter(x=>x==='history:s').length,2);});
test('actual commercial pages reader can enumerate a complete fictitious native index without source-root reads',async()=>{
 const Model=require('../cotizador/commercial-pages-model'),Reader=require('../js/core/commercial-pages-reader.v1'),built=await Model.build({sales:{s:{id:'V-FICTICIA',total:10,fecha:'2026-11-26'}},payments:{p:{ventaFbKey:'s',monto:10,fecha:'2026-11-26',anulado:true}},generation:'fiction-native',nativeCollections:true}),data={...built.patch,sv_commercial_pages_config:{schema:1,ready:true,generation:'fiction-native',nativeCollectionsReady:true,nativeCollectionsSchema:1}},access=[];
 const value=p=>{if(Object.hasOwn(data,p))return data[p];const out={};for(const[k,v]of Object.entries(data))if(k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/'))out[k.slice(p.length+1)]=v;return Object.keys(out).length?out:null;};
 const sdk={ref:(_,p)=>p,orderByKey:()=>({kind:'order'}),startAt:from=>({kind:'start',from}),limitToFirst:take=>({kind:'limit',take}),query:(ref,...constraints)=>({ref,constraints}),get:async spec=>{const p=typeof spec==='string'?spec:spec.ref;access.push(p);let v=value(p);if(typeof spec==='object'){let entries=Object.entries(v||{}).sort(([a],[b])=>a.localeCompare(b));const start=spec.constraints.find(x=>x.kind==='start'),limit=spec.constraints.find(x=>x.kind==='limit');if(start)entries=entries.filter(([k])=>k>=start.from);if(limit)entries=entries.slice(0,limit.take);v=Object.fromEntries(entries);}return{val:()=>v};}};
 const actor={uid:'u',role:'admin',auth:{},db:{},permissionRevision:1,route:'configuracion',hidden:false,viewing:false,canReadPayments:true,online:true},reader=Reader.create({sdk,capture:()=>actor}),f=fixture();
 const r=await create({reader,history:f.history,read:f.read,valid:()=>true}).run();assert.equal(r.complete,true);assert.equal(r.checked,2);assert.ok(access.every(p=>p.startsWith('sv_commercial_pages')));reader.reset();
});

test('six shared IO slots overlap independent links without adding reads or duplicating histories',async()=>{
 const sales=Array.from({length:12},(_,i)=>({key:'s'+i})),payments=sales.map(s=>({key:'p'+s.key,saleKey:s.key}));
 const f=fixture({sales,payments});let active=0,peak=0,histories=0,points=0;
 async function tracked(work){active++;peak=Math.max(peak,active);try{await new Promise(r=>setImmediate(r));return work();}finally{active--;}}
 const result=await create({reader:f.reader,valid:()=>true,history:id=>tracked(()=>{histories++;return {ok:true,record:{fbKey:id,clienteFbKey:'c'+id,otKey:'o'+id,presupuestoFbKey:'b'+id},paymentHistory:{schema:1,source:'global',complete:true,paidAmount:10,payments:[{fbKey:'p'+id,monto:10,hasReceipt:false}]}};}),read:path=>tracked(()=>{points++;return {};})}).run();
 assert.equal(result.complete,true);assert.equal(result.checked,24);assert.equal(histories,12);assert.equal(points,36);assert.equal(peak,6);assert.equal(active,0);assert.ok(result.results.every(r=>r.status==='ok'));assert.equal(result.reads,52);
});

test('cancellation with queued link reads drains six slots and never starts queued requests',async()=>{
 const f=fixture({sales:Array.from({length:6},(_,i)=>({key:'s'+i})),payments:[]});let alive=true,started=0,active=0;const releases=[];
 const model=create({reader:f.reader,valid:()=>alive,history:async id=>({ok:true,record:{fbKey:id,clienteFbKey:'c'+id,otKey:'o'+id,presupuestoFbKey:'b'+id},paymentHistory:{schema:1,source:'global',complete:true,paidAmount:0,payments:[]}}),read:async()=>{started++;active++;try{await new Promise(r=>releases.push(r));return {};}finally{active--;}}});
 const pending=model.run();await new Promise(r=>setImmediate(r));assert.equal(started,6);alive=false;releases.forEach(r=>r());const result=await pending;assert.equal(result.complete,false);assert.equal(started,6);assert.equal(active,0);
});

test('snapshot copies only completed rows and remains explicitly partial when cancelled',async()=>{
 let alive=true,release;const rows=Array.from({length:7},(_,i)=>({key:'s'+i})),f=fixture({sales:rows,payments:[]});
 const model=create({reader:f.reader,valid:()=>alive,read:f.read,history:async id=>{if(id!=='s0')await new Promise(r=>{const previous=release;release=()=>{previous?.();r();};});return {ok:true,record:{fbKey:id},paymentHistory:{schema:1,source:'global',complete:true,paidAmount:0,payments:[]}};}});
 const run=model.run();await new Promise(r=>setImmediate(r));const first=model.snapshot();assert.equal(first.checked,1);assert.equal(first.results.length,1);assert.equal(first.complete,false);assert.equal(first.partial,true);first.results[0].label='mutated';assert.notEqual(model.snapshot().results[0].label,'mutated');alive=false;release();const result=await run;assert.equal(result.complete,false);assert.equal(model.snapshot().checked,1);
});

test('changed final coverage interrupts the run without inventing a problem in each completed row',async()=>{
 const f=fixture({payments:[],totalsOverride:n=>({revision:n===1?1:2,generation:'fiction',totals:{sales:1,payments:0}})});const result=await f.model.run();assert.equal(result.complete,false);assert.equal(result.partial,true);assert.equal(result.interrupted,true);assert.equal(result.checked,1);assert.equal(result.results[0].status,'ok');assert.deepEqual(result.results[0].issues,[]);
});
