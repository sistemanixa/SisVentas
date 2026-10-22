'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {build,hash,BASELINE_HASH}=require('../scripts/prepare-bonus-history-index.cjs');
const clone=value=>structuredClone(value);
function fixture(index=['empleadoId','empleadoFbKey','ventaFbKey','ventaId','venta']){
 return {rules:{'.read':false,'.write':false,sisventas:{'.write':false,gastos:{'.read':'existing read','.write':'existing write','.indexOn':index,$gasto:{'.validate':'existing validation',bajaAdministrativa:{'.write':'existing removal'}}},config:{'.write':false,$config:{'.read':'existing config read','.write':'existing config write'}},pagos:{'.read':'existing payment read','.write':'existing payment write'},ctaemp:{'.read':'existing account read','.write':'existing account write'},haberes:{'.read':'existing salary read','.write':'existing salary write'}},sv_labor_indexes:{'.read':'existing index read','.write':'existing index write'},sv_labor_receipts:{$op:{'.write':'existing receipt write'}}}};
}
function changes(a,b,p='',result=[]){if(JSON.stringify(a)===JSON.stringify(b))return result;const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);if(obj(a)||obj(b))for(const key of new Set([...Object.keys(a||{}),...Object.keys(b||{})]))changes(a?.[key],b?.[key],p?p+'/'+key:key,result);else result.push(p);return result;}
test('adds exactly one query index while preserving all permissions, removal rules and unrelated domains',()=>{
 const input=fixture(),before=clone(input),result=build(input,{expectedHash:hash(input)});assert.deepEqual(input,before);assert.deepEqual(changes(input,result),['rules/sisventas/gastos/.indexOn']);
 assert.deepEqual(result.rules.sisventas.gastos['.indexOn'],[...before.rules.sisventas.gastos['.indexOn'],'tipoPagable']);delete result.rules.sisventas.gastos['.indexOn'];delete before.rules.sisventas.gastos['.indexOn'];assert.deepEqual(result,before);
});
test('does not retain shared references to the input or its unrelated rules',()=>{
 const input=fixture(),result=build(input,{expectedHash:hash(input)});result.rules.sisventas.config.$config['.read']='changed by consumer';result.rules.sisventas.gastos['.indexOn'].push('another');assert.equal(input.rules.sisventas.config.$config['.read'],'existing config read');assert.equal(input.rules.sisventas.gastos['.indexOn'].includes('another'),false);
});
for(const index of [undefined,'empleadoId',[],['empleadoId','empleadoId']])test('preserves supported prior index shape '+JSON.stringify(index),()=>{
 const input=fixture();if(index===undefined)delete input.rules.sisventas.gastos['.indexOn'];else input.rules.sisventas.gastos['.indexOn']=index;
 const result=build(input,{expectedHash:hash(input)}),expected=index===undefined?[]:typeof index==='string'?[index]:index;assert.deepEqual(result.rules.sisventas.gastos['.indexOn'],[...expected,'tipoPagable']);
});
for(const index of ['tipoPagable',['empleadoId','tipoPagable']])test('an explicitly reviewed indexed base is idempotent '+JSON.stringify(index),()=>{
 const input=fixture(index),result=build(input,{expectedHash:hash(input)});assert.deepEqual(result,input);assert.deepEqual(changes(input,result),[]);
});
for(const index of [null,0,false,{},['empleadoId',null],[''],['   ']])test('rejects malformed indexes without mutation '+JSON.stringify(index),()=>{
 const input=fixture(index),before=clone(input);assert.throws(()=>build(input,{expectedHash:hash(input)}),/Índices/);assert.deepEqual(input,before);
});
test('defaults to the currently reviewed expense-only baseline, never an unreviewed input',()=>{
 assert.equal(BASELINE_HASH,'dc05032cdfbcc5976a871d414f60b2920e709d248496474aff7c0d9b087df39a');const input=fixture(),before=clone(input);assert.throws(()=>build(input),/Base/);assert.throws(()=>build(input,{expectedHash:'a'.repeat(64)}),/Base/);assert.deepEqual(input,before);
});
for(const input of [null,{},[],{rules:[]},{rules:{sisventas:{}}},{rules:{sisventas:{gastos:[]}}}])test('rejects absent or malformed rule sources '+JSON.stringify(input),()=>{
 assert.throws(()=>build(input,{expectedHash:hash(input)}),/Base|Gastos/);
});
test('import and CLI rejection are offline: no file reads, writes, auth, network or process launch during import',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../scripts/prepare-bonus-history-index.cjs'),'utf8'),calls=[];
 const module={exports:{}},context={module,require:specifier=>{if(specifier==='node:fs')return new Proxy({},{get(_o,key){calls.push('fs.'+String(key));throw Error('No filesystem effects during import');}});if(specifier==='node:crypto')return require(specifier);if(specifier==='node:path')return require(specifier);throw Error('Unexpected dependency '+specifier);},structuredClone,console:{log(){calls.push('log');}},process:{argv:[]}};
 vm.runInNewContext(source,context);assert.equal(typeof module.exports.build,'function');assert.deepEqual(calls,[]);
});
