'use strict';
// Pure, scoped reversal. Server wrappers own authorization, journal and cohort checks.
const {digest}=require('./labor-guard');
const Money=require('./commercial-models/commercial-money'),Links=require('./purchase-list-reserve-model');
const clone=value=>structuredClone(value),own=(object,field)=>Object.hasOwn(object||{},field);
const costFields=['costoTotalCompra','costoUnitarioCompra','preparacionCompra','costoUnitarioUSD','proveedorCompra','proveedorCompraKey','origenCompra','compraExteriorAplicada','precioAcordadoCompra','monedaCompra','cotizacionCompra'];
function plan({list,listKey,sourceLists={},sales={},context}={}) {
 const fail=(identifier,field,message)=>{throw Object.assign(Error(message),{code:'SV_PURCHASE_PREPARATION_CANCEL_REVIEW',statusCode:409,identifier,field});};
 const key=(value,field)=>{if(typeof value!=='string'||!value||value.length>180||/[.#$\[\]/\x00-\x1f\x7f]/.test(value)||['__proto__','constructor','prototype'].includes(value))fail(listKey,field,'Clave inválida.');return value;};
 key(listKey,'listKey');key(context?.id,'context.id');
 if(!Number.isSafeInteger(context.at)||context.at<=0)fail(listKey,'context.at','Falta el instante del servidor.');
 const actor=typeof context.actor==='string'?context.actor:context.actor?.name;
 if(typeof actor!=='string'||!actor.trim())fail(listKey,'context.actor','Falta el actor del servidor.');
 if(typeof context.actor==='object')key(context.actor.uid,'context.actor.uid');
 const number=(value,id,field)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER)fail(id,field,'Falta cantidad o costo original explícito.');try{Money.decimal(value);}catch(_){fail(id,field,'El importe original está fuera de rango.');}return value;};
 const full=(value,id)=>{if(!value||typeof value!=='object'||Array.isArray(value)||value._svSummary||value._svListSummary||value._svPagedSummary||!Array.isArray(value.items))fail(id,'original','Falta el original completo.');return value;};
 const emptyRefs=(value,field,id)=>{if(!Array.isArray(value[field])||value[field].length)fail(id,field,'Falta comprobar que no existen órdenes vinculadas.');};
 const pending=(value,id)=>{
  for(const field of Object.keys(value))if(/(Pendiente|Bloqueo)$/.test(field)&&value[field])fail(id,field,'La operación pendiente requiere recuperación de servidor o revisión; no se ejecutan pasos guardados por el cliente.');
  if(value.cancelacionExteriorAplicada||value.exteriorCanceladoEn)fail(id,'exteriorCanceladoEn','Consultá el recibo de la cancelación anterior.');
 };
 const editable=(value,id,child=false)=>{full(value,id);pending(value,id);emptyRefs(value,'ordenesIds',id);if(!['preparacion','borrador'].includes(value.estado)||value.desagrupada||value.compraConfirmacion||value.stockExistenteReservado||Object.keys(value.reservasInventario||{}).length||value.compraConjuntaId&&!child)fail(id,'estado','La preparación tiene confirmación, reserva o vínculo incompatible.');};
 const qty=(row,id)=>{const values=['qty','cantidad','cant'].filter(field=>own(row,field)).map(field=>number(row[field],id,field));if(!values.length||values[0]<=0||values.some(v=>v!==values[0]))fail(id,'quantity','Cantidad original ambigua.');return values[0];};
 const cost=(row,id)=>{
  if(!row||typeof row!=='object'||Array.isArray(row))fail(id,'items','Falta el renglón original completo.');
  if(row.comisionCostoHistoricoPendiente)fail(id,'cost','El costo histórico está pendiente de revisión.');
  for(const field of ['costoTotalCompra','costoTotal','costo'])if(own(row,field))return number(row[field],id,field);
  for(const field of ['costoUnitarioCompra','costoUnitario','costoCompra'])if(own(row,field))return number(Money.rawProduct(qty(row,id),number(row[field],id,field)),id,field);
  fail(id,'cost','Falta costo histórico; no se usa catálogo ni cero.');
 };
 const patch={},preconditions={},readDependencies={};
 const depend=(path,value)=>{readDependencies[path]=clone(value);};
 const fieldWrite=(base,original,field,next)=>{
  const previous=own(original,field)?original[field]:null;if(digest(previous)===digest(next))return;
  const path=base+'/'+field;preconditions[path]=clone(previous);patch[path]=clone(next);
 };
 const audit={fecha:new Date(context.at).toISOString(),usuario:actor,accion:'Preparación exterior eliminada; restaurados costos y proveedores capturados',ts:context.at,operationId:context.id};
 const appendAudit=(base,record,id,entry)=>{
  const previous=record.audit;
  if(previous!=null&&(typeof previous!=='object'))fail(id,'audit','El historial de auditoría requiere revisión.');
  const slot=Array.isArray(previous)?String(previous.length):context.id;
  if(previous&&own(previous,slot))fail(id,'audit','La auditoría ya contiene esta operación; consultá su recibo.');
  fieldWrite(base+'/audit',previous||{},slot,entry);
 };
 const sources=[],listIds=new Set(),saleIds=new Set();
 editable(list,listKey);depend('sisventas/listas_materiales/'+listKey,list);
 const addSource=(lk,child,sk,group)=>{
  key(lk,'source.listId');key(sk,'source.ventaFbKey');
  if(listIds.has(lk)||saleIds.has(sk))fail(lk,'sources','Fuentes duplicadas.');listIds.add(lk);saleIds.add(sk);
  editable(child,lk,group);
  const sale=full(own(sales,sk)?sales[sk]:null,sk);pending(sale,sk);emptyRefs(sale,'ordenesCompraIds',sk);
  if(child.ventaFbKey!==sk||sale.listaMaterialesId!==lk||sale.anulada||sale.anulado||sale.eliminado||child.origen==='conjunta'||child.sources?.length)fail(lk,'ventaFbKey','Los vínculos originales no coinciden.');
  if(group&&child.compraConjuntaId!==listKey)fail(lk,'compraConjuntaId','Cambió la agrupación original.');
  depend('sisventas/listas_materiales/'+lk,child);depend('sisventas/ventas/'+sk,sale);sources.push({lk,child,sk,sale});
 };
 if(list.origen==='conjunta') {
  if(list.ventaFbKey||!Array.isArray(list.sources)||list.sources.length<2||list.sources.length>100)fail(listKey,'sources','Fuentes conjuntas incompletas.');
  for(const source of list.sources){if(!source||source.listId===listKey)fail(listKey,'sources','Fuente conjunta inválida.');addSource(source.listId,own(sourceLists,source.listId)?sourceLists[source.listId]:null,source.ventaFbKey,true);}
 }else if(list.origen==='stock_paraguay') {
  if(list.ventaFbKey||list.ventaId||list.sources?.length||list.items.length)fail(listKey,'sources','Stock con fuentes ambiguas.');
 }else {
  if(list.sources?.length)fail(listKey,'sources','Fuentes ambiguas.');addSource(listKey,list,list.ventaFbKey,false);
 }
 const union=[];for(const {lk,child,sk,sale}of sources){let entries;try{entries=Links.links(child,lk,sk);}catch(e){fail(lk,'vinculosInventario',e.message);}if(entries.length&&child.stockExistenteVinculado!==true||child.stockExistenteVinculado===true&&!own(child,'vinculosInventario'))fail(lk,'vinculosInventario','La traza v2 y su marca son contradictorias.');union.push(...entries);if(child.stockExistenteVinculado!==true&&!entries.length)continue;
  const amounts=new Map();for(const material of child.items){if(material.esManoDeObra===true||material.incluir===false)continue;const existing=number(material.usarExistente,lk,'usarExistente'),buy=number(material.cantidadComprar,lk,'cantidadComprar'),line=sale.items[material.linea];if(Money.quantitySum([existing,buy])!==number(material.cantidadNecesaria,lk,'cantidadNecesaria'))fail(lk,'vinculosInventario','La distribución vinculada no coincide con su necesidad.');if(!line?.preparacionCompra||line.preparacionCompra.cantidadStock!==existing||line.preparacionCompra.cantidadComprar!==buy)fail(lk,'vinculosInventario','La preparación intenta reinterpretar las cantidades vinculadas.');amounts.set(material.productoKey,Money.quantitySum([amounts.get(material.productoKey)||0,existing]));
   if(list.origen==='conjunta'){const joined=list.items.filter(r=>r.sourceListId===lk&&r.linea===lk+':'+material.linea);if(joined.length!==1||joined[0].usarExistente!==existing||joined[0].cantidadComprar!==buy||joined[0].productoKey!==material.productoKey)fail(lk,'vinculosInventario','El padre cambia las cantidades vinculadas de su fuente.');}
  }
  if(digest([...amounts].filter(([,q])=>q>0).sort())!==digest(entries.map(e=>[e.productKey,e.cantidad]).sort()))fail(lk,'vinculosInventario','Las cantidades originales contradicen el vínculo v2.');
 }
 if(list.origen==='conjunta'){try{Links.jointLinks(list,union);}catch(e){fail(listKey,'vinculosInventario',e.message);}if(union.length&&(!Array.isArray(list.vinculosInventario)||list.stockExistenteVinculado!==true))fail(listKey,'vinculosInventario','Falta la unión de trazas originales.');}
 else if(!sources.length&&(list.stockExistenteVinculado===true||list.vinculosInventario?.length))fail(listKey,'vinculosInventario','El stock independiente conserva un vínculo de venta ambiguo.');
 const usedJoint=new Set();
 for(const {lk,child,sk,sale}of sources) {
  const nextSale=clone(sale),used=new Set(),replacements=[];
  // Every existing receipt, even on an excluded line, prevents pre-order reversal.
  for(const line of sale.items)for(const field of ['cantidadCompraReal','costoRealCompraAcumulado'])if(own(line,field)&&number(line[field],sk,field)!==0)fail(sk,field,'La venta ya tiene recepciones.');
  const currentTotal=Money.quantitySum(sale.items.map(line=>cost(line,sk)));
  if(number(sale.costoTotal,sk,'costoTotal')!==currentTotal)fail(sk,'costoTotal','El costo agregado original es inconsistente.');
  for(const [materialIndex,material]of child.items.entries()) {
   if(material?.esManoDeObra===true)continue;
   const id=lk+':'+materialIndex,index=material?.linea;
   if(!Number.isSafeInteger(index)||index<0||used.has(index)||!sale.items[index])fail(id,'linea','Línea original ausente o ambigua.');used.add(index);
   const line=sale.items[index],snapshot=material.origenVentaItem;
   if(line.esManoDeObra===true)fail(id,'esManoDeObra','El material apunta a mano de obra.');
   if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))fail(id,'origenVentaItem','Falta snapshot original aprobado.');
   const code=material.codigo,product=material.productoKey;
   if(typeof code!=='string'||!code||typeof product!=='string'||!product||[line,snapshot].some(row=>(row.cod??row.codigo)!==code||[row.productoKey,row.pid,row.productoFbKey,row.fbKeyProducto].filter(v=>v!=null).some(v=>v!==product)))fail(id,'product','La identidad de origen cambió.');
   const quantity=qty(line,id);if(number(material.cantidadNecesaria,id,'cantidadNecesaria')!==quantity||qty(snapshot,id)!==quantity)fail(id,'quantity','Cambió la cantidad original.');
   for(const field of ['cantidadCompraReal','costoRealCompraAcumulado'])if(own(snapshot,field)&&number(snapshot[field],id,field)!==0)fail(id,field,'El snapshot ya conserva recepciones.');
   if(list.origen==='conjunta') {
    const matches=list.items.map((row,position)=>({row,position})).filter(({row})=>row.sourceListId===lk&&row.linea===lk+':'+index);
    if(matches.length!==1)fail(id,'sourceListId','Material conjunto sin fuente única.');
    const {row,position}=matches[0];if(row.codigo!==code||row.productoKey!==product||row.cantidadNecesaria!==quantity||digest(row.origenVentaItem)!==digest(snapshot))fail(id,'sourceListId','La captura conjunta difiere de su fuente.');usedJoint.add(position);
   }
   const originalTotal=cost(snapshot,id),unit=own(snapshot,'costoUnitarioCompra')?number(snapshot.costoUnitarioCompra,id,'costoUnitarioCompra'):originalTotal/quantity;
   if(originalTotal!==Money.rawProduct(unit,quantity)&&originalTotal!==Money.product(unit,quantity))fail(id,'cost','Los costos capturados se contradicen.');
   const origin=snapshot.origenCompra??'Local';
   // An original exterior purchase is not evidence of a local provider/price.
   if(!['Local','Stock'].includes(origin)||snapshot.compraExteriorAplicada||snapshot.monedaCompra&&snapshot.monedaCompra!=='ARS')fail(id,'origenVentaItem','Falta una captura local/stock inequívoca; no se reinterpreta una referencia exterior.');
   const reference=material.localReference??material.referenciaCompra;
   if(origin==='Local'&&!own(snapshot,'proveedorCompra')&&snapshot.origenCompra!=='Local'&&!(reference?.currency==='ARS'&&reference.amount===unit))fail(id,'provider','La captura no acredita un proveedor local para ese costo.');
   const provider=snapshot.proveedorCompra??(origin==='Stock'?'Stock disponible':reference?.currency==='ARS'?reference.provider:material.proveedor),providerKey=snapshot.proveedorCompraKey??(origin==='Stock'?'':reference?.currency==='ARS'?reference.providerKey:material.proveedorKey);
   if(typeof provider!=='string'||!provider.trim()||typeof providerKey!=='string'||origin==='Local'&&!providerKey)fail(id,'provider','Falta el proveedor local capturado.');
   if(origin==='Local'&&!own(snapshot,'proveedorCompra')&&(reference?.currency==='ARS'?number(reference.amount,id,'reference.amount'):number(material.costoUnitario,id,'costoUnitario'))!==unit)fail(id,'provider','El proveedor del material no acredita el costo original.');
   const restored={...clone(line)};
   for(const field of costFields) {if(own(snapshot,field))restored[field]=clone(snapshot[field]);else delete restored[field];}
   Object.assign(restored,{costoTotalCompra:originalTotal,costoUnitarioCompra:unit,origenCompra:origin,proveedorCompra:provider,proveedorCompraKey:providerKey});
   // Never replace full Sale lines with snapshots: current PVP/tax/payment metadata wins.
   for(const field of costFields)fieldWrite('sisventas/ventas/'+sk+'/items/'+index,line,field,own(restored,field)?restored[field]:null);
   nextSale.items[index]=restored;replacements.push({codigo:code,proveedor:provider,costoUnitario:unit});
  }
  const total=Money.quantitySum(nextSale.items.map(row=>cost(row,sk))),income=number(sale.subtotal,sk,'subtotal');if(income<=0)fail(sk,'subtotal','Falta el ingreso neto original positivo.');
  fieldWrite('sisventas/ventas/'+sk,sale,'costoTotal',total);fieldWrite('sisventas/ventas/'+sk,sale,'margenPct',(income-total)/income*100);
  appendAudit('sisventas/ventas/'+sk,sale,sk,{...audit,productos:replacements});
 }
 if(list.origen==='conjunta'&&list.items.some((row,index)=>row.esManoDeObra!==true&&!usedJoint.has(index)))fail(listKey,'items','Material conjunto sin fuente provista.');
 const cancelList=(lk,record)=>{
  const base='sisventas/listas_materiales/'+lk;
  if(record.preparacionExteriorEliminada)fail(lk,'preparacionExteriorEliminada','La preparación conserva otra cancelación; consultá el recibo.');
  fieldWrite(base,record,'preparacionExteriorEliminada',{simulador:clone(record.simuladorParaguay??null),fecha:context.at,usuario:actor,operationId:context.id});
  fieldWrite(base,record,'simuladorParaguay',null);fieldWrite(base,record,'compraConjuntaId',null);
  fieldWrite(base,record,'estado','cancelada');fieldWrite(base,record,'exteriorCanceladoEn',context.at);
  fieldWrite(base,record,'cancelacionExteriorAplicada',context.id);appendAudit(base,record,lk,audit);
 };
 for(const {lk,child}of sources)cancelList(lk,child);
 if(!listIds.has(listKey))cancelList(listKey,list);
 return {patch,preconditions,readDependencies,result:{operationId:context.id,listKey,cancelledLists:[...new Set([listKey,...listIds])],restoredSales:[...saleIds],inventoryChanged:false}};
}
module.exports=Object.freeze({plan});
