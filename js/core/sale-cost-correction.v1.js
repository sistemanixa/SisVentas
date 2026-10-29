(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVSaleCostCorrection=api;})(typeof window==='object'?window:null,function(){
 'use strict';const clone=x=>JSON.parse(JSON.stringify(x)),round=n=>Math.round((n+Number.EPSILON)*100)/100;
 const costFields=['costoUnitarioCompra','costoTotalCompra','costoUnitario','costoCompra','compra','precioCompra','precio_compra','costoTotal','costo','costoUnitarioPresupuestado','costoUnitarioAntesPreparacion'];
 function build(before,{index,cost,reason,uid,name,stamp}){
  if(!before||!before.items||!Object.hasOwn(before.items,index))throw Error('El ítem ya no está disponible.');
  if(typeof cost!=='number'||!Number.isFinite(cost)||cost<0||cost>1e12||Math.abs(cost*100-Math.round(cost*100))>.0001)throw Error('Indicá un costo válido, incluido cero, con hasta dos decimales.');
  if(typeof reason!=='string'||reason.trim().length<5||reason.trim().length>500)throw Error('Indicá el motivo de la corrección.');
  if(typeof uid!=='string'||!uid||!Number.isSafeInteger(stamp)||stamp<0)throw Error('Falta identificar la corrección.');
  const after=clone(before),item=after.items[index],qty=Number(item.qty??item.cantidad??1);if(!Number.isFinite(qty)||qty<=0)throw Error('Cantidad inválida.');
  const old=Object.fromEntries(costFields.filter(k=>Object.hasOwn(item,k)).map(k=>[k,item[k]]));
  for(const k of costFields)if(Object.hasOwn(item,k))item[k]=['costoTotalCompra','costoTotal','costo'].includes(k)?round(cost*qty):cost;
  Object.assign(item,{costoUnitarioCompra:cost,costoTotalCompra:round(cost*qty),costoVersion:1,costoOrigen:'correccion_manual_autorizada',costoCapturadoEn:stamp,comisionCostoHistoricoPendiente:false});
  const correction={index:String(index),cost,reason:reason.trim(),uid,name:String(name||uid).slice(0,150),stamp};
  item.costoCorregido={...correction,anterior:old};
  const audit={fecha:new Date(stamp).toISOString(),usuario:correction.name,tipo:'correccion_costo_compra',accion:'Costo de compra corregido: '+String(item.cod||item.codigo||item.desc||'Ítem')+' · '+qty+' × $'+cost+' · '+correction.reason,costoCorreccion:correction};
  if(Array.isArray(after.audit))after.audit.push(audit);else if(after.audit&&typeof after.audit==='object')after.audit['costo-'+stamp+'-'+index]=audit;else after.audit=[audit];return after;
 }
 return Object.freeze({build,costFields});
});
