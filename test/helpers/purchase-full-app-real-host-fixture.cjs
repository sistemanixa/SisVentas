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
 // Prepare the real operational indexes from the complete fixture originals.
 // No source records, historical receipts or signed cohort metadata are changed.
 const operational=await at('scripts/lib/read-index-activation.cjs').scan(async p=>f.get(p));
 for(const [key,value]of Object.entries(operational.indexes))f.set(key,value);
 assert.ok(f.get(Order.CONFIG)&&f.get(Order.FENCE),'Falta Order preparado por bootstrap genuino E; no se reconstruye');
 assert.equal(typeof f.cohort.verifyCohort,'function');
 const projector=at('cotizador/office-stock-order-projections').create({enabled:true,verifyCohort:f.cohort.verifyCohort});
 const calls=[],patches=[];
 const store=createLaborRtdbStore({databaseURL:'http://127.0.0.1:1/?ns=fiction-full-app-no-network',now:()=>f.now,otPhysicalWrites:true,accessToken:async()=>'FIXTURE_ONLY',fetchImpl:async(url,options)=>{
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
 const realCommit=store.commit;store.commit=async(patch,lease,actor)=>{try{return await realCommit(patch,lease,actor);}catch(error){console.error('REAL_COMMIT_REJECT '+JSON.stringify({code:error.code,paths:Object.keys(patch),operation:actor.operation}));throw error;}};
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
  if(/^\/(?:__qa|compras|ot|laboral|stock-oficina|usuarios|comerciales|commercial|clientes|cuentas)(?:\/|$)/.test(pathname)){await apiHandler(req,res);assert.ok(res.writableEnded||res.destroyed,'El montaje real no respondió '+pathname);return;}
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
  return {status:'CORE_READINESS_ONLY',ready,denied,restored,counts:composed.counts(),fixtureCertification:f.SourceFixture,limits:'No Chrome/UI, Rules no evaluadas; cierre de escritores declarado del fixture. Delete no ejecutado: host ON usa TypedDelete genuino; review legacy OFF no demuestra bug de capability.'};
 }finally{f.cleanup();}
}
async function createApiMount({sourceRoot,composed,nativeFixture:f}){
 const at=file=>require(path.join(path.resolve(sourceRoot),file)),queryRows=at('test/helpers/stock-reference-query-fixture.cjs').queryRows,store=composed.store,guard=composed.guard,clock=()=>f.now;
 function query(value,spec){let rows=queryRows(value,{...spec,limitToFirst:undefined});if(spec.after||spec.startAfter!==undefined)rows=Object.fromEntries(Object.entries(rows).filter(([key,row])=>spec.orderBy==='$key'?key>String(spec.after??spec.startAfter):row?.[spec.orderBy]>spec.startAfter));if(spec.endBefore!==undefined)rows=Object.fromEntries(Object.entries(rows).filter(([key,row])=>spec.orderBy==='$key'?key<String(spec.endBefore):row?.[spec.orderBy]<spec.endBefore));if(spec.limit)rows=Object.fromEntries(Object.entries(rows).slice(spec.last?-spec.limit:0,spec.last?undefined:spec.limit));return rows;}
 const db={ref:p=>{const spec={},ref={get:async()=>({val:()=>Object.keys(spec).length?query(f.get(p),spec):f.get(p)}),orderByChild:v=>(spec.orderBy=v,ref),orderByKey:()=>(spec.orderBy='$key',ref),equalTo:v=>(spec.equalTo=v,ref),startAt:v=>(spec.startAt=v,ref),limitToFirst:v=>(spec.limit=v,ref),limitToLast:v=>(spec.limit=v,spec.last=true,ref)};return ref;}};
 const auth={verifyIdToken:async(token,revoked)=>{assert.equal(token,'FIXTURE_ONLY');assert.equal(revoked,true);return structuredClone(f.identity.claims);}};
 const gateway=at('cotizador/labor-write-gateway').createLaborWriteGateway({auth,db,store,guard,enabled:true,inventoryCohort:f.cohort}),authorize=req=>gateway.authorize(req);
 const refs=at('cotizador/inventory-reference-runtime').create({enabled:true,cohort:f.cohort,store,now:clock});
 const lifecycle=at('cotizador/ot-lifecycle').createOTLifecycle({db,store,guard,enabled:true,commercialPages:true,now:clock,resolveReference:refs.resolveReference,createReferencePhase:refs.createReferencePhase});
 const isInstalled=async({read}={})=>{const state=await f.cohort.capabilities({read});if(!state.installed)return false;await f.cohort.assertAdmission({read});return true;};
 const inventory=at('cotizador/ot-inventory').createOTInventory({db,store,guard,enabled:true,isInstalled,now:clock,resolveReference:refs.resolveReference,createReferencePhase:refs.createReferencePhase,lifecycle});
 const metadata=at('cotizador/ot-metadata').createOTMetadata({db,store,guard,enabled:true,isInstalled,now:clock}),structure=at('cotizador/ot-structure').createOTStructure({db,store,guard,enabled:true,isInstalled,now:clock});
 const stock=at('cotizador/office-stock').create({authorize,store,guard,enabled:true,resolver:refs.stockResolver,initialInventoryReference:f.initialInventoryReference,queryPage:store.queryPage,now:clock});
 const link=at('cotizador/office-stock-link-command').create({authorize,store,guard,enabled:true,assertBarrier:f.cohort.assertAdmission,resolveOperation:(actor,body)=>gateway.resolve(actor,body),now:clock});
 const businessAuth=at('cotizador/user-access').createBusinessAuth(auth,db),users=at('cotizador/user-directory').createUserDirectory({auth:businessAuth,db,enabled:true});
 const employees=at('cotizador/employee-directory').createEmployeeDirectory({auth:businessAuth,db,queryReader:store.query}),providers=at('cotizador/supplier-directory').createSupplierDirectory({authorize:employees.authorize,db});
 const posts=[],results=[],waiters=new Set();let lostPath=null;
 const beforeNumber=f.get(f.Numbering.PATH).lastNumber;
 function label(path,body){if(path==='/compras/ordenes/crear')return'manualCreate';if(path==='/compras/ordenes/inventario')return body?.kind;if(path==='/ot/inventario'||path==='/ot/ciclo')return body?.kind==='consume'?'custody':body?.kind;return path;}
 async function readBody(req,max){let body='';for await(const part of req){body+=part;if(Buffer.byteLength(body)>max)throw Object.assign(Error('Body demasiado grande'),{statusCode:413});}const parsed=JSON.parse(body||'{}');req.__qaBody=parsed;return parsed;}
 function send(res,status,value){const req=res.__qaRequest;if(value?.committed===true){results.push({label:label(new URL(req.url,'http://localhost').pathname,req.__qaBody),result:structuredClone(value),used:false});for(const notify of waiters)notify();if(lostPath===new URL(req.url,'http://localhost').pathname){lostPath=null;res.writeHead(503);res.end();return;}}res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
 const observedInventory=Object.create(inventory);observedInventory.execute=async(...args)=>{try{return await inventory.execute(...args);}catch(error){console.error('REAL_OT_ERROR '+JSON.stringify({code:error.code,message:error.message,stack:error.stack,body:args[1]}));throw error;}};
 const purchases=at('cotizador/inventory-command-http').create({purchase:composed.host,link,stock,readBody,send}),ots=at('cotizador/ot-command-http').create({authorize,metadata,structure,inventory:observedInventory,readBody,send});
 async function apiHandler(req,res){res.__qaRequest=req;const url=new URL(req.url,'http://localhost'),path=url.pathname;if(req.method==='POST'&&(composed.host.routes.some(r=>r.path===path)||['/ot/inventario','/ot/metadata','/ot/ciclo'].includes(path)))posts.push(path);
  if(await purchases(path,req,res)||await ots(path,req,res))return;
  try{
   const actor=await authorize({...req,method:'POST',headers:req.headers,url:req.url});
   if(path==='/laboral/capacidades'){assert.equal(req.method,'POST');const body=await readBody(req,128);assert.equal(Object.keys(body).length,0);return send(res,200,{ok:true,inventory:await composed.host.capabilities()});}
   if(path==='/laboral/operacion'){assert.equal(req.method,'POST');return send(res,200,await gateway.resolve(actor,await readBody(req,2048)));}
   if(path==='/__qa/session'){const profile=await users.profile(await users.authorize({method:'POST',headers:req.headers,url:req.url}));return send(res,200,{uid:actor.uid,role:f.get('sv_chat_roles/'+actor.uid).rol,name:profile.profile.nombre||actor.uid,permissions:f.get('sv_permisos')});}
   if(path==='/__qa/read'){assert.equal(req.method,'GET');const spec=JSON.parse(url.searchParams.get('spec'));assert.ok(spec?.path&&spec.path!=='sisventas','No SDK root read');if(spec.path==='.info/connected')return send(res,200,true);if(spec.path==='.info/serverTimeOffset')return send(res,200,0);return send(res,200,Object.keys(spec).some(k=>!['path','key'].includes(k))?query(await store.readAsUser(spec.path,actor),spec):await store.readAsUser(spec.path,actor));}
   if(path.startsWith('/usuarios/')){const who=await users.authorize(req);return send(res,200,{ok:true,...await(path.endsWith('/perfil')?users.profile(who):users.directory(who,path.endsWith('/administracion')))});}
   if(path==='/laboral/directorio')return send(res,200,{ok:true,...await employees.read(await employees.authorize(req))});
   if(path==='/compras/proveedores')return send(res,200,{ok:true,proveedores:await providers.read(await providers.authorize(req))});
   const stockMethod={'/stock-oficina/listar':'list','/stock-oficina/detalle':'detail','/stock-oficina/historial':'history','/stock-oficina/ajustar':'save'}[path];if(stockMethod)return send(res,200,{ok:true,...await stock[stockMethod](await stock.authorize(req),await readBody(req,4096))});
   if(path==='/ot/ciclo/disponible')return send(res,200,await lifecycle.available(actor,Object.fromEntries(url.searchParams)));
   if(path==='/ot/ciclo')return send(res,200,await lifecycle.execute(actor,await readBody(req,2*1024*1024)));
   throw Object.assign(Error('Falta montaje real de '+path),{statusCode:404});
  }catch(error){send(res,error.statusCode||503,{ok:false,code:error.code,mensaje:error.message,...at('cotizador/ot-warehouse-receipt').errorDetails(error)});}
 }
 return {apiHandler,gateway,structure,inventory,lifecycle,stock,counts:()=>({businessPosts:posts.length,commits:composed.counts().commits,numberingAllocations:f.get(f.Numbering.PATH).lastNumber-beforeNumber}),armPostCommitAckLoss:async path=>{assert.equal(lostPath,null);lostPath=path;},waitCommitted:name=>new Promise((resolve,reject)=>{let timer;const check=()=>{const next=results.find(x=>!x.used&&x.label===name);if(next){next.used=true;clearTimeout(timer);waiters.delete(check);resolve(next.result);}};timer=setTimeout(()=>{waiters.delete(check);reject(Error('No hubo commit real '+name));},20000);waiters.add(check);check();})};
}
module.exports={createFixture,startFullAppServer,checkGenuineReadiness,createApiMount};
if(require.main===module){checkGenuineReadiness({sourceRoot:process.env.SV_NATIVE_SOURCE_ROOT,uiRoot:process.env.SV_NATIVE_UI_ROOT,baselineRulesPath:process.env.SV_NATIVE_RULES_BASELINE,baselineDigest:process.env.SV_NATIVE_RULES_DIGEST,nativeFactoryFile:process.env.SV_NATIVE_APPLICATION_FIXTURE}).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error);process.exitCode=1;});}
