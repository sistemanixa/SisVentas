'use strict';
const {performance}=require('node:perf_hooks'),{fixture}=require('./helpers/office-stock-link-command-fixture.cjs'),IO=require('../cotizador/office-stock-reference-io'),Command=require('../cotizador/office-stock-link-command'),Directed=require('../cotizador/office-stock-directed-coverage');
async function main(){
 if(process.env.SV_STOCK_REFERENCE_BENCHMARK!=='1')throw Error('Set SV_STOCK_REFERENCE_BENCHMARK=1 for the synthetic benchmark.');
 const latency=Number(process.env.SV_STOCK_REFERENCE_LATENCY_MS||150);
 for(const n of [1,6,12]){
  const f=fixture(),count={reads:0,queries:0,active:0,max:0};
  const rawRead=f.store.read,rawQuery=f.store.queryPage,wrap=(kind,fn)=>async(...args)=>{count[kind]++;count.max=Math.max(count.max,++count.active);try{await new Promise(resolve=>setTimeout(resolve,latency));return await fn(...args);}finally{count.active--;}};
  const read=wrap('reads',rawRead),queryPage=wrap('queries',rawQuery),phase=IO.createReferencePhase({queryPage}),coverage=Directed.createDirectedCoverage({queryPage});
  const tasks=Array.from({length:n},(_,i)=>{const productKey='product'+i,inventoryKey='physical'+i;f.set('sisventas/productos/'+productKey,{codigo:'SKU'+i,id:641+i,activo:true});f.set('sisventas/inventario_operativo/'+inventoryKey,{general:10});return{productKey,inventoryKey};});
  const start=performance.now();await Promise.all(tasks.map(task=>Command.loadSnapshot({read,queryPage,referencePhase:phase,loadCoverage:coverage,...task})));
  process.stdout.write(JSON.stringify({phase:'loader-shared',records:n,latency,ms:Math.round(performance.now()-start),reads:count.reads,queries:count.queries,maxInFlight:count.max})+'\n');
 }
}
main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
