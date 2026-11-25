'use strict';
// Composición local extraída del setup G/H/RESTStore de purchase-manual-create-core.
// Requiere fixture nativa E/B ya preparada: NO fabrica archivos/pins/cohorte/contador.
const assert=require('node:assert/strict'),path=require('node:path');
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
 const coordinated=await at('test/helpers/coordinated-backend.cjs').createCoordinatedBackend(f.get('sisventas'));
 for(const [key,value]of Object.entries(coordinated.state))if(!['sisventas','sv_chat_roles','sv_permisos','sv_labor_guard'].includes(key))f.set(key,value);
 const financial=await at('cotizador/sale-financial-dependencies-model').prepare({ventas:f.get('sisventas/ventas'),gastos:f.get('sisventas/gastos'),ctaemp:f.get('sisventas/ctaemp'),comisiones_generacion:f.get('sisventas/comisiones_generacion'),sv_commission_generation:f.get('sv_commission_generation')},{generation:'fiction-full-app-financial'});
 for(const [key,value]of Object.entries(financial.patch))f.set(key,value);
 const order=Order.prepare({inventory:f.get('sisventas/inventario_operativo'),generation:f.document.generation});
 for(const [key,value]of Object.entries(order.patch))f.set(key,value);
 f.set(Order.CONFIG,{...order.config,ready:true,writersClosed:true});f.set(Order.FENCE,order.fence);
 const projector=at('cotizador/office-stock-order-projections').create({enabled:true,verifyCohort:async({read})=>{await f.cohort.mappedAdmission.admit({read});return {schema:1,generation:f.document.generation,writerVersion:1,verified:true};}});
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
module.exports={createFixture};
