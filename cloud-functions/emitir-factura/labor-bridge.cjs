'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const Fiscal=require('./fiscal-contract.cjs');
const copy=value=>value==null?null:structuredClone(value);
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
function canonical(value){if(value==null)return 'null';if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(typeof value==='object')return '{'+Object.keys(value).filter(key=>value[key]!==undefined).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';return JSON.stringify(value);}
const hash=value=>crypto.createHash('sha256').update(canonical(value)).digest('hex');
function saleKey(value){if(typeof value!=='string'||!value||Buffer.byteLength(value)>768||/[.#$\[\]\/\x00-\x1f\x7f]/.test(value))throw fail(400,'Guardá la venta antes de emitir su comprobante');return value;}
const round=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
function fiscalType(value){const text=String(value||'').toUpperCase().replace(/\s+/g,' ').trim();return {'1':'FACTURA A','6':'FACTURA B','11':'FACTURA C','3':'NOTA DE CREDITO A','8':'NOTA DE CREDITO B','13':'NOTA DE CREDITO C'}[text.replace(/^0+/,'')]||text;}
function validateFiscalSource(sale,data,provider){
 let expected;
 try{
  if(data.esNotaCredito){
   const original=sale.factura?.datos_fiscales;
   if(!original?.cae||!Array.isArray(original.detalle)||!original.detalle.length||!(Number(original.total)>0))throw Error('Actualizá la información fiscal de la factura original');
   const associated=data.comprobante_asociado||{},number=String(original.numero||sale.factura?.numero||'').split('-').pop();
   if(fiscalType(associated.tipo)!==fiscalType(original.tipo||sale.factura.tipo)||Number(associated.punto_venta)!==Number(original.punto_venta||sale.factura.punto_venta||sale.factura.puntoVenta)||Number(associated.numero)!==Number(number))throw Error('La factura asociada cambió');
   expected=Fiscal.prepararVentaParaNotaCredito(sale,original);
  }else expected=Fiscal.prepararVentaParaFacturacion(sale,data.tipoComprobante).venta;
 }catch(error){throw fail(409,'La venta o su información fiscal cambió. Actualizá la pantalla antes de emitir. '+error.message);}
 const projected=(items,source)=>items.map(item=>source?{cantidad:Number(item.qty||item.cantidad),codigo:String(item.cod||item.codigo||''),descripcion:String(item.desc||item.descripcion||'Producto'),neto:round(item.precioUnitarioSinIvaFiscal)}:{cantidad:Number(item.cantidad),codigo:String(item.producto?.codigo||''),descripcion:String(item.producto?.descripcion||'Producto'),neto:round(item.producto?.precio_unitario_sin_iva)});
 const expectedDetail=projected(expected.items||[],true),actualDetail=projected(provider.comprobante?.detalle||[],false);
 if(canonical(expectedDetail)!==canonical(actualDetail)||round(expected.totalFiscalEsperado)!==round(provider.comprobante?.total))throw fail(409,'La venta cambió desde que abriste la facturación. Actualizá la pantalla; no se emitió el comprobante.');
}
function fiscalContract(data,provider,cycle){
 const c=provider.comprobante||{};
 return {ventaKey:saleKey(data.venta?.fbKey),clase:data.esNotaCredito?'nota_credito':'factura',ciclo:cycle,cliente:provider.cliente||{},comprobante:{tipo:c.tipo,punto_venta:c.punto_venta,moneda:c.moneda,cotizacion:c.cotizacion,rubro:c.rubro,rubro_grupo_contable:c.rubro_grupo_contable,total:c.total,detalle:c.detalle,asociados:c.comprobantes_asociados||[]}};
}
function createFiscalLaborBridge({db,guard,now=Date.now,uuid=crypto.randomUUID}){
 if(!db||!guard)throw Error('Falta la coordinación fiscal');
 const actor=operation=>({uid:'sv-labor-service',mode:'server',operation});
 const jobRef=id=>{if(!/^[a-f0-9]{64}$/.test(id||''))throw fail(400,'Referencia fiscal inválida');return db.ref('sv_fiscal_emissions/'+id);};
 async function attachment(job,result){
  const key=saleKey(job.ventaKey),salePath='sisventas/ventas/'+key;
  await guard.run({...actor('fiscal-attachment'),input:{operationId:job.operationId,ventaKey:key,cae:result.cae}},async scope=>{
   const sale=await scope.get(salePath);if(!sale)throw fail(409,'La venta ya no está disponible. El comprobante fiscal se conserva.');
   const existing=sale.emisionesFiscales?.[job.operationId];
   if(existing){if(String(existing.cae||existing.resultado?.cae||'')!==String(result.cae||''))throw fail(409,'La referencia fiscal tiene otro comprobante');return;}
   const currentCae=String(sale.factura?.cae||'');
   if(job.clase==='nota_credito'){
    if(currentCae!==job.facturaAnteriorCae)throw fail(409,'La factura original cambió. El comprobante autorizado se conserva.');
    if(sale.notaCredito?.cae&&String(sale.notaCredito.cae)!==String(result.cae))throw fail(409,'La venta ya tiene otra nota de crédito');
   }else if(currentCae&&currentCae!==String(result.cae||'')&&currentCae!==job.facturaAnteriorCae)throw fail(409,'La venta ya tiene otra factura. El comprobante autorizado se conserva.');
   if(job.clase==='factura'&&job.facturaAnteriorCae&&currentCae===job.facturaAnteriorCae&&!sale.facturaAnulada&&!sale.notaCredito?.cae)throw fail(409,'La factura anterior ya no figura anulada. El comprobante autorizado se conserva.');
   const updates={};
   updates[salePath+'/emisionesFiscales/'+job.operationId]={clase:job.clase,cae:String(result.cae||''),registradoTs:now(),usuario:job.usuario||'',uid:job.uid||''};
   if(job.clase==='nota_credito'){
    updates[salePath+'/notaCredito']=copy(result);updates[salePath+'/facturaAnulada']=true;updates[salePath+'/fechaAnulacionFiscal']=result.fecha||'';updates[salePath+'/facturaAnuladaPor']=job.usuario||'';
   }else{
    updates[salePath+'/factura']=copy(result);
    if(job.facturaAnteriorCae&&currentCae===job.facturaAnteriorCae){
     const history=Array.isArray(sale.historialFiscal)?sale.historialFiscal.slice():[];
     if(!history.some(item=>item?.factura?.cae===job.facturaAnteriorCae&&item?.notaCredito?.cae===sale.notaCredito?.cae))history.push({fecha:result.fecha||'',tipo:'factura_anulada',factura:copy(sale.factura),notaCredito:copy(sale.notaCredito),detalle:'Factura anterior anulada y reemplazada por una nueva emisión'});
     updates[salePath+'/historialFiscal']=history;
     for(const field of ['facturaAnulada','fechaAnulacionFiscal','facturaAnuladaPor','notaCredito'])updates[salePath+'/'+field]=null;
     updates[salePath+'/idNotaCredito']='';
    }
   }
   const audit=Array.isArray(sale.audit)?sale.audit.slice():[];
   if(!audit.some(item=>item?.emisionFiscalId===job.operationId))audit.push({fecha:result.fecha||'',usuario:job.usuario||'',accion:job.clase==='nota_credito'?'Nota de crédito emitida':'Factura emitida',emisionFiscalId:job.operationId});
   updates[salePath+'/audit']=audit;await scope.update(updates);
  });
 }
 async function response(job,result,durable=true){
  let pending=false;try{await attachment(job,result);}catch(_){pending=true;}
  return {...copy(result),gestionFiscalServidor:true,emisionOperacionId:job.operationId,persistenciaPendiente:pending,vinculacionDisponible:pending&&durable};
 }
 async function begin({data,provider,uid='',usuario=''}){
  data=Fiscal.normalizarSolicitudEmisionFiscal(data,true);
  if(provider.comprobante?.tipo!==data.tipoComprobante)throw fail(400,'El tipo del comprobante fiscal no coincide con la operación.');
  const key=saleKey(data.venta?.fbKey),salePath='sisventas/ventas/'+key;let sale,cycle,operationId;
  // El fence de preflight no abarca la llamada externa. Si el circuito no está
  // listo o está en revisión, no se contacta al proveedor fiscal.
  await guard.run({...actor('fiscal-preflight'),input:{ventaKey:key}},async scope=>{
   sale=await scope.get(salePath);if(!sale)throw fail(404,'La venta ya no está disponible');
   const prior=String(sale.factura?.cae||''),kind=data.esNotaCredito?'nota_credito':'factura';
   const existing=kind==='factura'&&prior&&!sale.facturaAnulada&&!sale.notaCredito?.cae||kind==='nota_credito'&&sale.notaCredito?.cae;
   cycle=kind==='nota_credito'?{facturaCae:prior}:{facturaAnteriorCae:prior,notaCreditoCae:String(sale.notaCredito?.cae||'')};
   operationId=hash({ventaKey:key,clase:kind,ciclo:cycle});
   const job=existing?null:await scope.get('sv_fiscal_emissions/'+operationId);
   if(!existing&&(!job||job.estado==='rechazada'))validateFiscalSource(sale,data,provider);
   // El recibo guarda únicamente el ack. La venta queda en memoria de esta
   // solicitud y nunca se duplica dentro de sv_labor_receipts.
   return {ready:true};
  });
  if(!sale)throw fail(404,'La venta ya no está disponible');
  const prior=String(sale.factura?.cae||''),kind=data.esNotaCredito?'nota_credito':'factura';
  if(kind==='factura'&&prior&&!sale.facturaAnulada&&!sale.notaCredito?.cae)return {dispatch:false,result:{...copy(sale.factura),gestionFiscalServidor:true,persistenciaPendiente:false,reutilizada:true}};
  if(kind==='nota_credito'&&!prior)throw fail(409,'La factura original todavía no está vinculada a la venta');
  if(kind==='nota_credito'&&sale.notaCredito?.cae)return {dispatch:false,result:{...copy(sale.notaCredito),gestionFiscalServidor:true,persistenciaPendiente:false,reutilizada:true}};
  const contractHash=hash(fiscalContract(data,provider,cycle)),claim=uuid();
  const proposed={operationId,ventaKey:key,clase:kind,facturaAnteriorCae:prior,contractHash,estado:'despachada',claim,uid,usuario,creadoTs:now()};
  const ref=jobRef(operationId),reserved=await ref.transaction(old=>!old||old.estado==='rechazada'?proposed:undefined);
  const job=reserved.snapshot?.val?reserved.snapshot.val():(await ref.get()).val();
  if(reserved.committed&&job?.claim===claim)return {dispatch:true,job};
  if(job?.resultado)return {dispatch:false,result:await response(job,job.resultado)};
  // No se vence ni se toma automáticamente una emisión despachada: la falta
  // de respuesta no demuestra que ARCA no haya autorizado el comprobante.
  throw fail(409,'Esta emisión está pendiente de verificación. No vuelvas a emitirla; revisá el comprobante original.','SV_FISCAL_PENDING');
 }
 async function rejected(job){
  await jobRef(job.operationId).transaction(old=>old?.claim===job.claim&&!old.resultado?{...old,estado:'rechazada',actualizadoTs:now()}:undefined);
 }
 async function complete(job,result){
  let durable=false;
  for(let attempt=0;attempt<2&&!durable;attempt++)try{
   const saved=await jobRef(job.operationId).transaction(old=>{
    if(old?.resultado){if(canonical(old.resultado)!==canonical(result))throw fail(409,'La emisión ya conserva otro resultado fiscal');return;}
    if(old?.claim!==job.claim)throw fail(409,'La reserva fiscal cambió');
    return {...old,estado:'autorizada',resultado:copy(result),autorizadoTs:now()};
   });
   durable=saved.committed||canonical(saved.snapshot?.val?.()?.resultado)===canonical(result);
  }catch(_){/* Sólo se repite el guardado del resultado; nunca la emisión. */}
  return response(job,result,durable);
 }
 async function resume(operationId,authorize=async()=>{}){
  const job=(await jobRef(operationId).get()).val();
  if(!job?.resultado)throw fail(409,'La emisión requiere verificación fiscal. Conservá su CAE y no vuelvas a emitirla.','SV_FISCAL_PENDING');
  await authorize(job);
  return response(job,job.resultado);
 }
 return {begin,complete,rejected,resume};
}
function runtime(admin){
 const vendored=fs.existsSync(path.join(__dirname,'vendor/labor/manifest.json'));
 const guardModule=vendored?require('./vendor/labor/labor-guard'):require('../../cotizador/labor-guard');
 const storeModule=vendored?require('./vendor/labor/labor-rtdb-store'):require('../../cotizador/labor-rtdb-store');
 const app=admin.app(),credential=app.options.credential||admin.credential.applicationDefault();
 const store=storeModule.createLaborRtdbStore({databaseURL:app.options.databaseURL,accessToken:async()=>(await credential.getAccessToken()).access_token});
 return createFiscalLaborBridge({db:admin.database(),guard:guardModule.createLaborGuard({store,readOnly:process.env.LABOR_SCOPED_READ_ONLY==='true'})});
}
module.exports={createFiscalLaborBridge,runtime,fiscalContract,validateFiscalSource,canonical,hash};
