'use strict';
const saleHash=value=>{const original=structuredClone(value);if(original)delete original.fbKey;return require('../cotizador/labor-guard').digest(original);};
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createLaborRuntime}=require('../cotizador/labor-runtime');
const {createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
const {createSaleDeleteHttpAdapter,PATH}=require('../cotizador/sale-delete-http-adapter');
const {child,put,parts}=require('../cotizador/labor-guard');
const Payments=require('../cotizador/payment-membership-index');
test('full runtime REST store, real gateway and local HTTP dispatch preserve routes and private receipts',async()=>{
 let state={sv_labor_config:{schema:1,ready:true},sv_chat_roles:{u:{activo:true,rol:'admin'},other:{activo:true,rol:'admin'}},sv_permisos:{admin:{indiceVersion:2,indiceModulos:{venta:true},acciones:{ventas:{eliminar:true}}}},sisventas:{ventas:{s:{id:'V-0001'}},pagos:{p:{venta:'PREFIX / 0001',monto:1}},ordenes_trabajo:{},presupuestos:{},reclamos:{}}};
 for(const [path,value]of Object.entries(Payments.buildIndex(state.sisventas.pagos,{generation:'runtime-fixture',ready:true}).patch))state=put(state,parts(path),value);
 const prepared=await createCoordinatedBackend({...state.sisventas,ventas:Object.fromEntries(Object.entries(state.sisventas.ventas).map(([id,sale])=>[id,{...sale,total:100,fecha:'2026-11-01',clienteFbKey:'c',responsableUid:'u'}])),pagos:Object.fromEntries(Object.entries(state.sisventas.pagos).map(([id,payment])=>[id,{...payment,fecha:'2026-11-01'}]))});
 Object.assign(prepared.state.sv_chat_roles,state.sv_chat_roles);prepared.state.sv_permisos=state.sv_permisos;state=prepared.state;
 let commits=0,authCalls=0;const calls=[];
 const fetchImpl=async(target,options)=>{
  const url=new URL(target),path=decodeURIComponent(url.pathname.replace(/^\//,'').replace(/\.json$/,''));calls.push([options.method,path]);
  if(options.method==='GET')return new Response(JSON.stringify(child(state,parts(path))));
  if(options.method==='PUT')state=put(state,parts(path),JSON.parse(options.body));
  else if(options.method==='DELETE')state=put(state,parts(path),null);
  else if(options.method==='PATCH'){commits++;for(const [destination,value]of Object.entries(JSON.parse(options.body)))state=put(state,parts(destination),value);}
  return new Response('null');
 };
 const db={ref:path=>({toString:()=> 'https://fixture.invalid/'+path,get:async()=>({val:()=>structuredClone(child(state,parts(path)))})})};
 const runtime=createLaborRuntime({db,databaseURL:'https://fixture.invalid',accessToken:async()=> 'fixture-service',fetchImpl,enabled:true,commercialPages:true,clientAccounts:true,clientHistory:true,operationalSummaries:true});
 require('./helpers/sale-delete-financial-evidence.cjs').install({store:runtime.store,get:path=>child(state,parts(path))});runtime.store.saleDeleteFenceReady=true;runtime.store.saleDeleteActivityFenceReady=true;
 const auth={verifyIdToken:async(token,checkRevoked)=>{authCalls++;assert.equal(checkRevoked,true);if(!['u','other'].includes(token))throw Error('invalid fixture token');return {uid:token};}};
 const gateway=createLaborWriteGateway({auth,db,guard:runtime.guard,store:runtime.store,enabled:true});
 const adapter=createSaleDeleteHttpAdapter({authorize:gateway.authorize,guard:runtime.guard,store:runtime.store,enabled:true});
 const disabled=createSaleDeleteHttpAdapter({authorize:gateway.authorize,guard:runtime.guard,store:runtime.store});
 const server=http.createServer(async(req,res)=>{
  try{
   if(req.url==='/existing'){res.end(JSON.stringify({existing:true}));return;}
   if(req.url!==PATH){res.statusCode=404;res.end('{}');return;}
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4096)throw Object.assign(Error('body too large'),{statusCode:413});}
   let body;try{body=JSON.parse(raw);}catch(_){throw Object.assign(Error('malformed body'),{statusCode:400});}
   const reply=await adapter.handle(req,body);res.writeHead(reply.statusCode,reply.headers);res.end(JSON.stringify(reply.body));
  }catch(error){res.statusCode=error.statusCode||500;res.end(JSON.stringify({ok:false,code:error.code||'ERROR',message:error.message}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const send=(body,uid='u')=>fetch(base+PATH,{method:'POST',headers:{authorization:'Bearer '+uid},body:typeof body==='string'?body:JSON.stringify(body)});
 try{
  assert.deepEqual(await(await fetch(base+'/existing')).json(),{existing:true});assert.equal(calls.length,0);
  assert.equal((await send('{')).status,400);assert.equal((await send({id:'operation-runtime',ventaKey:'s',uid:'forged'})).status,400);assert.equal(commits,0);assert.equal(authCalls,0);
  await assert.rejects(disabled.handle({url:PATH,method:'POST',headers:{authorization:'Bearer u'}},{id:'operation-disabled',ventaKey:'s'}));assert.equal(commits,0);
  const body={id:'operation-runtime',ventaKey:'s',expectedHash:saleHash(child(state,parts('sisventas/ventas/s')))},first=await send(body),firstBody=await first.json();assert.equal(first.status,200,JSON.stringify(firstBody));assert.match(first.headers.get('cache-control'),/no-store/);assert.equal(firstBody.committed,true);assert.equal(commits,1);
  assert.equal((await send(body)).status,200);assert.equal(commits,1);
  const foreign=await send(body,'other');assert.equal(foreign.status,409);assert.equal(commits,1);assert.equal(child(state,parts('sisventas/ventas/s')),null);
  assert(authCalls>=6);assert.deepEqual(await(await fetch(base+'/existing')).json(),{existing:true});
 }finally{await new Promise(resolve=>server.close(resolve));}
});
