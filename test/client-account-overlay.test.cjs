'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{overlay,compiledOverlay}=require('../cotizador/client-account-projections');
test('indexed overlay preserves exact patch order for parents, siblings, descendants and removals',()=>{
 const entries=[['root/a/x',1],['root',{a:{parent:true,x:3},b:2}],['root/a/y',{nested:5}],['root/a/x',null]];
 for(const selected of [entries,entries.slice().reverse(),[entries[1],entries[3],entries[2]],entries.slice(0,2)]){
  const patch=Object.fromEntries(selected),before=structuredClone(patch),read=compiledOverlay(patch);
  for(const path of ['root','root/a','root/a/x','root/a/y','root/a/y/nested','root/b','unrelated']){const value={keep:true};assert.deepEqual(read(path,value),overlay(path,value,patch),path);assert.deepEqual(value,{keep:true});}
  assert.deepEqual(patch,before);
 }
});
test('many point reads enumerate the fixed patch once rather than scanning every unrelated destination again',()=>{
 let enumerations=0;const data=Object.fromEntries(Array.from({length:10000},(_,n)=>['unrelated/'+n+'/value',n]));data['members/client/one']={key:'s'};data['sources/s']={amountCents:12345};
 const patch=new Proxy(data,{ownKeys(target){enumerations++;return Reflect.ownKeys(target);}}),read=compiledOverlay(patch);assert.equal(enumerations,1);
 for(let n=0;n<1000;n++){assert.deepEqual(read('members/client',null),{one:{key:'s'}});assert.equal(read('sources/s',null).amountCents,12345);}
 assert.equal(enumerations,1);
});
test('one returned overlay can be edited without changing its source or another point read',()=>{
 const source={root:{child:{amount:7}}},read=compiledOverlay(source),first=read('root/child',null);first.amount=900;assert.deepEqual(read('root/child',null),{amount:7});assert.equal(source.root.child.amount,7);
});
