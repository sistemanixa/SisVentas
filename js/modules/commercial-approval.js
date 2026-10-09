(function(root){
  'use strict';
  const number=value=>{if(typeof value==='number')return value;const text=String(value??'').trim();return Number(text.includes(',')?text.replace(/\./g,'').replace(',','.'):text)||0;};
  const round=value=>Math.round((value+Number.EPSILON)*100)/100;
  const lines=record=>Array.isArray(record.items)?record.items:Object.values(record.items||{});
  const general=(record,type)=>number(record.descuentoGeneral??record.descuentoPct??record.porcentajeDescuento??(type==='presupuesto'?record.descuento:0));
  const itemDiscount=item=>number(item.disc??item.descuentoPct??item.descuento??0);
  function discount(record,type){
    const g=general(record,type),items=lines(record),invalid=!Number.isFinite(g)||g<0||g>100||items.some(i=>{const d=itemDiscount(i);return !Number.isFinite(d)||d<0||d>100;});
    return {general:g,invalid,maximum:items.reduce((max,i)=>Math.max(max,100*(1-(1-g/100)*(1-itemDiscount(i)/100))),g)};
  }
  // The approval belongs to these economic values, not to a screen or a session flag.
  function signature(record,type){return JSON.stringify({general:general(record,type),items:lines(record).map(i=>[String(i.cod??i.codigo??i.pid??''),number(i.qty??i.cantidad??1),number(i.punit??i.precioUnitario??i.precio??0),itemDiscount(i)]),total:round(number(record.total)),iva:round(number(record.iva)),conIva:record.conIva!==false});}
  function stamp(record,type,identity,config){return {version:1,firma:signature(record,type),usuario:identity.usuario||'',uid:identity.uid||'',fecha:new Date().toISOString(),limite:number(config.descuentoLimite)};}
  function recalculateSale(record,items){
    let gross=0,net=0;const normalized=(items||lines(record)).map(item=>{const copy=Object.assign({},item),amount=number(item.qty??item.cantidad??1)*number(item.punit??item.precioUnitario??0);gross+=amount;copy.sub=round(amount*(1-itemDiscount(item)/100));net+=copy.sub;return copy;});
    const subtotal=round(Math.max(0,net-round(net*general(record,'venta')/100)));
    const rate=number(record.subtotal)>0?number(record.iva)/number(record.subtotal):(record.conIva===true?0.21:0);
    const iva=round(subtotal*Math.max(0,rate)),total=round(subtotal+iva),descuento=round(gross-subtotal);
    return {items:normalized,subtotal,iva,total,descuento,descuentoPctEfectivo:gross>0?round(descuento/gross*100):0};
  }
  function bonificarVisitaReclamo(record,context){
    context=context||{};
    const discounted=lines(record).filter(i=>itemDiscount(i)>0);
    if(!context.reclamoKey||!context.otKey||!context.usuario||general(record,'venta')!==0||discount(record,'venta').invalid||discounted.length!==1||itemDiscount(discounted[0])!==100||discounted[0].bonificadoPostVenta!==true)return null;
    return {version:1,reclamoKey:context.reclamoKey,otKey:context.otKey,usuario:context.usuario,fecha:new Date().toISOString(),firma:signature(record,'venta')};
  }
  function status(record,type,config){
    record=record||{};config=config||{};const d=discount(record,type),limit=number(config.descuentoLimite??10),proof=record.autorizacionDescuento;
    if(d.invalid)return {blocked:true,reason:'El descuento debe estar entre 0% y 100%.'};
    if(record.requiereAprobacion===true||['revision','pendiente_aprobacion','rechazado','anulado'].includes(record.estado))return {blocked:true,reason:'El documento está pendiente de aprobación, rechazado o anulado. No se puede emitir ni compartir.'};
    if(type==='venta'&&d.general>0&&lines(record).length){const totals=recalculateSale(record);if(Math.abs(totals.total-number(record.total))>0.02)return {blocked:true,reason:'El descuento general guardado ('+d.general+'%) no coincide con el total. Revisá y guardá la venta antes de emitirla.'};}
    const exceeds=d.maximum>limit+0.000001||(type==='presupuesto'&&number(record.total)>number(config.montoLimite??200000));
    const legacyApproved=type==='presupuesto'&&!proof&&!record.vistaPreviaSinGuardar&&!!record.aprobadoPor&&!!record.aprobadoEn&&['aprobado_int','enviado','visto','aceptado','convertido'].includes(record.estado);
    const claim=record.bonificacionReclamo;
    const claimValid=type==='venta'&&claim&&claim.version===1&&!!claim.fecha&&claim.firma===signature(record,type)&&!!bonificarVisitaReclamo(record,claim);
    const valid=claimValid||legacyApproved||proof&&proof.version===1&&proof.firma===signature(record,type)&&!!proof.usuario&&!!proof.fecha;
    if(exceeds&&!valid)return {blocked:true,needsApproval:true,reason:'Descuento o importe fuera del límite: falta una autorización registrada para estos valores. Guardá y solicitá la aprobación antes de imprimir, generar PDF o compartir.'};
    return {blocked:false,maximum:d.maximum,approved:!!valid};
  }
  const api={discount,signature,stamp,status,recalculateSale,bonificarVisitaReclamo};
  if(typeof module!=='undefined')module.exports=api;
  if(!root.document)return;
  root.SVCommercialApproval=api;
  // Older conversions may have omitted the approval stamp. Reuse only a uniquely
  // linked, explicitly approved budget with exactly the same commercial values.
  function documentStatus(record,type){
    const result=status(record,type,root.APROBACION_CONFIG);
    if(type!=='venta'||!result.needsApproval||record.autorizacionDescuento)return result;
    if(typeof root._presupuestosOrigenDeVenta!=='function'||typeof root.pptoDatosParaVenta!=='function')return result;
    const sources=root._presupuestosOrigenDeVenta(record);
    if(sources.length!==1)return result;
    const budget=sources[0],approved=status(budget,'presupuesto',root.APROBACION_CONFIG);
    if(approved.blocked||!approved.approved)return result;
    const data=root.pptoDatosParaVenta(budget);
    if(data.v3Ready===false)return result;
    const expected={items:data.items,descuentoGeneral:data.descuentoPct,total:data.total,iva:data.iva,conIva:data.conIva};
    if(signature(record,'venta')!==signature(expected,'venta'))return result;
    return {blocked:false,approved:true,maximum:result.maximum};
  }
  root.svValidarSalidaComercial=function(record,type){
    // Official documents already issued keep their original fiscal values.
    if(type==='venta'&&record&&record.factura&&(record.factura.cae||record.factura.fuente==='externa'||record.factura.manual))return true;
    const result=documentStatus(record,type);if(result.blocked){root.notify(result.reason);return false;}return true;
  };
  root.svAutorizarDescuentoVenta=async function(record,previous){
    const config=root.APROBACION_CONFIG||{},d=discount(record,'venta');
    if(d.invalid){root.notify('El descuento debe estar entre 0% y 100%.');return false;}
    if(d.maximum<=number(config.descuentoLimite??10)+0.000001){record.autorizacionDescuento=null;record.requiereAprobacion=false;return true;}
    if(previous&&previous.autorizacionDescuento){record.autorizacionDescuento=previous.autorizacionDescuento;if(!status(record,'venta',config).blocked)return true;}
    record.autorizacionDescuento=null;
    if(!root.tienePermiso('ventas.autorizarDescuento')){root.notify('El descuento supera el límite. Un usuario con permiso para autorizar descuentos debe revisar y guardar esta venta.');return false;}
    if(!await root.svConfirm('El descuento alcanza '+round(d.maximum)+'% (límite '+number(config.descuentoLimite)+'%). ¿Autorizar estos importes y guardar la venta?'))return false;
    record.requiereAprobacion=false;record.autorizacionDescuento=stamp(record,'venta',{usuario:root.currentUser||root.currentUserEmail||'Admin',uid:root.currentUserUid||''},config);
    record.audit=record.audit||[];record.audit.push({fecha:record.autorizacionDescuento.fecha,usuario:record.autorizacionDescuento.usuario,accion:'Descuento autorizado: hasta '+round(d.maximum)+'% para los importes guardados',descuentoGeneral:d.general});return true;
  };
  root.svAvisoAprobacionVenta=function(record){const result=documentStatus(record,'venta');return result.blocked?'<div role="alert" style="padding:12px;margin:12px 0;border:1px solid var(--amber);border-radius:9px;color:var(--amber)">'+root.escapeHTML(result.reason)+'</div>':'';};
})(typeof window!=='undefined'?window:globalThis);
