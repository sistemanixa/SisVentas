'use strict';
const Policy=require('./ot-inventory-policy'),Life=require('./ot-lifecycle-model'),Physical=require('./ot-physical-confirmation-model'),Money=require('./commercial-models/commercial-money');
const sum=(...values)=>Money.quantitySum(values),fail=()=>Object.assign(Error('La entrega requiere cantidades e historia originales verificadas.'),{statusCode:409,code:'SV_OT_STANDALONE_DELIVERY_REVIEW'});
const qty=value=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw fail();return value;};
function plan({ot,otKey,changes,references,inventories,heldByOthers,actor,at,operationId,commandContext}){
 Policy.standalone(ot);
 if(!['admin','administrativo'].includes(actor?.role)||!actor.uid||!operationId||!Number.isSafeInteger(at)||!Array.isArray(ot.materiales)||ot.items&&Object.keys(ot.items).length||!ot.tecnico||!changes||Object.keys(changes).some(key=>!['entregas','confirmacionStock'].includes(key))||!Array.isArray(changes.entregas)||!changes.entregas.length||changes.entregas.length>100)throw fail();
 const Warehouse=require('./ot-warehouse-receipt'),next=structuredClone(ot),ledgers=new Map(),selected=new Set(),items=[],warehouseEvents=[];
 for(const entry of changes.entregas){
  if(!entry||Object.keys(entry).some(key=>!['index','cantidad'].includes(key))||!Number.isSafeInteger(entry.index)||entry.index<0||selected.has(entry.index))throw fail();selected.add(entry.index);
  const row=next.materiales[entry.index],ref=references.get(entry.index);if(!row||!ref||Life.service(row)||row.stockPendiente||row._recuperado||row.origenMaterialHistorico||Life.closed(ot)&&row.adicionalOT!==true)throw fail();
  const delivered=qty(row.entregada??0),installed=qty(row.instalada),returned=qty(row.devuelta??0),delta=qty(entry.cantidad);
  if(!delta||sum(delivered,delta)>qty(row.vendida)||!row.stockRegistro&&(delivered!==0||installed!==0||['devuelta','devueltaPendiente','enTecnico','danada','faltante'].some(key=>qty(row[key]??0)!==0)||row.stockRevision!=null&&row.stockRevision!==0||row.entregadoEn||row.recibidoEn))throw fail();
  if(!ledgers.has(ref.inventoryKey))ledgers.set(ref.inventoryKey,structuredClone(inventories.get(ref.inventoryKey)));
  const inventory=ledgers.get(ref.inventoryKey);if(!inventory)throw fail();const allocation=require('./ot-inventory-model').allocation(ot,otKey,row,commandContext),original=inventories.get(ref.inventoryKey);
  const reserveTotal=inv=>Object.values(inv.rendicionesOT||{}).filter(receipt=>receipt.venta===allocation).reduce((total,receipt)=>sum(total,qty(receipt.enReserva??0)),0);
  const unreceipted=Math.max(0,sum(qty(heldByOthers.get(JSON.stringify([ref.inventoryKey,allocation]))??heldByOthers.get(ref.inventoryKey)??0),-reserveTotal(original))),own=qty(inventory.rendicionesOT?.[row.stockRegistro]?.enReserva??0),held=sum(reserveTotal(inventory),-own,unreceipted);
  const result=Physical.confirm({kind:'delivery',inventory,productKey:ref.receiptIdentityKey,otKey,rowKey:String(entry.index),allocation,beforeDelivered:delivered,targetDelivered:sum(delivered,delta),beforeInstalled:installed,targetInstalled:installed,returned,heldByOthers:held,receipt:row.stockRegistro,revision:row.stockRevision??0,actor:{uid:actor.uid,role:actor.role,allowed:true},operationId,at});
  const event=Warehouse.deliveryEvent({beforeInventory:inventory,result,quantity:delta,otKey,rowKey:String(entry.index),reference:ref,operationId,actorUid:actor.uid});warehouseEvents.push(event);
  ledgers.set(ref.inventoryKey,result.inventory);Object.assign(row,{entregada:sum(delivered,delta),custodiaActiva:true,custodiaClasificada:false,entregadoEn:at,entregadoPor:actor.name,entregadoA:ot.tecnico,stockRegistro:result.receipt,stockRevision:result.revision,stockPendiente:false});
  items.push({index:entry.index,codigo:row.cod||row.codigo||'',descripcion:row.desc||row.descripcion||'',cantidad:delta,unidad:row.unidad||'unidades',adicional:row.adicionalOT===true,productoKey:ref.productKey,descontadoGeneral:event.debitedGeneral,descontadoReserva:event.debitedReserve,faltanteAutorizado:event.shortage});
 }
 const deliveryQuote=Warehouse.quote({ot,references,inventories,heldByOthers,events:warehouseEvents,context:commandContext});Warehouse.confirm(deliveryQuote,changes.confirmacionStock);Warehouse.bind(commandContext,warehouseEvents);
 if(next.remitosEntrega&&typeof next.remitosEntrega!=='object'||Array.isArray(next.remitosEntrega)||next.audit!=null&&!Array.isArray(next.audit))throw fail();
 const receipt={id:operationId,numero:'RE-'+String(ot.id||otKey)+'-'+(Object.keys(next.remitosEntrega||{}).length+1),otId:ot.id||'',tecnico:ot.tecnico,cliente:ot.cliente||'',fecha:at,entregadoPor:actor.name,entregadoPorUid:actor.uid,items};
 next.remitosEntrega={...(next.remitosEntrega||{}),[operationId]:receipt};Object.assign(next,{custodiaIniciada:true,custodiaRendida:false,custodiaTecnico:ot.tecnico,custodiaEntregadaEn:at});next.audit=[...(next.audit||[]),{fecha:new Date(at).toISOString(),usuario:actor.name,uid:actor.uid,accion:'Entrega '+receipt.numero+' al técnico',tipo:'ot_inventory_delivery',operacionId:operationId}];
 return{ot:next,inventories:ledgers,warehouseEvents};
}
module.exports={plan};
