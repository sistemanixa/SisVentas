'use strict';
// Current-state admission, never a reconstruction of historical stock movements.
const {digest}=require('./labor-guard'),Money=require('./commercial-models/commercial-money'),FX=require('./purchase-receipt-fx'),Costs=require('./commercial-models/purchase-receipt-costs.v1');
const ROOTS=Object.freeze({orders:'sisventas/ordenes',legacyOrders:'sisventas/ordenes_compra'});
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_PURCHASE_CURRENT_PENDING_REVIEW'}),own=(v,k)=>Object.hasOwn(v||{},k),copy=v=>structuredClone(v);
function demand(ok,message){if(!ok)throw fail(message);}
function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function key(v){demand(typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v),'Falta una referencia canónica acotada.');return v;}
function number(v){demand(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER,'Una cantidad o costo original es desconocido.');Money.decimal(v);return v;}
const sum=values=>Money.quantitySum(values);
function quantities(row,legacy=false){
 demand(object(row),'Falta el renglón original completo.');
 const ordered=number(row.cantidadOrdenada??row.cantidad??(legacy?row.qty:undefined));
 demand(ordered>0,'La cantidad ordenada no es positiva.');
 const received=own(row,'cantidadRecibida')?number(row.cantidadRecibida):legacy&&typeof row.recibido==='boolean'?(row.recibido?ordered:0):number(undefined);
 demand(received<=ordered,'La recepción supera la cantidad original.');return{ordered,received,pending:sum([ordered,-received])};
}
function sourceOrders(sources){
 demand(object(sources)&&object(sources.orders)&&object(sources.legacyOrders),'Faltan ambos conjuntos completos de órdenes.');
 const destinations=new Map(),origins=new Map(),result=[];
 for(const [id,order]of Object.entries(sources.orders)){key(id);demand(object(order),'Hay una orden inválida.');if(order.legacyKey!=null&&order.legacyKey!==''){key(order.legacyKey);demand(!origins.has(order.legacyKey),'Dos órdenes reclaman la misma fuente histórica.');origins.set(order.legacyKey,id);}}
 for(const [id,order]of Object.entries(sources.legacyOrders)){
  key(id);demand(object(order),'Hay una fuente histórica inválida.');
  if(order.migradaA!=null&&order.migradaA!==''){const target=key(order.migradaA);demand(!destinations.has(target)&&sources.orders[target]?.legacyKey===id&&origins.get(id)===target,'La deduplicación histórica no es inequívoca.');destinations.set(target,id);}
  else demand(!origins.has(id),'La importación histórica conserva un paso incompleto.');
 }
 for(const [id,order]of Object.entries(sources.orders)){if(order.legacyKey!=null&&order.legacyKey!=='')demand(destinations.get(id)===order.legacyKey,'Falta la contraparte histórica de la migración.');result.push({path:ROOTS.orders+'/'+id,order,legacy:false});}
 for(const [id,order]of Object.entries(sources.legacyOrders))if(!order.migradaA)result.push({path:ROOTS.legacyOrders+'/'+id,order,legacy:true});
 return result;
}
function rows(order,legacy=false,{closed=false}={}){
 demand(object(order)&&!order._svSummary&&!order._svListSummary&&!order._svPagedSummary,'Hace falta la orden completa, sin filtros ni resúmenes.');
 demand(['borrador','enviada','pendiente','recepcion_parcial','recibida','cancelada'].includes(order.estado),'El estado histórico requiere revisión.');
 for(const [field,value]of Object.entries(order))if(/(pendiente|bloqueo)$/i.test(field))demand(value==null||value===false||value===0,'Hay una operación original pendiente.');
 // A known closed original contributes no CURRENT pending. Its prior movements
 // and unrelated economic history are neither reconstructed nor normalized.
 if(!closed&&['recibida','cancelada'].includes(order.estado))return [];
 demand(Array.isArray(order.items)&&order.items.length<=100,'Faltan las filas explícitas del original activo.');
 if(order.recepciones!=null)demand(Array.isArray(order.recepciones),'La historia de recepciones no es canónica.');
 if(order.items.length===0){demand(!order.recepciones?.length&&['recibidoEn','totalRealRecibido','totalRealRecibidoARS','totalPresupuestadoRecibido'].every(field=>order[field]==null||order[field]===0),'La orden vacía conserva historia de recepción ambigua.');return [];}
 return order.items.map((row,index)=>{const quantitiesNow=quantities(row,legacy);for(const [field,value]of Object.entries(row))if(/(pendiente|bloqueo)$/i.test(field))demand(value==null||value===false||value===0,'El renglón conserva un paso pendiente.');if(order.estado==='recibida')demand(quantitiesNow.pending===0,'La orden recibida conserva unidades pendientes.');return{index,row,...quantitiesNow,pending:order.estado==='cancelada'?0:quantitiesNow.pending};});
}
function economic(order,targetRows,linked,checkTotals=true){
 demand(['ARS','USD'].includes(order.moneda??'ARS'),'La moneda original requiere revisión.');
 for(const entry of targetRows){const {row,received}=entry;number(row.costoUnitario);if(row.precioPublico!=null)number(row.precioPublico);
  if(received>0){demand(number(row.cantidadCostoReal)===received,'La recepción no tiene su cantidad económica original completa.');demand(row.monedaCostoReal==null||row.monedaCostoReal===(order.moneda??'ARS'),'La moneda de los costos recibidos es contradictoria.');number(row.costoRealAcumulado);if(order.moneda==='USD')number(row.costoRealAcumuladoARS);number(row.costoUnitarioPresupuestado??row.costoUnitario);}
  else{for(const field of ['cantidadCostoReal','costoRealAcumulado','costoRealAcumuladoARS'])if(own(row,field))demand(number(row[field])===0,'Hay costos reales sin cantidad recibida conocida.');}
  if(order.ventaFbKey&&FX.destination(order,row)==='sale'){
   demand(linked?.sale&&linked.list&&row.sourceLine!=null&&row.sourceSaleQty!=null&&row.sourceOriginalUnit!=null,'Faltan las capturas originales de la venta vinculada.');
   const line=linked.sale.items[Costs.resolve(linked.sale.items,row)];FX.budgetARS(order,row,line);
   if(received>0){number(line.cantidadCompraReal);number(line.costoRealCompraAcumulado);}
  }
 }
 const realTotal=sum(targetRows.map(({row,received})=>received?row.costoRealAcumulado:0));if(checkTotals&&own(order,'totalRealRecibido'))demand(number(order.totalRealRecibido)===realTotal,'El costo real agregado no coincide con sus capturas.');
 if(checkTotals&&order.moneda==='USD'&&own(order,'totalRealRecibidoARS'))demand(number(order.totalRealRecibidoARS)===sum(targetRows.map(({row,received})=>received?row.costoRealAcumuladoARS:0)),'El costo histórico ARS no coincide con sus capturas.');
}
function plan({body,sourceOrder,sources,coverage,referencesBySource,inventories,dependencies={},linked,actorUid,fence,at}={}){
 demand(object(body)&&Object.keys(body).length===3&&['id','orderKey','expectedHash'].every(k=>own(body,k)),'Controles de conciliación inválidos.');key(body.id);key(body.orderKey);key(actorUid);key(fence);demand(body.id.length>=8&&Number.isSafeInteger(at)&&at>0,'Falta contexto nativo de conciliación.');
 const path=ROOTS.orders+'/'+body.orderKey;demand(object(sourceOrder)&&digest(sourceOrder)===body.expectedHash&&digest(sources?.orders?.[body.orderKey])===body.expectedHash,'La orden original cambió.');
 demand(!own(sourceOrder,'fbKey')||sourceOrder.fbKey===body.orderKey,'La orden original conserva otra identidad.');
 demand(!own(sourceOrder,'inventarioCompra')&&!['cancelada','recibida'].includes(sourceOrder.estado),'La orden no admite una nueva base de pendientes.');
 demand(coverage?.eof===true&&Array.isArray(coverage.pages)&&coverage.pages.length>=2&&Object.values(ROOTS).every(root=>coverage.pages.some(page=>page.path===root)),'Falta acreditar EOF de ambos conjuntos.');
 const entries=sourceOrders(sources),totals=new Map(),owners=new Map(),targetRows=rows(sourceOrder),baselineRows={};
 for(const entry of entries)for(const row of rows(entry.order,entry.legacy)){
  const ref=referencesBySource?.[entry.path]?.[String(row.index)];demand(object(ref),'Falta una referencia genuina del original.');for(const field of ['productKey','inventoryKey','receiptIdentityKey'])key(ref[field]);
  const ownership=owners.get(ref.inventoryKey);demand(!ownership||ownership.productKey===ref.productKey&&ownership.receiptIdentityKey===ref.receiptIdentityKey,'Hay alias físicos contradictorios.');owners.set(ref.inventoryKey,ref);totals.set(ref.inventoryKey,sum([totals.get(ref.inventoryKey)||0,row.pending]));
  if(entry.path===path)baselineRows[String(row.index)]={productKey:ref.productKey,inventoryKey:ref.inventoryKey,receiptIdentityKey:ref.receiptIdentityKey,ordered:row.ordered,received:row.received,pending:row.pending,sourceRowHash:digest(row.row)};
 }
 for(const [inventoryKey,pending]of totals){const ledger=inventories?.[inventoryKey];demand(object(ledger)&&own(ledger,'enCompra')&&number(ledger.enCompra)===pending,'Los pendientes completos no coinciden con el saldo actual conocido.');number(ledger.general);for(const field of ['reservado','consumido'])if(own(ledger,field))number(ledger[field]);}
 economic(sourceOrder,targetRows,linked);
 demand(targetRows.some(row=>row.pending>0),'La orden no conserva pendientes para conciliar.');
 if(sourceOrder.ventaId&&!sourceOrder.ventaFbKey)throw fail('Falta resolver la venta original de la compra.');
 if(sourceOrder.compraVentaReferencia&&!sourceOrder.ventaFbKey&&!sourceOrder.listaMaterialesId)throw fail('La referencia comercial no está resuelta.');
 if(sourceOrder.listaMaterialesId)demand(linked?.list&&Array.isArray(linked.list.ordenesIds)&&linked.list.ordenesIds.includes(body.orderKey),'La preparación no conserva su vínculo original.');
 if(sourceOrder.ventaFbKey)demand(linked?.sale&&Array.isArray(linked.sale.ordenesCompraIds)&&linked.sale.ordenesCompraIds.includes(body.orderKey),'La venta no conserva su vínculo original.');
 if(sourceOrder.ventaFbKey){demand(linked?.sale&&linked.list,'Faltan las fuentes completas vinculadas.');for(const target of targetRows){if(FX.destination(sourceOrder,target.row)!=='sale')continue;const lineIndex=Costs.resolve(linked.sale.items,target.row);let quantity=0,cost=0;for(const entry of entries)if(entry.order.ventaFbKey===sourceOrder.ventaFbKey)for(const other of rows(entry.order,entry.legacy,{closed:true})){if(FX.destination(entry.order,other.row)!=='sale')continue;if(Costs.resolve(linked.sale.items,other.row)!==lineIndex)continue;quantity=sum([quantity,other.received]);if(other.received){economic(entry.order,[other],{sale:linked.sale,list:linked.list},false);cost=sum([cost,entry.order.moneda==='USD'?other.row.costoRealAcumuladoARS:other.row.costoRealAcumulado]);}}const line=linked.sale.items[lineIndex];demand((line.cantidadCompraReal??0)===quantity&&(line.costoRealCompraAcumulado??0)===cost,'La venta no conserva el mismo baseline económico de todas sus órdenes.');}}
 const coverageDigest=digest({sources,coverage,referencesBySource,inventories,dependencies}),baseline={schema:1,kind:'current-pending',operationId:body.id,actorUid,orderKey:body.orderKey,fence,ts:at,originalOrderHash:body.expectedHash,coverageDigest,rows:baselineRows};
 const references=Object.fromEntries(Object.entries(baselineRows).map(([index,row])=>[index,{productKey:row.productKey,inventoryKey:row.inventoryKey,receiptIdentityKey:row.receiptIdentityKey,baselineOperationId:body.id,baselineRow:index}]));
 const next={...copy(sourceOrder),inventarioCompra:{schema:1,registered:true,revision:1,lastOperation:body.id,baseline,references}},readDependencies=copy(dependencies);
 for(const entry of Object.values(ROOTS))for(const [id,order]of Object.entries(entry===ROOTS.orders?sources.orders:sources.legacyOrders))if(entry+'/'+id!==path)readDependencies[entry+'/'+id]=copy(order);
 for(const [id,ledger]of Object.entries(inventories))readDependencies['sisventas/inventario_operativo/'+id]=copy(ledger);
 const result={ok:true,committed:true,operationId:body.id,orderKey:body.orderKey,reconciliation:'current-pending',baselineVersion:1,actorUid,originalOrderHash:body.expectedHash,rowsHash:digest(baseline.rows),baselineDigest:digest(baseline)};
 return{patch:{[path]:next},preconditions:{[path]:copy(sourceOrder)},readDependencies,result};
}
module.exports={plan,rows,sourceOrders,ROOTS};
