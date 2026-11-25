'use strict';
// Pure proposal. Every source/context argument is supplied by the authenticated server.
const Inventory=require('./purchase-inventory-model'),Money=require('./commercial-models/commercial-money');
const fail=message=>Object.assign(Error(message),{code:'SV_PURCHASE_MANUAL_CREATE_REVIEW',statusCode:409});
function object(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw fail('Declaración de compra inválida.');}
function number(value,positive=false){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER||positive&&value===0)throw fail('Cantidad o importe fuera de rango.');Money.decimal(value);return value;}
function text(value){if(typeof value!=='string'||!value.trim()||value.length>240)throw fail('Falta un dato original de la compra.');return value;}
function plan({body,context,originalOrder,operationReceipt,products,provider,inventories,references}={}){
 object(body,['providerKey','currency','date','items']);object(context,['orderKey','numero','id','at','actor']);
 const {orderKey,numero,id,at,actor}=context;Inventory.key(orderKey);Inventory.key(id);if(!/^[A-Za-z0-9_-]{8,160}$/.test(id)||!Number.isSafeInteger(at)||at<=0||!actor||!actor.uid)throw fail('Falta el contexto de creación del servidor.');Inventory.key(actor.uid);text(actor.name);text(numero);
 if(originalOrder!==null)throw fail('La orden destino ya existe o no fue leída.');if(operationReceipt!==null)throw fail('Consultá el recibo de la operación anterior antes de crear.');
 Inventory.key(body.providerKey);if(!provider||provider.fbKey!==body.providerKey||provider.activo!==true)throw fail('Falta el proveedor original activo.');text(provider.nombre);
 if(!['ARS','USD'].includes(body.currency)||!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||new Date(body.date+'T00:00:00.000Z').toISOString().slice(0,10)!==body.date)throw fail('Fecha o moneda inválida.');
 if(!Array.isArray(body.items)||!body.items.length||body.items.length>100)throw fail('Faltan los materiales de la compra.');
 const resolved=Object.create(null),physical=new Map(),receipts=new Map(),items=body.items.map(row=>{
  object(row,['productKey','quantity','unitCost','publicPrice']);Inventory.key(row.productKey);number(row.quantity,true);number(row.unitCost);number(row.publicPrice);
  const product=products?.[row.productKey];if(!product||product.fbKey!==row.productKey||product.activo!==true||product.esManoDeObra===true)throw fail('Falta el producto original activo.');text(product.codigo);text(product.nombre);text(product.unidad);
  if(/^(unidad|unidades|u|un|uni|ud|uds)$/i.test(product.unidad)&&!Number.isInteger(row.quantity))throw fail('Este producto requiere cantidades enteras.');
  const ref=Inventory.reference(references?.[row.productKey]);if(ref.productKey!==row.productKey)throw fail('El vínculo pertenece a otro producto.');
  const previous=physical.get(ref.inventoryKey);if(previous&&(previous.productKey!==ref.productKey||previous.receiptIdentityKey!==ref.receiptIdentityKey))throw fail('Inventario físico ambiguo.');const receiptOwner=receipts.get(ref.receiptIdentityKey);if(receiptOwner&&receiptOwner!==ref.productKey)throw fail('Identidad de recibo ambigua.');receipts.set(ref.receiptIdentityKey,ref.productKey);physical.set(ref.inventoryKey,ref);resolved[row.productKey]=structuredClone(ref);
  // Absence needs a canonical alias verifier, not a boolean supplied by the client.
  if(!Object.hasOwn(inventories||{},ref.inventoryKey)||inventories[ref.inventoryKey]===null)throw fail('Falta el inventario físico original; la ausencia requiere un verificador todavía no integrado.');
  const subtotal=number(Money.rawProduct(row.quantity,row.unitCost));
  return {productoKey:row.productKey,codigo:product.codigo,descripcion:product.nombre,unidad:product.unidad,...(typeof product.imagenUrl==='string'?{imagenUrl:product.imagenUrl}:{}),cantidadOrdenada:row.quantity,cantidadRecibida:0,costoUnitario:row.unitCost,costoUnitarioPresupuestado:row.unitCost,precioPublico:row.publicPrice,subtotal};
 });
 const total=number(Money.quantitySum(items.map(item=>item.subtotal)));
 const order={numero,origen:'manual',proveedor:provider.nombre,proveedorKey:body.providerKey,fecha:body.date,estado:'borrador',items,monto:total,total,moneda:body.currency,descripcion:items.length+' materiales',recepciones:[],ts:at,usuario:actor.name,usuarioUid:actor.uid};
 const planned=Inventory.planPendingOrder({kind:'register',order:{...order,fbKey:orderKey},id,at,inventories,references:resolved});
 for(const value of Object.values(planned.patch))number(value.enCompra);
 order.inventarioCompra={schema:1,registered:true,revision:1,lastOperation:id,references:Object.fromEntries(items.map((item,index)=>[String(index),{...resolved[item.productoKey],operationId:id}]))};
 const path='sisventas/ordenes/'+orderKey;
 return {patch:{...planned.patch,[path]:order},preconditions:{...planned.preconditions,[path]:null},result:{ok:true,committed:true,operationId:id,orderKey}};
}
module.exports={plan};
