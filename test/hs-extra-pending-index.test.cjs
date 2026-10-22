'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Builder=require('../scripts/prepare-hs-extra-pending-index.cjs');
const clone=value=>structuredClone(value),own=(value,key)=>Object.hasOwn(value,key);
function fixture(index=['empFbKey','fecha']){
 return {rules:{'.read':false,'.write':false,sisventas:{'.read':false,'.write':false,hsextra_solicitudes:{'.read':'existing request read','.write':'existing request write','.indexOn':index,$request:{'.validate':'existing request validation',estado:{'.write':'existing approval write'},pagos:{'.validate':'existing payment validation'}}},config:{'.write':false,$config:{'.read':'existing config read','.write':'existing config write'}},gastos:{'.read':'existing expense read','.write':'existing expense write','.indexOn':['tipoPagable']},ctaemp:{'.read':'existing account read','.write':'existing account write'},haberes:{'.read':'existing salary read','.write':'existing salary write'}},sv_labor_indexes:{'.read':'existing index read','.write':'existing index write'},sv_labor_receipts:{$op:{'.write':'existing receipt restrictions'}}}};
}
function changes(a,b,p='',result=[]){if(JSON.stringify(a)===JSON.stringify(b))return result;const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);if(obj(a)||obj(b))for(const key of new Set([...Object.keys(a||{}),...Object.keys(b||{})]))changes(a?.[key],b?.[key],p?p+'/'+key:key,result);else result.push(p);return result;}
const reviewed=input=>({expectedHash:Builder.hash(input)});

test('adds only estado index and preserves every permission, validation, ancestor and unrelated index',()=>{
 const input=fixture(),before=clone(input),result=Builder.build(input,reviewed(input));
 assert.deepEqual(input,before);assert.deepEqual(changes(input,result),['rules/sisventas/hsextra_solicitudes/.indexOn']);
 assert.deepEqual(result.rules.sisventas.hsextra_solicitudes['.indexOn'],['empFbKey','fecha','estado']);
 delete result.rules.sisventas.hsextra_solicitudes['.indexOn'];delete before.rules.sisventas.hsextra_solicitudes['.indexOn'];assert.deepEqual(result,before);
});
test('clones all branches without retaining shared references to the source',()=>{
 const input=fixture(),result=Builder.build(input,reviewed(input));result.rules.sisventas.config.$config['.read']='changed by consumer';result.rules.sisventas.gastos['.indexOn'].push('another');result.rules.sisventas.hsextra_solicitudes['.indexOn'].push('another');
 assert.equal(input.rules.sisventas.config.$config['.read'],'existing config read');assert.deepEqual(input.rules.sisventas.gastos['.indexOn'],['tipoPagable']);assert.deepEqual(input.rules.sisventas.hsextra_solicitudes['.indexOn'],['empFbKey','fecha']);
});
for(const index of [undefined,'empFbKey',[],['empFbKey','empFbKey'],['fecha','empleado/id','.value']])test('preserves every prior index while supporting shape '+JSON.stringify(index),()=>{
 const input=fixture();if(index===undefined)delete input.rules.sisventas.hsextra_solicitudes['.indexOn'];else input.rules.sisventas.hsextra_solicitudes['.indexOn']=index;
 const before=clone(input),result=Builder.build(input,reviewed(input)),expected=index===undefined?[]:typeof index==='string'?[index]:index;
 assert.deepEqual(result.rules.sisventas.hsextra_solicitudes['.indexOn'],[...expected,'estado']);assert.deepEqual(input,before);
});
for(const index of ['estado',['estado'],['empFbKey','estado'],['estado','estado','fecha']])test('reviewed indexed sources remain byte-equivalent and idempotent: '+JSON.stringify(index),()=>{
 const input=fixture(index),text=JSON.stringify(input),result=Builder.build(input,reviewed(input));assert.equal(JSON.stringify(result),text);assert.deepEqual(changes(input,result),[]);assert.notEqual(result,input);
 const again=Builder.build(result,reviewed(result));assert.equal(JSON.stringify(again),text);assert.equal(JSON.stringify(input),text);
});
test('a newly indexed result is idempotent only after explicitly reviewing its new hash',()=>{
 const input=fixture(),result=Builder.build(input,reviewed(input)),before=clone(input);assert.throws(()=>Builder.build(result,reviewed(input)),/Base/);assert.deepEqual(Builder.build(result,reviewed(result)),result);assert.deepEqual(input,before);
});
for(const index of [null,0,false,{},'', '   ',['empFbKey',null],[''],['   '],['empFbKey',3],Array(1)])test('rejects invalid index without changing the reviewed source: '+JSON.stringify(index),()=>{
 const input=fixture(index),before=clone(input);assert.throws(()=>Builder.build(input,reviewed(input)),/Índices/);assert.deepEqual(input,before);
});
test('the default pins published7 and refuses an unreviewed or mismatched source',()=>{
 assert.equal(Builder.BASELINE_HASH,'cf03c8023e13b0eebb28419c84b6ada82524f79e7f12e40dfa68c23ed0e3b064');const input=fixture(),before=clone(input);
 assert.throws(()=>Builder.build(input),/Base/);assert.throws(()=>Builder.build(input,{expectedHash:'a'.repeat(64)}),/Base/);assert.deepEqual(input,before);
});
for(const hash of ['',null,0,'A'.repeat(64),'a'.repeat(63),'a'.repeat(65)])test('rejects malformed expected hash '+JSON.stringify(hash),()=>assert.throws(()=>Builder.build(fixture(),{expectedHash:hash}),/Base/));
for(const input of [null,undefined,{},[],{rules:[]},{rules:{}},{rules:{sisventas:[]}},{rules:{sisventas:{}}},{rules:{sisventas:{hsextra_solicitudes:null}}},{rules:{sisventas:{hsextra_solicitudes:[]}}},{rules:{sisventas:{hsextra_solicitudes:'unexpected'}}}])test('rejects absent or malformed object '+JSON.stringify(input),()=>{
 assert.throws(()=>Builder.build(input,{expectedHash:input===undefined?'0'.repeat(64):Builder.hash(input)}),/Base|solicitudes/);
});

const script=fs.readFileSync(path.join(__dirname,'../scripts/prepare-hs-extra-pending-index.cjs'),'utf8');
function sandbox({args,files={},main=false,platform='win32'}={}){
 const module={exports:{}},calls=[],content=new Map(Object.entries(files)),printed=[];
 const localFs={readFileSync(name,encoding){calls.push(['read',name,encoding]);if(!content.has(name))throw Error('Fixture source missing');return content.get(name);},writeFileSync(name,text,options){calls.push(['write',name,options]);assert.deepEqual(JSON.parse(JSON.stringify(options)),{flag:'wx'});if(content.has(name))throw Object.assign(Error('Fixture target exists'),{code:'EEXIST'});content.set(name,text);}};
 function requireOnly(name){if(name==='node:fs')return localFs;if(name==='node:crypto'||name==='node:path')return require(name);throw Error('Unexpected dependency '+name);}
 requireOnly.main=main?module:{};
 const context={module,require:requireOnly,structuredClone,process:{argv:['node','builder',...(args||[])],platform},console:{log:text=>printed.push(text)}};
 return {module,calls,content,printed,run:()=>vm.runInNewContext(script,context)};
}
test('import is pure: no file access, process launch, credential or network dependency',()=>{
 const f=sandbox();f.run();assert.equal(typeof f.module.exports.build,'function');assert.deepEqual(f.calls,[]);assert.deepEqual(f.printed,[]);
});
for(const args of [[],['base.json','out.candidate.json'],['base.json','out.json','a'.repeat(64)],['base.json','out.candidate.json','bad'],['base.json','out.candidate.json','a'.repeat(64),'extra'],['C:/fixture/base.candidate.json','c:/fixture/base.candidate.json','a'.repeat(64)]])test('CLI refuses invalid arguments before any file access: '+JSON.stringify(args),()=>{
 const f=sandbox({args,main:true});assert.throws(f.run,/Uso/);assert.deepEqual(f.calls,[]);assert.deepEqual(f.printed,[]);
});
test('CLI produces only a separate candidate with mandatory reviewed hash and leaves source byte-identical',()=>{
 const input=fixture(),source='base.json',target='out.candidate.json',text=JSON.stringify(input,null,1),f=sandbox({main:true,args:[source,target,Builder.hash(input)],files:{[source]:text}});f.run();
 assert.equal(f.content.get(source),text);assert.deepEqual(JSON.parse(f.content.get(target)),Builder.build(input,reviewed(input)));assert.equal(f.calls.filter(c=>c[0]==='read').length,1);assert.equal(f.calls.filter(c=>c[0]==='write').length,1);assert.equal(f.printed.length,1);assert.match(f.printed[0],/Sin aplicar.*SHA256 [a-f0-9]{64}$/);
});
test('CLI rejects mismatched or invalid JSON sources without creating a candidate',()=>{
 for(const text of [JSON.stringify(fixture()),'{bad-json']){const f=sandbox({main:true,args:['base.json','out.candidate.json','a'.repeat(64)],files:{'base.json':text}});assert.throws(f.run);assert.equal(f.content.has('out.candidate.json'),false);assert.equal(f.calls.some(c=>c[0]==='write'),false);assert.equal(f.content.get('base.json'),text);}
});
test('CLI never overwrites an existing candidate, even if it aliases the input',()=>{
 const input=fixture(),source='base.json',target='out.candidate.json',text=JSON.stringify(input),f=sandbox({main:true,args:[source,target,Builder.hash(input)],files:{[source]:text,[target]:text}});assert.throws(f.run,{code:'EEXIST'});assert.equal(f.content.get(source),text);assert.equal(f.content.get(target),text);assert.deepEqual(f.printed,[]);
});
