'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Fixture=require('./helpers/ot-performance-fixture.cjs'),Index=require('../cotizador/record-list-model'),{digest}=require('../cotizador/labor-guard'),{createOTInventory}=require('../cotizador/ot-inventory'),Source=require('../cotizador/ot-stock-source-authority');
async function fixture({mixed=false,mutate}={}){
 const f=await Fixture.create({rowCount:1,otherCount:0,prepare:data=>{
  const ot=data.sisventas.ordenes_trabajo.ot;for(const field of ['ventaFbKey','ventaId','venta'])delete ot[field];ot.clienteFbKey='client';ot.tecnico='Fiction technician';
  Object.assign(ot.materiales[0],{productoKey:'product0',vendida:2,entregada:0,instalada:0,custodiaActiva:false,adicionalOT:true,destinoVenta:'nueva',ventaDestinoFbKey:'extra',ventaDestinoId:'V-EXTRA'});
  ot.ventasAdicionales={extra:{ventaFbKey:'extra',ventaId:'V-EXTRA',total:12.345,ts:1}};
  data.sisventas.ventas.extra={id:'V-EXTRA',otId:'ot',otNumero:ot.id,clienteFbKey:'client',total:12.345,items:[{cod:'C0',qty:2,punit:6.1725}],pagos:[{monto:3}],comisiones:{keep:4}};
  if(mixed){const row=structuredClone(ot.materiales[0]);for(const field of ['destinoVenta','ventaDestinoFbKey','ventaDestinoId'])delete row[field];ot.materiales.unshift(row);}
  data.sisventas.inventario_operativo.product0={general:1,reservado:0,consumido:0,asignaciones:{}};
  data.sv_ot_inventory_config={schema:1,ready:true,generation:'fiction-generation',referenceMode:'legacy'};
  if(mutate)mutate(data);data.sisventas.listados_resumen.ordenes_trabajo.ot=Index.summary('ordenes_trabajo',ot);
 }});
 let sourceChecks=0;
 const guard={run:(actor,work)=>f.runtime.guard.run(actor,scope=>work({...scope,update:async patch=>{
  const full={...patch,sv_labor_guard:null,['sv_labor_receipts/'+actor.opId]:{actorUid:actor.uid,digest:scope.lease.digest,fence:scope.lease.fence}};
  await Source.validate({actor,lease:scope.lease,patch:full,readFresh:async path=>f.get(path)});sourceChecks++;
  await assert.rejects(Source.validate({actor:{...actor,otInventory:{...actor.otInventory}},lease:scope.lease,patch:full,readFresh:async path=>f.get(path)}));
  await assert.rejects(Source.validate({actor,lease:scope.lease,patch:{...full,'sisventas/ventas/extra/total':0},readFresh:async path=>f.get(path)}),{code:'SV_OT_STOCK_SOURCE_AUTHORITY'});
  return scope.update(patch);
 }}))};
 return {...f,api:createOTInventory({...f.runtime,guard,enabled:true,isInstalled:async()=>true}),sourceChecks:()=>sourceChecks,body:(id,kind,changes)=>({id,kind,otKey:'ot',expectedOTHash:digest(f.get('sisventas/ordenes_trabajo/ot')),changes})};
}
async function delivery(f,index=0){const changes={entregas:[{index,cantidad:2}]};let quote;await assert.rejects(f.api.execute(f.identity,f.body('additional-preview','delivery',changes)),error=>{quote=error.deliveryQuote;return error.code==='SV_OT_SHORTAGE_CONFIRMATION_REQUIRED';});assert.equal(f.commits.length,0);await f.api.execute(f.identity,f.body('additional-delivery','delivery',{...changes,confirmacionStock:quote}));}
test('standalone additional delivery -> rendition -> partial returns keeps Sale attribution and only real backing',async()=>{
 const f=await fixture(),sale=structuredClone(f.get('sisventas/ventas/extra'));await delivery(f);
 let ot=f.get('sisventas/ordenes_trabajo/ot'),row=ot.materiales[0],receipt=f.get('sisventas/inventario_operativo/product0/rendicionesOT/'+row.stockRegistro);assert.equal(receipt.venta,'extra');assert.equal(receipt.warehouse.events['additional-delivery'].debitedGeneral,1);assert.equal(receipt.warehouse.events['additional-delivery'].shortage,1);
 await f.api.execute(f.identity,f.body('additional-rendition','consume',{rows:[{rowIndex:0,instalada:0,devueltaPendiente:2,enTecnico:0,danada:0,faltante:0}],custodiaRendida:true}));
 await f.api.execute(f.identity,f.body('additional-return-one','return',{receptions:[{rowIndex:0,cantidad:1}]}));const last=f.body('additional-return-two','return',{receptions:[{rowIndex:0,cantidad:1}]});await f.api.execute(f.identity,last);await f.api.execute(f.identity,last);
 assert.equal(f.get('sisventas/inventario_operativo/product0/general'),1);assert.equal(f.commits.length,4);assert.equal(f.sourceChecks(),4);assert.deepEqual(f.get('sisventas/ventas/extra'),sale);
 ot=f.get('sisventas/ordenes_trabajo/ot');for(const field of ['ventaFbKey','ventaId','venta'])assert.equal(ot[field],undefined);
});
test('standalone additional installation has no second debit; shortage return cannot credit installed real stock',async()=>{
 const f=await fixture();await delivery(f);await f.api.execute(f.identity,f.body('additional-install','consume',{rows:[{rowIndex:0,instalada:1,devueltaPendiente:1,enTecnico:0,danada:0,faltante:0}],custodiaRendida:true}));await f.api.execute(f.identity,f.body('additional-return-missing','return',{receptions:[{rowIndex:0,cantidad:1}]}));assert.equal(f.get('sisventas/inventario_operativo/product0/general'),0);assert.equal(f.get('sisventas/inventario_operativo/product0/consumido'),1);
});
test('standalone additional rejects missing/foreign/retargeted originals with zero writes',async()=>{
 for(const mutate of [data=>delete data.sisventas.ventas.extra,data=>data.sisventas.ventas.extra.otId='other',data=>data.sisventas.ventas.extra.clienteFbKey='other',data=>delete data.sisventas.ordenes_trabajo.ot.ventasAdicionales.extra,data=>data.sisventas.ordenes_trabajo.ot.materiales[0].ventaDestinoId='other',data=>data.sisventas.ventas.extra.otNumero='OT-OTHER']){const f=await fixture({mutate});await assert.rejects(f.api.execute(f.identity,f.body('additional-invalid','delivery',{entregas:[{index:0,cantidad:1}]})),{code:'SV_OT_ADDITIONAL_DESTINATION_REVIEW'});assert.equal(f.commits.length,0);}
});
test('same product in standalone and extra-sale rows retains independent allocation custody',async()=>{
 const f=await fixture({mixed:true});await delivery(f,1);
 const ot=f.get('sisventas/ordenes_trabajo/ot');assert.equal(ot.materiales[0].entregada,0);assert.equal(ot.materiales[1].entregada,2);
 await f.api.execute(f.identity,f.body('additional-mixed-install','consume',{rowIndex:1,instalada:1}));assert.equal(f.get('sisventas/inventario_operativo/product0/general'),0);assert.equal(f.get('sisventas/inventario_operativo/product0/asignaciones/extra/consumido'),1);
});
test('additional Sale changed during fresh authorized reread aborts before stock commit',async()=>{
 const f=await fixture();let reads=0;f.onRequest(entry=>{if(entry.path==='sisventas/ventas/extra'&&entry.method==='GET'&&++reads===2)f.set('sisventas/ventas/extra/otId','other');});
 await assert.rejects(f.api.execute(f.identity,f.body('additional-stale-sale','delivery',{entregas:[{index:0,cantidad:1}]})));
 assert.equal(f.commits.length,0);assert.equal(f.get('sisventas/inventario_operativo/product0/general'),1);
});
test('release separates base OT free backing from extra Sale custody on the same ledger',async()=>{
 const f=await fixture({mixed:true}),ot=f.get('sisventas/ordenes_trabajo/ot'),inventory=f.get('sisventas/inventario_operativo/product0');inventory.reservado=1;inventory.asignaciones[ot.id]={reservado:1,consumido:0,liberado:0};f.set('sisventas/inventario_operativo/product0',inventory);await delivery(f,1);
 await f.api.execute(f.identity,f.body('additional-mixed-release','release',{}));
 assert.equal(f.get('sisventas/inventario_operativo/product0/general'),1);assert.equal(f.get('sisventas/inventario_operativo/product0/asignaciones/'+ot.id+'/reservado'),0);assert.equal(f.get('sisventas/inventario_operativo/product0/asignaciones/extra/reservado'),2);
});
