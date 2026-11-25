(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVPurchaseCommandAdapter=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 const fail=(code,message)=>Object.assign(Error(message),{code,svLaborAttempted:false});
 function decisionNumber(value){
  if(value===''||value===undefined)return value;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())&&Number.isFinite(Number(value)))return Number(value);
  throw fail('SV_PURCHASE_INPUT','Revisá el importe o la cantidad: usá un número decimal válido.');
 }
 function exchangeRate(value){const rate=decisionNumber(value);if(typeof rate!=='number'||rate<=0||rate>1e9)throw fail('SV_PURCHASE_EXCHANGE_RATE','Indicá una cotización ARS por USD mayor que cero y hasta 1.000.000.000.');return rate;}
 function editExchangeRequired(original,rows,sources){
  if(String(original?.moneda||'ARS').toUpperCase()!=='USD')return false;
  return rows.some((row,index)=>{const sourceIndex=sources?.[index]??null,prior=sourceIndex===null?null:original.items?.[sourceIndex];return !prior||Number(row.costoUnitario)!==Number(prior.costoUnitario);});
 }
 function inventoryRevision(original){
  const revision=original?._svReadRevision??0;
  if(!Number.isSafeInteger(revision)||revision<0)throw fail('SV_PURCHASE_ORIGINAL','Reabrí la compra: su revisión original necesita verificarse.');
  return revision;
 }
 function editDestination(original,item,sourceIndex){
  const linked=!!(original&&(original.ventaFbKey||original.ventaId||original.listaMaterialesId||original.listaOrigenId||original.compraVentaReferencia));
  if(!linked)return {required:false};
  const next=decisionNumber(item.cantidadOrdenada);if(typeof next!=='number'||next<=0)throw fail('SV_PURCHASE_INPUT','Revisá la cantidad del material.');
  if(sourceIndex===null)return {required:true,newLine:true,extra:next};
  if(!Number.isSafeInteger(sourceIndex)||sourceIndex<0||!original.items?.[sourceIndex])throw fail('SV_PURCHASE_SOURCE_INDEX','Reabrí la orden: falta identificar su renglón original.');
  const source=original.items[sourceIndex],quantity=Number(source.cantidadOrdenada??source.cantidad);
  if(!Number.isFinite(quantity)||quantity<0)throw fail('SV_PURCHASE_SOURCE_INDEX','El renglón original requiere revisión.');
  const stock=source.destino==='stock'||source.destination==='stock'||original.origen==='extra_stock';
  return {required:!stock&&next>quantity,newLine:false,originalQuantity:quantity,extra:Math.max(0,next-quantity)};
 }
 function linkedEditRows(original,rows,sources,destinations){
  if(!original||!(original.ventaFbKey||original.ventaId||original.listaMaterialesId||original.listaOrigenId||original.compraVentaReferencia))return rows;
  if(!Array.isArray(sources)||sources.length!==rows.length)throw fail('SV_PURCHASE_SOURCE_INDEX','Reabrí la orden para conservar sus renglones originales.');
  const used=new Set();
  return rows.map((row,index)=>{
   const sourceIndex=sources[index],source=sourceIndex===null?null:original.items?.[sourceIndex];
   if(sourceIndex!==null&&(used.has(sourceIndex)||String(source?.productoKey||source?.codigo||'')!==row.productKey))throw fail('SV_PURCHASE_SOURCE_INDEX','El producto no coincide con su renglón original.');
   if(sourceIndex!==null)used.add(sourceIndex);
   const needed=editDestination(original,{cantidadOrdenada:row.quantity},sourceIndex),out={...row};
   if(sourceIndex!==null)out.sourceIndex=sourceIndex;
   if(needed.required){if(destinations?.[index]!=='stock')throw fail('SV_PURCHASE_DESTINATION','Elegí Stock para el material nuevo o las unidades adicionales. Para ampliar la venta, modificá Venta y Lista.');out.destination='stock';}
   return out;
  });
 }
 const routes=Object.freeze({manualCreate:'/compras/ordenes/crear',orderInventory:'/compras/ordenes/inventario',listGenerate:'/compras/listas/generar',orderState:'/compras/ordenes/estado',orderReconcile:'/compras/ordenes/conciliar',orderDelete:'/compras/ordenes/eliminar',listCreate:'/compras/listas/crear',listStock:'/compras/listas/stock',listSave:'/compras/listas/guardar',listReserve:'/compras/listas/reservar',listClose:'/compras/listas/cerrar',listGroup:'/compras/listas/agrupar',listUngroup:'/compras/listas/desagrupar',legacyImport:'/compras/legacy/importar',listPreparation:'/compras/listas/preparar',listRename:'/compras/listas/renombrar',listPreparationCancel:'/compras/listas/cancelar-preparacion'});
 function create(root){
  const installedUsers=new Set(),attempts=new Map(),originals=new Map();
  function capture(){
   const uid=root.currentUserUid,user=root.fbAuth?.currentUser,role=root.currentRole,revision=root.PERMISOS_ROLES?.[role]?.indiceRevision,epoch=root._svOperacionesSesionEpoch||0,valid=root.svCapturarContextoOperacion?.();
   function check(){if(!uid||user?.uid!==uid||root.currentUserUid!==uid||root.fbAuth?.currentUser!==user||root.currentRole!==role||root.PERMISOS_ROLES?.[role]?.indiceRevision!==revision||(root._svOperacionesSesionEpoch||0)!==epoch||root._impersonacionOriginal||valid&&!valid()||root.permisoModulo?.('ordenes')!==true)throw fail('SV_PURCHASE_SESSION','La sesión o los permisos cambiaron. Revisá Compras antes de guardar.');}
   check();return {uid,role,revision,epoch,check};
  }
  async function request(path,body,context,capability=false){
   let attempted=false,definitivelyNotAttempted=false;
   try{
    context.check();const base=String(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,'');
    if(!base||typeof root.SVServiceAuth?.headers!=='function'||typeof root.fetch!=='function'||root.navigator?.onLine===false)throw fail('SV_PURCHASE_UNAVAILABLE','No se pudo conectar con Compras. Conservá el formulario y volvé a consultar.');
    const serialized=JSON.stringify(body),limit=path==='/compras/listas/preparar'?3145728:path==='/compras/listas/guardar'?524288:['/compras/ordenes/crear','/compras/ordenes/inventario'].includes(path)?65536:16384;
    if(new TextEncoder().encode(serialized).byteLength>limit)throw fail('SV_PURCHASE_SIZE','El guardado supera el tamaño permitido. Conservá el formulario y revisá el comprobante.');
    const headers=await root.SVServiceAuth.headers({'Content-Type':'application/json'});context.check();
    await root.SVForegroundSession?.waitVisible?.();context.check();
    let release;try{
     release=root.SVForegroundSession?.holdDatabase?.();attempted=!capability;
     const response=await root.fetch(base+path,{method:'POST',headers,body:serialized,cache:'no-store',signal:AbortSignal.timeout(capability?20000:90000)});
     const data=await response.json().catch(()=>null);context.check();
     definitivelyNotAttempted=data?.svLaborAttempted===false && data.ok!==true && data.committed!==true;
     if(!response.ok||data?.ok!==true||!capability&&(data.committed!==true||data.operationId!==body.id))throw Object.assign(Error(data?.mensaje||data?.message||'No se pudo confirmar el guardado. Consultá la operación pendiente.'),{code:data?.code||'SV_LABOR_COMMIT_UNCONFIRMED',statusCode:response.status,httpStatus:response.status});
     return data;
    }finally{try{release?.();}catch(_){/* A UI release cannot change a confirmed commit. */}}
   }catch(error){error.svLaborAttempted=attempted&&!definitivelyNotAttempted;throw error;}
  }
  async function mode(command,context=capture()){
   const data=await request('/laboral/capacidades',{},context,true),cap=data.inventory;
   if(!cap||cap.version!==1||typeof cap.installed!=='boolean'||typeof cap.ready!=='boolean')throw fail('SV_PURCHASE_CAPABILITY','No se pudo comprobar el guardado de Compras. No se enviaron cambios.');
   if(cap.installed)installedUsers.add(context.uid);
   const signedGeneration=typeof cap.generation==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(cap.generation);
   if(typeof cap.generation!=='string'||(!cap.installed?cap.generation!=='':cap.ready?!signedGeneration:cap.generation!==''&&!signedGeneration))throw fail('SV_PURCHASE_CAPABILITY','No se pudo comprobar la generación de Compras. No se enviaron cambios.');
   if(!cap.installed){if(installedUsers.has(context.uid))throw fail('SV_PURCHASE_WRITER_CHANGED','La versión de Compras cambió. Actualizá la aplicación sin repetir el guardado.');return 'legacy';}
   if(!cap.ready||cap.commands?.[command]!==true)throw fail('SV_PURCHASE_NOT_READY','Esta operación de Compras todavía no está lista. Conservá tus datos y volvé a consultar.');
   return 'command';
  }
  function execute(command,payload,attemptKey){
   const signature=JSON.stringify({command,payload}),previous=attempts.get(attemptKey);
   if(previous)return previous.signature===signature?previous.promise:Promise.reject(fail('SV_PURCHASE_ATTEMPT_CHANGED','Hay un guardado pendiente. Confirmalo antes de cambiar sus datos.'));
   const context=capture(),body=clone(payload);
   const promise=Promise.resolve().then(async()=>{
    if(!Object.hasOwn(routes,command))throw fail('SV_PURCHASE_COMMAND','Esta operación de Compras requiere actualizar la aplicación.');
    if(await mode(command,context)!=='command')throw fail('SV_PURCHASE_NOT_INSTALLED','El guardado coordinado todavía no está instalado.');
    const recovery=root.SVLaborWriteRecovery;
    if(typeof recovery?.execute!=='function'||typeof recovery?.assertAvailable!=='function'||typeof root.SVLaborWrites?.hash!=='function'||typeof root.crypto?.randomUUID!=='function')throw fail('SV_PURCHASE_RECOVERY','Actualizá SisVentas para guardar con confirmación segura.');
    recovery.assertAvailable();context.check();body.id=root.crypto.randomUUID();
    const digest=await root.SVLaborWrites.hash(body);context.check();
    const result=await recovery.execute({uid:context.uid,id:body.id,digest},()=>request(routes[command],body,context),context.check);
    context.check();
    // A definitive recovered receipt confirms this attempt. Do not replay a POST
    // just to recover optional result keys; subscriptions/explicit reads refresh UI.
    if(result?.recovered===true)return {ok:true,committed:true,recovered:true,operationId:body.id};
    if(result?.ok!==true||result.committed!==true||result.operationId!==body.id)throw Object.assign(Error('Falta confirmar el resultado de Compras.'),{code:'SV_LABOR_COMMIT_UNCONFIRMED',svLaborAttempted:true});
    return result;
   }).finally(()=>{if(attempts.get(attemptKey)?.promise===promise)attempts.delete(attemptKey);});
   attempts.set(attemptKey,{promise,signature});return promise;
  }
  function remember(domain,key,value){originals.set(domain+'/'+key,{uid:root.currentUserUid,role:root.currentRole,revision:root.PERMISOS_ROLES?.[root.currentRole]?.indiceRevision,epoch:root._svOperacionesSesionEpoch||0,value:clone(value)});}
  async function original(domain,key){
   const context=capture(),saved=originals.get(domain+'/'+key),value=saved?.value;
   if(!value||['uid','role','revision','epoch'].some(key=>saved[key]!==context[key])||value._svSummary||value._svListSummary||value._svPagedSummary)throw fail('SV_PURCHASE_ORIGINAL','Reabrí el detalle para guardar contra el registro completo.');
   if(typeof root.SVLaborWrites?.hash!=='function')throw fail('SV_PURCHASE_RECOVERY','No está disponible la verificación del guardado.');
   const expectedHash=await root.SVLaborWrites.hash(value);context.check();return {value:clone(value),expectedHash};
  }
  return Object.freeze({mode,execute,remember,original,clearOriginals:()=>originals.clear(),installed:()=>installedUsers.has(root.currentUserUid)});
 }
 return Object.freeze({create,decisionNumber,exchangeRate,editExchangeRequired,inventoryRevision,editDestination,linkedEditRows});
});
