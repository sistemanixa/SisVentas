'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {setup}=require('./helpers/purchase-linked-order-store-fixture.cjs'),{apply}=require('./helpers/labor-ui-flow.cjs');
const {createLaborGuard,digest}=require('../cotizador/labor-guard'),{createLaborRtdbStore}=require('../cotizador/labor-rtdb-store');
const Projection=require('../cotizador/office-stock-order-projections'),Order=require('../cotizador/office-stock-order'),Policy=require('../cotizador/office-stock-order-policy'),Purchase=require('../cotizador/purchase-inventory-command'),Source=require('../cotizador/purchase-source-cost-protocol');
async function compose(role='administrativo'){
 const f=await setup('receive',{role}),patches=[],calls=[];let clock=f.input.at,latest,late,lose=false,hooks=0;
 apply(f.state,{sv_operational_read_config:{schema:1,ready:true},[Order.CONFIG]:{schema:1,generation:'linked-composition',writerVersion:1,ready:true,writersClosed:true},[Order.FENCE]:{schema:1,generation:'linked-composition',revision:10,inventoryCount:1,positiveCount:1,invalidCount:0},sv_stock_order_cohort:{schema:1,generation:'linked-composition',writerVersion:1,closed:true}});
 const store=createLaborRtdbStore({databaseURL:'http://127.0.0.1:1/?ns=fiction-only',now:()=>clock,accessToken:async()=>{if(late&&latest){const fn=late;late=null;fn(latest);}return 'fiction-only';},fetchImpl:async(url,opt)=>{
  const u=new URL(url),path=decodeURIComponent(u.pathname).replace(/^\//,'').replace(/\.json$/,''),body=opt.body?JSON.parse(opt.body):null,override=JSON.parse(u.searchParams.get('auth_variable_override')||'null');calls.push({method:opt.method,path,override});
  if(opt.method==='GET'){a.notEqual(path,'sisventas');return new Response(JSON.stringify(f.get(path)));}
  if(opt.method==='PUT'){a.equal(path,'sv_labor_guard');a.equal(f.get(path),null);apply(f.state,{[path]:body});}
  else if(opt.method==='DELETE')apply(f.state,{[path]:null});
  else {a.equal(opt.method,'PATCH');a.equal(f.get('sv_labor_guard/fence'),latest.lease.fence);patches.push(body);apply(f.state,body);if(lose){lose=false;throw Error('fiction lost ACK');}}
  return new Response('null');
 }});
 const original=store.commit;store.commit=async(patch,lease,actor)=>{latest={patch,lease,actor};return original(patch,lease,actor);};
 const projection=Projection.create({enabled:true,verifyCohort:async({read,actor})=>{const c=await read('sv_stock_order_cohort'),p=await read('sv_chat_roles/'+actor.uid),r=await read('sv_permisos/'+actor.role);return {schema:1,generation:c?.generation,writerVersion:c?.writerVersion,verified:c?.closed===true&&p?.activo===true&&p.rol===actor.role&&digest(r)===actor.permissionDigest};}});
 const guard=createLaborGuard({store,now:()=>clock,delay:async()=>{},operationalSummaries:true,saleFinancialDependencies:true,commercialPages:true,clientAccounts:true,clientHistory:true,stockOrderProjections:{augment:async options=>{hooks++;return projection.augment(options);}}});
 const admission=f.sourceAuthority;
 const command=Purchase.create({store,guard,authorize:f.authorize,assertAdmission:async({read})=>admission.verify(await read('sv_stock_reference_config/activation')),resolveReference:async()=>({...f.input.references.p,readSet:[]}),enabled:true,linkedEnabled:true,now:()=>clock});
 return {...f,store,guard,calls,patches,run:()=>command.execute({},f.body),setLate:fn=>late=fn,lose:()=>lose=true,tick:()=>clock+=60000,get latest(){return latest;},get hooks(){return hooks;}};
}
for(const role of ['admin','administrativo'])test('linked receive + Order + SourceCost + Financial TRUE through real guard/store '+role,async()=>{
 const f=await compose(role),before=f.protectedState(),sale=f.get('sisventas/ventas/s'),inv=f.get('sisventas/inventario_operativo/physical');await f.run();a.equal(f.patches.length,1);a.deepEqual(f.protectedState(),before);
 const patch=f.patches[0],{actor,lease}=f.latest,base=Policy.sourcePatch(actor,lease,patch,f.input.at),token=f.calls.find(c=>c.method==='PATCH').override.token;
 a.equal(token.svStockOrderWriterVersion,1);a.equal(token.svPurchaseSourceCostVersion,1);a.equal(token.svPurchaseSourceCostBasePatchHash,digest(base));a.deepEqual(Source.claims(actor,lease,base).svPurchaseSourceCostVersion,1);a.equal(Object.hasOwn(base,Order.FENCE),false);
 a.equal(f.get(Order.FENCE+'/revision'),11);const updated=f.get('sisventas/inventario_operativo/physical');a.equal(f.get(Order.INDEX+'/physical/'+Order.RANK),-updated.general);a.equal(f.get(Order.INDEX+'/physical/'+Order.HASH),Order.classify(updated).hash);a.deepEqual(updated.unknown,inv.unknown);a.deepEqual(updated.asignaciones.other,inv.asignaciones.other);
 for(const key of ['total','subtotal','totalPagado','iva','descuento','pagos','usuario'])a.deepEqual(f.get('sisventas/ventas/s/'+key),sale[key]);a.equal(f.get('sisventas/ventas/s/items')[0].punit,100);a.equal(f.get('sisventas/ventas/s/costoTotal'),22);a.equal(f.get('sv_permisos/'+role+'/acciones/ventas/corregirCosto'),false);
});
test('linked lost ACK recovers exact receipt without second PATCH or hook',async()=>{const f=await compose();f.lose();await a.rejects(f.run(),/lost ACK/);const receipt=f.get('sv_labor_receipts/'+f.body.id),hooks=f.hooks;const result=await f.run();a.deepEqual(result,receipt.result);a.equal(f.patches.length,1);a.equal(f.hooks,hooks);a.deepEqual(f.get('sv_labor_receipts/'+f.body.id),receipt);});
for(const change of ['source','rank','fence','receipt','extra','expiry'])test('linked real store rejects final '+change+' before PATCH',async()=>{const f=await compose();f.setLate(({patch,actor})=>{if(change==='source')patch['sisventas/ventas/s'].costoTotal++;if(change==='rank')patch[Order.INDEX+'/physical'][Order.RANK]--;if(change==='fence')patch[Order.FENCE].revision++;if(change==='receipt')patch['sv_labor_receipts/'+actor.opId].actorUid='other';if(change==='extra')patch['sisventas/pagos/forged']={monto:1};if(change==='expiry')f.tick();});await a.rejects(f.run());a.ok(f.latest,'must reach actual commit before mutation rejection');a.equal(f.patches.length,0);});
test('real store rejects missing lease deadline without IO',async()=>{const f=await compose();await f.run();const count=f.calls.length;await a.rejects(f.store.commit(f.latest.patch,{...f.latest.lease,expiresAt:undefined},f.latest.actor),{code:'SV_LABOR_LEASE_EXPIRED'});a.equal(f.calls.length,count);});
