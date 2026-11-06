'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const Contract=require('./helpers/tecnoprices-container-contract.cjs'),Patch=require('../cotizador/tecnoprices-presentation-overlay/attach.cjs');
test('image config comparison preserves defaults and refuses every runtime override',()=>{
 const base={RepoDigests:['local/cotizador@'+Contract.BASE_IMAGE_DIGEST],Config:{Env:['FIXTURE=fiction'],Entrypoint:['node'],Cmd:['index.js'],User:'node',WorkingDir:'/app',ExposedPorts:{'8080/tcp':{}},Volumes:null,Healthcheck:null,StopSignal:'SIGTERM',Shell:null}};
 assert.equal(Contract.imageConfig(base,structuredClone(base)).serviceResourcesVerified,false);
 for(const key of Object.keys(base.Config)){const combined=structuredClone(base);combined.Config[key]='changed';assert.throws(()=>Contract.imageConfig(base,combined));}
 const unknown=structuredClone(base);unknown.RepoDigests=[];assert.throws(()=>Contract.imageConfig(unknown,base));
});
const reference=process.env.SV_PRESENTATION_ENTRYPOINT_FILE,retained=process.env.SV_PRESENTATION_RETAINED_SOURCE;
test('retained image sources form the exact reversible combined filesystem; not a container run',{skip:!reference||!retained},async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tecnoprices-container-contract-'));
 try{
  const overlay=path.resolve(__dirname,'../cotizador/tecnoprices-presentation-overlay');
  for(const file of ['budget-presentation-trial.js','budget-presentation-trial-model.js'])fs.copyFileSync(path.join(retained,file),path.join(temp,file));
  fs.copyFileSync(path.join(overlay,'attach.cjs'),path.join(temp,'tecnoprices-overlay-attach.cjs'));fs.copyFileSync(path.join(overlay,'tecnoprices-login.js'),path.join(temp,'tecnoprices-login.js'));
  fs.writeFileSync(path.join(temp,'index.js'),Patch.apply(fs.readFileSync(reference,'utf8')));
  assert.deepEqual(Contract.files(temp),{scope:'filesystem-contract-only',files:4,exactReversal:true,containerExecutionProven:false});
  assert.deepEqual(await Contract.authorization(temp),{unauthenticated:401,revokedToken:401,realAuthUsed:false});
  for(const file of Object.keys(Contract.FILES)){const target=path.join(temp,file),original=fs.readFileSync(target);fs.appendFileSync(target,'\n');assert.throws(()=>Contract.files(temp));fs.writeFileSync(target,original);}
 }finally{assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep+'tecnoprices-container-contract-'));fs.rmSync(temp,{recursive:true});}
});
