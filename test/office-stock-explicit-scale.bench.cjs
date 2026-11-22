'use strict';
// Synthetic resolver cohort, not an OT command or production benchmark.
const {performance}=require('node:perf_hooks'),IO=require('../cotizador/office-stock-reference-io'),Port=require('../cotizador/office-stock-reference-port'),Reference=require('../cotizador/office-stock-reference'),{explicitFixture}=require('./helpers/office-stock-explicit-fixture.cjs');
async function main(){
 if(process.env.SV_STOCK_REFERENCE_BENCHMARK!=='1')throw Error('Set SV_STOCK_REFERENCE_BENCHMARK=1 for the synthetic benchmark.');
 const latency=Number(process.env.SV_STOCK_REFERENCE_LATENCY_MS||150);
 for(const mode of ['mapped','legacy-exact'])for(const n of [1,6,12]){
  const f=await explicitFixture(),rows=[];
  for(let i=0;i<n;i++){
   const productKey='item'+i,inventoryKey=mode==='mapped'?'physical'+i:productKey;
   f.set('sisventas/productos/'+productKey,{codigo:'SKU'+i,id:641+i,activo:true});f.set('sisventas/inventario_operativo/'+inventoryKey,{general:10,reservado:0,consumido:0});
   if(mode==='mapped')await f.api.execute(f.identity,{id:'benchmark-map-'+i,productKey,inventoryKey,reason:'Ficticio',expectedHash:(await f.api.preview(f.identity,{productKey,inventoryKey})).expectedHash});
   rows.push({productoKey:productKey,inventoryKey,instalada:0,entregada:0});
  }
  f.set('sisventas/ordenes_trabajo/benchOt',{ventaFbKey:'sale',materiales:rows});
  const count={reads:0,queries:0,active:0,max:0},raw=f.store.read,read=IO.memoRead(async path=>{count.reads++;count.max=Math.max(count.max,++count.active);try{await new Promise(resolve=>setTimeout(resolve,latency));return await raw(path);}finally{count.active--;}}).read;
  const resolver=Port.createReferenceResolver({enabled:true,mappedAdmission:f.authority}),ports={read,queryPage:async()=>{count.queries++;throw Error('Unexpected discovery');},legacy:async()=>{throw Error('Unexpected reinterpretation');},identifyOriginal:async(source,selector,io)=>{const row=source.materiales[selector],path='sisventas/inventario_operativo/'+row.inventoryKey,ledger=await io.read(path);if(row.instalada!==0||row.entregada!==0||row.stockRegistro||ledger.rendicionesOT)throw Error('Invalid synthetic absence fixture');return{productKey:row.productoKey,inventoryKey:row.inventoryKey,history:{kind:'absent',sourceHash:Reference.digest(source),verifiedReads:[path]}};}};
  const start=performance.now(),results=await IO.mapOrdered(rows,(_,selector)=>resolver({purpose:'ot',path:'sisventas/ordenes_trabajo/benchOt',selector},ports));
  const ms=Math.round(performance.now()-start),fresh=IO.memoRead(async path=>{count.reads++;count.max=Math.max(count.max,++count.active);try{await new Promise(resolve=>setTimeout(resolve,latency));return await raw(path);}finally{count.active--;}}).read,before=count.reads,freshStart=performance.now();
  await IO.mapOrdered(results,result=>Port.assertFresh(result.readSet,fresh));
  process.stdout.write(JSON.stringify({mode,records:n,latency,resolveMs:ms,freshMs:Math.round(performance.now()-freshStart),reads:before,freshReads:count.reads-before,queries:count.queries,maxInFlight:count.max})+'\n');
 }
}
main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
