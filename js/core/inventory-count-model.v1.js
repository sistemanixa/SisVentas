(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SVInventoryCountModel=api;})(typeof window==='object'?window:null,function(){
'use strict';
function quantity(value){if(value==null||String(value).trim()==='')throw Error('Ingresá la cantidad contada.');const n=Number(value);if(!Number.isFinite(n)||n<0||n>1e9||Math.abs(n*1e6-Math.round(n*1e6))>0.000001)throw Error('Cantidad inválida: usá hasta seis decimales, sin valores negativos.');return Math.round(n*1e6)/1e6;}
function plan(current,command){
 if(!command||!/^[-a-zA-Z0-9_]{1,100}$/.test(command.id||'')||!String(command.uid||'').trim())throw Error('No se identificó el ajuste.');
 const target=quantity(command.count),reason=String(command.reason||'').trim();if(reason.length<5||reason.length>500)throw Error('Indicá un motivo de entre 5 y 500 caracteres.');
 if(command.unitCount&& !Number.isInteger(target))throw Error('Este producto se cuenta en unidades enteras.');
 const original=current||{},ledger=original.ajustesConteo||{},found=ledger[command.id];
 if(found){if(found.usuarioUid!==command.uid||found.cantidadContada!==target||found.motivo!==reason)throw Error('La referencia del ajuste ya tiene otros datos.');return JSON.parse(JSON.stringify(original));}
 const before=quantity(original.general??0),reserved=quantity(original.reservado??0);
 if(before!==quantity(command.expectedGeneral)||reserved!==quantity(command.expectedReserved))throw Error('El stock cambió durante el conteo. Actualizá y revisá la cantidad antes de guardar.');
 if(before===target)throw Error('No hay diferencia para ajustar.');
 const next=JSON.parse(JSON.stringify(original));next.general=target;next.codigo=String(command.code||'');next.descripcion=String(command.description||'');next.actualizadoEn=command.ts;
 next.ajustesConteo=next.ajustesConteo||{};next.ajustesConteo[command.id]={tipo:'conteo_oficina',cantidadAnterior:before,cantidadContada:target,diferencia:Math.round((target-before)*1e6)/1e6,reservadoAlContar:reserved,motivo:reason,usuarioUid:command.uid,usuario:String(command.user||''),fecha:command.ts};
 return next;
}
return Object.freeze({quantity,plan});
});
