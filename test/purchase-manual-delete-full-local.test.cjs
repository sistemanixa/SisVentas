'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {start}=require('../scripts/dev-purchase-delete-local.cjs'),R=require('../cotizador/purchase-manual-delete-review'),{digest,createLaborGuard}=require('../cotizador/labor-guard');
test('full local frontend preserves assets and real command stays closed until exact reviewed rules and authentication',{timeout:30000},async()=>{
 const orders={draft:{numero:'OC-TEST-49',estado:'borrador',origen:'manual',items:[{productoKey:'p',codigo:'P',cantidadOrdenada:2,cantidadRecibida:0}]},received:{numero:'OC-TEST-48',estado:'recibida',origen:'manual',items:[{productoKey:'p',codigo:'P',cantidadOrdenada:2,cantidadRecibida:2}]}};
 const inventory={general:2,enCompra:2,reservado:0,consumido:0};
 const backend=await require('./helpers/coordinated-backend.cjs').createCoordinatedBackend({ordenes:orders,inventario_operativo:{p:inventory}});
 backend.state.sv_labor_config.writerSchema=2;backend.state.sv_operational_read_config={schema:1,ready:true,generation:'local-test'};backend.state.sv_permisos=require('../js/core/permission-index').build({admin:{bloqueados:[],acciones:{ordenes:{eliminar:true}}}});backend.state.sv_permisos.admin.indiceRevision=1;
 delete backend.state.sv_client_history;delete backend.state.sv_client_history_config;
 const prepared=R.prepare({orders,orderKey:'draft',protectedOrderKey:'received',inventoryByKey:{p:inventory},configs:backend.state,expiresAt:Date.now()+60000});
 const review=R.create({env:{PURCHASE_MANUAL_DELETE_READY:'true',PURCHASE_MANUAL_DELETE_REVIEW_JSON:prepared.reviewJson,PURCHASE_MANUAL_DELETE_REVIEW_SHA256:prepared.reviewSha256},runtime:()=>({coordinated:true,readOnly:false,commercialPages:true,clientAccounts:true,operationalSummaries:true})});
 const guard=createLaborGuard({store:backend.store,commercialPages:true,clientAccounts:true,operationalSummaries:true,clientHistory:false,delay:async()=>{}});
 let rules='{"rules":{"old":true}}';const correct='{"rules":{"reviewed":true}}',expectedRulesHash=digest(JSON.parse(correct));
 const authorize=async req=>{if(req.headers.authorization!=='Bearer synthetic-test')throw Object.assign(Error('Sesión requerida.'),{statusCode:401});return {uid:'u',claims:{uid:'u'}};};
 const local=await start({store:backend.store,guard,review,authorize,expectedRulesHash,readRules:async()=>rules});
 const request=(route,body={},headers={Authorization:'Bearer synthetic-test'})=>fetch(local.url+'/__purchase_delete_local/'+route,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  const active=require('./helpers/active-app').readActiveApp();
  const index=await (await fetch(local.url+'/')).text();assert.ok(index.includes('js/'+active.filename),'Serves the actual immutable application declared by the source index');
  const servedApp=await (await fetch(local.url+'/js/'+active.filename)).text();assert.equal(digest(servedApp.replace(/\r\n/g,'\n')),digest(active.source),'Application asset is preserved byte for byte after newline normalization');assert.match(index,/__purchase_delete_local\/bridge\.js/);assert.match(index,/page-ordenes/);
  assert.equal((await fetch(local.url+'/cotizador/purchase-order-delete.js')).status,404);
  assert.equal((await fetch(local.url+'/docs/CONTEXTO_ACTUAL.md')).status,404);
  assert.equal((await request('capability',{},{})).status,401);
  assert.equal((await (await request('capability')).json()).enabled,false);
  const body={id:'local-complete-reviewed',orderKey:'draft',expectedHash:digest(orders.draft)};
  assert.equal((await request('delete',body)).status,503);assert.equal(backend.commits.length,0);
  rules=correct;assert.equal((await (await request('capability')).json()).enabled,true);
  assert.equal((await request('delete',body,{Authorization:'Bearer synthetic-test',Origin:'https://other.invalid'})).status,403);assert.equal(backend.commits.length,0);
  const response=await request('delete',body);assert.equal(response.status,200,await response.text());
  assert.equal(backend.get('sisventas/ordenes/draft'),null);assert.deepEqual(backend.get('sisventas/ordenes/received'),orders.received);assert.equal(backend.get('sisventas/inventario_operativo/p').general,2);assert.equal(backend.get('sisventas/inventario_operativo/p').enCompra,0);assert.equal(backend.commits.length,1);
 }finally{await local.close();}
});
