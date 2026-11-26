'use strict';
// No network: run from checkout root. Compile reviewed baseline sources in memory.
const fs=require('node:fs'),Module=require('node:module'),cp=require('node:child_process'),path=require('node:path');
const {setup}=require('../test/helpers/payment-reader-latency-fixture.cjs');
const revision=process.argv[2]||'7714ce9b';
if(!/^[a-f0-9]{8,40}$/.test(revision))throw Error('Expected reviewed Git SHA');
function old(file,overrides={}){
 const filename=path.resolve('cotizador/'+file),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
 const requireOriginal=m.require.bind(m);m.require=id=>Object.hasOwn(overrides,id)?overrides[id]:requireOriginal(id);
 m._compile(cp.execFileSync('git',['show',revision+':cotizador/'+file],{encoding:'utf8'}),filename);return m.exports;
}
(async()=>{
 const authFactory=old('user-access.js').createBusinessAuth,ownershipFactory=old('commercial-ownership.js').createCommercialOwnership;
 const readerFactory=old('commercial-sale-payments.js',{'./payment-snapshot':old('payment-snapshot.js')}).create;
 for(const rtt of [20,80,175])for(const before of [true,false]){
  const f=setup({rtt,rich:true,...(before?{authFactory,ownershipFactory,readerFactory}:{})}),start=performance.now(),result=await f.load();
  if(result.paymentHistory.paidAmount!==40)throw Error('Unexpected fixture result');
  console.log(JSON.stringify({baseline:revision,before,rtt,ms:Math.round(performance.now()-start),reads:f.events.filter(e=>e.phase==='start').length}));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
