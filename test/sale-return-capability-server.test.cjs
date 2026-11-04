const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Return=require('../cotizador/sale-return-to-budget');
test('server capability is disabled without explicit coordinated configuration and verified digest',()=>{
 assert.deepEqual(Return.capability(),{version:1,enabled:false,purpose:'sale-return-to-budget',coordinated:false,rules:{version:1,verified:false,digest:null}});
 for(const rulesDigest of [undefined,null,'','abc','g'.repeat(64),'A'.repeat(64),true,{}]){const result=Return.capability({enabled:true,coordinated:true,rulesDigest});assert.equal(result.enabled,false);assert.equal(result.rules.verified,false);assert.equal(result.rules.digest,null);}
});
test('server capability requires actual booleans and reports exact configured digest',()=>{
 const rulesDigest='ab'.repeat(32);
 for(const config of [{},{enabled:true},{coordinated:true},{enabled:'true',coordinated:true},{enabled:true,coordinated:'true'}])assert.equal(Return.capability({...config,rulesDigest}).enabled,false);
 assert.deepEqual(Return.capability({enabled:true,coordinated:true,rulesDigest}),{version:1,enabled:true,purpose:'sale-return-to-budget',coordinated:true,rules:{version:1,verified:true,digest:rulesDigest}});
});
test('capability module uses canonical economic helpers packaged without divergence',()=>{
 for(const name of ['commercial-money.v1.js','sale-budget-transition.v1.js'])assert.equal(fs.readFileSync(require.resolve('../cotizador/commercial-models/'+name),'utf8').replace(/\r\n/g,'\n'),fs.readFileSync(require.resolve('../js/core/'+name),'utf8').replace(/\r\n/g,'\n'));
});
