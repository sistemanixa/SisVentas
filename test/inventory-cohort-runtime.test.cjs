'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Runtime=require('../cotizador/inventory-cohort-runtime');
function signedFixture(){
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),Pins=require('../cotizador/inventory-code-pins'),Contract=require('../cotizador/inventory-cohort-contract'),Install=require('../cotizador/inventory-installation-contract'),Activation=require('../cotizador/stock-link-activation-contract'),{digest}=require('../cotizador/labor-guard');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'inventory-cohort-runtime-')),serverRoot=path.join(directory,'server'),uiRoot=path.join(directory,'ui');fs.mkdirSync(serverRoot);fs.mkdirSync(uiRoot);
 for(const name of new Set(Object.values(Pins.manifest.groups).slice(0,3).flat()))fs.writeFileSync(path.join(serverRoot,name),'module.exports={};');
 for(const name of ['package.json','package-lock.json'])fs.writeFileSync(path.join(serverRoot,name),'{}');
 for(const name of ['js/core','js/modules','css'])fs.mkdirSync(path.join(uiRoot,name),{recursive:true});
 fs.writeFileSync(path.join(uiRoot,'index.html'),'<script src="./js/app.v3.21.2.js"></script>');fs.writeFileSync(path.join(uiRoot,'sw.js'),'//fixture');fs.writeFileSync(path.join(uiRoot,'js/app.v3.21.2.js'),'//fixture');
 const keys=crypto.generateKeyPairSync('ed25519'),contract=Contract.create({generation:'runtime-fixture',operationId:'bootstrap-fixture',sourceDigest:'a'.repeat(64),runtimeHash:'b'.repeat(64),writers:Contract.REQUIRED.map(id=>({id,sourceHash:'c'.repeat(64),proofHash:'d'.repeat(64),state:'closed'}))}),pins={schema:1,generation:contract.generation,baselineDigest:'e'.repeat(64),contractDigest:digest(contract),codePins:Pins.calculateCodePins({serverRoot,uiRoot}).codePins,indexQueryCoverageVersion:1},env={INVENTORY_COHORT_PINS_JSON:JSON.stringify(pins),INVENTORY_COHORT_CONTRACT_JSON:JSON.stringify(contract),INVENTORY_RULES_DIGEST:'f'.repeat(64),INVENTORY_COHORT_PUBLIC_KEY:keys.publicKey.export({type:'spki',format:'pem'})},document={...pins,rulesDigest:env.INVENTORY_RULES_DIGEST,issuedAt:Date.now()-1000};
 document.signature=crypto.sign(null,Buffer.from(Activation.payload(document)),keys.privateKey).toString('base64url');
 const verifier=Pins.createVerifier({serverRoot,uiRoot,env}),marker=Install.createMarker(document,{verifier});
 let values={[Runtime.INSTALLED]:marker,[Runtime.ACTIVATION]:document};const reads=[];
 return{directory,serverRoot,uiRoot,env,document,marker,reads,read:async path=>{reads.push(path);return structuredClone(values[path]??null);},set:(path,value)=>{values[path]=value;},cleanup:()=>{const resolved=fs.realpathSync(directory),parent=fs.realpathSync(os.tmpdir());if(path.dirname(resolved)!==parent||!path.basename(resolved).startsWith('inventory-cohort-runtime-'))throw Error('Unexpected fixture cleanup path');fs.rmSync(resolved,{recursive:true,force:true});}};
}
test('OFF construction performs no reads, parses no environment and exposes no admission',async()=>{
 let calls=0;const runtime=Runtime.create({enabled:false,serverRoot:'not-a-path',uiRoot:'not-a-path',env:{},read:async()=>{calls++;return null;}});
 assert.equal(calls,0);assert.equal(runtime.mappedAdmission,null);
 assert.deepEqual(await runtime.capabilities(),{version:1,installed:false,ready:false,generation:''});assert.equal(calls,2);
 await assert.rejects(runtime.assertAdmission(),e=>e.code==='SV_INVENTORY_COHORT_NOT_READY');
});
test('even malformed installed or activation presence blocks legacy and stays sticky',async()=>{
 for(const root of [Runtime.INSTALLED,Runtime.ACTIVATION]){
  let values={[root]:false};const runtime=Runtime.create({read:async path=>Object.hasOwn(values,path)?values[path]:null});
  assert.equal((await runtime.capabilities()).installed,true);assert.equal((await runtime.capabilities()).ready,false);
  values={};assert.equal((await runtime.capabilities()).installed,true);await assert.rejects(runtime.assertAdmission());
 }
});
test('missing authority and transport failure never become not installed',async()=>{
 await assert.rejects(Runtime.create({read:async()=>undefined}).capabilities(),e=>e.code==='SV_INVENTORY_COHORT_NOT_READY');
 const denied=Object.assign(Error('fixture denied'),{statusCode:403});await assert.rejects(Runtime.create({read:async()=>{throw denied;}}).capabilities(),e=>e===denied);
 await assert.rejects(Runtime.create().capabilities());
});
test('all admissions read current state and readOnly is an explicit boolean',async()=>{
 let calls=0;const runtime=Runtime.create({readOnly:true,read:async()=>{calls++;return null;}});
 for(let i=0;i<3;i++)await assert.rejects(runtime.verifyCohort());assert.equal(calls,6);
 assert.throws(()=>Runtime.create({enabled:'true'}));assert.throws(()=>Runtime.create({readOnly:'false'}));
});
test('genuine startup verifier and Explicit authority compose with fresh signed installation',async()=>{
 const f=signedFixture();try{
  const runtime=Runtime.create({enabled:true,...f});assert.equal(f.reads.length,0);assert.equal(require('../cotizador/office-stock-explicit-reference').isMappedAdmission(runtime.mappedAdmission),true);
  const DeleteCohort=require('../cotizador/ot-delete-inventory-cohort');assert.equal(DeleteCohort.isAuthority(runtime.otDeleteAuthority),true);assert.equal(DeleteCohort.isAuthority({...runtime.otDeleteAuthority}),false);
  assert.deepEqual(await runtime.capabilities(),{version:1,installed:true,ready:true,generation:'runtime-fixture'});
  const proof=await runtime.verifyCohort({read:f.read});assert.equal(proof.verified,true);assert.equal(proof.writerVersion,1);assert.equal(proof.generation,'runtime-fixture');assert.equal(f.reads.length,4);
  f.set(Runtime.ACTIVATION,{...f.document,signature:'A'.repeat(86)});assert.equal((await runtime.capabilities()).ready,false);await assert.rejects(runtime.assertAdmission());
 }finally{f.cleanup();}
});
test('signed activation without marker, changed marker and read-only mode never authorize a writer',async()=>{
 const f=signedFixture();try{
  const runtime=Runtime.create({enabled:true,...f});f.set(Runtime.INSTALLED,null);assert.equal((await runtime.capabilities()).installed,true);await assert.rejects(runtime.assertAdmission());
  for(const marker of [false,{}, {...f.marker,authorizationHash:'0'.repeat(64)}, {...f.marker,extra:true}]){f.set(Runtime.INSTALLED,marker);assert.equal((await runtime.capabilities()).ready,false);await assert.rejects(runtime.assertAdmission());}
  f.set(Runtime.INSTALLED,f.marker);const paused=Runtime.create({enabled:true,readOnly:true,...f});assert.equal((await paused.capabilities()).ready,false);await assert.rejects(paused.verifyCohort());
 }finally{f.cleanup();}
});
test('different package bytes fail during construction before any remote metadata read',()=>{
 const f=signedFixture();try{
  require('node:fs').writeFileSync(require('node:path').join(f.uiRoot,'sw.js'),'//different');assert.throws(()=>Runtime.create({enabled:true,...f}));assert.equal(f.reads.length,0);
 }finally{f.cleanup();}
});
test('startup bytes are not rescanned per admission while remote authority is reread each time',async()=>{
 const f=signedFixture(),fs=require('node:fs'),original=fs.readFileSync;try{
  const runtime=Runtime.create({enabled:true,...f});await runtime.assertAdmission();let reads=0;
  fs.readFileSync=function(...args){reads++;return original.apply(this,args);};
  for(let i=0;i<3;i++)await runtime.assertAdmission({read:f.read});
  assert.equal(reads,0);assert.equal(f.reads.length,8);
  f.set(Runtime.INSTALLED,{...f.marker,installedAt:Date.now()+60000});await assert.rejects(runtime.assertAdmission());assert.equal(f.reads.length,10);
 }finally{fs.readFileSync=original;f.cleanup();}
});
