'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),State=require('../cotizador/ot-material-state');
const {digest}=require('../cotizador/labor-guard');
function resolver(onIdentity){return async(original,ports)=>{onIdentity?.(original);await ports.identifyOriginal?.(original.record,original.selector);const path='sisventas/productos',options={orderBy:'codigo',equalTo:'FICTION',limitToFirst:65},rows=await ports.queryPage(path,options);await ports.trackQueryPage(path,options,rows);return {mapped:true,productKey:'p',inventoryKey:'physical',receiptIdentityKey:'historical',mappingRevision:1,readSet:[{kind:'range',path,options,hash:digest(rows)}],rows};};}
test('siblings share only a full planning query while original identity is verified for each row',async()=>{
 let reads=0,identities=0;const seen=[],op=State.referenceOperation(resolver(original=>seen.push(original.selector)),{queryPage:async()=>{reads++;return{p:{codigo:'FICTION'}};}}),ports={identifyOriginal:async()=>{identities++;}};
 const a=await op.resolve({selector:0,record:{materials:['a','b']}},ports);a.rows.p.codigo='CLIENT_MUTATION';const b=await op.resolve({selector:1,record:{materials:['a','b']}},ports);assert.equal(b.rows.p.codigo,'FICTION');assert.equal(reads,1);assert.equal(identities,2);assert.deepEqual(seen,[0,1]);
 let fresh=0;await op.assertFresh(async()=>{fresh++;return{p:{codigo:'FICTION'}};});assert.equal(fresh,1);await op.resolve({selector:0,record:{materials:['a','b']}},ports);assert.equal(reads,2,'commit-phase resolution must issue a new range read');assert.equal(identities,3);
});
test('a changed range is rejected fresh and another operation cannot inherit planning pages',async()=>{
 let value={p:{codigo:'FICTION'}},reads=0;const store={queryPage:async()=>{reads++;return structuredClone(value);}},callback=resolver(),op=State.referenceOperation(callback,store);await op.resolve({selector:0,record:{}},{});value={p:{codigo:'FICTION'},new:{codigo:'FICTION'}};await assert.rejects(op.assertFresh(store.queryPage),{code:'SV_OT_MATERIAL_REVIEW'});const other=State.referenceOperation(callback,store),result=await other.resolve({selector:0,record:{}},{});assert(result.rows.new);assert.equal(reads,3);
});
test('fresh directed queries use at most six slots and drain the started batch on rejection',async()=>{
 const callback=async(original,ports)=>{for(let i=0;i<18;i++){const path='sisventas/productos',options={orderBy:'codigo',equalTo:'F'+i,limitToFirst:65},rows=await ports.queryPage(path,options);await ports.trackQueryPage(path,options,rows);}return {mapped:true};},op=State.referenceOperation(callback,{queryPage:async()=>({})});await op.resolve({selector:0,record:{}},{});
 let active=0,max=0,finished=0,calls=0;await assert.rejects(op.assertFresh(async(_path,options)=>{calls++;active++;max=Math.max(max,active);try{await new Promise(r=>setTimeout(r,options.equalTo==='F0'?1:20));if(options.equalTo==='F0')throw Error('Fictitious query denied');return{};}finally{active--;finished++;}}),/Fictitious query denied/);assert.equal(active,0);assert.equal(max,6);assert.equal(calls,6);assert.equal(finished,6);
});
test('OFF performs its legacy callback on every call without querying or creating range checks',async()=>{
 let calls=0;const op=State.referenceOperation(async(_original,ports)=>ports.legacy(),{queryPage:()=>assert.fail('OFF read')}),ports={legacy:async()=>({mapped:false,value:++calls,readSet:[]})};assert.equal((await op.resolve({},ports)).value,1);assert.equal((await op.resolve({},ports)).value,2);await op.assertFresh(()=>assert.fail('OFF fresh query'));assert.equal(calls,2);
});
