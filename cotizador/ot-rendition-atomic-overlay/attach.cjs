'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const BASE_IMAGE='sha256:cf7bcefb95650282ecb6a29aec3f33871c5f05371976ff3b1970d0122825dc65';
const BASE=Object.freeze({
 'index.js':'833d54e9ccc7779a686d3c1b1aeb713b1d32632c47cb926d05194beed232a159',
 'ot-lifecycle.js':'3992e1856cc18672867c5585b2b63e5bd76fd4bf2b3d8ec201a79cb023a4abf1',
 'ot-lifecycle-policy.js':'6ee7baab2d906172a62436dc523a9b032dcb265610fe3cb20748e47bf748ca37',
 'ot-lifecycle-model.js':'7e27f03108c3630ab8947a3c7abb00c591a9bbabf5c93008de09107a1dbeee5b',
 'ot-material-rows-model.js':'71bed377f82b2a3cab62abfc8fe23bfa17f8eb34e3c0b4ed905bf97b655bd8b3',
 'labor-guard.js':'315c03c3a18cd236c8efaf2f39ac6b4cc18854ebdfe3d94085723555c91b4020',
 'record-list-model.js':'cb3f886b58f175da915a689f01f0a8bf375b5c5a8ba37de511a209d4f5a82e76',
 'labor-rtdb-store.js':'b0f13f6253b946f10d3c86bff08d8a7b904a2e1b124c999f74d66fdab26a7273'
});
const MODIFIED=Object.freeze(['index.js','ot-lifecycle.js','ot-lifecycle-policy.js']);
const PAYLOAD=Object.freeze(['ot-rendition-stock-plan.js','ot-rendition-model.js','ot-rendition-material-state.js','ot-rendition-stock-model.js','ot-rendition-money.js','ot-rendition-hooks.json']);
function once(source,from,to){if(source.split(from).length!==2)throw Error('Unknown or duplicate OT overlay anchor');return source.replace(from,to);}
function line(source,prefix){const matches=source.split('\n').filter(s=>s.startsWith(prefix));if(matches.length!==1)throw Error('Unknown OT source line');return matches[0];}
function compute(files,hooks){
 for(const [name,hash]of Object.entries(BASE))if(sha(files[name]||'')!==hash)throw Error('OT runtime baseline changed: '+name);
 let service=files['ot-lifecycle.js'].toString(),policy=files['ot-lifecycle-policy.js'].toString(),index=files['index.js'].toString();
 service=once(service,'commercialPages=false,now=Date.now})','commercialPages=false,atomicCustody=false,now=Date.now})');
 service=once(service,"async function available(identity,{otKey,kind='custody'}={})","async function availableInternal(identity,{otKey,kind='custody'}={})");
 service=once(service,'async function executeInternal(identity,body,started)','async function executeInternal(identity,body,started,atomic=false)');
 service=once(service,line(service,'  if(!body||'),hooks.validation);
 service=once(service,line(service,'  actor.otLifecycle=Policy.issue('),hooks.capability);
 service=once(service,line(service,'   const sale=await scope.get(salePath)'),hooks.readiness);
 service=once(service,'   let changes=body.changes;','   let changes=body.changes;\n'+hooks.stage);
 service=once(service,"if(body.kind!=='return'&&changes?.materiales)for(let i=0;","if(!atomic&&body.kind!=='return'&&changes?.materiales)for(let i=0;");
 service=once(service,'const plan=Model.plan({','const plan=(atomic?require(\'./ot-rendition-model\'):Model).plan({');
 service=once(service,'   await scope.update(patch);','   if(atomic){Policy.bindAtomicStock(actor,scope.lease,inventoryChanges);Policy.verifyAtomicStockPatch(actor,scope.lease,patch);}\n   await scope.update(patch);');
 service=once(service,' return {execute,available};',hooks.methods+'\n return {execute,available,executeAtomic,availableAtomic};');
 policy=once(policy,'const issued=new WeakSet(),key=','const issued=new WeakSet(),atomicPlans=new WeakMap(),key=');
 policy=once(policy,line(policy,'function issue('),hooks.policySignature);
 policy=once(policy,line(policy,' const cap=Object.freeze('),hooks.policyCap);
 policy=once(policy,'module.exports={issue,token,authority,validate};',hooks.policyFunctions+'\nmodule.exports={issue,token,authority,validate,allowsAtomicStock,bindAtomicStock,verifyAtomicStockPatch};');
 const init=line(index,'const otLifecycle=');if(hooks.initializer.replace(",atomicCustody:process.env.OT_ATOMIC_RENDITION_READY==='true'",'')!==init)throw Error('Unknown OT runtime initialization');
 index=once(index,init,hooks.initializer);index=once(index,"  if(pathname==='/ot/ciclo/disponible'){",hooks.routes+"  if(pathname==='/ot/ciclo/disponible'){");
 const outputs={'index.js':index,'ot-lifecycle.js':service,'ot-lifecycle-policy.js':policy};for(const [name,source]of Object.entries(outputs))new vm.Script(source,{filename:name});return outputs;
}
function load(root,expected){const raw=fs.readFileSync(path.join(root,'ot-rendition-overlay.manifest.json'));if(sha(raw)!==expected)throw Error('Unknown OT overlay manifest');const m=JSON.parse(raw);if(m.schema!==1||m.sourceClean!==true||m.baseImage!==BASE_IMAGE||!/^[a-f0-9]{40}$/.test(m.sourceCommit||''))throw Error('Unfrozen OT overlay source');for(const name of PAYLOAD){if(sha(fs.readFileSync(path.join(root,name)))!==m.payload[name])throw Error('OT overlay payload changed');}return m;}
function apply(root,expected){const m=load(root,expected),files=Object.fromEntries(Object.keys(BASE).map(name=>[name,fs.readFileSync(path.join(root,name))])),hooks=JSON.parse(fs.readFileSync(path.join(root,'ot-rendition-hooks.json'))),outputs=compute(files,hooks);for(const name of MODIFIED)if(sha(outputs[name])!==m.outputs[name])throw Error('Unexpected composed OT runtime');for(const name of MODIFIED)fs.writeFileSync(path.join(root,name),outputs[name]);return {modified:MODIFIED,payload:PAYLOAD,sourceCommit:m.sourceCommit};}
function verify(root,expected){const m=load(root,expected);for(const name of MODIFIED)if(sha(fs.readFileSync(path.join(root,name)))!==m.outputs[name])throw Error('Composed OT runtime changed');for(const name of Object.keys(BASE).filter(n=>!MODIFIED.includes(n)))if(sha(fs.readFileSync(path.join(root,name)))!==BASE[name])throw Error('Unrelated OT runtime dependency changed');return{verified:true,sourceCommit:m.sourceCommit};}
if(require.main===module){try{const mode=process.argv[2],root=process.argv[3]||'/app',expected=process.argv[4];if(!/^[a-f0-9]{64}$/.test(expected||'')||!['apply','verify'].includes(mode))throw Error('Explicit mode and manifest hash required');console.log(JSON.stringify(mode==='apply'?apply(root,expected):verify(root,expected)));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={BASE_IMAGE,BASE,MODIFIED,PAYLOAD,sha,compute,apply,verify};
