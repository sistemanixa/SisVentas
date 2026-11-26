'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path');
const {measure}=require('../scripts/measure-sale-payment-rtt.cjs');
const serverRoot=process.env.PAYMENT_MEASURE_SERVER_ROOT||path.resolve(__dirname,'../cotizador');
test('literal payment route and genuine auth/snapshot/store produce bounded reads without mutations',async()=>{
 const r=await measure({serverRoot,rttMs:0,richAliases:true});a.equal(r.status,200);a.deepEqual(r.history,{source:'global',paymentCount:1,paidAmount:40});a.equal(r.unchanged,true);a.equal(r.writes,0);a.equal(r.byCategory.auth.calls,2);a.equal(r.byCategory.reset.calls,2);a.equal(r.byCategory.profile.calls,2);a.equal(r.byCategory.role.calls,2);a.equal(r.byCategory.permissions.calls,2);a.equal(r.byCategory.payment.calls,2);a.equal(r.byCategory.sale.calls,3);a.equal(r.byCategory.coverage.calls,2);a(r.byCategory.membership.calls>12);a(r.maxConcurrent<=6);a.equal(r.events.filter(e=>e.channel==='user-rest'&&e.category==='payment').length,2);a(r.events.every(e=>e.responseBytes>=0));a.equal(Object.keys(r.sourceHashes).length,6);
});
test('reset after initial authorization prevents a successful measured history',async()=>{const r=await measure({serverRoot,rttMs:0,mutate:({root,verifications})=>{if(verifications===2)root.sv_access_resets['fixture-user'].required=true;}});a.equal(r.status,401);a.equal(r.history,null);});
test('permission changes before final authorization prevent a successful measured history',async()=>{const r=await measure({serverRoot,rttMs:0,mutate:({root,verifications})=>{if(verifications===2)root.sv_permisos.vendedor.indiceRevision++;}});a.equal(r.status,409);a.equal(r.history,null);});
