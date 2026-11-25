'use strict';
// Dedicated authenticated command; no generic write or administrative endpoint.
const http=require('node:http'),{digest,createLaborGuard}=require('./labor-guard');
function createHandler({authorize,command,resolve,checkRules,allowedOrigins}){
 return async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost'),origin=req.headers.origin;
  if(origin&&!allowedOrigins.has(origin))return res.writeHead(403).end();
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Frontend-Key');return res.writeHead(204).end();}
  if(req.method==='GET'&&url.pathname==='/healthz'&&!url.search)return res.writeHead(200,{'Content-Type':'application/json'}).end('{"ok":true,"service":"purchase-delete"}');
  if(req.method!=='POST'||url.search||!['/laboral/capacidades','/laboral/operacion','/compras/ordenes/eliminar'].includes(url.pathname))return res.writeHead(404).end();
  const actor=await authorize(req);let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16384)throw Object.assign(Error('Solicitud demasiado grande.'),{statusCode:413});}const body=JSON.parse(raw||'{}');let result;
  if(url.pathname==='/laboral/operacion')result=await resolve(actor,body);
  else {await checkRules();if(url.pathname==='/laboral/capacidades')result={ok:true,payments:{enabled:false,version:1},adminExpense:{enabled:false,version:1},orderDelete:{enabled:await command.capability(),version:1}};else result=await command.handle(req,body);}
  res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(result));
 }catch(error){res.writeHead(error.statusCode||503,{'Content-Type':'application/json'}).end(JSON.stringify({ok:false,code:error.code,mensaje:error.message}));}};
}
async function main(){
 const admin=require('firebase-admin'),databaseURL=process.env.FIREBASE_DATABASE_URL;
 if(databaseURL!=='https://nixa-sisventas-default-rtdb.firebaseio.com')throw Error('Destino no revisado.');
 admin.initializeApp({credential:admin.credential.applicationDefault(),databaseURL});
 const accessToken=async()=>(await admin.app().options.credential.getAccessToken()).access_token;
 const store=require('./labor-rtdb-store').createLaborRtdbStore({databaseURL,accessToken});
 const guard=createLaborGuard({store,operationalSummaries:true,commercialPages:true,clientAccounts:true});
 const review=require('./purchase-manual-delete-review').create({runtime:()=>({coordinated:true,readOnly:false,operationalSummaries:true,commercialPages:true,clientAccounts:true})});
 if(!review.configured())throw Error('Revisión de compra ausente o vencida.');
 const gateway=require('./labor-write-gateway').createLaborWriteGateway({auth:{verifyIdToken:(...args)=>admin.auth().verifyIdToken(...args)},db:admin.database(),guard,store,enabled:true});
 const command=require('./purchase-order-delete').createPurchaseOrderDelete({authorize:gateway.authorize,guard,store,review,enabled:true});
 const expected=process.env.PURCHASE_DELETE_RULES_HASH;if(!/^[a-f0-9]{64}$/.test(expected||''))throw Error('Falta verificar las reglas.');
 const checkRules=async()=>{const r=await fetch(databaseURL+'/.settings/rules.json',{headers:{Authorization:'Bearer '+await accessToken()},signal:AbortSignal.timeout(20000)});if(!r.ok||digest(await r.json())!==expected)throw Object.assign(Error('La revisión del borrado cambió. No se modificó la compra.'),{statusCode:503});};
 http.createServer(createHandler({authorize:gateway.authorize,command,resolve:gateway.resolve,checkRules,allowedOrigins:new Set(['https://ventas.sistemanixa.com','http://127.0.0.1:4173','http://localhost:4173'])})).listen(Number(process.env.PORT||8080),'0.0.0.0');
}
module.exports={createHandler};if(require.main===module)main().catch(()=>{console.error('No se pudo iniciar el borrado revisado.');process.exitCode=1;});
