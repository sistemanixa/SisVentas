'use strict';
const http=require('node:http');
const {createBusinessAuth}=require('./user-access');
const {createCommercialOwnership}=require('./commercial-ownership');
const {create}=require('./commercial-sale-payments');
const {create:createReadDb}=require('./dashboard-rtdb-read-db');
const Index=require('./payment-membership-index');
function createServer({auth,store,allowOrigin='https://ventas.sistemanixa.com',observe}={}){
 if(typeof auth?.verifyIdToken!=='function'||['read','readQuery','query','readAsUser'].some(key=>typeof store?.[key]!=='function'))throw TypeError('Faltan puertos genuinos de lectura y autenticación');
 const origin=new URL(allowOrigin);
 if(origin.origin!==allowOrigin||origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['127.0.0.1','localhost'].includes(origin.hostname)))throw TypeError('Origen no permitido');
 // The composed controllers receive no commit, SDK database or writer methods.
 const reads=Object.freeze(Object.fromEntries(['read','readQuery','query','readAsUser'].map(key=>[key,store[key].bind(store)])));
 const db=createReadDb({store:reads}),businessAuth=createBusinessAuth({verifyIdToken:(token)=>auth.verifyIdToken(token,true)},db);
 const ownership=createCommercialOwnership({auth:businessAuth,db,enabled:true,scopedReads:true,queryReader:reads.query,readAsUser:reads.readAsUser});
 const payments=create({ownership,store:reads,observe});
 return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Authorization, Origin');
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
  try{
   if(req.headers.origin&&req.headers.origin!==allowOrigin){send(403,{ok:false,mensaje:'Origen no permitido'});return;}
   res.setHeader('Access-Control-Allow-Origin',allowOrigin);
   const url=new URL(req.url,'http://localhost'),match=url.pathname.match(/^\/comerciales\/ventas\/registro\/([^/]+)$/);
   if(!match||url.searchParams.size!==1||url.searchParams.get('para')!=='pagos'){send(404,{ok:false,mensaje:'Operación no disponible'});return;}
   let saleKey;try{saleKey=decodeURIComponent(match[1]);Index.recordKey(saleKey);}catch(_){send(400,{ok:false,mensaje:'Clave de venta inválida'});return;}
   if(req.method==='OPTIONS'){
    if(req.headers['access-control-request-method']!=='GET'){send(501,{ok:false,mensaje:'Método no implementado'});return;}
    res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, X-Frontend-Key, If-None-Match');res.writeHead(204);res.end();return;
   }
   if(req.method!=='GET'){send(501,{ok:false,mensaje:'Método no implementado'});return;}
   const actor=await ownership.authorize(req,'ventas'),record=(await ownership.readAuthorizedRecordsByIds(actor,'ventas',[saleKey]))[saleKey];
   if(!record){send(404,{ok:false,mensaje:'Registro no disponible'});return;}
   const detail=await payments.load({req,actor,saleKey,record});
   send(200,{ok:true,...detail,record:{...detail.record,fbKey:saleKey}});
  }catch(error){send(Number.isInteger(error.statusCode)&&error.statusCode>=400&&error.statusCode<=599?error.statusCode:503,{ok:false,mensaje:error.statusCode?error.message:'No se pudo confirmar la operación comercial'});}
 });
}
function createFromEnv({env=process.env,admin,fetchImpl=globalThis.fetch}={}){
 const databaseURL=env.FIREBASE_DATABASE_URL;
 if(!databaseURL)throw TypeError('Falta FIREBASE_DATABASE_URL');
 // Lazily instantiate Auth and ADC only in the executable composition. No SDK
 // database/listeners or labor-runtime/browser initialization is involved.
 admin=admin||require('firebase-admin');
 const app=admin.initializeApp({credential:admin.credential.applicationDefault(),databaseURL,...(env.GOOGLE_CLOUD_PROJECT?{projectId:env.GOOGLE_CLOUD_PROJECT}:{})},'sale-payment-reader');
 const store=require('./labor-rtdb-store').createLaborRtdbStore({databaseURL,fetchImpl,accessToken:async()=>(await app.options.credential.getAccessToken()).access_token});
 return createServer({auth:{verifyIdToken:(token)=>app.auth().verifyIdToken(token,true)},store,allowOrigin:env.ALLOW_ORIGIN||'https://ventas.sistemanixa.com'});
}
if(require.main===module){const port=Number(process.env.PORT||8080);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Puerto inválido');createFromEnv().listen(port);}
module.exports={createServer,createFromEnv};
