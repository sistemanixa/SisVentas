'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const B=require('../scripts/prepare-activity-date-index.cjs');
const fixture=()=>({rules:{'.read':false,'.write':false,sisventas:{'.read':false,'.write':false,log_actividad:{'.read':'existing activity authorization','.write':'existing activity write',$entry:{'.validate':'existing activity validation'}},gastos:{'.read':'existing expense read','.write':'existing expense write'},ctaemp:{'.read':'existing account read'}},sv_labor_guard:{'.write':'mandatory guard',$lease:{'.validate':'mandatory lease'}},sv_labor_receipts:{$op:{'.write':'existing receipt'}}}});
const reviewed=input=>({expectedHash:B.hash(input)});
function differences(a,b,p=''){if(JSON.stringify(a)===JSON.stringify(b))return[];const object=x=>x&&typeof x==='object'&&!Array.isArray(x);return object(a)&&object(b)?[...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>differences(a[k],b[k],p?p+'/'+k:k)):[p];}
test('adds only the fecha index and preserves every permission, validation and guard',()=>{
 const source=fixture(),before=structuredClone(source),result=B.build(source,reviewed(source));
 assert.deepEqual(source,before);assert.deepEqual(differences(source,result),['rules/sisventas/log_actividad/.indexOn']);assert.deepEqual(result.rules.sisventas.log_actividad['.indexOn'],['fecha']);
 delete result.rules.sisventas.log_actividad['.indexOn'];assert.deepEqual(result,before);
});
for(const old of ['timestamp',['timestamp'],[],['fecha'],['timestamp','fecha'],'fecha'])test('preserves existing index values and is idempotent: '+JSON.stringify(old),()=>{
 const source=fixture();source.rules.sisventas.log_actividad['.indexOn']=old;
 const result=B.build(source,reviewed(source));
 assert.deepEqual(result.rules.sisventas.log_actividad['.indexOn'],old==='fecha'||Array.isArray(old)&&old.includes('fecha')?old:(Array.isArray(old)?old:[old]).concat('fecha'));
 assert.deepEqual(B.build(result,reviewed(result)),result);
 if(B.hash(result)!==B.hash(source))assert.throws(()=>B.build(result,reviewed(source)));
});
for(const old of [null,{},42,['timestamp',null],['timestamp',''],['timestamp',42],['timestamp',{}]])test('rejects malformed index metadata '+JSON.stringify(old),()=>{
 const source=fixture();source.rules.sisventas.log_actividad['.indexOn']=old;assert.throws(()=>B.build(source,reviewed(source)),/Índices/);
});
test('requires explicit reviewed hash even for a valid source and refuses altered rules',()=>{
 const source=fixture();assert.throws(()=>B.build(source));assert.throws(()=>B.build(source,{expectedHash:B.BASELINE_HASH}));assert.throws(()=>B.build(source,{expectedHash:'bad'}));
 const changed=structuredClone(source);changed.rules.sisventas.log_actividad['.read']=true;assert.throws(()=>B.build(changed,reviewed(source)));
 for(const value of [null,{},[],{rules:{}},{rules:{sisventas:{}}},{rules:{sisventas:{log_actividad:[]}}}])assert.throws(()=>B.build(value,reviewed(value)));
});
test('semantic hash ignores object property order while retaining array order and values',()=>{
 const first={z:1,a:{d:2,c:3},i:['fecha','timestamp']},second={i:['fecha','timestamp'],a:{c:3,d:2},z:1};assert.equal(B.hash(first),B.hash(second));assert.notEqual(B.hash(first),B.hash({...second,i:['timestamp','fecha']}));
 assert.equal(B.SOURCE_BASELINE_HASH,'29cb92156619a52ab8905c524190f622740e1a1865128978aac21811ca3dc61f');assert.equal(B.BASELINE_HASH,'ce74aa228ffe88cc6c2c8aeaf84dff262a90576a89fd863d141a19db396f0f07');
});
const script=fs.readFileSync(path.resolve(__dirname,'../scripts/prepare-activity-date-index.cjs'),'utf8');
function sandbox(args,files={}){
 const module={exports:{}},stored=new Map(Object.entries(files)),calls=[];
 function requireOnly(name){
  if(name==='node:fs')return{readFileSync(p){calls.push('read');if(!stored.has(p))throw Error('absent');return stored.get(p);},writeFileSync(p,value,options){calls.push('write');assert.deepEqual(JSON.parse(JSON.stringify(options)),{flag:'wx'});if(stored.has(p))throw Object.assign(Error('exists'),{code:'EEXIST'});stored.set(p,value);}};
  if(['node:path','node:crypto'].includes(name))return require(name);throw Error('Unexpected dependency '+name);
 }
 requireOnly.main=module;return{stored,calls,run:()=>vm.runInNewContext(script,{module,require:requireOnly,structuredClone,process:{argv:['node','index',...args],platform:'win32'},console:{log(){}}})};
}
test('CLI creates one separate candidate with mandatory semantic hash; never overwrites source or target',()=>{
 const source=fixture(),text=JSON.stringify(source),args=['base.json','out.candidate.json',B.hash(source)],f=sandbox(args,{'base.json':text});f.run();assert.equal(f.stored.get('base.json'),text);assert.deepEqual(JSON.parse(f.stored.get('out.candidate.json')),B.build(source,reviewed(source)));
 const existing=sandbox(args,{'base.json':text,'out.candidate.json':'keep'});assert.throws(existing.run,{code:'EEXIST'});assert.equal(existing.stored.get('out.candidate.json'),'keep');
});
for(const args of [[],['base.json','out.candidate.json'],['base.json','out.json','a'.repeat(64)],['base.candidate.json','BASE.candidate.json','a'.repeat(64)],['base.json','out.candidate.json','bad'],['base.json','out.candidate.json','a'.repeat(64),'extra']])test('CLI refuses invalid arguments before file access '+JSON.stringify(args),()=>{
 const f=sandbox(args);assert.throws(f.run,/Uso offline/);assert.deepEqual(f.calls,[]);
});
