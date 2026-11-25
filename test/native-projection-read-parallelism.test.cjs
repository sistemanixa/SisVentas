'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../cotizador/commercial-pages-model');
test('native commercial delta keeps bounded parallel reads and identical financial output',async()=>{
 const sales=Object.fromEntries(Array.from({length:8},(_,i)=>['s'+i,{id:'V-'+i,total:100.01,subtotal:100.01,clienteFbKey:'c'+i,cliente:'Cliente ficticio '+i,fecha:'2026-11-01'}]));
 const before=structuredClone(sales),base=await M.build({sales,payments:{},owner:()=> 'owner',generation:'native-read-fixture'}),old=base.patch[M.ROOT+'/records/sales/s0'],after={...structuredClone(old),notes:'Nota ficticia'};
 const changes=[{kind:'sales',key:'s0',before:old,after}],read=async path=>structuredClone(base.patch[path]??null),expected=await M.delta(changes,{read,generation:'native-read-fixture',revision:2});
 let active=0,maximum=0;const counts=new Map();const actual=await M.delta(changes,{generation:'native-read-fixture',revision:2,read:async path=>{counts.set(path,(counts.get(path)||0)+1);active++;maximum=Math.max(maximum,active);try{await new Promise(resolve=>setImmediate(resolve));return read(path);}finally{active--;}}});
 assert.deepEqual(actual,expected);assert.deepEqual(sales,before);assert.ok(maximum>1&&maximum<=6);assert.ok([...counts.values()].every(n=>n===1));assert.equal(active,0);
});
test('failure of a prefetched native commercial dependency rejects the whole delta',async()=>{
 const row=M.saleRow('sale',{id:'V-FICTICIA',total:100,subtotal:100,cliente:'Cliente ficticio',fecha:'2026-11-01'},[],{ownerUid:'owner'}),before=structuredClone(row),error=Error('Fictitious dependency unavailable');let active=0,completed=0;
 await assert.rejects(M.delta([{kind:'sales',key:'sale',before:null,after:row}],{generation:'native-read-fixture',revision:1,read:async path=>{active++;try{await new Promise(resolve=>setImmediate(resolve));if(path===M.ROOT+'/totals/all')throw error;return null;}finally{active--;completed++;}}}),value=>value===error);
 assert.equal(active,0);assert.ok(completed>1);assert.deepEqual(row,before);
});
