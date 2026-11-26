'use strict';
// Read batching only. Uses the reviewed source checkout's native HTTP lab.
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module'),{execFileSync}=require('node:child_process');
const sourceRoot=path.resolve(process.env.SV_SALE_DELETE_CONCURRENCY_SOURCE_ROOT||path.join(__dirname,'..'));
if(process.env.SV_SALE_DELETE_CONCURRENCY_SOURCE_SHA)a.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim(),process.env.SV_SALE_DELETE_CONCURRENCY_SOURCE_SHA);
const {create}=createRequire(path.join(sourceRoot,'index.html'))('./test/helpers/sale-delete-native-http-lab.cjs');
const roots=new Set(['ventas','pagos','ordenes_trabajo','presupuestos','reclamos','agenda','ordenes','listas_materiales','remitos','equipos','tickets','ordenesTrabajo'].map(d=>'sisventas/'+d));
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};}
// Deadlock watchdog only, never a latency/performance expectation.
async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Fixture barrier did not settle')),5000);})]);}finally{clearTimeout(timer);}}
test('both plans overlap collection reads with maximum six and preserve every root, point check and full commit', {timeout:15000},async()=>{
 const f=await create({sourceRoot});let active=0,maximum=0;const seen={};
 try{f.control.beforeRead=async p=>{if(roots.has(p)){seen[p]=(seen[p]||0)+1;maximum=Math.max(maximum,++active);await turn();active--;}};
  const r=await f.request(f.body());a.equal(r.status,200,JSON.stringify(r));a.equal(maximum,6);a.equal(active,0);a.equal(Object.keys(seen).length,12);a(Object.values(seen).every(count=>count===2));
  const metrics=f.metrics();a.equal(metrics.collectionReads,24);a.equal(metrics.storeGets,148);a.equal(metrics.pointGets,124);a.equal(metrics.businessCommits,1);a.equal(f.commits.length,1);a(f.commits[0].patch['sv_labor_receipts/'+r.body.operationId]);
 }finally{await f.close();}
});
test('first-root failure drains an already pending worker before answering, with no next batch or business commit', {timeout:15000},async()=>{
 const f=await create({sourceRoot}),held=deferred(),entered=deferred();let failed=false,waiting=false,answered=false,pending;
 try{const sale=f.get('sisventas/ventas/sale'),payment=f.get('sisventas/pagos/payment');f.control.beforeRead=async p=>{if(p==='sisventas/ventas'&&!failed){failed=true;throw Error('Fictitious first root failure');}if(p==='sisventas/pagos'&&!waiting){waiting=true;entered.resolve();await held.promise;}};
  pending=f.request(f.body());pending.then(()=>{answered=true;},()=>{answered=true;});await bounded(entered.promise);await turn();a.equal(answered,false,'HTTP must wait for the outstanding worker');a.equal(f.commits.length,0);held.resolve();const r=await pending;a.equal(r.status,503);a.equal(f.commits.length,0);a.equal(f.calls.some(c=>c.method==='GET'&&c.path==='sisventas/agenda'),false);
  const count=f.calls.length;await turn();a.equal(f.calls.length,count,'No background IO after response');a.deepEqual(f.get('sisventas/ventas/sale'),sale);a.deepEqual(f.get('sisventas/pagos/payment'),payment);
 }finally{held.resolve();if(pending)await bounded(pending.catch(()=>{})).catch(()=>{});await f.close();}
});
test('a payment added after the first collection batch is caught by the fresh plan without partial deletion', {timeout:15000},async()=>{
 const f=await create({sourceRoot});try{const sale=f.get('sisventas/ventas/sale'),payment=f.get('sisventas/pagos/payment'),budget=f.get('sisventas/presupuestos/budget');let injected=false;
  f.control.beforeRead=async p=>{if(!injected&&p==='sisventas/agenda'){injected=true;f.set('sisventas/pagos/late',{ventaFbKey:'sale',monto:3,fecha:'2026-11-26'});}};
  const r=await f.request(f.body());a.equal(injected,true);a.equal(r.status,409);a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas/ventas/sale'),sale);a.deepEqual(f.get('sisventas/pagos/payment'),payment);a.deepEqual(f.get('sisventas/presupuestos/budget'),budget);a.equal(f.get('sisventas/pagos/late/monto'),3);a.equal(f.calls.filter(c=>c.method==='GET'&&c.path==='sisventas/pagos').length,2);
 }finally{await f.close();}
});
test('a changed native financial coverage keeps its final temporal barrier despite parallel root reads', {timeout:15000},async()=>{
 const f=await create({sourceRoot});try{const sale=f.get('sisventas/ventas/sale');let injected=false;f.control.beforeRead=async p=>{if(!injected&&p==='sisventas/agenda'){injected=true;f.set('sisventas/gastos/late',{ventaFbKey:'sale',tipoPagable:'comision',monto:7,estado:'aprobado'});await f.prepareFinancial();}};
  const r=await f.request(f.body());a.equal(injected,true);a.equal(r.status,409);a.equal(r.body.code,'SV_SALE_FINANCIAL_INCOMPLETE');a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas/ventas/sale'),sale);a.equal(f.get('sisventas/gastos/late/monto'),7);a.equal(f.get('sv_labor_guard'),null);
 }finally{await f.close();}
});
