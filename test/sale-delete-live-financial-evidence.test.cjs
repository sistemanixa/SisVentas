'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const Live=require('../cotizador/sale-delete-live-financial-evidence');
const M=require('../cotizador/sale-financial-dependencies-model');
const roots=['sisventas/ventas','sisventas/gastos','sisventas/ctaemp','sisventas/comisiones_generacion','sv_commission_generation'];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function fixture(){
 const values={'sisventas/ventas':{s:{id:'V-0001'},other:{id:'V-0002'}},'sisventas/gastos':{},'sisventas/ctaemp':{},'sisventas/comisiones_generacion':{},sv_commission_generation:{},sv_client_history_config:null};
 const present=new Set(),reads=[],existence=[],control={hook:null,existsHook:null};
 const store={exists:async path=>{existence.push(path);if(control.existsHook)return control.existsHook(path);return present.has(path);},commit(){throw Error('No writes');},acquire(){throw Error('No leases in provider');}};
 const read=async path=>{reads.push(path);if(control.hook)await control.hook(path);if(!Object.hasOwn(values,path))throw Error('Unexpected read, no virtual-index fallback: '+path);return structuredClone(values[path]);};
 const provider=Live.create({store}),args={saleKey:'s',operationId:'fixture-live-operation',read};
 return {values,present,reads,existence,control,store,provider,args,run:()=>provider(args)};
}
test('genuine provider is private branded/frozen and never trusts serialized or wrapped substitutes',()=>{
 const f=fixture();a.equal(Object.isFrozen(f.provider),true);a.equal(Live.isProvider(f.provider),true);for(const fake of [{},JSON.stringify(f.provider),f.provider.bind(null),Object.assign({},f.provider),null])a.equal(Live.isProvider(fake),false);a.throws(()=>Live.create({store:{read(){}}}),/existencia/);
});
test('real model and provider build only RAM coverage and read five originals exactly once',async()=>{
 const f=fixture(),before=structuredClone(f.values),r=await f.run();a.equal(r.scope,'complete-financial-dependencies');a.deepEqual(r.dependencies,[]);a.equal(r.generation,'live-'+M.digest({saleKey:'s',operationId:f.args.operationId}));a.equal(r.coverageSnapshot.generation,r.generation);a.equal(r.coverageSnapshot.unresolved,0);
 for(const root of roots){a.equal(f.reads.filter(path=>path===root).length,1);a.equal(r.originalSourceHashes[root],M.digest(before[root]));}
 a.deepEqual(Object.keys(r.originalSourceHashes),roots);a.deepEqual(f.values,before);a.equal(f.reads.length,6);a.equal(f.existence.length,3);
 const again=await f.run();a.deepEqual(again,r);a.equal(f.reads.length,12,'no cross-request cache');
});
for(const domain of ['gastos','ctaemp','comisiones_generacion','sv_commission_generation'])test('target dependency from '+domain+' is never auto-declared absent',async()=>{
 const f=fixture(),path=domain==='sv_commission_generation'?domain:'sisventas/'+domain;
 f.values[path]=domain==='ctaemp'?{employee:{movement:{ventaFbKey:'s',monto:9}}}:domain==='sv_commission_generation'?{s:{monto:9}}:{entry:{ventaFbKey:'s',monto:9}};
 const r=await f.run();a.equal(r.dependencies.length,1);a.equal(r.dependencies[0].path,path+(domain==='ctaemp'?'/employee/movement':domain==='sv_commission_generation'?'/s':'/entry'));a.match(r.dependencies[0].sourceHash,/^[a-f0-9]{64}$/);
});
test('global unresolved dependencies are rejected even when unrelated to requested sale',async()=>{const f=fixture();f.values['sisventas/gastos']={orphan:{tipo:'Comisión',monto:9}};await a.rejects(f.run(),{code:'SV_SALE_FINANCIAL_INCOMPLETE',message:'Existen dependencias financieras sin resolver; no se certificó ausencia.'});});
test('ambiguous numeric aliases retain genuine model denial',async()=>{const f=fixture();f.values['sisventas/ventas'].other.id='OTHER-0001';f.values['sisventas/gastos']={entry:{ventaId:'0001',monto:9}};await a.rejects(f.run(),{code:'SV_SALE_FINANCIAL_INCOMPLETE'});});
test('technical priority is preserved over a conflicting visible alias',async()=>{const f=fixture();f.values['sisventas/gastos']={entry:{ventaFbKey:'other',ventaId:'V-0001',monto:9}};a.deepEqual((await f.run()).dependencies,[]);});
test('significant leading zeros never collapse into an invented absent dependency',async()=>{const f=fixture();f.values['sisventas/gastos']={entry:{ventaId:'1',monto:9}};await a.rejects(f.run(),{code:'SV_SALE_FINANCIAL_INCOMPLETE'});});
test('five RAW hashes capture changes absent from four financial accumulators',async()=>{
 const f=fixture(),one=await f.run();f.values['sisventas/ventas'].other.extra='changed';const two=await f.run();a.notDeepEqual(one.originalSourceHashes,two.originalSourceHashes);a.deepEqual(one.sources,two.sources);a.equal(one.generation,two.generation);
 f.values['sisventas/gastos']=null;const three=await f.run();a.notEqual(two.originalSourceHashes['sisventas/gastos'],three.originalSourceHashes['sisventas/gastos']);a.deepEqual(two.sources,three.sources);
});
for(const invalid of [undefined,false,0,'',[],['record']])test('invalid full root '+String(invalid)+' never becomes empty',async()=>{const f=fixture();f.values['sisventas/gastos']=invalid;await a.rejects(f.run(),{code:'SV_SALE_FINANCIAL_INCOMPLETE'});});
for(const invalid of [false,0,[],null])test('malformed employee account '+String(invalid)+' never becomes no movements',async()=>{const f=fixture();f.values['sisventas/ctaemp']={employee:invalid};await a.rejects(f.run(),{code:'SV_SALE_FINANCIAL_INCOMPLETE'});});
for(const parent of ['sv_client_history','sv_client_history_config','sv_sale_financial_dependencies'])test('partial or installed namespace '+parent+' denies before source reads',async()=>{const f=fixture();f.present.add(parent);await a.rejects(f.run(),{code:'SV_SALE_DELETE_LIVE_ABSENCE_REQUIRED'});a.equal(f.reads.some(path=>roots.includes(path)),false);});
for(const value of [{},false,undefined])test('config point must be exactly null: '+String(value),async()=>{const f=fixture();f.values.sv_client_history_config=value;await a.rejects(f.run(),{code:'SV_SALE_DELETE_LIVE_ABSENCE_REQUIRED'});a.equal(f.reads.length,1);});
test('absence errors and non-boolean existence values are denied and drained',async()=>{
 for(const invalid of ['error',null,undefined,0]){const f=fixture();let active=0;
  f.control.existsHook=async path=>{active++;try{await wait(path==='sv_client_history'?1:4);if(path==='sv_client_history'){if(invalid==='error')throw Error('private failure');return invalid;}return false;}finally{active--;}};
  await a.rejects(f.run(),{code:'SV_SALE_DELETE_LIVE_ABSENCE_REQUIRED'});a.equal(active,0);
 }
});
test('installed namespace in a later phase cannot reuse a previous absence result',async()=>{const f=fixture();await f.run();f.present.add('sv_sale_financial_dependencies');await a.rejects(f.run(),{code:'SV_SALE_DELETE_LIVE_ABSENCE_REQUIRED'});});
test('source I/O failures drain all five readers; no pending work after rejection',async()=>{
 const f=fixture();let active=0,peak=0,finished=0;f.control.hook=async path=>{if(!roots.includes(path))return;active++;peak=Math.max(peak,active);try{await wait(path==='sisventas/gastos'?1:5);if(path==='sisventas/gastos')throw Error('source failure');}finally{active--;finished++;}};
 await a.rejects(f.run(),/source failure/);a.equal(active,0);a.equal(peak,5);a.equal(finished,5);await wait(8);a.equal(finished,5);
});
test('oversize root is rejected without truncation or writes',async()=>{const f=fixture();f.values['sisventas/gastos']={entry:{nota:'x'.repeat(16*1024*1024)}};await a.rejects(f.run(),{code:'SV_SALE_DELETE_LIVE_SCOPE_SIZE',statusCode:413});});
test('missing operation identity and missing target original fail closed',async()=>{const f=fixture();await a.rejects(f.provider({...f.args,operationId:undefined}),{code:'SV_SALE_FINANCIAL_INCOMPLETE'});f.values['sisventas/ventas']={};await a.rejects(f.run(),{code:'SV_SALE_FINANCIAL_INCOMPLETE'});});
