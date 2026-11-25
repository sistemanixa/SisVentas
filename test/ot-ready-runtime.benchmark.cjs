'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const directory=process.env.SV_OT_REVIEWED_RUNTIME;if(!directory)throw Error('Set reviewed runtime directory explicitly');
const base=path.dirname(directory),manifest=JSON.parse(fs.readFileSync(path.join(base,'source-manifest.private.json'))),otManifest=JSON.parse(fs.readFileSync(path.join(base,'source-ot-manifest.private.json')));
(async()=>{
 const results=[];
 for(const overlay of [false,true]){
  const loader=require('./helpers/ot-reviewed-runtime-loader.cjs').create({directory,manifest,otManifest,overlay}),f=await require('./helpers/ot-active-flow-fixture.cjs').create({latency:150,rowCount:12,productCount:641,otherCount:1100,runtimeModule:loader.load('labor-runtime.js'),lifecycleModule:loader.load('ot-lifecycle.js')}),start=performance.now();
  assert.equal((await f.save()).confirmed,true);assert.equal(f.commits.length,1);assert.equal(f.stats().active,0);assert.equal(f.client.filter(call=>call.kind==='SDK').length,overlay?0:1);for(let i=0;i<12;i++)assert.equal(f.get('sisventas/inventario_operativo/product'+i).consumido,2);
  results.push({overlay,elapsedMs:Math.round(performance.now()-start),requests:f.requests.length,client:f.client,maxConcurrency:f.stats().maxConcurrency,leaseWindowExceeded:Date.now()>=f.stats().leaseExpiresAt,commits:f.commits.length,verifiedFiles:loader.verifiedFiles});
 }
 const output=process.env.SV_OT_RUNTIME_BENCH_OUT||'tmp/ot-active-writers/runtime-overlay.json';fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({scope:'fictional Guard/REST Store runtime image modules plus checkout dependencies; no production IO',latency:150,productCount:641,otherOTs:1100,rows:12,results},null,2));console.log(JSON.stringify(results));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
