'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=process.env.SV_STOCK_TEST_ROOT||'/app',manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'runtime-manifest.json')));
test('coordinated image contains every reviewed runtime byte and exact dependencies',()=>{
 a.match(manifest.sourceCommit,/^[a-f0-9]{40}$/);
 for(const [name,hash]of Object.entries(manifest.files)){a(!name.includes('..'));const bytes=fs.readFileSync(path.join(root,name));a.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,name);if(name.endsWith('.js'))new vm.Script(bytes.toString(),{filename:name});}
 const expected=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).dependencies;
 for(const name of ['firebase-admin','google-auth-library','playwright'])a.equal(JSON.parse(fs.readFileSync(path.join(root,'node_modules',name,'package.json'))).version,expected[name],name);
});
test('runtime imports preserve Stock and refuse unconfigured deletion authority without IO',async()=>{
 for(const name of ['office-stock','office-stock-model','office-stock-policy','sale-delete-command','ot-delete-command','purchase-order-delete','tecnoprices-login','ot-lifecycle','commission-generation','payment-commands'])a.equal(typeof require(path.join(root,name)),'object',name);
 const {createLaborRuntime}=require(path.join(root,'labor-runtime'));
 const runtime=createLaborRuntime({db:{},databaseURL:'https://fixture.invalid',accessToken:async()=>{throw Error('Unexpected credentials');},enabled:true,commercialPages:true,clientAccounts:true,clientHistory:true,operationalSummaries:true,deliveryEnvironment:{},deleteEnvironment:{COMMERCIAL_DELETE_ENABLED:'true'}});
 a.equal(runtime.capabilities().clientAccounts,true);a.equal(runtime.capabilities().clientHistory,true);a.equal(await runtime.deleteReadiness.available(),false);a.equal(runtime.store.saleDeleteFenceReady,false);
});
test('container checks deny production, metadata, DNS and subprocess use',()=>{
 a.throws(()=>fetch('https://metadata.google.internal'),/forbidden/);a.throws(()=>require('node:https').get('https://production.invalid'),/forbidden/);a.throws(()=>require('node:child_process').spawn('anything'),/forbidden/);
});
