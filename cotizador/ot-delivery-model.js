'use strict';
const {digest}=require('./labor-guard');
const Lifecycle=require('./ot-lifecycle-model'),Money=require('./commercial-models/commercial-money'),State=require('./ot-material-state');
const Physical=require('./ot-physical-confirmation-model');
const sum=values=>Money.quantitySum(values);
const fail=(message,code='SV_OT_DELIVERY_REVIEW')=>Object.assign(Error(message),{statusCode:409,code});
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
function amount(v){if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw fail('La custodia histórica requiere cantidades explícitas verificables.');return v;}
function allocation(ot,m){const id=m.destinoVenta==='nueva'?m.ventaDestinoFbKey:ot.ventaFbKey;return key(id)?id:null;}
function selections(ot,items,catalog={}){if(!Array.isArray(ot.materiales)||!Array.isArray(items)||!items.length||items.length>100)throw fail('Seleccioná materiales conocidos.');const seen=new Set();return items.map(item=>{if(!item||Object.keys(item).some(k=>!['index','qty'].includes(k))||!Number.isInteger(item.index)||item.index<0||seen.has(item.index))throw fail('La selección de materiales no es válida.');seen.add(item.index);const m=ot.materiales[item.index];if(!m||m._recuperado||m.stockPendiente||!key(m.productoKey)||!allocation(ot,m))throw fail('El producto o destino de la entrega requiere revisión.');if(Lifecycle.service(m,catalog[m.productoKey]))throw fail('La entrega física no admite servicios ni mano de obra.','SV_OT_DELIVERY_SERVICE');const qty=amount(item.qty),pending=sum([amount(m.vendida),-amount(m.entregada)]);if(qty<=0||qty>pending)throw fail('La cantidad supera lo pendiente.','SV_OT_DELIVERY_QUANTITY');if(Lifecycle.closed(ot)&&m.adicionalOT!==true)throw fail('La OT cerrada requiere su circuito de corrección.');return{index:item.index,qty,product:m.productoKey,allocation:allocation(ot,m)};});}
function plan({ot,otKey,items,others,inventory,catalog={},actor,operationId,at,atomicStock=false,commandContext}){
 ot=State.normalizePristine(ot,{inventory,otKey,...(atomicStock&&commandContext?{deliveryContext:commandContext,selectedIndexes:items?.map(item=>item.index),catalog}:{})});others=Object.fromEntries(Object.entries(others).map(([id,record])=>[id,id===otKey?structuredClone(ot):State.normalizePristine(record,{inventory,otKey:id})]));
 const selected=selections(ot,items,catalog),groups=new Map();
 for(const s of selected){const name=s.product+'/'+s.allocation,g=groups.get(name)||{...s,qty:0};g.qty=sum([g.qty,s.qty]);groups.set(name,g);}
 if(!atomicStock)for(const g of groups.values()){
  const inv=inventory[g.product];if(!inv||!inv.asignaciones||!Object.hasOwn(inv.asignaciones,g.allocation))throw fail('La asignación de stock requiere revisión.');
  const reserved=amount(inv.asignaciones[g.allocation].reservado),global=amount(inv.reservado);amount(inv.general);amount(inv.consumido);if(global<reserved)throw fail('La reserva global no coincide con la asignación.');let held=0;
  for(const [id,record]of Object.entries(others)){
   if(!Array.isArray(record.materiales))throw fail('Una OT vinculada tiene custodia desconocida.');
   for(const m of record.materiales){if(m.productoKey!==g.product)continue;const destination=allocation(record,m);if(destination===null)throw fail('Una custodia del producto tiene destino ambiguo.');if(destination!==g.allocation)continue;
    State.bounds(m,{unchanged:true});
    const delivered=amount(m.entregada),installed=amount(m.instalada),returned=amount(m.devuelta);if(sum([installed,returned])>delivered||delivered>0&&m.custodiaActiva!==true)throw fail('Una custodia vinculada es inconsistente.');
    if(installed>0){const receipt=inv.rendicionesOT?.[m.stockRegistro];if(!receipt||receipt.ot!==id||receipt.venta!==g.allocation||receipt.revision!==m.stockRevision||receipt.instalada!==installed)throw fail('La instalación histórica no tiene consumo verificable.');}
    held=sum([held,delivered,-installed,-returned]);
   }
  }
  if(held>reserved||g.qty>sum([reserved,-held]))throw fail('No hay material libre de otras custodias para esta entrega.','SV_OT_DELIVERY_AVAILABILITY');
 }
 const next=structuredClone(ot),inventoryChanges=structuredClone(inventory),receipt={id:operationId,numero:'RE-'+ot.id+'-'+(Object.keys(ot.remitosEntrega||{}).length+1),otId:ot.id,fecha:at,entregadoPorUid:actor.uid,entregadoPor:actor.name,tecnico:ot.tecnico||'',cliente:ot.cliente||'',items:[]};
 for(const s of selected){const m=next.materiales[s.index],delivered=m.entregada;
  if(atomicStock){
   let held=0;
   for(const [id,original]of Object.entries(others)){
    const record=id===otKey?next:original;if(!Array.isArray(record.materiales))throw fail('Una OT vinculada tiene custodia desconocida.');
    for(let i=0;i<record.materiales.length;i++){const row=record.materiales[i];if(id===otKey&&i===s.index||row.productoKey!==s.product)continue;
     const destination=allocation(record,row);if(!destination)throw fail('Una custodia del producto tiene destino ambiguo.');if(destination!==s.allocation)continue;
     State.bounds(row,{unchanged:true});const d=amount(row.entregada),installed=amount(row.instalada),returned=amount(row.devuelta);if(sum([installed,returned])>d||d>0&&row.custodiaActiva!==true)throw fail('Una custodia vinculada es inconsistente.');
     if(installed>0){const entry=inventoryChanges[s.product]?.rendicionesOT?.[row.stockRegistro];if(!entry||entry.ot!==id||entry.venta!==s.allocation||entry.revision!==row.stockRevision||entry.instalada!==installed)throw fail('La instalación histórica no tiene consumo verificable.');}
     held=sum([held,d,-installed,-returned]);
    }
   }
   let result;try{result=Physical.confirm({kind:'delivery',inventory:inventoryChanges[s.product],productKey:s.product,otKey,rowKey:String(s.index),allocation:s.allocation,beforeDelivered:delivered,targetDelivered:sum([delivered,s.qty]),beforeInstalled:amount(m.instalada),targetInstalled:amount(m.instalada),returned:amount(m.devuelta),heldByOthers:held,receipt:m.stockRegistro,revision:m.stockRevision??0,actor:{...actor,allowed:true},operationId,at});}catch(error){throw fail(error.message);}
   inventoryChanges[s.product]=result.inventory;m.stockRegistro=result.receipt;m.stockRevision=result.revision;m.stockPendiente=false;
  }
  m.entregada=sum([delivered,s.qty]);m.custodiaActiva=true;m.custodiaClasificada=false;m.entregadoEn=at;m.entregadoPor=actor.name;m.entregadoA=ot.tecnico||'';receipt.items.push({index:s.index,codigo:m.cod||m.codigo||'',descripcion:m.desc||m.descripcion||'',cantidad:s.qty,unidad:String(m.unidad||catalog[s.product]?.unidad||'unidades'),adicional:m.adicionalOT===true,productoKey:s.product,ventaFbKey:s.allocation});}
 next.remitosEntrega={...next.remitosEntrega,[operationId]:receipt};next.custodiaIniciada=true;next.custodiaRendida=false;next.custodiaTecnico=ot.tecnico||'';next.audit=[...Object.values(ot.audit||{}),{tipo:'entrega_materiales',operationId,actorUid:actor.uid,fecha:at,accion:'Entrega parcial registrada · '+receipt.numero}];
 return{ot:next,receipt,selectionHash:digest(selected),...(atomicStock?{inventory:inventoryChanges}:{})};
}
module.exports={key,allocation,selections,plan};
