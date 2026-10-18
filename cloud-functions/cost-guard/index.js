'use strict';
const functions=require('@google-cloud/functions-framework');
const {GoogleAuth}=require('google-auth-library');
const {decide,suspend}=require('./policy.cjs');
const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']});
functions.cloudEvent('sisventasCostGuard',async event=>{
 const decision=decide(event.data?.message,{billingAccountId:process.env.COST_GUARD_BILLING_ACCOUNT,budgetId:process.env.COST_GUARD_BUDGET_ID});
 if(!decision.pause){console.log(JSON.stringify({event:'cost_guard_no_action',reason:decision.reason}));return;}
 const client=await auth.getClient();
 await suspend({request:options=>client.request(options),logger:entry=>console.log(JSON.stringify(entry))});
});
