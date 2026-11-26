'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),cp=require('node:child_process'),Module=require('node:module'),path=require('node:path');
const G=require('../cotizador/labor-guard'),M=require('../cotizador/sale-delete-target-index'),Current=require('../cotizador/sale-delete-target-projections');
const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store');
// Immutable reviewed oracle, not a second handwritten financial planner.
const baselineFile=path.resolve(__dirname,'../cotizador/sale-delete-target-projections.js'),baselineModule=new Module(baselineFile,module);baselineModule.filename=baselineFile;baselineModule.paths=Module._nodeModulePaths(path.dirname(baselineFile));baselineModule._compile(cp.execFileSync('git',['show','aba1a4fa:cotizador/sale-delete-target-projections.js'],{encoding:'utf8'}),baselineFile);const Before=baselineModule.exports;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function seed(){let tree={};const sources=Object.fromEntries(M.roots.map(root=>[root,null]));Object.assign(sources,{'sisventas/ventas':{sale:{id:'V-0001',total:100},other:{id:'V-0002',total:80}},'sisventas/pagos':{pay:{ventaFbKey:'sale',monto:10}},'sisventas/gastos':{expense:{ventaFbKey:'sale',tipo:'Comisión',monto:3}},'sisventas/ctaemp':{employee:{movement:{ventaFbKey:'sale',monto:2}}}});for(const[p,v]of Object.entries(sources))tree=G.put(tree,G.parts(p),v);const prepared=await M.prepare(sources,{generation:'projection-prefetch-fixture'});for(const[p,v]of Object.entries(prepared.patch))tree=G.put(tree,G.parts(p),v);return tree;}
async function run(projector,tree,wire,{rtt=0,failPath}={}){
 const events=[];let active=0,maxActive=0;
 const store=createLaborRtdbStore({databaseURL:'http://127.0.0.1:1/?ns=projection-fixture',accessToken:async()=>'FIXTURE_ONLY',fetchImpl:async(url,options)=>{
  a.equal(options.method,'GET');const u=new URL(url),p=decodeURIComponent(u.pathname).slice(1,-5),event={path:p,start:performance.now()};events.push(event);active++;maxActive=Math.max(maxActive,active);
  try{if(rtt)await wait(rtt);if(p===failPath)throw Error('fixture read failure');let value=G.child(tree,G.parts(p));event.bytes=Buffer.byteLength(JSON.stringify(value));return new Response(JSON.stringify(value));}finally{event.end=performance.now();active--;}
 }});
 const memo=new Map(),raw=async p=>{if(!memo.has(p))memo.set(p,store.read(p));return structuredClone(await memo.get(p));};
 const patch=structuredClone(wire),start=performance.now();let error;try{await projector.augment({patch,raw,get:raw,exists:p=>store.exists(p)});}catch(e){error=e;}
 return {patch,error,events,elapsed:performance.now()-start,maxActive,active};
}
for(const kind of ['scalar','alias','agenda','expense','payment','mixed','delete','insertSale'])test('prefetch produces exact oracle wire patch for '+kind,async()=>{
 const tree=await seed(),sale=G.child(tree,G.parts('sisventas/ventas/sale'));let wire;
 if(kind==='scalar')wire={'sisventas/ventas/sale':{...sale,observaciones:'Ficticio'}};
 if(kind==='alias')wire={'sisventas/ventas/sale':{...sale,id:'V-0999'}};
 if(kind==='agenda')wire={'sisventas/agenda/new':{ventaFbKey:'sale',titulo:'Ficticio'}};
 if(kind==='expense')wire={'sisventas/gastos/new':{ventaId:'V-0001',monto:4}};
 if(kind==='payment')wire={'sisventas/pagos/pay/monto':11};
 if(kind==='mixed')wire={'sisventas/ventas/sale/total':101,'sisventas/gastos/expense/ventaFbKey':'other','sisventas/agenda/new':{ventaFbKey:'other'}};
 if(kind==='delete')wire={'sisventas/ventas/sale':null,'sisventas/pagos/pay':null};
 if(kind==='insertSale')wire={'sisventas/ventas/new':{id:'V-0003',total:3}};
 const before=await run(Before,tree,wire),after=await run(Current,tree,wire);a.equal(before.error,undefined);a.equal(after.error,undefined);a.deepEqual(after.patch,before.patch);a.equal(after.active,0);a(after.maxActive<=6);a.deepEqual(after.events.map(e=>e.path).sort(),before.events.map(e=>e.path).sort());a.equal(after.events.reduce((n,e)=>n+e.bytes,0),before.events.reduce((n,e)=>n+e.bytes,0));
});
test('bounded metadata overlap reduces RTT waves without reducing validated reads',async t=>{
 const tree=await seed(),wire={'sisventas/ventas/sale/observaciones':'Ficticio'};
 const before=await run(Before,tree,wire,{rtt:15}),after=await run(Current,tree,wire,{rtt:15});a.deepEqual(after.patch,before.patch);a.equal(before.maxActive,1);a(after.maxActive>=2&&after.maxActive<=6);a.equal(after.events.length,before.events.length);a(after.events.some((e,i)=>after.events.some((other,j)=>i!==j&&e.start<other.end&&other.start<e.end)));
 t.diagnostic(JSON.stringify({rtt:15,beforeMs:Math.round(before.elapsed),afterMs:Math.round(after.elapsed),reads:after.events.length,bytes:after.events.reduce((n,e)=>n+e.bytes,0),maxConcurrent:after.maxActive}));
});
test('I/O rejection drains bounded workers and does not add a derived patch',async()=>{
 const tree=await seed(),wire={'sisventas/ventas/sale/observaciones':'Ficticio'},result=await run(Current,tree,wire,{rtt:3,failPath:M.FINANCIAL_ROOT+'/coverage'});a.match(result.error.message,/fixture read failure/);a.equal(result.active,0);a.deepEqual(result.patch,wire);const count=result.events.length;await wait(10);a.equal(result.events.length,count);
});
test('corrupt original metadata remains rejected by unchanged delta',async()=>{let tree=await seed();tree=G.put(tree,G.parts(M.recordPath('sisventas/ventas/sale')+'/sourceHash'),'0'.repeat(64));const wire={'sisventas/ventas/sale/observaciones':'Ficticio'},before=await run(Before,tree,wire),after=await run(Current,tree,wire);a.equal(after.error.code,before.error.code);a.equal(after.error.message,before.error.message);a.deepEqual(after.patch,wire);});
test('genuine absence retains previous OFF I/O and no cross-operation cache',async()=>{
 const tree={},wire={'sisventas/agenda/new':{titulo:'Ficticio'}};for(let i=0;i<2;i++){const before=await run(Before,tree,wire),after=await run(Current,tree,wire);a.equal(after.error,undefined);a.deepEqual(after.patch,before.patch);a.deepEqual(after.events.map(e=>e.path),before.events.map(e=>e.path));a.equal(after.events.length,2);}
});

test('financial source mismatch remains rejected and installed operations never reuse prior metadata',async()=>{
 let tree=await seed();const wire={'sisventas/ventas/sale/observaciones':'Ficticio'},first=await run(Current,tree,wire);a.equal(first.error,undefined);
 tree=G.put(tree,G.parts(M.financialPath('sv_sale_financial_dependencies/v1/records/'+G.digest('sisventas/ventas/sale'))+'/sourceHash'),'0'.repeat(64));
 const before=await run(Before,tree,wire),after=await run(Current,tree,wire);a.equal(after.error.code,before.error.code);a.equal(after.error.message,before.error.message);a.deepEqual(after.patch,wire);a.equal(after.active,0);
});

const TargetDelta=require('../cotizador/sale-delete-target-index-delta'),FinancialModel=require('../cotizador/sale-financial-dependencies-model'),FinancialProvider=require('../cotizador/sale-financial-dependencies-provider'),PaymentIndex=require('../cotizador/payment-membership-index');
function applyPatch(tree,patch){for(const[p,v]of Object.entries(patch))tree=G.put(tree,G.parts(p),v);return tree;}
function normalizedGraph(tree){const graph=structuredClone(G.child(tree,G.parts('sv_sale_delete_relations')));delete graph.v1.coverage.revision;delete graph.v1.financial.v1.coverage.revision;return PaymentIndex.normalizeRtdb(graph);}
for(const [label,wire]of [
 ['agenda',{'sisventas/agenda/new':{ventaFbKey:'sale',titulo:'Ficticio'}}],
 ['payment-only',{'sisventas/pagos/pay/monto':11}],
 ['OT',{'sisventas/ordenes_trabajo/new':{ventaFbKey:'sale',id:'OT-FICTICIA',materiales:[]}}]
])test('non-financial '+label+' maintains Graph with zero financial I/O and exact financial bytes',async()=>{
 const tree=await seed(),beforeFinancial=JSON.stringify(G.child(tree,G.parts(M.FINANCIAL_ROOT))),beforeCoverage=G.child(tree,G.parts(M.ROOT+'/coverage'));
 const result=await run(Current,tree,wire);a.equal(result.error,undefined);a.equal(result.events.filter(e=>e.path===M.FINANCIAL_ROOT||e.path.startsWith(M.FINANCIAL_ROOT+'/')).length,0);a(Object.keys(result.patch).every(p=>!p.startsWith(M.FINANCIAL_ROOT+'/')));
 const next=applyPatch(structuredClone(tree),result.patch);a.equal(JSON.stringify(G.child(next,G.parts(M.FINANCIAL_ROOT))),beforeFinancial);a.equal(G.child(next,G.parts(M.ROOT+'/coverage')).revision,beforeCoverage.revision+1);
 const prepared=await M.prepare(Object.fromEntries(M.roots.map(p=>[p,G.child(next,G.parts(p))])),{generation:beforeCoverage.generation});const rebuilt=applyPatch(G.put(structuredClone(next),G.parts('sv_sale_delete_relations'),null),prepared.patch);a.deepEqual(normalizedGraph(next),normalizedGraph(rebuilt));
 const provider=FinancialProvider.create(),evidence=await provider({saleKey:'sale',read:async p=>G.child(next,G.parts(p===FinancialModel.ROOT||p.startsWith(FinancialModel.ROOT+'/')?M.financialPath(p):p))});a.equal(evidence.dependencies.length,2);
});
test('no-op financial original does not prefetch or advance financial metadata',async()=>{const tree=await seed(),wire={'sisventas/ventas/sale':G.child(tree,G.parts('sisventas/ventas/sale'))},r=await run(Current,tree,wire);a.equal(r.error,undefined);a.equal(r.events.filter(e=>e.path.startsWith(M.FINANCIAL_ROOT+'/')).length,0);a(Object.keys(r.patch).every(p=>!p.startsWith(M.FINANCIAL_ROOT+'/')));a.equal(r.patch[M.ROOT+'/coverage'].revision,G.child(tree,G.parts(M.ROOT+'/coverage')).revision+1);});
test('empty direct Graph delta still advances Graph revision without financial I/O',async()=>{const tree=await seed(),reads=[],patch=await TargetDelta.delta({changes:[],read:async p=>{reads.push(p);return structuredClone(G.child(tree,G.parts(p)));}});a.deepEqual(reads,[M.ROOT+'/coverage']);a.deepEqual(Object.keys(patch),[M.ROOT+'/coverage']);});
test('existing financial delta fields remain patch-identical, with candidates added separately',async()=>{
 const filename=path.resolve(__dirname,'../cotizador/sale-delete-target-index-delta.js'),oldModule=new Module(filename,module);oldModule.filename=filename;oldModule.paths=Module._nodeModulePaths(path.dirname(filename));oldModule._compile(cp.execFileSync('git',['show','09cb79c3:cotizador/sale-delete-target-index-delta.js'],{encoding:'utf8'}),filename);
 const tree=await seed(),sale=G.child(tree,G.parts('sisventas/ventas/sale'));
 for(const changes of [
  [{path:'sisventas/ventas/sale',before:sale,after:{...sale,observaciones:'Ficticio'}}],
  [{path:'sisventas/ventas/sale',before:sale,after:{...sale,id:'V-0999'}}],
  [{path:'sisventas/ventas/sale',before:sale,after:null}],
  [{path:'sisventas/gastos/expense',before:G.child(tree,G.parts('sisventas/gastos/expense')),after:null}],
  [{path:'sisventas/ctaemp/employee/movement',before:G.child(tree,G.parts('sisventas/ctaemp/employee/movement')),after:{ventaFbKey:'other',monto:3}}],
  [{path:'sv_commission_generation/other',before:null,after:{monto:1}}],
  [{path:'sisventas/comisiones_generacion/new',before:null,after:{ventaFbKey:'sale',monto:1}}]
 ]){const read=async p=>structuredClone(G.child(tree,G.parts(p))),before=await oldModule.exports.delta({changes,read}),after=await TargetDelta.delta({changes,read});a.deepEqual(Object.fromEntries(Object.entries(after).filter(([p])=>!p.startsWith(M.FINANCIAL_ROOT+'/candidatesBySale/'))),before);}
});

const candidates=(tree,sale)=>G.child(tree,G.parts(M.FINANCIAL_ROOT+'/candidatesBySale/'+sale));
const financialEntry=(tree,id)=>G.child(tree,G.parts(M.FINANCIAL_ROOT+'/records/'+id));
async function candidateSeed({ambiguous=false,technical=false,orphan=false}={}){
 const sources=Object.fromEntries(M.roots.map(root=>[root,null]));Object.assign(sources,{'sisventas/ventas':{a:{id:'V-0001',total:10},b:{id:ambiguous?'V-0001':'V-0002',total:20}},'sisventas/gastos':{g:{tipo:'Comisión',monto:1,...(orphan?{}:{ventaId:'V-0001'}),...(technical?{ventaFbKey:'a',ventaId:'V-0002'}:{})}}});
 let tree={};for(const[p,v]of Object.entries(sources))tree=G.put(tree,G.parts(p),v);return applyPatch(tree,(await M.prepare(sources,{generation:'candidate-inverse-fixture'})).patch);
}
async function assertRebuilt(tree){const sources=Object.fromEntries(M.roots.map(root=>[root,G.child(tree,G.parts(root))])),generation=G.child(tree,G.parts(M.ROOT+'/coverage')).generation,fresh=await M.prepare(sources,{generation}),rebuilt=applyPatch(G.put(structuredClone(tree),G.parts('sv_sale_delete_relations'),null),fresh.patch);a.deepEqual(normalizedGraph(tree),normalizedGraph(rebuilt));}
test('bootstrap candidate inverse includes every ambiguous target without falsifying unresolved coverage',async()=>{
 const tree=await candidateSeed({ambiguous:true}),id=G.digest('sisventas/gastos/g');a.deepEqual(candidates(tree,'a'),{[id]:true});a.deepEqual(candidates(tree,'b'),{[id]:true});a.equal(financialEntry(tree,id).unresolved,true);a.equal(G.child(tree,G.parts(M.FINANCIAL_ROOT+'/coverage')).unresolved,1);a.equal(G.child(tree,G.parts(M.FINANCIAL_ROOT+'/bySale/a')),null);a.equal(G.child(tree,G.parts('sv_sale_financial_dependencies')),null);await assertRebuilt(tree);
});
test('alias collision, resolution, source move and removal keep complete inverse equal to fresh rebuild',async()=>{
 let tree=await candidateSeed();const id=G.digest('sisventas/gastos/g');a.deepEqual(candidates(tree,'a'),{[id]:true});a.equal(candidates(tree,'b'),null);
 for(const [wire,expectedTargets,unresolved]of [
  [{'sisventas/ventas/b/id':'V-0001'},['a','b'],1],
  [{'sisventas/ventas/b/id':'V-0002'},['a'],0],
  [{'sisventas/gastos/g/ventaId':'V-0002'},['b'],0],
  [{'sisventas/gastos/g':null},[],0]
 ]){const result=await run(Current,tree,wire);a.equal(result.error,undefined);tree=applyPatch(tree,result.patch);for(const sale of ['a','b'])a.equal(candidates(tree,sale)?.[id]===true,expectedTargets.includes(sale));a.equal(G.child(tree,G.parts(M.FINANCIAL_ROOT+'/coverage')).unresolved,unresolved);await assertRebuilt(tree);}
});
test('candidate inverse preserves technical priority and does not invent targets for orphan sources',async()=>{
 const technical=await candidateSeed({technical:true}),id=G.digest('sisventas/gastos/g');a.deepEqual(candidates(technical,'a'),{[id]:true});a.equal(candidates(technical,'b'),null);a.equal(financialEntry(technical,id).unresolved,false);
 const orphan=await candidateSeed({orphan:true});a.equal(candidates(orphan,'a'),null);a.equal(candidates(orphan,'b'),null);a.equal(financialEntry(orphan,id).unresolved,true);a.equal(G.child(orphan,G.parts(M.FINANCIAL_ROOT+'/coverage')).unresolved,1);
});
test('malformed old candidate targets veto the patch instead of fabricating an empty inverse',async()=>{
 let tree=await candidateSeed();const id=G.digest('sisventas/gastos/g');tree=G.put(tree,G.parts(M.FINANCIAL_ROOT+'/records/'+id+'/targets'),'a');const wire={'sisventas/gastos/g/monto':2},result=await run(Current,tree,wire);a.equal(result.error.code,'SV_SALE_DELETE_TARGET_INDEX');a.equal(result.error.message,'Candidatos financieros inválidos.');a.deepEqual(result.patch,wire);a.equal(result.active,0);
});
