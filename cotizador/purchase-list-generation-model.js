'use strict';
// Pure plan from captured, coherent preparation. No UI callbacks or catalog repricing.
const {digest}=require('./labor-guard'),Inventory=require('./purchase-inventory-model'),Manual=require('./purchase-manual-create-model'),Costs=require('./commercial-models/purchase-receipt-costs.v1'),Money=require('./commercial-models/commercial-money');
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_PURCHASE_LIST_GENERATION_REVIEW'});
const n=value=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER)throw fail('Falta una cantidad o costo capturado válido.');return value;};
const sum=values=>Money.quantitySum(values);
function refs(record,field){const value=record?.[field];if(!Array.isArray(value)||new Set(value).size!==value.length)throw fail('Los vínculos de la preparación requieren revisión.');for(const id of value)Inventory.key(id);return value;}
function groupKey(providerKey,destination='venta'){Inventory.key(providerKey);return destination+'_'+providerKey;}
function orderKey(listKey,id,group){return 'oc_'+digest({listKey,id,group}).slice(0,40);}
function plan({sourceList:list,sale,listKey,body,context,products,providers,inventories,references,originalOrders,operationReceipt,otherOrders={}}={}){
 Inventory.key(listKey);if(!body||Object.keys(body).some(k=>!['id','expectedHash'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id||'')||body.expectedHash!==digest(list))throw fail('La preparación cambió o la declaración no corresponde.');
 if(operationReceipt!==null)throw fail('Falta comprobar la ausencia del recibo de esta operación.');
 if(!list||!Array.isArray(list.items)||list._svSummary||list._svListSummary||list._svPagedSummary||list.origen==='conjunta'||list.sources?.length||list.compraConjuntaId)throw fail('La compra conjunta requiere el plan de todas sus fuentes.');
 if(list.compraConfirmacion||list.recepcionPendiente||list.aplicacionExteriorPendiente||list.cancelacionExteriorPendiente||list.cancelacionExteriorBloqueo||list.desagrupada||!['preparacion','borrador'].includes(list.estado))throw fail('La preparación no está disponible para confirmar.');
 if(list.simuladorParaguay&&(list.simuladorParaguay.version<6||list.simuladorParaguay.complete!==true||(list.simuladorParaguay.pending||[]).length))throw fail('La simulación guardada todavía tiene pendientes.');
 if(!context||!Number.isSafeInteger(context.at)||context.at<=0||!context.actor?.uid||typeof context.actor.name!=='string'||!context.actor.name||typeof context.date!=='string')throw fail('Falta el contexto autenticado del servidor.');Inventory.key(context.actor.uid);
 const saleKey=Inventory.key(list.ventaFbKey);if(!sale||sale.listaMaterialesId!==listKey||sale.anulada||sale.anulado||!Array.isArray(sale.items)||sale._svListSummary)throw fail('Falta la venta original de esta preparación.');
 const listRefs=refs(list,'ordenesIds'),saleRefs=refs(sale,'ordenesCompraIds'),dependencies=Object.create(null),occupied=new Set();
 for(const id of new Set([...listRefs,...saleRefs])){const order=otherOrders[id];if(!order||order.listaMaterialesId!==listKey&&order.ventaFbKey!==saleKey||!Array.isArray(order.items))throw fail('Falta una orden original referenciada.');dependencies['sisventas/ordenes/'+id]=structuredClone(order);if(order.ventaFbKey===saleKey&&order.estado!=='cancelada')for(const row of order.items)if(n(row.cantidadOrdenada??row.cantidad)>0)occupied.add(Costs.resolve(sale.items,row));}
 const groups=new Map(),stock=new Map(),covered=new Set();
 for(const item of list.items){
  if(item.esManoDeObra===true)continue;if(item.incluir!==true)throw fail('Hay materiales sin resolver en la preparación.');
  const productKey=Inventory.key(item.productoKey),ref=Inventory.reference(references?.[productKey]);if(ref.productKey!==productKey)throw fail('La referencia pertenece a otro producto.');
  const lineIndex=Costs.resolve(sale.items,{...item,sourceLine:item.sourceLine??item.linea}),line=sale.items[lineIndex];if(covered.has(lineIndex))throw fail('Hay renglones repetidos en la preparación.');covered.add(lineIndex);
  const qty=Costs.quantity(line),capture=line.preparacionCompra;if(!capture||line.comisionCostoHistoricoPendiente||n(line.cantidadCompraReal??0)>0||line.costoRealCompraAcumulado!=null&&n(line.costoRealCompraAcumulado)>0)throw fail('Falta una preparación capturada sin recepciones previas.');
  const existing=n(capture.cantidadStock),purchased=n(capture.cantidadComprar),stockUnit=n(capture.costoStockUnitario),buyUnit=n(capture.costoCompraUnitario);n(line.costoUnitarioAntesPreparacion);
  if(sum([existing,purchased])!==qty||n(item.cantidadNecesaria)!==qty||n(item.usarExistente)!==existing||n(item.cantidadComprar)!==purchased)throw fail('Las cantidades guardadas no coinciden con la venta.');
  const planned=Money.sum([Money.rawProduct(existing,stockUnit),Money.rawProduct(purchased,buyUnit)]);if(Money.amount(n(line.costoTotalCompra))!==planned)throw fail('El costo de la venta no coincide con la preparación capturada.');
  if(occupied.has(lineIndex))throw fail('Otra orden todavía cubre este renglón; no se duplica la compra.');
  if(existing){const group=stock.get(productKey)||{quantity:0,sources:[],ref};group.quantity=sum([group.quantity,existing]);group.sources.push({saleLine:lineIndex,quantity:existing,stockUnitCost:stockUnit});stock.set(productKey,group);}
  if(!purchased)continue;const providerKey=Inventory.key(item.proveedorKey);if(line.proveedorCompraKey!==providerKey||typeof line.proveedorCompra!=='string'||!line.proveedorCompra||!(buyUnit>0))throw fail('Falta el proveedor y precio pactados de la venta.');
  const group=groupKey(providerKey),rows=groups.get(group)||{providerKey,providerName:line.proveedorCompra,rows:[]};if(rows.providerName!==line.proveedorCompra)throw fail('El proveedor tiene snapshots contradictorios.');
  const publicPrice=n(item.precioPublico??item.precioVenta??line.punit);rows.rows.push({productKey,quantity:purchased,unitCost:buyUnit,publicPrice,sourceLine:'sale:'+saleKey+':'+lineIndex,sourceSaleQty:qty,sourceOriginalUnit:n(line.costoUnitarioAntesPreparacion),sourceItem:structuredClone(item),line});groups.set(group,rows);
 }
 // A material with a captured purchase plan cannot disappear from the list.
 for(const [index,line]of sale.items.entries())if(line.preparacionCompra&&!covered.has(index))throw fail('Falta un renglón preparado de la venta.');
 if(!covered.size)throw fail('No hay materiales preparados.');
 if((list.simuladorParaguay?.extras||[]).length)throw fail('Los extras para stock requieren su plan de logística capturado completo.');
 const numbers=context.orderNumbers;if(!numbers||digest(Object.keys(numbers).sort())!==digest([...groups.keys()].sort())||new Set(Object.values(numbers)).size!==groups.size)throw fail('Falta la numeración autoritativa completa y única de los grupos.');
 const patch=Object.create(null),preconditions=Object.create(null),working=structuredClone(inventories),nextList=structuredClone(list),nextSale=structuredClone(sale),newOrders=[];
 function merge(delta){for(const [path,value]of Object.entries(delta.patch)){if(!Object.hasOwn(preconditions,path))preconditions[path]=structuredClone(delta.preconditions[path]);patch[path]=structuredClone(value);if(path.startsWith('sisventas/inventario_operativo/'))working[path.split('/')[2]]=structuredClone(value);}}
 nextList.reservasInventario=structuredClone(list.reservasInventario||{});
 for(const [productKey,group]of stock){const {ref,quantity,sources}=group,inventory=inventories?.[ref.inventoryKey];if(!inventory)throw fail('Falta el inventario físico original.');const proof=list.reservasInventario?.[productKey];
  if(proof){const allocation=inventory.asignaciones?.[saleKey];if(proof.inventoryKey!==ref.inventoryKey||proof.receiptIdentityKey!==ref.receiptIdentityKey||n(proof.quantity)!==quantity||digest(proof.sources)!==digest(sources)||!Object.hasOwn(inventory.operaciones||{},proof.operationId)||!allocation||n(allocation.reservado)<quantity)throw fail('La reserva anterior no conserva su prueba completa.');continue;}
  if(list.stockExistenteReservado===true||n(inventory.asignaciones?.[saleKey]?.reservado??0)>0||n(inventory.asignaciones?.[saleKey]?.consumido??0)>0||Object.values(inventory.rendicionesOT||{}).some(receipt=>receipt.venta===saleKey))throw fail('La reserva histórica requiere atribución antes de volver a reservar.');
  const id='list_stock_'+digest({listKey,id:body.id,productKey}).slice(0,40);merge(Inventory.planExistingReservation({id,at:context.at,inventories:working,references,identity:productKey,allocationKey:saleKey,saleNumber:sale.id||'',quantity}));nextList.reservasInventario[productKey]={...structuredClone(ref),quantity,sources:structuredClone(sources),operationId:id};
 }
 for(const [group,data]of [...groups].sort(([a],[b])=>a.localeCompare(b))){const key=orderKey(listKey,body.id,group);if(!Object.hasOwn(originalOrders||{},key)||originalOrders[key]!==null)throw fail('La orden destino existe o falta comprobar su ausencia.');const id='list_order_'+digest({listKey,id:body.id,group}).slice(0,40),declaration={providerKey:data.providerKey,currency:'ARS',date:context.date,items:data.rows.map(({productKey,quantity,unitCost,publicPrice})=>({productKey,quantity,unitCost,publicPrice}))},created=Manual.plan({body:declaration,context:{id,orderKey:key,numero:numbers[group],at:context.at,actor:context.actor},originalOrder:null,operationReceipt:null,products,provider:providers?.[data.providerKey],inventories:working,references});
  const path='sisventas/ordenes/'+key,order=created.patch[path];Object.assign(order,{origen:'venta',listaMaterialesId:listKey,ventaFbKey:saleKey,ventaId:sale.id||'',cliente:sale.cliente||'',proveedor:data.providerName,generacionPendiente:false,generacionCompraOperacion:body.id});
  order.items.forEach((row,index)=>{const source=data.rows[index];Object.assign(row,{sourceLine:source.sourceLine,sourceSaleQty:source.sourceSaleQty,sourceOriginalUnit:source.sourceOriginalUnit});if(source.sourceItem.descripcion)row.descripcion=source.sourceItem.descripcion;if(source.line.monedaCompra==='USD')row.precioOrigenUSD=n(source.line.precioAcordadoCompra);});merge(created);newOrders.push(key);
 }
 nextList.ordenesIds=[...listRefs,...newOrders];nextSale.ordenesCompraIds=[...saleRefs,...newOrders];nextList.estado=newOrders.length?'ordenada':'cerrada';nextSale.compraEstado=newOrders.length?'ordenada':'stock_reservado';nextList.stockExistenteReservado=true;nextList.ordenadaEn=context.at;
 nextList.compraConfirmacion={estado:'completa',operationId:body.id,ordenesIds:structuredClone(newOrders),fecha:context.at};
 merge({patch:{['sisventas/listas_materiales/'+listKey]:nextList,['sisventas/ventas/'+saleKey]:nextSale},preconditions:{['sisventas/listas_materiales/'+listKey]:list,['sisventas/ventas/'+saleKey]:sale}});
 return {patch,preconditions,readDependencies:dependencies,result:{ok:true,committed:true,listKey,orderKeys:newOrders,operationId:body.id}};
}
module.exports={plan,groupKey,orderKey};
