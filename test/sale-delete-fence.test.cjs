'use strict';
const saleHash=value=>{const original=structuredClone(value);if(original)delete original.fbKey;return require('../cotizador/labor-guard').digest(original);};
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createSaleDeleteCommand}=require('../cotizador/sale-delete-command');
const {createSaleDeleteHttpAdapter,PATH}=require('../cotizador/sale-delete-http-adapter');
for(const missing of ['accounts','history','attestation'])test('missing '+missing+' rejects HTTP and command before authorization or source reads',async()=>{
 let reads=0,auth=0,runs=0;const guard={clientAccounts:true,clientHistory:true,run:async()=>{runs++;}},store={saleDeleteFenceReady:true,saleDeleteActivityFenceReady:true,read:async()=>{reads++;}};
 if(missing==='accounts')guard.clientAccounts=false;if(missing==='history')guard.clientHistory=false;if(missing==='attestation')delete store.saleDeleteFenceReady;
 const command=createSaleDeleteCommand({guard,store,enabled:true,verifyActor:async()=>{auth++;}}),adapter=createSaleDeleteHttpAdapter({guard,store,enabled:true,authorize:async()=>{auth++;}});
 assert.equal(command.capability(),false);assert.equal(adapter.capability(),false);
 await assert.rejects(command.execute({uid:'fixture'},{id:'fixture-operation',ventaKey:'s',expectedHash:'a'.repeat(64)}),{code:'SV_SALE_DELETE_FENCE_REQUIRED'});
 await assert.rejects(adapter.handle({method:'POST',url:PATH},{id:'fixture-operation',ventaKey:'s',expectedHash:'a'.repeat(64)}),{code:'SV_SALE_DELETE_FENCE_REQUIRED'});
 assert.equal(reads,0);assert.equal(auth,0);assert.equal(runs,0);
});
test('fence attestation is explicit and cannot be replaced by a promise or truthy object',()=>{const Fence=require('../cotizador/sale-delete-fence');for(const value of [undefined,{},Promise.resolve(true),'true'])assert.equal(Fence.ready({clientAccounts:true,clientHistory:true},{saleDeleteFenceReady:value}),false);});

test('financial provider cannot advertise delete without integrated writer maintenance',()=>{const Fence=require('../cotizador/sale-delete-fence'),guard={clientAccounts:true,clientHistory:true,saleFinancialDependencies:true},store={saleDeleteFenceReady:true,saleDeleteActivityFenceReady:true,saleDeleteFinancialEvidence:async()=>({})};assert.equal(Fence.ready(guard,store),true);for(const value of [false,undefined,'true'])assert.equal(Fence.ready({...guard,saleFinancialDependencies:value},store),false);});
