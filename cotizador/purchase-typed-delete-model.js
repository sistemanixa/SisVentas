'use strict';
// Pure typed-draft deletion. Admission, fresh reads and commit authority belong to callers.
const Inventory=require('./purchase-inventory-model'),Money=require('./commercial-models/commercial-money'),{digest}=require('./labor-guard');
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_PURCHASE_TYPED_DELETE_REVIEW'});
const own=(o,k)=>Object.hasOwn(o||{},k),copy=x=>structuredClone(x);
function demand(ok,message){if(!ok)throw fail(message);}
function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function amount(v,positive=false){demand(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER&&(!positive||v>0),'Cantidad o importe original inválido.');Money.decimal(v);return v;}
function plan({sourceOrder:order,body,inventories,references,at}={}){
 demand(object(body)&&Object.keys(body).length===3&&['id','orderKey','expectedHash'].every(k=>own(body,k)),'Declaración de borrado inválida.');
 Inventory.key(body.id);Inventory.key(body.orderKey);demand(/^[A-Za-z0-9_-]{8,160}$/.test(body.id)&&Number.isSafeInteger(at)&&at>0,'Falta contexto de operación.');
 demand(object(order)&&!order._svSummary&&!order._svListSummary&&!order._svPagedSummary&&(!own(order,'fbKey')||order.fbKey===body.orderKey),'Falta el original completo de la orden.');
 demand(body.expectedHash===digest(order),'La orden cambió; recargá antes de eliminar.');
 demand(['manual','extra_stock'].includes(order.origen)&&order.estado==='borrador'&&Array.isArray(order.items)&&order.items.length>0&&order.items.length<=100,'Sólo se elimina un borrador typed independiente.');
 for(const k of ['ventaFbKey','ventaId','listaMaterialesId','listaOrigenId','compraVentaReferencia','sources','sourceListId','sourceSaleKey','preparacionCompra','receipt','operationReceipt','recibo','reciboInventario','legacyKey','legacyNum','migradaA','migradoDe','compraConjuntaId'])demand(!own(order,k)||order[k]===null||order[k]==='', 'La orden tiene fuentes o historia que requieren revisión.');
 for(const [k,v]of Object.entries(order)){
  if(/(pendiente|bloqueo)$/i.test(k))demand(v===false||v==null,'Hay una operación pendiente o un flag ambiguo.');
  if(/legacy|migrad/i.test(k))demand(v==null||v==='', 'La orden conserva una referencia legacy.');
  if(/recibid|costoreal|realrecibido|presupuestadorecibido|diferenciacompra|conciliacion|cancelad/i.test(k))demand(v==null,'La orden conserva historia de recepción o conciliación.');
 }
 for(const k of ['recepciones','recepcionesAplicadas','edicionesCompra','edicionesCabecera','historial','historia','reservasInventario','vinculosInventario'])if(own(order,k)&&order[k]!=null)demand((Array.isArray(order[k])||object(order[k]))&&Object.keys(order[k]).length===0,'La orden conserva historia o vínculos adicionales.');
 for(const k of ['stockExistenteReservado','stockExistenteVinculado'])demand(order[k]===undefined||order[k]===null||order[k]===false,'La orden conserva un vínculo de stock o un flag ambiguo.');
 const marker=order.inventarioCompra;demand(object(marker)&&marker.schema===1&&marker.registered===true&&Number.isSafeInteger(marker.revision)&&marker.revision>=1&&object(marker.references)&&Object.keys(marker.references).length===order.items.length,'Falta registro typed original completo.');
 const resolved=Object.create(null),physical=new Map(),receiptOwners=new Map(),totals=new Map();
 for(const [index,row]of order.items.entries()){
  demand(object(row),'Falta un renglón original.');const pk=Inventory.key(row.productoKey),ref=Inventory.reference(references?.[pk]),evidence=marker.references[String(index)];
  demand(ref.productKey===pk&&object(evidence)&&['productKey','inventoryKey','receiptIdentityKey'].every(k=>evidence[k]===ref[k]),'Referencia histórica contradice la resolución canónica.');Inventory.key(evidence.operationId);
  demand(!physical.has(ref.inventoryKey)||physical.get(ref.inventoryKey)===pk,'Alias físico compartido por productos distintos.');demand(!receiptOwners.has(ref.receiptIdentityKey)||receiptOwners.get(ref.receiptIdentityKey)===pk,'Identidad de recibo compartida.');physical.set(ref.inventoryKey,pk);receiptOwners.set(ref.receiptIdentityKey,pk);
  for(const k of ['sourceLine','sourceSaleQty','sourceOriginalUnit','sourceListId','sourceSaleKey','ventaFbKey','listaMaterialesId','legacyKey'])demand(row[k]==null||row[k]==='', 'La fila conserva fuentes históricas.');
  demand((row.destination==null||row.destination==='stock')&&(row.destino==null||row.destino==='stock'),'Destino de fila ambiguo.');
  const quantity=amount(row.cantidadOrdenada,true);demand(row.cantidad==null||row.cantidad===quantity,'Cantidades originales contradictorias.');demand(row.cantidadRecibida==null||row.cantidadRecibida===0,'La orden tiene unidades recibidas.');
  for(const [k,v]of Object.entries(row)){if(/costo.*real|proveedorfinal|cantidadcostoreal|cotizacionultimarecepcion|receipt|recepcion/i.test(k))demand(v==null,'La fila conserva costos reales.');if(/(pendiente|bloqueo)$/i.test(k))demand(v===false||v==null,'La fila conserva un pendiente.');}
  const inv=inventories?.[ref.inventoryKey];demand(own(inventories,ref.inventoryKey)&&object(inv)&&own(inv,'enCompra')&&object(inv.operaciones)&&own(inv.operaciones,evidence.operationId)&&inv.operaciones[evidence.operationId]!=null&&inv.operaciones[evidence.operationId]!==false,'Falta ledger y recibo original de inventario.');demand(!own(inv.operaciones,body.id),'Consultá el recibo de borrado anterior.');
  amount(inv.enCompra);totals.set(pk,Money.quantitySum([totals.get(pk)||0,quantity]));
  resolved[pk]={productKey:ref.productKey,inventoryKey:ref.inventoryKey,receiptIdentityKey:ref.receiptIdentityKey};
 }
 for(const [pk,total]of totals)demand(inventories[resolved[pk].inventoryKey].enCompra>=total,'El saldo pendiente no respalda la orden completa.');
 const identified={...copy(order),fbKey:body.orderKey},delta=Inventory.planPendingOrder({kind:'cancel',order:identified,previousOrder:identified,id:body.id,at,inventories,references:resolved});
 const path='sisventas/ordenes/'+body.orderKey;delta.patch[path]=null;delta.preconditions[path]=copy(order);
 return{patch:delta.patch,preconditions:delta.preconditions,result:{orderKey:body.orderKey,operationId:body.id,deleted:true}};
}
module.exports={plan};
