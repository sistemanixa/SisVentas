'use strict';
// Opt-in synthetic latency, no network or production data.
const {performance}=require('node:perf_hooks'),{fixture}=require('./helpers/office-stock-link-command-fixture.cjs'),Command=require('../cotizador/office-stock-link-command');
async function main(){
 if(process.env.SV_STOCK_REFERENCE_BENCHMARK!=='1')throw Error('Set SV_STOCK_REFERENCE_BENCHMARK=1 for the synthetic benchmark.');
 const latency=Number(process.env.SV_STOCK_REFERENCE_LATENCY_MS||150),f=fixture(),totals={reads:0,queries:0,active:0,max:0},delay=fn=>async(...args)=>{totals[fn.kind]++;totals.max=Math.max(totals.max,++totals.active);try{await new Promise(resolve=>setTimeout(resolve,latency));return await fn(...args);}finally{totals.active--;}};
 const read=f.store.read;read.kind='reads';f.store.read=delay(read);const query=f.store.queryPage;query.kind='queries';f.store.queryPage=delay(query);
 const api=Command.create({...f.options,queryPage:f.store.queryPage}),measure=async(phase,fn)=>{const before={...totals},start=performance.now(),result=await fn();process.stdout.write(JSON.stringify({phase,latency,ms:Math.round(performance.now()-start),reads:totals.reads-before.reads,queries:totals.queries-before.queries,maxInFlight:totals.max})+'\n');return result;};
 const preview=await measure('preview',()=>api.preview(f.identity,{productKey:'product',inventoryKey:'legacy'}));
 await measure('execute',()=>api.execute(f.identity,{id:'synthetic-latency-link',productKey:'product',inventoryKey:'legacy',reason:'Ficticio',expectedHash:preview.expectedHash}));
}
main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
