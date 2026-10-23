'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=require('../scripts/prepare-dashboard-hours-index.cjs');
const fixture=()=>({rules:{'.read':false,'.write':false,sisventas:{'.read':false,'.write':false,hsextra_solicitudes:{'.read':'existing root authorization','.write':'existing fenced write','.indexOn':['estado'], $request:{'.validate':'existing validation'}},gastos:{'.read':'existing expense read','.write':'existing expense write'},ctaemp:{'.read':'existing account read'}},sv_labor_receipts:{$op:{'.write':'existing receipt'}}}});
const reviewed=input=>({expectedHash:B.hash(input)});
function differences(a,b,p=''){if(JSON.stringify(a)===JSON.stringify(b))return[];const object=x=>x&&typeof x==='object'&&!Array.isArray(x);return object(a)&&object(b)?[...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>differences(a[k],b[k],p?p+'/'+k:k)):[p];}
test('adds only empFbKey index while preserving estado, every read/write/validation and source',()=>{
  const source=fixture(),before=structuredClone(source),result=B.build(source,reviewed(source));assert.deepEqual(source,before);
  assert.deepEqual(differences(source,result),['rules/sisventas/hsextra_solicitudes/.indexOn']);assert.deepEqual(result.rules.sisventas.hsextra_solicitudes['.indexOn'],['estado','empFbKey']);
  delete result.rules.sisventas.hsextra_solicitudes['.indexOn'];delete before.rules.sisventas.hsextra_solicitudes['.indexOn'];assert.deepEqual(result,before);
});
test('preserves existing indexes/order and is idempotent only with the reviewed new hash',()=>{
  const source=fixture();source.rules.sisventas.hsextra_solicitudes['.indexOn'].push('fecha');const result=B.build(source,reviewed(source));assert.deepEqual(result.rules.sisventas.hsextra_solicitudes['.indexOn'],['estado','fecha','empFbKey']);
  assert.throws(()=>B.build(result,reviewed(source)));assert.deepEqual(B.build(result,reviewed(result)),result);
});
test('default pins published8 and unreviewed input is refused',()=>{assert.equal(B.BASELINE_HASH,'4a859ae7ac48ff46554dcbc2b35ca9dab3057794630758b4674c1cf8c856c8a7');assert.throws(()=>B.build(fixture()));});
for(const value of [undefined,null,{},'estado',[],['fecha'],['estado',null],['estado','']])test('malformed index is refused: '+JSON.stringify(value),()=>{
  const source=fixture();source.rules.sisventas.hsextra_solicitudes['.indexOn']=value;assert.throws(()=>B.build(source,reviewed(source)),/Índices/);
});
const script=fs.readFileSync(path.join(__dirname,'../scripts/prepare-dashboard-hours-index.cjs'),'utf8');
function sandbox(args,files={}){
  const module={exports:{}},stored=new Map(Object.entries(files)),calls=[];function requireOnly(name){if(name==='node:fs')return{readFileSync(p){calls.push('read');return stored.get(p);},writeFileSync(p,value,options){calls.push('write');assert.deepEqual(JSON.parse(JSON.stringify(options)),{flag:'wx'});if(stored.has(p))throw Object.assign(Error('exists'),{code:'EEXIST'});stored.set(p,value);}};if(['node:path','node:crypto'].includes(name))return require(name);throw Error('Unexpected dependency');}
  requireOnly.main=module;return{stored,calls,run:()=>vm.runInNewContext(script,{module,require:requireOnly,structuredClone,process:{argv:['node','index',...args]},console:{log(){}}})};
}
test('CLI creates only a separate candidate and never overwrites existing paths',()=>{
  const source=fixture(),text=JSON.stringify(source),args=['base.json','out.candidate.json',B.hash(source)],f=sandbox(args,{'base.json':text});f.run();assert.equal(f.stored.get('base.json'),text);assert.deepEqual(JSON.parse(f.stored.get('out.candidate.json')),B.build(source,reviewed(source)));
  const same=sandbox(['BASE.candidate.json','base.candidate.json']);assert.throws(same.run,/Uso/);assert.deepEqual(same.calls,[]);
  const existing=sandbox(args,{'base.json':text,'out.candidate.json':'keep'});assert.throws(existing.run,{code:'EEXIST'});assert.equal(existing.stored.get('out.candidate.json'),'keep');
});
