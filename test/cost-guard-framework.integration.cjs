'use strict';
// Optional: npm ci in cloud-functions/cost-guard first. Loopback and fake budget only.
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module');
const dep=createRequire(path.resolve('cloud-functions/cost-guard/package.json'));
test('controlador real procesa CloudEvents sin pedir credenciales ni suspender servicios por octubre',async()=>{
 const {GoogleAuth}=dep('google-auth-library'),original=GoogleAuth.prototype.getClient;
 GoogleAuth.prototype.getClient=async()=>{throw Error('La prueba no debe pedir credenciales');};
 const oldAccount=process.env.COST_GUARD_BILLING_ACCOUNT,oldBudget=process.env.COST_GUARD_BUDGET_ID;
 process.env.COST_GUARD_BILLING_ACCOUNT='FAKE';process.env.COST_GUARD_BUDGET_ID='FAKE';
 require('../cloud-functions/cost-guard/index.js');
 const {getTestServer}=dep('@google-cloud/functions-framework/testing'),{CloudEvent,HTTP}=dep('cloudevents');
 const server=getTestServer('sisventasCostGuard');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const event=new CloudEvent({type:'google.cloud.pubsub.topic.v1.messagePublished',source:'//pubsub.googleapis.com/projects/demo/topics/fake',data:{message:{attributes:{billingAccountId:'FAKE',budgetId:'FAKE',schemaVersion:'1.0'},data:Buffer.from(JSON.stringify({currencyCode:'USD',budgetAmountType:'SPECIFIED_AMOUNT',budgetAmount:60,costAmount:100,costIntervalStart:'2026-10-01T07:00:00Z'})).toString('base64')}}});
  const wire=HTTP.binary(event),response=await fetch('http://127.0.0.1:'+server.address().port,{method:'POST',headers:{...wire.headers,Connection:'close'},body:typeof wire.body==='string'?wire.body:JSON.stringify(wire.body)});
  await response.text();assert.equal(response.status,204);
 }finally{
  await new Promise(resolve=>server.close(resolve));GoogleAuth.prototype.getClient=original;
  for(const [key,value]of [['COST_GUARD_BILLING_ACCOUNT',oldAccount],['COST_GUARD_BUDGET_ID',oldBudget]])if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
