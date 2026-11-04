(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVPurchaseReceiptCosts=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const amount=(...values)=>{for(const value of values)if(value!==null&&value!==undefined&&value!==''){const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error('Hay un costo inválido en el material.');return n;}return 0;};
 const quantity=item=>{const value=Number(item.qty??item.cantidad??item.cant);if(!Number.isFinite(value)||value<=0)throw Error('Cambió la cantidad del material en la venta.');return value;};
 const original=item=>amount(item.costoUnitarioAntesPreparacion,item.costoCompraAnterior,item.costoUnitarioPresupuestado,item.costoUnitarioCompra,item.costoUnitario,item.costoCompra,item.costoTotalCompra==null?null:Number(item.costoTotalCompra)/quantity(item));
 function resolve(items,orderItem){
  const code=String(orderItem.codigo||'').trim().toUpperCase(),matches=item=>!!item&&(orderItem.productoKey&&[item.productoKey,item.productoId,item.pid,item.fbKeyProducto].some(key=>String(key||'')===String(orderItem.productoKey))||code&&String(item.cod||item.codigo||'').trim().toUpperCase()===code);
  if(orderItem.sourceLine!=null){
   const text=String(orderItem.sourceLine).split(':').at(-1),index=/^\d+$/.test(text)?Number(text):-1,item=items[index];
   if(!matches(item)||orderItem.sourceSaleQty!=null&&quantity(item)!==Number(orderItem.sourceSaleQty)||orderItem.sourceOriginalUnit!=null&&Math.abs(original(item)-Number(orderItem.sourceOriginalUnit))>0.000001)throw Error('Cambió el renglón de '+code+' en la venta. Revisá la recepción pendiente.');
   return index;
  }
  const indices=items.map((item,index)=>matches(item)?index:-1).filter(index=>index>=0);
  if(indices.length>1)throw Error('Hay varios renglones de '+code+' en la venta. Revisá cuál corresponde antes de confirmar la recepción.');
  if(!indices.length)throw Error('El material '+(code||orderItem.productoKey||'')+' ya no está en la venta. Revisá la recepción pendiente.');
  return indices[0];
 }
 function apply(item,orderItem,movement,costOfItem){
  const next=JSON.parse(JSON.stringify(item)),qty=quantity(item),plan=item.preparacionCompra;
  const stock=plan?Number(plan.cantidadStock):0,purchased=plan?Number(plan.cantidadComprar):qty;
  if(!Number.isFinite(stock)||stock<0||!Number.isFinite(purchased)||purchased<0||Math.abs(stock+purchased-qty)>0.000001)throw Error('Cambió la preparación de materiales. Revisá la compra.');
  const originalUnit=item.costoUnitarioAntesPreparacion==null?amount(item.costoUnitarioPresupuestado,costOfItem?Number(costOfItem(item))/qty:null,original(item)):Number(item.costoUnitarioAntesPreparacion);
  const budget=plan?amount(plan.costoCompraUnitario):amount(item.costoUnitarioPresupuestado,item.costoUnitarioCompra,item.costoUnitario,item.costoCompra,orderItem.costoUnitarioPresupuestado,orderItem.costoUnitario);
  const stockUnit=plan?amount(plan.costoStockUnitario):originalUnit,priorQty=amount(item.cantidadCompraReal),priorTotal=amount(item.costoRealCompraAcumulado),accepted=Number(movement.qty),realUnit=Number(movement.costoUnitarioReal);
  if(!Number.isFinite(accepted)||accepted<=0||!Number.isFinite(realUnit)||realUnit<0||priorQty+accepted>purchased+0.000001)throw Error('La recepción supera la cantidad pendiente de la venta.');
  const realQty=priorQty+accepted,realTotal=priorTotal+accepted*realUnit,plannedTotal=stock*stockUnit+purchased*budget,effectiveTotal=stock*stockUnit+realTotal+Math.max(0,purchased-realQty)*budget;
  Object.assign(next,{costoUnitarioAntesPreparacion:originalUnit,costoUnitarioPresupuestado:plannedTotal/qty,costoTotalPresupuestado:plannedTotal,cantidadCompraReal:realQty,costoRealCompraAcumulado:realTotal,costoTotalCompra:Math.round(effectiveTotal*100)/100,costoUnitarioCompra:Math.round(effectiveTotal/qty*100)/100,ultimoCostoCompraReal:realUnit,proveedorCompraReal:movement.proveedor,proveedorCompraRealKey:movement.proveedorKey});
  return next;
 }
 return Object.freeze({resolve,apply,amount,quantity,original});
});
