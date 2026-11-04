'use strict';
const {digest}=require('./labor-guard');
const Lifecycle=require('./ot-lifecycle-model'),Money=require('./commercial-models/commercial-money');
const sum=values=>Money.quantitySum(values);
const fail=(message,code='SV_OT_DELIVERY_REVIEW')=>Object.assign(Error(message),{statusCode:409,code});
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
function amount(v){if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw fail('La custodia histórica requiere cantidades explícitas verificables.');return v;}
function allocation(ot,m){const id=m.destinoVenta==='nueva'?m.ventaDestinoFbKey:ot.ventaFbKey;return key(id)?id:null;}
function selections(ot,items){if(!Array.isArray(ot.materiales)||!Array.isArray(items)||!items.length||items.length>100)throw fail('Seleccioná materiales conocidos.');const seen=new Set();return items.map(item=>{if(!item||Object.keys(item).some(k=>!['index','qty'].includes(k))||!Number.isInteger(item.index)||item.index<0||seen.has(item.index))throw fail('La selección de materiales no es válida.');seen.add(item.index);const m=ot.materiales[item.index];if(!m||m._recuperado||m.stockPendiente||!key(m.productoKey)||!allocation(ot,m))throw fail('El producto o destino de la entrega requiere revisión.');const qty=amount(item.qty),pending=sum([amount(m.vendida),-amount(m.entregada)]);if(qty<=0||qty>pending)throw fail('La cantidad supera lo pendiente.','SV_OT_DELIVERY_QUANTITY');if(Lifecycle.closed(ot)&&m.adicionalOT!==true)throw fail('La OT cerrada requiere su circuito de corrección.');return{index:item.index,qty,product:m.productoKey,allocation:allocation(ot,m)};});}
function plan({ot,otKey,items,others,inventory,catalog={},actor,operationId,at}){
 const selected=selections(ot,items),groups=new Map();
 for(const s of selected){const name=s.product+'/'+s.allocation,g=groups.get(name)||{...s,qty:0};g.qty=sum([g.qty,s.qty]);groups.set(name,g);}
 for(const g of groups.values()){
  const inv=inventory[g.product];if(!inv||!inv.asignaciones||!Object.hasOwn(inv.asignaciones,g.allocation))throw fail('La asignación de stock requiere revisión.');
  const reserved=amount(inv.asignaciones[g.allocation].reservado),global=amount(inv.reservado);amount(inv.general);amount(inv.consumido);if(global<reserved)throw fail('La reserva global no coincide con la asignación.');let held=0;
  for(const [id,record]of Object.entries(others)){
   if(!Array.isArray(record.materiales))throw fail('Una OT vinculada tiene custodia desconocida.');
   for(const m of record.materiales){if(m.productoKey!==g.product)continue;const destination=allocation(record,m);if(destination===null)throw fail('Una custodia del producto tiene destino ambiguo.');if(destination!==g.allocation)continue;
    const delivered=amount(m.entregada),installed=amount(m.instalada),returned=amount(m.devuelta);if(sum([installed,returned])>delivered||delivered>0&&m.custodiaActiva!==true)throw fail('Una custodia vinculada es inconsistente.');
    if(installed>0){const receipt=inv.rendicionesOT?.[m.stockRegistro];if(!receipt||receipt.ot!==id||receipt.venta!==g.allocation||receipt.revision!==m.stockRevision||receipt.instalada!==installed)throw fail('La instalación histórica no tiene consumo verificable.');}
    held=sum([held,delivered,-installed,-returned]);
   }
  }
  if(held>reserved||g.qty>sum([reserved,-held]))throw fail('No hay material libre de otras custodias para esta entrega.','SV_OT_DELIVERY_AVAILABILITY');
 }
 const next=structuredClone(ot),receipt={id:operationId,numero:'RE-'+ot.id+'-'+(Object.keys(ot.remitosEntrega||{}).length+1),otId:ot.id,fecha:at,entregadoPorUid:actor.uid,entregadoPor:actor.name,tecnico:ot.tecnico||'',cliente:ot.cliente||'',items:[]};
 for(const s of selected){const m=next.materiales[s.index];m.entregada=sum([m.entregada,s.qty]);m.custodiaActiva=true;m.custodiaClasificada=false;m.entregadoEn=at;m.entregadoPor=actor.name;m.entregadoA=ot.tecnico||'';receipt.items.push({index:s.index,codigo:m.cod||m.codigo||'',descripcion:m.desc||m.descripcion||'',cantidad:s.qty,unidad:String(m.unidad||catalog[s.product]?.unidad||'unidades'),adicional:m.adicionalOT===true,productoKey:s.product,ventaFbKey:s.allocation});}
 next.remitosEntrega={...next.remitosEntrega,[operationId]:receipt};next.custodiaIniciada=true;next.custodiaRendida=false;next.custodiaTecnico=ot.tecnico||'';next.audit=[...Object.values(ot.audit||{}),{tipo:'entrega_materiales',operationId,actorUid:actor.uid,fecha:at,accion:'Entrega parcial registrada · '+receipt.numero}];
 return{ot:next,receipt,selectionHash:digest(selected)};
}
module.exports={key,allocation,selections,plan};
