'use strict';
// Composición local extraída del setup G/H/RESTStore de purchase-manual-create-core.
// Requiere fixture nativa E/B ya preparada: NO fabrica archivos/pins/cohorte/contador.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),http=require('node:http');
async function createFixture({sourceRoot,nativeFixture:f,authorize,createOrderDelete}={}){
 assert.ok(sourceRoot,'Falta checkout explícito de host/domains revisados');
 const at=file=>require(path.join(path.resolve(sourceRoot),file));
 assert.ok(f&&typeof f.get==='function'&&typeof f.set==='function','Falta fixture nativa de fuentes E/B');
 assert.ok(f.cohort&&f.cohort.mappedAdmission,'Falta cohorte nativa firmada actual de E');
 assert.equal(typeof authorize,'function','Falta authorize del montaje de sesión fixture');
 assert.equal(typeof createOrderDelete,'function','Falta montaje del delete revisado sobre este mismo store/guard');
 const {createLaborGuard,digest}=at('cotizador/labor-guard'),{createLaborRtdbStore}=at('cotizador/labor-rtdb-store'),Numbering=at('cotizador/purchase-numbering'),Order=at('cotizador/office-stock-order');
 assert.ok(f.document?.generation,'Falta documento firmado de cohorte');
 assert.ok(f.get(Numbering.PATH),'Falta contador B preparado: no se inventa bootstrap');
 Numbering.state(f.get(Numbering.PATH));
 const originalLabor=f.get('sv_labor_config');
 const coordinated=await at('test/helpers/coordinated-backend.cjs').createCoordinatedBackend(f.get('sisventas'));
 for(const [key,value]of Object.entries(coordinated.state))if(!['sisventas','sv_chat_roles','sv_permisos','sv_labor_guard'].includes(key))f.set(key,key==='sv_labor_config'?{...originalLabor,...value}:value);
 const financial=await at('cotizador/sale-financial-dependencies-model').prepare({ventas:f.get('sisventas/ventas'),gastos:f.get('sisventas/gastos'),ctaemp:f.get('sisventas/ctaemp'),comisiones_generacion:f.get('sisventas/comisiones_generacion'),sv_commission_generation:f.get('sv_commission_generation')},{generation:'fiction-full-app-financial'});
 for(const [key,value]of Object.entries(financial.patch))f.set(key,value);
 assert.ok(f.get(Order.CONFIG)&&f.get(Order.FENCE),'Falta Order preparado por bootstrap genuino E; no se reconstruye');
 assert.equal(typeof f.cohort.verifyCohort,'function');
 const projector=at('cotizador/office-stock-order-projections').create({enabled:true,verifyCohort:f.cohort.verifyCohort});
 const calls=[],patches=[];
 const store=createLaborRtdbStore({databaseURL:'http://127.0.0.1:1/?ns=fiction-full-app-no-network',now:()=>f.now,accessToken:async()=>'FIXTURE_ONLY',fetchImpl:async(url,options)=>{
  const target=new URL(url);assert.equal(target.hostname,'127.0.0.1');calls.push({target,options});const record=decodeURIComponent(target.pathname).slice(1,-5);let value=null;
  if(options.method==='GET'){
   assert.ok(record,'No root GET');value=f.get(record);
   if(target.searchParams.has('orderBy')){const query=Object.fromEntries([...target.searchParams].filter(([key])=>!['ns','auth_variable_override'].includes(key)).map(([key,value])=>[key,JSON.parse(value)]));value=at('test/helpers/stock-reference-query-fixture.cjs').queryRows(value,query);}
  }else if(options.method==='PUT')f.set(record,JSON.parse(options.body));
  else if(options.method==='DELETE')f.set(record,null);
  else if(options.method==='PATCH'){const patch=JSON.parse(options.body);patches.push(structuredClone(patch));for(const [key,value]of Object.entries(patch))f.set(key,value);}
  else assert.fail('Método REST inesperado: '+options.method);
  return {ok:true,status:200,body:{cancel:async()=>{}},json:async()=>structuredClone(value)};
 }});
 const guard=createLaborGuard({store,now:()=>f.now,operationalSummaries:true,saleFinancialDependencies:true,clientAccounts:true,commercialPages:true,clientHistory:true,stockOrderProjections:projector,delay:async()=>{}});
 const orderDelete=await createOrderDelete({store,guard,authorize,cohort:f.cohort});assert.equal(typeof orderDelete?.handle,'function','Delete revisado no montado');
 const host=at('cotizador/purchase-command-host').create({authorize,store,guard,cohort:f.cohort,numbering:f.numbering,initialInventoryReference:f.initialInventoryReference,orderDelete,enabled:true,queryPage:store.queryPage,now:()=>f.now});
 // El caller root monta host.handle(path,req,body) y Recovery real, sin emular su respuesta.
 // No pérdida de ACK en REST: se inyecta DESPUÉS del commit al responder HTTP a la UI.
 return {nativeFixture:f,store,guard,host,calls,patches,digest,readiness:()=>host.readiness(),counts:()=>({restCalls:calls.length,commits:patches.filter(p=>Object.keys(p).some(k=>k.startsWith('sv_labor_receipts/'))).length}),read:p=>structuredClone(f.get(p))};
}
async function startFullAppServer({checkout,apiHandler}={}){
 // apiHandler es el montaje HTTP real revisado de Root (host + OTPJR + resolve).
 // Este servidor sólo sirve activos originales; nunca genera respuestas POST.
 assert.equal(typeof apiHandler,'function','Falta montaje HTTP real del coordinador');const root=path.resolve(checkout);
 const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
 const server=http.createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(/^\/(?:compras|ot|laboral|stock-oficina|usuarios|comerciales|commercial|clientes|cuentas)(?:\/|$)/.test(pathname)){await apiHandler(req,res);assert.ok(res.writableEnded||res.destroyed,'El montaje real no respondió '+pathname);return;}
  if(req.method!=='GET')throw Object.assign(Error('No hay handler de negocio para esta ruta'),{statusCode:404});
  const relative=decodeURIComponent(pathname==='/'?'/index.html':pathname).slice(1);
  if(!/^(?:index\.html|sw\.js|manifest[^/]*\.json|favicon[^/]*|(?:js|css|assets|img|fonts|icons)\/[^\x00]*)$/.test(relative))throw Object.assign(Error('Activo fuera del alcance público'),{statusCode:404});
  const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))throw Object.assign(Error('Ruta inválida'),{statusCode:404});
  const data=await fs.promises.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch(error){if(!res.writableEnded&&!res.destroyed){res.writeHead(error.statusCode||500,{'Content-Type':'text/plain; charset=utf-8'});res.end(error.message);}}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {baseURL:'http://127.0.0.1:'+server.address().port,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
async function checkGenuineReadiness({sourceRoot,uiRoot,baselineRulesPath,baselineDigest,nativeFactoryFile,rolePermissions}={}){
 assert.ok(nativeFactoryFile,'Falta archivo del helper E revisado');const at=file=>require(path.join(path.resolve(sourceRoot),file));
 const f=await require(path.resolve(nativeFactoryFile)).create({sourceRoot,uiRoot,baselineRulesPath,baselineDigest,rolePermissions});
 try{
  const before={counter:f.get(f.Numbering.PATH),orderConfig:f.get(at('cotizador/office-stock-order').CONFIG),orderFence:f.get(at('cotizador/office-stock-order').FENCE),labor:f.get('sv_labor_config')};
  let gateway;const authorize=req=>gateway.authorize(req);
  const composed=await createFixture({sourceRoot,nativeFixture:f,authorize,createOrderDelete:({store,guard,authorize})=>at('cotizador/purchase-order-delete').createPurchaseOrderDelete({authorize,store,guard,enabled:true,review:at('cotizador/purchase-order-delete-review').create({env:{}})})});
  gateway=at('cotizador/labor-write-gateway').createLaborWriteGateway({db:{ref:p=>({get:async()=>({val:()=>f.get(p)})})},store:composed.store,guard:composed.guard,enabled:true,auth:{verifyIdToken:async(token,revoked)=>{assert.equal(token,'FIXTURE_ONLY');assert.equal(revoked,true);return f.identity.claims;}}});
  assert.equal(f.get('sv_labor_config').officeStockVersion,before.labor.officeStockVersion);
  assert.deepEqual(f.get(f.Numbering.PATH),before.counter);assert.deepEqual(f.get(at('cotizador/office-stock-order').CONFIG),before.orderConfig);assert.deepEqual(f.get(at('cotizador/office-stock-order').FENCE),before.orderFence);
  const ready=await composed.readiness();assert.equal(ready.ready,true,'Readiness genuina no lista: '+JSON.stringify(ready.missing));
  const history=f.get('sv_client_history_config');f.set('sv_client_history_config',{...history,ready:false});const denied=await composed.readiness();assert.equal(denied.ready,false);assert.ok(denied.missing.includes('linked-config'));f.set('sv_client_history_config',history);
  const restored=await composed.readiness();assert.equal(restored.ready,true);assert.equal(composed.counts().commits,0);
  return {status:'CORE_READINESS_ONLY',ready,denied,restored,counts:composed.counts(),fixtureCertification:f.SourceFixture,limits:'No Chrome/UI, Rules no evaluadas; cierre de escritores declarado del fixture. Delete revisado permanece configurado OFF por falta de revisión individual; no se prueba ni habilita borrado.'};
 }finally{f.cleanup();}
}
module.exports={createFixture,startFullAppServer,checkGenuineReadiness};
if(require.main===module){checkGenuineReadiness({sourceRoot:process.env.SV_NATIVE_SOURCE_ROOT,uiRoot:process.env.SV_NATIVE_UI_ROOT,baselineRulesPath:process.env.SV_NATIVE_RULES_BASELINE,baselineDigest:process.env.SV_NATIVE_RULES_DIGEST,nativeFactoryFile:process.env.SV_NATIVE_APPLICATION_FIXTURE}).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error);process.exitCode=1;});}
