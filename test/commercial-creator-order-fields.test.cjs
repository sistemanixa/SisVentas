'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../cotizador/commercial-pages-model'),L=require('../cotizador/commercial-creator-latest');
const fields=['schema','rawDate','loaderTime','loaderTs'];
function permutations(keys){return keys.length?keys.flatMap((k,i)=>permutations(keys.filter((_,j)=>j!==i)).map(t=>[k,...t])):[[]];}
async function fixture(){
 const built=await M.build({sales:{p:{id:'V-FICTICIA',creadaPor:'Ana',responsableUid:'u',fecha:'2026-11-04',ts:100,total:12.34,items:[]}},owner:()=> 'u'}),state=built.patch,row=state[M.ROOT+'/records/sales/p'];
 const read=async p=>{assert(p.startsWith(M.ROOT+'/'));if(Object.hasOwn(state,p))return state[p];const entries=Object.entries(state).filter(([k,v])=>k.startsWith(p+'/')&&v!=null);return entries.length?Object.fromEntries(entries.map(([k,v])=>[k.slice(p.length+1),v])):null;};
 return {row,state,latest:()=>L.readLatest({read,scope:'u_u',creator:'Ana',month:'2026-11',locale:'es-AR',expectedLocale:'es-AR'})};
}
for(const order of permutations(fields))test('equivalent creatorOrder property permutation is accepted: '+order.join(','),async()=>{
 const f=await fixture(),original=f.row.creatorOrder;f.row.creatorOrder=Object.fromEntries(order.map(k=>[k,original[k]]));const result=await f.latest();assert.equal(result.count,1);assert.deepEqual(result.rows.map(r=>r.key),['p']);assert.equal(result.rows[0].totalCents,1234);
});
test('closed null-prototype object with equivalent own fields is valid',async()=>{const f=await fixture();f.row.creatorOrder=Object.assign(Object.create(null),f.row.creatorOrder);assert.equal((await f.latest()).count,1);});
const invalidObjects={null:()=>null,undefined:()=>undefined,array:o=>Object.assign([],o),string:()=> 'invalid',number:()=>1,boolean:()=>true,function:o=>Object.assign(()=>{},o),date:o=>Object.assign(new Date(0),o),boxedNumber:o=>Object.assign(new Number(1),o),map:o=>Object.assign(new Map(),o),inherited:o=>Object.create(o),extra:o=>({...o,extra:1}),extraUndefined:o=>({...o,extra:undefined}),extraSymbol:o=>({...o,[Symbol('extra')]:1}),extraHidden:o=>Object.defineProperty({...o},'extra',{value:1,enumerable:false})};
for(const [name,edit]of Object.entries(invalidObjects))test('creatorOrder rejects invalid object or extra own key: '+name,async()=>{const f=await fixture();f.row.creatorOrder=edit(f.row.creatorOrder);await assert.rejects(f.latest(),{code:'SV_CREATOR_LATEST_NOT_READY'});});
for(const field of fields)test('creatorOrder rejects missing canonical own field: '+field,async()=>{const f=await fixture();delete f.row.creatorOrder[field];await assert.rejects(f.latest(),{code:'SV_CREATOR_LATEST_NOT_READY'});});
for(const field of fields)test('creatorOrder rejects altered canonical value: '+field,async()=>{const f=await fixture();f.row.creatorOrder[field]=field==='rawDate'?'2026-11-03':f.row.creatorOrder[field]+1;await assert.rejects(f.latest(),{code:'SV_CREATOR_LATEST_NOT_READY'});});
const invalidValues={schema:['1',true,null,undefined],rawDate:[20261104,null,undefined,new String('2026-11-04')],loaderTime:['1793750400000',null,undefined,NaN,Infinity,1n],loaderTs:['100',false,null,undefined,NaN,Infinity,100n]};
for(const [field,values]of Object.entries(invalidValues))for(const [i,value]of values.entries())test('creatorOrder rejects invalid canonical field type: '+field+'/'+i,async()=>{const f=await fixture();f.row.creatorOrder[field]=value;await assert.rejects(f.latest(),{code:'SV_CREATOR_LATEST_NOT_READY'});});
