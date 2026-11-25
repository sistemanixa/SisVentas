'use strict';
// Pure proposal: context and source documents must be resolved by the server.
const Inventory=require('./purchase-inventory-model'),Money=require('./commercial-models/commercial-money');
const Baseline=require('./purchase-current-pending-baseline');
const fail=message=>Object.assign(Error(message),{code:'SV_PURCHASE_MANUAL_EDIT_REVIEW',statusCode:409});
function object(v,fields){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!fields.includes(k)))throw fail('Declaración inválida.');}
function number(v,positive=false){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>Number.MAX_SAFE_INTEGER||positive&&v===0)throw fail('Cantidad o importe inválido.');Money.decimal(v);return v;}
function text(v){if(typeof v!=='string'||!v.trim()||v.length>240)throw fail('Falta una captura original.');return v;}
function editFX(order,body,reject=fail){
 const supplied=Object.hasOwn(body,'exchangeRate');
 if(supplied&&((order.moneda??'ARS')!=='USD'||typeof body.exchangeRate!=='number'||!Number.isFinite(body.exchangeRate)||body.exchangeRate<=0||body.exchangeRate>1e9))throw reject('Cotización explícita USD inválida.');
 return (prior,row)=>{if((order.moneda??'ARS')!=='USD'||prior&&row.unitCost===prior.costoUnitario)return null;
 if(!supplied)throw reject('El nuevo costo USD requiere conversión explícita con cotización.');
 return {moneda:'USD',costoUnitarioUSD:row.unitCost,costoUnitarioARS:number(Money.rawProduct(row.unitCost,body.exchangeRate)),cotizacion:body.exchangeRate};};
}
function plan({order,orderKey,body,provider,products,inventories,references,at,id,actor,sourceStockList,sourceStockListKey}={}){
 object(body,['providerKey','currency','date','items','exchangeRate']);Inventory.key(orderKey);Inventory.key(id);
 if(!/^[A-Za-z0-9_-]{8,160}$/.test(id)||!Number.isSafeInteger(at)||at<=0||!actor)throw fail('Falta contexto del servidor.');Inventory.key(actor.uid);text(actor.name);
 const sourceStock=['extra_stock','stock_paraguay'].includes(order?.origen)&&sourceStockList&&['conjunta','stock_paraguay'].includes(sourceStockList.origen)&&!sourceStockList._svSummary&&!sourceStockList._svListSummary&&!sourceStockList._svPagedSummary&&Array.isArray(sourceStockList.ordenesIds)&&sourceStockList.ordenesIds.includes(orderKey)&&order.listaMaterialesId===sourceStockListKey;
 if(sourceStock){Inventory.key(sourceStockListKey);
 if(!Array.isArray(sourceStockList.items)||sourceStockList.ventaFbKey||sourceStockList.ventaId||new Set(sourceStockList.ordenesIds).size!==sourceStockList.ordenesIds.length||Object.keys(sourceStockList).some(k=>/(Pendiente|Bloqueo)$/.test(k)&&sourceStockList[k])||order.items.some(row=>row.destination!=null&&row.destination!=='stock'||row.destino!=null&&row.destino!=='stock'||['sourceLine','sourceListId','sourceSaleKey','sourceSaleQty','sourceOriginalUnit'].some(k=>row[k]!=null)))throw fail('La fuente de stock conserva vínculos ambiguos.');
 }
 if(!order||order.origen!=='manual'&&!sourceStock||!['borrador','enviada'].includes(order.estado)||!Array.isArray(order.items)||!order.items.length||order._svSummary||order._svListSummary||order._svPagedSummary||order.fbKey&&order.fbKey!==orderKey)throw fail('Hace falta una orden original de stock sin recepciones.');
 if(['ventaFbKey','ventaId',...(sourceStock?[]:['listaMaterialesId']),'listaOrigenId','compraVentaReferencia','sources','sourceListId','preparacionCompra'].some(k=>order[k]!=null&&order[k]!==''))throw fail('La compra vinculada requiere un plan conjunto.');
 if(Object.keys(order).some(k=>/pendiente$/i.test(k)&&order[k])||order.recepciones!=null&&(!Array.isArray(order.recepciones)||order.recepciones.length)||['recibidoEn','totalRealRecibido','totalPresupuestadoRecibido','diferenciaCompra'].some(k=>order[k]!=null&&order[k]!==0))throw fail('La compra conserva historia o acciones pendientes.');
 const marker=order.inventarioCompra;
 if(marker?.schema!==1||marker.registered!==true||!Number.isSafeInteger(marker.revision)||marker.revision<1||marker.revision===Number.MAX_SAFE_INTEGER)throw fail('Falta respaldo histórico de inventario.');
 const old=new Map(),resolved=Object.create(null),physical=new Map(),receipts=new Map(),dependencies=Object.create(null);
 if(sourceStock)dependencies['sisventas/listas_materiales/'+sourceStockListKey]=structuredClone(sourceStockList);
 function resolve(key){Inventory.key(key);if(resolved[key])return resolved[key];const ref=Inventory.reference(references?.[key]);if(ref.productKey!==key)throw fail('Alias contradictorio.');
  if(physical.has(ref.inventoryKey)&&physical.get(ref.inventoryKey)!==key||receipts.has(ref.receiptIdentityKey)&&receipts.get(ref.receiptIdentityKey)!==key)throw fail('Identidad física ambigua.');
  const inv=inventories?.[ref.inventoryKey];if(!inv||typeof inv!=='object'||Array.isArray(inv)||!Object.hasOwn(inv,'enCompra')||inv.operaciones!=null&&(typeof inv.operaciones!=='object'||Array.isArray(inv.operaciones)))throw fail('Falta inventario y saldo en compra originales.');number(inv.enCompra);
  if(Object.hasOwn(inv.operaciones||{},id))throw fail('Consultá el recibo anterior.');
  physical.set(ref.inventoryKey,key);receipts.set(ref.receiptIdentityKey,key);resolved[key]=structuredClone(ref);dependencies['sisventas/inventario_operativo/'+ref.inventoryKey]=structuredClone(inv);return ref;
 }
 for(const [index,item]of order.items.entries()){
  if(!item||!item.productoKey||old.has(item.productoKey))throw fail('Renglones históricos ambiguos.');
  const key=Inventory.key(item.productoKey),ref=resolve(key),evidence=marker.references?.[index];
  try{Baseline.assertReference(order,index,ref,inventories[ref.inventoryKey]);}catch(e){throw fail(e.message);}
  number(item.cantidadOrdenada,true);if(inventories[ref.inventoryKey].enCompra<item.cantidadOrdenada)throw fail('El saldo histórico no respalda la orden.');if(item.cantidad!=null&&item.cantidad!==item.cantidadOrdenada)throw fail('Cantidades históricas contradictorias.');
  for(const k of ['cantidadRecibida','cantidadCostoReal','costoRealAcumulado'])if(item[k]!=null&&number(item[k])!==0)throw fail('La compra tiene recepciones.');
  if(['costoUnitarioReal','ultimoCostoReal','proveedorFinal','proveedorFinalKey'].some(k=>item[k]!=null))throw fail('La historia real requiere revisión.');
  number(item.costoUnitario);if(!(sourceStock&&item.precioPublicoPendiente===true&&item.precioPublico==null))number(item.precioPublico);text(item.codigo);text(item.descripcion);text(item.unidad);
  if(item.subtotal!==Money.rawProduct(item.cantidadOrdenada,item.costoUnitario))throw fail('Subtotal histórico ambiguo.');old.set(key,item);
 }
 const originalTotal=number(Money.quantitySum(order.items.map(i=>i.subtotal)));
 for(const k of ['total','monto'])if(order[k]!==originalTotal)throw fail('Totales históricos requieren un plan completo.');
 Inventory.key(body.providerKey);if(provider?.fbKey!==body.providerKey||provider.activo!==true)throw fail('Falta proveedor activo.');text(provider.nombre);
 if(!['ARS','USD'].includes(body.currency)||body.currency!==(order.moneda??'ARS')||typeof body.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||!Number.isFinite(Date.parse(body.date+'T00:00:00Z'))||new Date(body.date+'T00:00:00Z').toISOString().slice(0,10)!==body.date)throw fail('Fecha inválida o cambio de moneda sin conversión explícita.');
 if(!Array.isArray(body.items)||!body.items.length||body.items.length>100)throw fail('Faltan materiales.');
 const quoteFor=editFX(order,body),quotes=[];
 const seen=new Set(),items=body.items.map(row=>{
  object(row,['productKey','quantity','unitCost','publicPrice',...(sourceStock?['sourceIndex','destination']:[])]);if(sourceStock&&(row.destination!==undefined&&row.destination!=='stock'||row.sourceIndex!==undefined&&(!Number.isSafeInteger(row.sourceIndex)||row.sourceIndex<0||order.items[row.sourceIndex]?.productoKey!==row.productKey)))throw fail('La edición no conserva su renglón y destino de stock.');Inventory.key(row.productKey);if(seen.has(row.productKey))throw fail('Producto repetido ambiguo.');seen.add(row.productKey);resolve(row.productKey);
  number(row.quantity,true);number(row.unitCost);number(row.publicPrice);
  const prior=old.get(row.productKey),product=products?.[row.productKey];let snapshot;
  if(sourceStock&&!prior&&row.destination!=='stock')throw fail('Los productos nuevos requieren destino stock explícito.');
  if(prior){snapshot=structuredClone(prior);if(sourceStock)delete snapshot.precioPublicoPendiente;}
  else {if(!product||product.fbKey!==row.productKey||product.activo!==true||product.esManoDeObra===true)throw fail('Falta producto nuevo activo.');text(product.codigo);text(product.nombre);text(product.unidad);dependencies['sisventas/productos/'+row.productKey]=structuredClone(product);snapshot={productoKey:row.productKey,codigo:product.codigo,descripcion:product.nombre,unidad:product.unidad,...(typeof product.imagenUrl==='string'?{imagenUrl:product.imagenUrl}:{})};}
  if(/^(unidad|unidades|u|un|uni|ud|uds)$/i.test(snapshot.unidad)&&!Number.isInteger(row.quantity))throw fail('El producto requiere cantidades enteras.');
  const quote=quoteFor(prior,row);if(quote){snapshot.costoUnitarioPresupuestadoARS=quote.costoUnitarioARS;snapshot.presupuestoCompraEdicion={...quote,operationId:id,ts:at,uid:actor.uid,usuario:actor.name};quotes.push(quote);}
  return {...snapshot,cantidadOrdenada:row.quantity,...(Object.hasOwn(snapshot,'cantidad')?{cantidad:row.quantity}:{}),cantidadRecibida:0,costoUnitario:row.unitCost,costoUnitarioPresupuestado:row.unitCost,precioPublico:row.publicPrice,subtotal:number(Money.rawProduct(row.quantity,row.unitCost))};
 });
 const next={...structuredClone(order),proveedorKey:body.providerKey,proveedor:provider.nombre,fecha:body.date,moneda:body.currency,items,total:number(Money.quantitySum(items.map(i=>i.subtotal))),descripcion:items.length+' materiales',actualizadoEn:at,actualizadoPor:actor.name};next.monto=next.total;
 const result=Inventory.planPendingOrder({kind:'edit',order:{...next,fbKey:orderKey},previousOrder:{...order,fbKey:orderKey},id,at,inventories,references:resolved});
 for(const value of Object.values(result.patch))number(value.enCompra);
 next.inventarioCompra={...structuredClone(marker),revision:marker.revision+1,lastOperation:id,references:Object.fromEntries(items.map((item,index)=>{const ref=resolved[item.productoKey],changed=result.patch['sisventas/inventario_operativo/'+ref.inventoryKey],previousIndex=order.items.findIndex(i=>i.productoKey===item.productoKey);return [index,Baseline.nextReference({order,index:previousIndex<0?undefined:previousIndex,reference:ref,operationId:id,changed:!!changed&&(previousIndex<0||item.cantidadOrdenada!==order.items[previousIndex].cantidadOrdenada)})];}))};
 if(Object.hasOwn(order.edicionesCompra||{},id))throw fail('La edición ya tiene historia.');
 next.edicionesCompra={...structuredClone(order.edicionesCompra||{}),[id]:{uid:actor.uid,usuario:actor.name,ts:at,...(quotes.length?{cotizacionEdicion:{moneda:'USD',cotizacion:body.exchangeRate}}:{}),anterior:Object.fromEntries(['proveedorKey','proveedor','fecha','moneda','items','total','monto'].filter(k=>Object.hasOwn(order,k)).map(k=>[k,structuredClone(order[k])]))}};
 const path='sisventas/ordenes/'+orderKey;result.patch[path]=next;result.preconditions={...dependencies,...result.preconditions,[path]:structuredClone(order)};
 return {patch:result.patch,preconditions:result.preconditions,readDependencies:{...dependencies,['sisventas/proveedores/'+body.providerKey]:structuredClone(provider)},result:{orderKey,operationId:id}};
}
module.exports={plan,editFX};
