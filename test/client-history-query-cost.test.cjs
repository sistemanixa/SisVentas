'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),Query=require('../cotizador/client-history-query'),Account=require('../cotizador/client-account-projection');
for(const count of [121,5000])test('measure first history page over '+count+' real projected sales',{timeout:120000},async()=>{
 const sales=Object.fromEntries(Array.from({length:count},(_,index)=>['s'+index,{id:'V-'+index,fecha:'2026-11-01',clienteFbKey:'c',responsableUid:'u',total:100,subtotal:100}]));
 const backend=await createCoordinatedBackend({ventas:sales}),calls={metadata:0,contributions:0,pages:0,authorization:0},context={active:true,uid:'u',authUid:'u',role:'admin',viewing:false,passwordResetRequired:false,moduleAllowed:()=>true,actionAllowed:()=>true,financialHistoryAccess:{ventas:true,pagos:true,presupuestos:true},revision:1};
 const reader=Query.create({trustedAuthorize:async()=>{calls.authorization++;return context;},read:async path=>{if(path.includes('/sources/'))calls.contributions++;else calls.metadata++;return backend.get(path);},query:async(path,{after,limit})=>{calls.pages++;return Object.fromEntries(Object.entries(backend.get(path)||{}).filter(([key])=>!after||key>after).sort(([left],[right])=>left.localeCompare(right)).slice(0,limit));}});
 const start=performance.now(),result=await reader.page({accountId:Account.hash('client:c'),domain:'ventas'}),elapsedMs=Math.round(performance.now()-start);
 assert.equal(result.rows.length,50);assert.equal(result.totalRows,count);assert.equal(result.totals.totalCents,count*10000);assert.equal(calls.contributions,50);assert.equal(calls.pages,1);assert.ok(result.rows.every(row=>backend.get('sv_client_history/v1/sources/ventas/'+row.key)?.ownerUid==='u'));assert.equal(calls.authorization,2);assert.equal(backend.commits.length,0);
 console.log(JSON.stringify({count,returnedRows:result.rows.length,...calls,elapsedMs,measurement:'RAM fixtures; not network latency'}));
});
