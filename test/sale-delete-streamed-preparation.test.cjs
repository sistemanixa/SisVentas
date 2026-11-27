'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const M=require('../cotizador/sale-delete-target-index'),P=require('../cotizador/sale-delete-target-preparation'),G=require('../cotizador/labor-guard');
const streamRoots=['sisventas/ordenes_trabajo','sisventas/reclamos'],retained=M.roots.filter(root=>!streamRoots.includes(root));
const delay=()=>new Promise(resolve=>setImmediate(resolve));
function sourceFixture(){return {...Object.fromEntries(M.roots.map(root=>[root,null])),'sisventas/ventas':{sale:{id:'V-0001',total:100}},'sisventas/gastos':{expense:{ventaFbKey:'sale',monto:2}},'sisventas/ordenes_trabajo':{'10':{ventaFbKey:'sale',id:'OT-10',materiales:[],foto:'BASE64_FICTICIO'},'2':{ventaFbKey:'sale',id:'OT-2',obs:'Sí, Unicode 😀'}},'sisventas/reclamos':{claim:{ventaFbKey:'sale',otId:'OT-10',id:'R-1',adjunto:'FICTICIO'}}};}
function fixture(sources=sourceFixture()){
 const state=structuredClone(sources),calls=[],control={hook:null,active:true},actor={mode:'user',uid:'u',role:'admin',financialAction:'ventas.eliminar.preparar'},lease={opId:'stream-preparation-fixture'};
 let currentPhase=null,phaseCount=0,active=0,peak=0,consumed;
 const assertActive=()=>{if(!control.active)throw Object.assign(Error('lease expired fixture'),{code:'FIXTURE_LEASE_EXPIRED'});};
 const reader={phase(name){a.equal(name,phaseCount++===0?'initial':'fresh');a.equal(active,0);currentPhase=name;return {keys:async root=>{a(streamRoots.includes(root));calls.push({kind:'keys',root,phase:name});await control.hook?.({kind:'keys',root,phase:name});const value=state[root];return {keys:value===null?[]:Object.keys(value),exists:value!==null};},read:async(root,key)=>{a(streamRoots.includes(root));active++;peak=Math.max(peak,active);calls.push({kind:'record',root,key,phase:name});try{await delay();await control.hook?.({kind:'record',root,key,phase:name});return structuredClone(state[root]?.[key]??null);}finally{active--;}}};},dispose(){}};
 const scope={actor,lease,assertActive,get:async path=>{a(!streamRoots.includes(path),'No full streamed root reads or Guard memo');calls.push({kind:'retained',root:path,phase:currentPhase});return path===M.CONFIG?null:structuredClone(state[path]);},installSaleDeleteRelations:async plan=>{consumed=P.consume(plan,actor,lease,scope);}};
 const store={exists:async path=>{a.equal(path,'sv_sale_delete_relations');return false;}};
 return {state,control,reader,scope,store,calls,assertActive,initial:async()=>{await P.prepare({scope,store,reader});return consumed;},fresh:()=>P.assertStreamedFresh(consumed.streamedToken,{assertActive}),peak:()=>peak,active:()=>active};
}
test('streamed model patch is EXACTLY full-RAW preparation for both domains',async()=>{
 const sources=sourceFixture(),images=streamRoots.flatMap(root=>Object.entries(sources[root]||{}).map(([key,row])=>M.image(root+'/'+key,row))),partial=Object.fromEntries(retained.map(root=>[root,sources[root]])),generation='model-stream-fixture';
 a.deepEqual(await M.prepareWithImages(partial,{generation,images}),await M.prepare(sources,{generation}));
});
test('two passes preserve canonical RAW root hashes and every metadata field without memoized binaries',async()=>{
 const f=fixture(),original=structuredClone(f.state),plan=await f.initial();for(const root of M.roots)a.equal(plan.hashes[root],G.digest(original[root]),root);
 const generation='links-'+G.digest({uid:'u',opId:f.scope.lease.opId}).slice(0,48),expected=await M.prepare(original,{generation});a.deepEqual(plan.patch,expected.patch);a.equal(Object.keys(plan.streamedToken).length,0);await f.fresh();a.deepEqual(f.state,original);a.equal(f.active(),0);a(f.peak()<=6);
 for(const root of streamRoots){a.equal(f.calls.filter(c=>c.kind==='keys'&&c.root===root).length,4);a.equal(f.calls.filter(c=>c.kind==='record'&&c.root===root).length,Object.keys(original[root]).length*2);}
 await a.rejects(P.assertStreamedFresh(plan.streamedToken,{assertActive:f.assertActive}),{code:'SV_SALE_DELETE_TARGET_INDEX'});
});
for(const empty of [null,{}])test('empty streamed roots retain exact null/map RAW digest '+JSON.stringify(empty),async()=>{const sources=sourceFixture();for(const root of streamRoots)sources[root]=empty;const f=fixture(sources),plan=await f.initial();for(const root of streamRoots)a.equal(plan.hashes[root],G.digest(empty));await f.fresh();});
for(const mutation of ['row','add','remove','attachment'])test('fresh pass rejects '+mutation+' before metadata installation completes',async()=>{
 const f=fixture();await f.initial();const root='sisventas/ordenes_trabajo';if(mutation==='row')f.state[root]['10'].obs='changed';if(mutation==='add')f.state[root].new={id:'OT-new'};if(mutation==='remove')delete f.state[root]['2'];if(mutation==='attachment')f.state[root]['10'].foto='CHANGED_BINARY_FICTITIOUS';await a.rejects(f.fresh(),{code:'SV_SALE_DELETE_TARGET_INDEX'});a.equal(f.active(),0);
});
test('EOF key phantom during initial scan is denied and no plan is installed',async()=>{const f=fixture();let changed=false;f.control.hook=({kind,root})=>{if(kind==='record'&&!changed){changed=true;f.state[root].late={id:'OT-late'};}};await a.rejects(f.initial(),{code:'SV_SALE_DELETE_TARGET_INDEX'});a.equal(f.active(),0);});
test('JSON or cloned token cannot manufacture freshness authority',async()=>{const f=fixture(),plan=await f.initial();for(const token of [{},structuredClone(plan.streamedToken)])await a.rejects(P.assertStreamedFresh(token,{assertActive:f.assertActive}),{code:'SV_SALE_DELETE_TARGET_INDEX'});await f.fresh();});
test('missing closed reader is 503 with no full-root fallback',async()=>{const f=fixture();await a.rejects(P.prepare({scope:f.scope,store:f.store}),{statusCode:503,code:'SV_SALE_DELETE_PREPARATION_READER_REQUIRED'});a.equal(f.calls.length,0);});
test('lease expiration drains the current batch and does not read the remaining domain',async()=>{const f=fixture();f.control.hook=({kind})=>{if(kind==='record')f.control.active=false;};await a.rejects(f.initial(),{code:'FIXTURE_LEASE_EXPIRED'});a.equal(f.active(),0);a.equal(f.calls.filter(c=>c.kind==='keys'&&c.root==='sisventas/reclamos').length,0);});
for(const [root,budgetMiB]of [['sisventas/ordenes_trabajo',80],['sisventas/reclamos',32]])test('record above unchanged domain budget is rejected: '+root,async()=>{const f=fixture();f.state[root]={large:{id:'FICTICIO',adjunto:'a'.repeat(budgetMiB*1024*1024)}};await a.rejects(f.initial(),{code:'SV_SALE_DELETE_TARGET_INDEX',message:'La preparación excede el alcance permitido.'});a.equal(f.active(),0);});
for(const bad of ['duplicate','wrongDomain','missingRoot','rawRootLeak'])test('model rejects invalid image contract '+bad,async()=>{
 const sources=sourceFixture(),partial=Object.fromEntries(retained.map(root=>[root,sources[root]])),image=M.image('sisventas/ordenes_trabajo/10',sources['sisventas/ordenes_trabajo']['10']);let images=[image];if(bad==='duplicate')images.push(image);if(bad==='wrongDomain')images=[M.image('sisventas/ventas/sale',sources['sisventas/ventas'].sale)];if(bad==='missingRoot')delete partial['sisventas/gastos'];if(bad==='rawRootLeak')partial['sisventas/ordenes_trabajo']=sources['sisventas/ordenes_trabajo'];await a.rejects(M.prepareWithImages(partial,{generation:'invalid-image-fixture',images}),{code:'SV_SALE_DELETE_TARGET_INDEX'});
});

test('9MiB records in both streamed domains preserve genuine model and RAW hashes across both passes',async()=>{
 const f=fixture();for(const root of streamRoots)f.state[root]={large:{id:'DOCUMENTO-FICTICIO',ventaFbKey:'sale',adjunto:'x'.repeat(9*1024*1024)}};
 const plan=await f.initial(),generation='links-'+G.digest({uid:'u',opId:f.scope.lease.opId}).slice(0,48);
 for(const root of streamRoots)a.equal(plan.hashes[root],G.digest(f.state[root]));
 a.deepEqual(plan.patch,(await M.prepare(f.state,{generation})).patch);await f.fresh();a.equal(f.active(),0);a(f.peak()<=6);
 for(const root of streamRoots)a.equal(f.calls.filter(c=>c.kind==='record'&&c.root===root).length,2);
});
