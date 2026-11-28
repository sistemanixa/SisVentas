'use strict';
// Dedicated authenticated command; no generic write or administrative endpoint.
const http=require('node:http'),{digest,createLaborGuard}=require('./labor-guard');
function createHandler({authorize,command,cancelCommand,resolve,checkRules,allowedOrigins,metrics=()=>{}}){
 return async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost'),origin=req.headers.origin;
  if(origin&&!allowedOrigins.has(origin))return res.writeHead(403).end();
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Frontend-Key');return res.writeHead(204).end();}
  if(req.method==='GET'&&url.pathname==='/healthz'&&!url.search)return res.writeHead(200,{'Content-Type':'application/json'}).end('{"ok":true,"service":"purchase-delete"}');
  if(req.method!=='POST'||url.search||!['/laboral/capacidades','/laboral/operacion','/compras/ordenes/eliminar','/compras/ordenes/anular'].includes(url.pathname))return res.writeHead(404).end();
  const timing=(phase,start)=>{try{metrics({event:'purchase-command-timing',phase,milliseconds:Math.round(performance.now()-start)});}catch{}};
  let start=performance.now();const actor=await authorize(req);timing('authentication',start);let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16384)throw Object.assign(Error('Solicitud demasiado grande.'),{statusCode:413});}const body=JSON.parse(raw||'{}');let result;
  if(url.pathname==='/laboral/operacion')result=await resolve(actor,body);
  else if(url.pathname==='/laboral/capacidades')result={ok:true,payments:{enabled:false,version:1},adminExpense:{enabled:false,version:1},orderDelete:{enabled:await command.capability(),version:1}};
  else {start=performance.now();await checkRules();timing('rules',start);start=performance.now();try{if(url.pathname==='/compras/ordenes/anular'){if(!cancelCommand)throw Object.assign(Error('La anulación todavía no está disponible.'),{statusCode:503});result=await cancelCommand.handle(req,body);}else result=await command.handle(req,body);}finally{timing('command',start);}}
  res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(result));
 }catch(error){res.writeHead(error.statusCode||503,{'Content-Type':'application/json'}).end(JSON.stringify({ok:false,code:error.code,mensaje:error.message}));}};
}
async function main(){
 const admin=require('firebase-admin'),databaseURL=process.env.FIREBASE_DATABASE_URL;
 if(databaseURL!=='https://nixa-sisventas-default-rtdb.firebaseio.com')throw Error('Destino no revisado.');
 admin.initializeApp({credential:admin.credential.applicationDefault(),databaseURL});
 const accessToken=async()=>(await admin.app().options.credential.getAccessToken()).access_token;
 const store=require('./labor-rtdb-store').createLaborRtdbStore({databaseURL,accessToken});
 const guard=createLaborGuard({store,operationalSummaries:true,commercialPages:true,clientAccounts:true,saleDeleteRelations:true});
 const review=require('./purchase-draft-delete-policy').create({runtime:()=>({coordinated:true,readOnly:false,operationalSummaries:true,commercialPages:true,clientAccounts:true,saleDeleteRelations:guard.saleDeleteRelations===true})});
 if(!review.configured())throw Error('El guardado de borradores no está disponible.');
 const gateway=require('./labor-write-gateway').createLaborWriteGateway({auth:{verifyIdToken:(...args)=>admin.auth().verifyIdToken(...args)},db:admin.database(),guard,store,enabled:true});
 const command=require('./purchase-order-delete').createPurchaseOrderDelete({authorize:gateway.authorize,guard,store,review,enabled:true});
 const cancelCommand=require('./purchase-order-delete').createPurchaseOrderDelete({authorize:gateway.authorize,guard,store,review:require('./purchase-draft-delete-policy').create({operation:'cancel',runtime:()=>({coordinated:true,readOnly:false,operationalSummaries:true,commercialPages:true,clientAccounts:true,saleDeleteRelations:guard.saleDeleteRelations===true})}),enabled:true,operation:'cancel'});
 const expected=process.env.PURCHASE_DELETE_RULES_HASH;if(!/^[a-f0-9]{64}$/.test(expected||''))throw Error('Falta verificar las reglas.');
 const checkRules=async()=>{const r=await fetch(databaseURL+'/.settings/rules.json',{headers:{Authorization:'Bearer '+await accessToken()},signal:AbortSignal.timeout(20000)});if(!r.ok||digest(await r.json())!==expected)throw Object.assign(Error('La revisión del borrado cambió. No se modificó la compra.'),{statusCode:503});};
 http.createServer(createHandler({authorize:gateway.authorize,command,cancelCommand,resolve:gateway.resolve,checkRules,metrics:event=>console.info(JSON.stringify(event)),allowedOrigins:new Set(['https://ventas.sistemanixa.com','http://127.0.0.1:4173','http://localhost:4173'])})).listen(Number(process.env.PORT||8080),'0.0.0.0');
}
module.exports={createHandler};if(require.main===module)main().catch(()=>{console.error('No se pudo iniciar el borrado revisado.');process.exitCode=1;});
