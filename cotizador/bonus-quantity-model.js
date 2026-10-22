(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SVBonusQuantity=api;
})(typeof window==='object'?window:null,function(){
 'use strict';
 const MAX_EMPLOYEES=42,MAX_AMOUNT_CENTS=100000000000000n;
 const fail=message=>Object.assign(new Error(message),{code:'SV_BONUS_QUANTITY_INVALID'});
 function scaled(value,places,label,max){
  if(!['string','number'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))throw fail('Revisá '+label+'.');
  const text=String(value??'').trim().replace(',','.');
  if(text.length>24||!new RegExp('^\\d+(?:\\.\\d{1,'+places+'})?$').test(text))throw fail('Revisá '+label+'.');
  const [whole,fraction='']=text.split('.'),integer=BigInt(whole)*10n**BigInt(places)+BigInt(fraction.padEnd(places,'0'));
  if(integer<=0n||integer>max)throw fail('Revisá '+label+'.');return integer;
 }
 function employeeKey(value){
  if(typeof value!=='string'||!value||value.length>128||/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)||['__proto__','constructor','prototype','hasOwnProperty'].includes(value))throw fail('La referencia del empleado no es válida.');return value;
 }
 function operationKey(prefix,parts){return String(prefix)+'_'+parts.map(value=>String(value??'').replace(/[^A-Za-z0-9_-]/g,'_')).join('_');}
 function line(cantidad,valorUnitario){
  const units=scaled(cantidad,3,'la cantidad de unidades (hasta tres decimales)',1000000000n),price=scaled(valorUnitario,2,'el valor por unidad (hasta dos decimales)',MAX_AMOUNT_CENTS);
  const cents=(units*price+500n)/1000n;
  if(cents<=0n||cents>MAX_AMOUNT_CENTS)throw fail('El importe por empleado debe ser mayor que cero y no superar $1.000.000.000.000.');
  return {cantidad:Number(units)/1000,valorUnitario:Number(price)/100,monto:Number(cents)/100};
 }
 function plan({empleados,valorUnitario}={}){
  if(!Array.isArray(empleados)||!empleados.length)throw fail('Seleccioná al menos un empleado.');
  if(empleados.length>MAX_EMPLOYEES)throw fail('Podés registrar hasta '+MAX_EMPLOYEES+' empleados juntos.');
  const seen=new Set(),keys=new Set();
  const items=empleados.map(row=>{
   const empleadoId=employeeKey(row?.empleadoId);if(seen.has(empleadoId))throw fail('Hay un empleado repetido.');seen.add(empleadoId);
   const normalized=operationKey('bonificacion',[empleadoId,'grupo']);if(keys.has(normalized))throw fail('Dos empleados tienen referencias incompatibles. Revisá la selección.');keys.add(normalized);
   return {empleadoId,...line(row.cantidad,valorUnitario)};
  }).sort((a,b)=>a.empleadoId<b.empleadoId?-1:a.empleadoId>b.empleadoId?1:0);
  const total=items.reduce((sum,row)=>sum+scaled(row.monto,2,'el importe calculado',MAX_AMOUNT_CENTS),0n);
  if(total>MAX_AMOUNT_CENTS)throw fail('El total de la bonificación supera el importe permitido.');
  return {items,ids:items.map(row=>row.empleadoId),valorUnitario:items[0].valorUnitario,total:Number(total)/100,
   unidades:Number(items.reduce((sum,row)=>sum+scaled(row.cantidad,3,'la cantidad',1000000000n),0n))/1000};
 }
 function metadata(item,groupId,batch){
  if(typeof groupId!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(groupId))throw fail('No se pudo identificar el grupo de bonificaciones.');
  const value=line(item.cantidad,item.valorUnitario);if(value.monto!==item.monto)throw fail('El importe no coincide con las unidades.');
  const normalized=plan({empleados:batch?.items,valorUnitario:batch?.valorUnitario});
  if(JSON.stringify(batch.ids)!==JSON.stringify(normalized.ids)||batch.total!==normalized.total)throw fail('El detalle del grupo no coincide con el total.');
  const selected=normalized.items.find(row=>row.empleadoId===employeeKey(item.empleadoId));
  if(!selected||selected.cantidad!==value.cantidad||selected.valorUnitario!==value.valorUnitario||selected.monto!==value.monto)throw fail('El grupo no incluye el detalle del empleado.');
  return {bonificacionCantidad:value.cantidad,bonificacionValorUnitario:value.valorUnitario,bonificacionGrupoId:groupId,
   bonificacionDestinatarios:normalized.ids,bonificacionGrupoTotal:normalized.total,bonificacionGrupoPersonas:normalized.ids.length};
 }
 return Object.freeze({MAX_EMPLOYEES,employeeKey,operationKey,line,plan,metadata});
});
