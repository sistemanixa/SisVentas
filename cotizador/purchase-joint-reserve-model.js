'use strict';
const Single=require('./purchase-list-reserve-model'),{digest}=require('./labor-guard'),Inventory=require('./purchase-inventory-model');
const Costs=require('./commercial-models/purchase-receipt-costs.v1'),Money=require('./commercial-models/commercial-money');
const copy=x=>structuredClone(x),fail=()=>Object.assign(Error('Las fuentes de la reserva conjunta requieren revisión.'),{statusCode:409,code:'SV_PURCHASE_JOINT_RESERVE_REVIEW'});
const fingerprint=s=>JSON.stringify({items:s.items||[],total:s.total||0,descuento:s.descuento||0});
function plan({list,listKey,sourceLists,sales,inventories,references,context,body}){
 Inventory.key(listKey);
 if(!list||list.origen!=='conjunta'||!Array.isArray(list.sources)||list.sources.length<2||!Array.isArray(list.items)||list._svSummary||list._svListSummary||list._svPagedSummary||list.compraConjuntaId||list.desagrupada||list.compraConfirmacion||!['preparacion','borrador'].includes(list.estado)||Object.keys(list).some(k=>/(Pendiente|Bloqueo)$/.test(k)&&list[k])||!body||Object.keys(body).some(k=>!['id','expectedHash'].includes(k))||body.expectedHash!==digest(list)||body.id!==context?.id)throw fail();
 const patch={},preconditions={},readDependencies={},working=copy(inventories),seenLists=new Set(),seenSales=new Set(),matched=new Set();
 for(const source of list.sources){const lk=Inventory.key(source.listId),sk=Inventory.key(source.ventaFbKey),child=sourceLists?.[lk],sale=sales?.[sk];if(lk===listKey||seenLists.has(lk)||seenSales.has(sk)||!child||child.compraConjuntaId!==listKey||child.ventaFbKey!==sk||!Array.isArray(child.items)||!sale||source.saleFingerprint!==fingerprint(sale))throw fail();seenLists.add(lk);seenSales.add(sk);
  // Project only the already-validated lock. The persisted child always retains it.
  const projected=copy(child);delete projected.compraConjuntaId;
  for(const [index,item]of child.items.entries()){const candidates=list.items.map((row,i)=>({row,i})).filter(({row})=>row.sourceListId===lk&&row.linea===lk+':'+item.linea);if(candidates.length!==1)throw fail();const {row,i}=candidates[0],normalized=copy(row);delete normalized.sourceListId;delete normalized.saleLabel;normalized.linea=item.linea;if(digest(normalized)!==digest(item)||matched.has(i))throw fail();matched.add(i);}
  let result;
  if(child.items.every(item=>item.esManoDeObra===true||item.usarExistente===0)){
   if(child._svSummary||child._svListSummary||child._svPagedSummary||child.sources?.length||child.compraConfirmacion||!['preparacion','borrador'].includes(child.estado)||Object.keys(child).some(k=>/(Pendiente|Bloqueo)$/.test(k)&&child[k])||sale.listaMaterialesId!==lk||sale.anulada||sale.anulado||sale.eliminado||sale._svSummary||sale._svListSummary||!Array.isArray(sale.items)||Object.keys(child.reservasInventario||{}).length)throw fail();
   const seen=new Set();for(const item of child.items){if(item.esManoDeObra===true)continue;const index=Costs.resolve(sale.items,{...item,sourceLine:item.sourceLine??item.linea});if(item.incluir!==true||seen.has(index)||item.cantidadNecesaria!==Costs.quantity(sale.items[index])||typeof item.cantidadComprar!=='number'||!Number.isFinite(item.cantidadComprar)||item.cantidadComprar<0||Money.quantitySum([item.cantidadComprar])!==item.cantidadNecesaria)throw fail();seen.add(index);}
   if(!Number.isSafeInteger(context.at)||context.at<=0||typeof context.actor?.name!=='string'||!context.actor.name)throw fail();Inventory.key(context.actor.uid);Inventory.key(body.id);
   result={patch:{['sisventas/listas_materiales/'+lk]:{...projected,stockExistenteReservado:true,reservadoEn:context.at,reservadoPor:context.actor.name}},preconditions:{},readDependencies:{['sisventas/ventas/'+sk]:sale}};
  }else result=Single.plan({list:projected,listKey:lk,sale,references,inventories:working,context,body:{id:body.id,expectedHash:digest(projected)}});
  for(const [path,value]of Object.entries(result.patch)){if(!Object.hasOwn(preconditions,path))preconditions[path]=copy(path==='sisventas/listas_materiales/'+lk?child:result.preconditions[path]);patch[path]=copy(value);if(path==='sisventas/listas_materiales/'+lk)patch[path].compraConjuntaId=listKey;else if(path.startsWith('sisventas/inventario_operativo/'))working[path.slice('sisventas/inventario_operativo/'.length)]=copy(value);}
  for(const [path,value]of Object.entries(result.readDependencies))if(!Object.hasOwn(patch,path))readDependencies[path]=copy(value);
 }
 if(matched.size!==list.items.length)throw fail();
 const path='sisventas/listas_materiales/'+listKey;preconditions[path]=copy(list);patch[path]={...copy(list),stockExistenteReservado:true,reservadoEn:context.at,reservadoPor:context.actor.name};
 // A ledger read by a later child may already have a pending write from an earlier child.
 for(const path of Object.keys(patch))delete readDependencies[path];
 return{patch,preconditions,readDependencies,result:{listKey,operationId:body.id,reserved:true,sourceListKeys:[...seenLists]}};
}
module.exports={plan};
