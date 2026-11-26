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
