(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVOTRelatedAdapters=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 // Pure plans only. The host writer must still authorize, bind originals/CAS and
 // validate its complete financial/support command on the server.
 const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!['constructor','prototype','__proto__'].includes(value);
 const fail=message=>Object.assign(Error(message),{code:'SV_OT_RELATED_INVALID',statusCode:409});
 const copy=value=>structuredClone(value);
 function fields(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(name=>!allowed.includes(name)))throw fail('El comando relacionado contiene campos no autorizados.');}
 function actorTime(actor,at){if(!actor||!key(actor.uid)||typeof actor.name!=='string'||!Number.isSafeInteger(at)||at<0)throw fail('Falta el actor y la fecha del comando.');}
 function identity(record,id){if(!record||!key(id)||record.fbKey&&record.fbKey!==id)throw fail('El registro no tiene identidad canónica.');}
 function finite(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0;}
 function absent(value){return value===undefined||value===null||value==='';}
 function references(record,names,expected){for(const name of names)if(!absent(record[name])&&record[name]!==expected)throw fail('El vínculo contradice el original.');}
 function additionalSale({ot,otKey,sale,saleKey,actor,at}){
  identity(ot,otKey);identity(sale,saleKey);actorTime(actor,at);
  if(['cerrada','cerrado','completada','completado','finalizada','finalizado'].includes(String(ot.estado||'').toLowerCase())||ot.cerrada===true||ot.finalizada===true)throw fail('La OT está cerrada.');
  if(!key(ot.clienteFbKey)||sale.clienteFbKey!==ot.clienteFbKey||sale.tipoVenta!=='adicional_ot'||sale.otId!==otKey||sale.otNumero!==ot.id||typeof sale.id!=='string'||!sale.id||!finite(sale.total)||!Number.isSafeInteger(sale.ts)||!Array.isArray(sale.items)||!sale.items.length||sale.items.length>500)throw fail('La venta adicional no corresponde a esta OT.');
  if(!Array.isArray(ot.materiales)||ot.audit!=null&&!Array.isArray(ot.audit)||ot.ventasAdicionales!=null&&(typeof ot.ventasAdicionales!=='object'||Array.isArray(ot.ventasAdicionales))||Object.hasOwn(ot.ventasAdicionales||{},saleKey))throw fail('El historial de la OT requiere revisión.');
  const rows=sale.items.map(item=>{
   if(!item||typeof item.cod!=='string'||!item.cod.trim()||typeof item.desc!=='string'||!finite(item.qty)||item.qty===0||!finite(item.punit)||!finite(item.sub)||item.adicionalOT!==true||item.origenOTKey!==otKey)throw fail('El ítem adicional requiere una venta validada.');
   // Preserve the sale's agreed snapshots. A commercial addition is neither a
   // technical delivery nor an installation; never merge into historical rows.
   return {cod:item.cod,desc:item.desc,vendida:item.qty,qty:item.qty,cantidad:item.qty,punit:item.punit,sub:item.sub,instalada:0,entregada:0,custodiaActiva:false,custodiaClasificada:false,adicionalOT:true,origen:'adicional_ot',destinoVenta:'nueva',ventaDestinoFbKey:saleKey,ventaDestinoId:sale.id,agregadoEn:new Date(at).toISOString(),agregadoPor:actor.name};
  });
  const materiales=[...copy(ot.materiales),...rows],audit=[...copy(ot.audit||[]),{fecha:new Date(at).toISOString(),usuario:actor.name,actorUid:actor.uid,accion:'Venta adicional vinculada: '+sale.id,tipo:'ot_related',kind:'additionalSale'}];
  const entry={ventaFbKey:saleKey,ventaId:sale.id,total:sale.total,ts:sale.ts},base='sisventas/ordenes_trabajo/'+otKey;
  return {related:{[base+'/materiales']:materiales,[base+'/audit']:audit,[base+'/ventasAdicionales/'+saleKey]:entry},materiales,audit,entry,requires:{ot:'corregirMateriales',sale:'existingFinancialWriter'},physicalDelivery:false};
 }
 const claimFields=['estado','historial','resolucion','resuelto','cerradoEn','manoObra','ventaComercialRespetada','otKey','otId','otNumero','ventaKey','ventaFbKey','ventaId','tecnico','reclamoKey','reclamoId','generacionOTPendiente','generacionOTError','visitaSolicitadaEn','vinculoRecuperadoEn','generacionOTCompletadaEn'];
 function supportChanges({claim,claimKey,ot,otKey,sale,saleKey,reclamoCambios,actor,at}){
  identity(claim,claimKey);actorTime(actor,at);fields(reclamoCambios,claimFields);
  const input=copy(reclamoCambios),result={};
  if(!['nuevo','diagnostico','visita','ot_activa','cerrado'].includes(input.estado))throw fail('Estado de reclamo inválido.');
  if(claim.historial!=null&&!Array.isArray(claim.historial))throw fail('El historial original requiere revisión.');
  // Legacy callers send their whole history. It is never accepted as authority;
  // the server rebuilds the event from its original record and actor.
  result.estado=input.estado;
  if(input.estado==='cerrado'){
   if(!['remota','visita_tecnica','sin_resolver'].includes(input.resolucion)||input.resuelto!==(input.resolucion!=='sin_resolver'))throw fail('La resolución no coincide con el cierre.');
   result.resolucion=input.resolucion;result.resuelto=input.resuelto;result.cerradoEn=at;
  }else if(['resolucion','resuelto','cerradoEn','manoObra','ventaComercialRespetada'].some(name=>Object.hasOwn(input,name)))throw fail('La resolución requiere cerrar el reclamo.');
  if(Object.hasOwn(input,'manoObra')){if(input.resolucion!=='visita_tecnica'||!['bonificada_100','con_cargo'].includes(input.manoObra))throw fail('La mano de obra requiere revisión.');result.manoObra=input.manoObra;}
  if(Object.hasOwn(input,'ventaComercialRespetada')){if(input.resolucion!=='visita_tecnica'||input.ventaComercialRespetada!==true)throw fail('La resolución comercial requiere revisión.');result.ventaComercialRespetada=true;}
  const relationFields=['otKey','otId','otNumero','ventaKey','ventaFbKey','ventaId','tecnico','reclamoKey','reclamoId'];
  if(ot){identity(ot,otKey);references(claim,['otKey','otFbKey'],otKey);references(ot,['reclamoKey','reclamoFbKey'],claimKey);}
  if(sale){identity(sale,saleKey);references(claim,['ventaKey','ventaFbKey'],saleKey);references(sale,['reclamoKey','reclamoFbKey'],claimKey);}
  if(ot&&sale){references(ot,['ventaFbKey','ventaKey'],saleKey);references(sale,['otId'],otKey);references(ot,['ventaId','venta'],sale.id||sale.numero||'');}
  for(const record of [ot,sale].filter(Boolean))if(claim.clienteFbKey&&record.clienteFbKey!==claim.clienteFbKey)throw fail('El vínculo pertenece a otro cliente.');
  const canonical={otKey:otKey||'',otId:ot?.id||ot?.numero||'',otNumero:ot?.id||ot?.numero||'',ventaKey:saleKey||'',ventaFbKey:saleKey||'',ventaId:sale?.id||sale?.numero||'',tecnico:ot?.tecnico||'',reclamoKey:claimKey,reclamoId:claim.id||claim.numero||claimKey};
  for(const name of relationFields)if(Object.hasOwn(input,name)){if(input[name]!==canonical[name]||name.startsWith('ot')&&!ot||['ventaKey','ventaFbKey','ventaId'].includes(name)&&!sale||name==='tecnico'&&!ot)throw fail('El reclamo contiene un vínculo no acreditado.');result[name]=canonical[name];}
  if(input.estado==='ot_activa'&&!ot)throw fail('La OT activa requiere su original.');
  if(Object.hasOwn(input,'generacionOTPendiente')){if(typeof input.generacionOTPendiente!=='boolean'||input.generacionOTPendiente&&input.estado!=='visita'||!input.generacionOTPendiente&&!ot)throw fail('La generación de OT requiere revisión.');result.generacionOTPendiente=input.generacionOTPendiente;}
  if(Object.hasOwn(input,'generacionOTError')){if(input.generacionOTError!==null)throw fail('El error debe registrarse mediante el comando de fallo.');result.generacionOTError=null;}
  for(const name of ['visitaSolicitadaEn','vinculoRecuperadoEn','generacionOTCompletadaEn'])if(Object.hasOwn(input,name)){if(name==='visitaSolicitadaEn'?input.estado!=='visita':!ot||input.estado!=='ot_activa')throw fail('La marca temporal no corresponde al estado.');result[name]=at;}
  const labels={nuevo:'Nuevo',diagnostico:'En diagnóstico',visita:'Visita requerida',ot_activa:'OT activa',cerrado:'Cerrado'};
  const text=input.resolucion==='remota'?'Reclamo resuelto de forma remota':input.resolucion==='visita_tecnica'?'Reclamo resuelto mediante visita técnica':input.resolucion==='sin_resolver'?'Reclamo cerrado sin resolver':input.estado==='visita'?'Derivado a visita técnica; iniciando generación de OT':'Estado cambiado a: '+labels[input.estado];
  result.historial=[...copy(claim.historial||[]),{texto:text,autor:actor.name,actorUid:actor.uid,ts:at}];
  return {changes:result,requires:{support:'resolver',otRelation:!!ot},structure:ot?{otKey,kind:'claim',changes:{reclamoFbKey:claimKey,...(sale?{ventaFbKey:saleKey}:{})}}:null};
 }
 return Object.freeze({additionalSale,supportChanges});
});
