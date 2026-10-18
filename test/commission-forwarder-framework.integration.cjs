'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module');
const dep=createRequire(path.resolve('cloud-functions/commission-events/package.json'));
test('el framework real recibe la firma de evento de primera generación sin credenciales ni consultas al vencer',async()=>{
 const {GoogleAuth}=dep('google-auth-library'),original=GoogleAuth.prototype.getIdTokenClient;
 GoogleAuth.prototype.getIdTokenClient=async()=>assert.fail('El evento vencido no debe obtener credenciales ni consultar servidores');
 const keys=['COMMISSION_EVENT_INSTANCE','COMMISSION_EVENT_TARGET'],previous=keys.map(k=>process.env[k]);process.env.COMMISSION_EVENT_INSTANCE='nixa-sisventas-default-rtdb';process.env.COMMISSION_EVENT_TARGET='https://cotizador-is54pr4fha-rj.a.run.app';
 const handler=require('../cloud-functions/commission-events/index.js').sisventasCommissionEventForward;
 const {getServer}=require(path.join(path.dirname(dep.resolve('@google-cloud/functions-framework')),'server.js'));
 const server=getServer(handler,{signatureType:'event',enableExecutionId:false,timeoutMilliseconds:0,port:'0',target:'',sourceLocation:'',printHelp:false,ignoredRoutes:null});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const response=await fetch('http://127.0.0.1:'+server.address().port,{method:'POST',headers:{'Content-Type':'application/json',Connection:'close'},body:JSON.stringify({data:{FICTICIO:'NO ENVIAR'},context:{eventId:'framework-ficticio',eventType:'providers/google.firebase.database/eventTypes/ref.write',timestamp:new Date(Date.now()-172800000).toISOString(),resource:{name:'projects/_/instances/nixa-sisventas-default-rtdb/refs/sisventas/pagos/ficticio/monto'}}})});await response.text();assert.equal(response.status,204);}
 finally{await new Promise(resolve=>server.close(resolve));GoogleAuth.prototype.getIdTokenClient=original;keys.forEach((k,i)=>{if(previous[i]===undefined)delete process.env[k];else process.env[k]=previous[i];});}
});
