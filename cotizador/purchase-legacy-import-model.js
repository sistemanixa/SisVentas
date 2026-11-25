'use strict';
const {digest}=require('./labor-guard');
const Money=require('./commercial-models/commercial-money');
const copy=value=>structuredClone(value);
const own=(value,field)=>Object.hasOwn(value,field);
function review(legacyKey,field,message) {
 return Object.assign(new Error(message),{code:'SV_PURCHASE_LEGACY_IMPORT_REVIEW',statusCode:409,legacyKey,field});
}
function plan({legacy,legacyKey,originalOrder,body,context}={}) {
 const fail=(field,message)=>{throw review(legacyKey,field,message);};
 const object=(value,field)=>{if(!value||typeof value!=='object'||Array.isArray(value))fail(field,'Falta el original completo o el contexto.');};
 const key=(value,field)=>{if(typeof value!=='string'||!value||Buffer.byteLength(value)>768||/[.#$\[\]/\x00-\x1f\x7f]/.test(value))fail(field,'Clave inválida.');return value;};
 const number=(value,field,positive=false)=>{
  if(typeof value!=='number'&&!(typeof value==='string'&&/^(?:\d+)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)))fail(field,'Cantidad o costo histórico no identificable.');
  const result=Number(value);if(!Number.isFinite(result)||result<0||result>Number.MAX_SAFE_INTEGER||positive&&result===0)fail(field,'Cantidad o costo histórico inválido.');
  try{Money.decimal(result);}catch(_){fail(field,'Cantidad o costo fuera de rango.');}return result;
 };
 const alias=(row,fields,field,positive=false)=>{
  const present=fields.filter(name=>own(row,name));if(!present.length)fail(field,'Falta cantidad o costo explícito; requiere revisión.');
  const values=present.map(name=>number(row[name],field+'.'+name,positive));
  if(values.some(value=>value!==values[0]))fail(field,'Los valores históricos son contradictorios.');return values[0];
 };
 const calculate=(field,run)=>{try{return number(run(),field);}catch(error){if(error.code==='SV_PURCHASE_LEGACY_IMPORT_REVIEW')throw error;fail(field,'El cálculo histórico está fuera de rango.');}};
 const coherent=(actual,expected,field)=>{const value=number(actual,field);if(value!==expected&&value!==calculate(field,()=>Money.amount(expected)))fail(field,'El importe original contradice sus cantidades y costos.');return value;};
 key(legacyKey,'legacyKey');object(legacy,'legacy');
 for(const field of ['_svSummary','_svListSummary','_svPagedSummary'])if(legacy[field])fail(field,'Una proyección no reemplaza al original histórico.');
 object(body,'body');if(Object.keys(body).some(field=>!['id','expectedHash'].includes(field)))fail('body','Controles de importación inválidos.');key(body.id,'body.id');
 if(typeof body.expectedHash!=='string'||body.expectedHash!==digest(legacy))fail('body.expectedHash','La fuente histórica cambió; recargá el original.');
 object(context,'context');key(context.orderKey,'context.orderKey');
 if(typeof context.numero!=='string'||!context.numero.trim()||context.numero.length>240)fail('context.numero','Falta el número asignado por servidor.');
 if(!Number.isSafeInteger(context.at)||context.at<=0||typeof context.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(context.date)||!Number.isFinite(Date.parse(context.date+'T00:00:00Z'))||new Date(context.date+'T00:00:00Z').toISOString().slice(0,10)!==context.date)fail('context.at','Falta la fecha de importación válida del servidor.');
 if(typeof context.actor==='string'){if(!context.actor.trim())fail('context.actor','Falta el actor del servidor.');}
 else {object(context.actor,'context.actor');key(context.actor.uid,'context.actor.uid');if(typeof context.actor.name!=='string'||!context.actor.name.trim())fail('context.actor.name','Falta el actor del servidor.');}
 const sourcePath='sisventas/ordenes_compra/'+legacyKey,destinationPath='sisventas/ordenes/'+context.orderKey;
 const source=copy(legacy);delete source.migradaA;delete source.migradaEn;
 const sourceHash=digest(source);
 if(own(legacy,'migradaA')) {
  if(key(legacy.migradaA,'migradaA')!==context.orderKey)fail('migradaA','La fuente ya tiene otro destino; recuperar su recibo.');
  object(originalOrder,'originalOrder');const proof=originalOrder.importacionHistorica;
  if(!proof||proof.schema!==1||proof.kind!=='purchase-legacy-import'||proof.historicalOnly!==true||proof.legacyKey!==legacyKey||proof.sourcePath!==sourcePath||proof.orderKey!==context.orderKey||proof.sourceHash!==sourceHash||digest(proof.source)!==sourceHash||proof.operationId!==body.id||proof.numero!==context.numero||originalOrder.numero!==proof.numero||originalOrder.origen!=='legacy'||originalOrder.legacyKey!==legacyKey||proof.importedAt!==legacy.migradaEn)fail('originalOrder.importacionHistorica','El destino no acredita esta fuente y operación históricas.');
  return {patch:{},preconditions:{},readDependencies:{[sourcePath]:copy(legacy),[destinationPath]:copy(originalOrder)},result:{orderKey:context.orderKey,legacyKey,alreadyImported:true,requiresReceipt:true,inventoryChanged:false}};
 }
 if(own(legacy,'migradaEn'))fail('migradaEn','El marcador de migración está incompleto.');
 if(originalOrder!==null)fail('originalOrder','El destino existe o no se leyó su ausencia real.');
 if(!Array.isArray(legacy.items)||!legacy.items.length)fail('items','Faltan renglones históricos completos.');
 const items=legacy.items.map((row,index)=>{
  const field='items.'+index;object(row,field);
  const qty=alias(row,['cantidadOrdenada','cantidad','qty'],field+'.quantity',true),cost=alias(row,['costoUnitario','precioRef'],field+'.unitCost');
  const calculated=calculate(field+'.subtotal',()=>Money.rawProduct(qty,cost)),subtotal=own(row,'subtotal')?coherent(row.subtotal,calculated,field+'.subtotal'):calculated;
  const next={...copy(row),cantidadOrdenada:qty,costoUnitario:cost,subtotal};
  if(!own(next,'codigo')&&own(row,'cod'))next.codigo=copy(row.cod);
  if(!own(next,'descripcion')&&own(row,'desc'))next.descripcion=copy(row.desc);
  let received;
  if(own(row,'cantidadRecibida'))received=number(row.cantidadRecibida,field+'.cantidadRecibida');
  if(own(row,'recibido')) {
   if(typeof row.recibido!=='boolean')fail(field+'.recibido','El indicador recibido no es explícito.');
   const indicated=row.recibido?qty:0;
   if(received!==undefined&&received!==indicated)fail(field+'.recibido','Las evidencias de recepción se contradicen.');
   if(received===undefined){received=indicated;next.cantidadRecibida=indicated;}
  }
  if(received!==undefined&&received>qty)fail(field+'.cantidadRecibida','La cantidad recibida supera la ordenada.');
  const realFields=['cantidadCostoReal','costoRealAcumulado','costoUnitarioReal','ultimoCostoReal'];
  if(realFields.some(name=>own(row,name))) {
   if(received===undefined||!own(row,'cantidadCostoReal')||!own(row,'costoRealAcumulado')||!own(row,'costoUnitarioReal'))fail(field+'.receipt','Falta evidencia completa del costo recibido.');
   const accounted=number(row.cantidadCostoReal,field+'.cantidadCostoReal'),real=number(row.costoUnitarioReal,field+'.costoUnitarioReal'),accumulated=number(row.costoRealAcumulado,field+'.costoRealAcumulado');
   if(accounted!==received)fail(field+'.cantidadCostoReal','La cantidad costeada y recibida son contradictorias.');
   coherent(accumulated,calculate(field+'.costoRealAcumulado',()=>Money.rawProduct(accounted,real)),field+'.costoRealAcumulado');
   if(own(row,'ultimoCostoReal'))number(row.ultimoCostoReal,field+'.ultimoCostoReal');
  }
  return next;
 });
 const calculatedTotal=calculate('total',()=>Money.quantitySum(items.map(row=>number(row.subtotal,'items.subtotal'))));
 for(const field of ['totalRealRecibido','totalPresupuestadoRecibido'])if(own(legacy,field)) {
  const amounts=items.map((row,index)=>{
   const path='items.'+index;
   if(!own(row,'cantidadRecibida'))fail(path+'.cantidadRecibida','Falta evidencia para el agregado histórico recibido.');
   const received=number(row.cantidadRecibida,path+'.cantidadRecibida');
   if(field==='totalRealRecibido') {
    if(received>0&&!own(row,'costoRealAcumulado'))fail(path+'.costoRealAcumulado','Falta evidencia para el costo real agregado.');
    return received>0?number(row.costoRealAcumulado,path+'.costoRealAcumulado'):0;
   }
   const unit=own(row,'costoUnitarioPresupuestado')?number(row.costoUnitarioPresupuestado,path+'.costoUnitarioPresupuestado'):row.costoUnitario;
   return calculate(path+'.budget',()=>Money.rawProduct(received,unit));
  });
  coherent(legacy[field],calculate(field,()=>Money.quantitySum(amounts)),field);
 }
 if(own(legacy,'diferenciaCompra')) {
  if(!own(legacy,'totalRealRecibido')||!own(legacy,'totalPresupuestadoRecibido'))fail('diferenciaCompra','Faltan totales recibidos que acrediten la diferencia histórica.');
  const actual=legacy.diferenciaCompra;
  if(typeof actual!=='number'||!Number.isFinite(actual))fail('diferenciaCompra','Diferencia histórica inválida.');
  const expected=Money.quantitySum([number(legacy.totalPresupuestadoRecibido,'totalPresupuestadoRecibido'),-number(legacy.totalRealRecibido,'totalRealRecibido')]);
  if(actual!==expected&&actual!==Money.amount(expected))fail('diferenciaCompra','La diferencia histórica contradice sus totales.');
 }
 const totals=['total','monto'].filter(field=>own(legacy,field));
 const values=totals.map(field=>coherent(legacy[field],calculatedTotal,field));
 if(values.length===2&&values[0]!==values[1])fail('total','Los totales originales se contradicen.');
 const order={numero:context.numero,origen:'legacy',legacyKey,items};
 // Preserve known historical header values verbatim; unknowns stay in the exact source snapshot.
 for(const field of ['ventaId','ventaFbKey','listaMaterialesId','listaOrigenId','cliente','proveedor','proveedorKey','proveedorFinalResumen','proveedoresFinales','fecha','estado','moneda','descripcion','obs','ts','usuario','usuarioUid','autor','creadoPor','creadoEn','actualizadoEn','recibidoEn','recepciones','totalRealRecibido','totalPresupuestadoRecibido','diferenciaCompra','precioPublico','publicPrice'])if(own(legacy,field))order[field]=copy(legacy[field]);
 if(own(legacy,'estado')&&typeof legacy.estado!=='string')fail('estado','El estado histórico requiere revisión.');
 // No invented current date/owner, ARS denomination, receipt ledger or inventory registration.
 for(const field of ['total','monto'])order[field]=own(legacy,field)?copy(legacy[field]):values.length?values[0]:calculatedTotal;
 order.importacionHistorica={schema:1,kind:'purchase-legacy-import',historicalOnly:true,legacyKey,sourcePath,orderKey:context.orderKey,numero:context.numero,operationId:body.id,sourceHash,source:copy(source),importedAt:context.at,importedDate:context.date,importedBy:copy(context.actor)};
 const nextLegacy={...copy(legacy),migradaA:context.orderKey,migradaEn:context.at};
 return {patch:{[sourcePath]:nextLegacy,[destinationPath]:order},preconditions:{[sourcePath]:copy(legacy),[destinationPath]:null},readDependencies:{[sourcePath]:copy(legacy),[destinationPath]:null},result:{orderKey:context.orderKey,legacyKey,alreadyImported:false,historicalOnly:true,inventoryChanged:false}};
}
module.exports=Object.freeze({plan});
