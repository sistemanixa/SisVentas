'use strict';
const {digest}=require('./labor-guard'),Inventory=require('./purchase-inventory-model'),Base=require('./purchase-inventory-order-plan');
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_PURCHASE_EDIT_REVIEW'}),copy=value=>structuredClone(value);
function header(value){if(!value||typeof value!=='object'||Array.isArray(value)||!Object.keys(value).length||Object.keys(value).some(key=>!['providerKey','date'].includes(key)))throw fail('Encabezado de compra inválido.');if(value.providerKey!==undefined)Inventory.key(value.providerKey);if(value.date!==undefined&&(!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||!Number.isFinite(Date.parse(value.date+'T00:00:00Z'))||new Date(value.date+'T00:00:00Z').toISOString().slice(0,10)!==value.date))throw fail('Fecha de compra inválida.');return value;}
function classicHeader(order,body){return !!order&&!Object.hasOwn(order,'inventarioCompra')&&body?.kind==='edit'&&body.header!==undefined&&body.quantities===undefined&&body.declaration===undefined;}
function validateClassicHeader(order,body){
 if(!classicHeader(order,body)||!Array.isArray(order.items)||!order.items.length||!['borrador','enviada'].includes(order.estado))throw fail('El encabezado clásico requiere una orden original sin recepción.');
 const emptyHistory=value=>value==null||Array.isArray(value)&&value.length===0||value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===0;
 if(order.recepciones!=null&&!Array.isArray(order.recepciones))throw fail('El historial de recepción requiere revisión.');
 for(const field of ['recepciones','recepcionesAplicadas','reservasInventario','vinculosInventario','receipt','operationReceipt','recibo','reciboInventario'])if(!emptyHistory(order[field]))throw fail('La compra conserva historia que requiere revisión.');
 for(const field of ['recibidoEn','totalRealRecibido','totalRealRecibidoARS','totalPresupuestadoRecibido','diferenciaCompra','canceladaEn'])if(order[field]!=null&&order[field]!==0)throw fail('La compra conserva una recepción anterior.');
 for(const [field,value]of Object.entries(order))if(/(pendiente|bloqueo)$/i.test(field)&&value!=null&&value!==false)throw fail('La compra conserva una operación pendiente.');
 if(order.edicionesCabecera!=null&&(typeof order.edicionesCabecera!=='object'||Array.isArray(order.edicionesCabecera)))throw fail('La auditoría de encabezado requiere revisión.');
 for(const row of order.items){
  if(!row||typeof row!=='object'||Array.isArray(row))throw fail('Falta el material original.');
  for(const field of ['cantidadRecibida','cantidadCostoReal','costoRealAcumulado','costoRealAcumuladoARS','costoUnitarioReal','costoUnitarioRealARS','ultimoCostoReal','ultimoCostoRealARS'])if(row[field]!=null&&row[field]!==0)throw fail('El material conserva una recepción anterior.');
  for(const field of ['receiptIdentityKey','stockRegistro','stockRevision','stockPendiente','instalada','devuelta','devueltaPendiente','rendicion','rendiciones','recepciones','receipt','operacionStock','proveedorFinal','proveedorFinalKey'])if(row[field]!=null&&row[field]!==false&&row[field]!==0&&row[field]!=='')throw fail('El material conserva historia de inventario.');
  for(const [field,value]of Object.entries(row))if(/(pendiente|bloqueo)$/i.test(field)&&value!=null&&value!==false)throw fail('El material conserva una operación pendiente.');
 }
 header(body.header);
}
function build(input){const {sourceOrder:order,body,at,actorName,actorUid,provider,products,references,inventories,sale,list,otherOrders}=input;
 if(classicHeader(order,body))validateClassicHeader(order,body);
 if(body.kind!=='edit'||!order||!Array.isArray(order.items)||!['borrador','enviada'].includes(order.estado)||order.items.some(row=>Number(row.cantidadRecibida??0)!==0)||order.recepciones?.length||Object.keys(order).some(key=>/Pendiente$/.test(key)&&order[key]))throw fail('La orden recibida o pendiente no se puede editar.');
 const linked=!!(order.ventaFbKey||order.ventaId||order.listaMaterialesId||order.listaOrigenId||order.compraVentaReferencia),context={order,orderKey:body.orderKey,provider,products,references,inventories,at,id:body.id,actor:{uid:actorUid,name:actorName},sale,list,otherOrders};
 if(body.declaration!==undefined){if(body.header!==undefined||body.quantities!==undefined)throw fail('La declaración completa no se combina con cambios parciales.');return(linked?require('./purchase-linked-edit-model'):require('./purchase-manual-edit-model')).plan({...context,body:body.declaration});}
 if(body.header!==undefined)header(body.header);if(body.header===undefined&&body.quantities===undefined)throw fail('Falta el cambio de encabezado o cantidades.');
 let plan;if(body.quantities!==undefined){
  if(!Array.isArray(body.quantities)||!body.quantities.length||body.quantities.length>100||body.quantities.some(row=>!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(key=>!['index','quantity'].includes(key))||!Number.isSafeInteger(row.index)||row.index<0||row.index>=order.items.length||typeof row.quantity!=='number'||!Number.isFinite(row.quantity)||row.quantity<=0))throw fail('Cantidad o renglón inválido.');
  if(linked){const moves=new Map(body.quantities.map(row=>[row.index,row.quantity]));if(moves.size!==body.quantities.length)throw fail('Hay renglones repetidos.');const declaration={providerKey:body.header?.providerKey??order.proveedorKey,currency:order.moneda??'ARS',date:body.header?.date??order.fecha,items:order.items.map((row,index)=>({sourceIndex:index,productKey:row.productoKey,quantity:moves.get(index)??row.cantidadOrdenada,unitCost:row.costoUnitario,publicPrice:row.precioPublico,...(row.destination?{destination:row.destination}:{})}))};return require('./purchase-linked-edit-model').plan({...context,body:declaration});}
  plan=Base.build({...input,body:{...body,header:undefined},allowLinked:false});
 }else plan={patch:{},preconditions:{}};
 const path='sisventas/ordenes/'+body.orderKey,next=copy(plan.patch[path]||order),before=Object.fromEntries(['proveedorKey','proveedor','fecha',...(body.quantities?['items','total','monto']:[])].filter(key=>Object.hasOwn(order,key)).map(key=>[key,copy(order[key])]));
 if(body.header?.providerKey!==undefined){if(provider?.fbKey!==body.header.providerKey||provider.activo!==true||provider.eliminado||typeof provider.nombre!=='string'||!provider.nombre.trim())throw fail('Falta el proveedor original activo.');next.proveedorKey=provider.fbKey;next.proveedor=provider.nombre;}
 if(body.header?.date!==undefined)next.fecha=body.header.date;
 if(!Number.isSafeInteger(at)||!actorUid||typeof actorName!=='string'||!actorName||Object.hasOwn(order.edicionesCabecera||{},body.id))throw fail('Falta identificar la edición.');
 next.edicionesCabecera={...copy(order.edicionesCabecera||{}),[body.id]:{uid:actorUid,usuario:actorName,ts:at,anterior:before}};next.actualizadoEn=at;next.actualizadoPor=actorName;
 plan.patch[path]=next;plan.preconditions[path]=copy(order);if(provider&&body.header?.providerKey!==undefined)plan.readDependencies={...(plan.readDependencies||{}),['sisventas/proveedores/'+provider.fbKey]:copy(provider)};
 return{...plan,sourceOrder:order,result:{orderKey:body.orderKey,operationId:body.id,changed:digest(next)!==digest(order)}};
}
module.exports={build,header,classicHeader};
