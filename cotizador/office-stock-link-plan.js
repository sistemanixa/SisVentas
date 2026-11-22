'use strict';
const Reference=require('./office-stock-reference');
const clone=value=>structuredClone(value),fail=(code,message)=>Object.assign(Error(message),{code,statusCode:409});
function authorize(actor){if(typeof actor?.uid!=='string'||!actor.uid||actor.active!==true||actor.allowed!==true||actor.viewAs||!['admin','administrativo'].includes(actor.role)||actor.productAccess!==true||actor.stockAdjust!==true||!/^[a-f0-9]{64}$/.test(actor.permissionDigest||'')||actor.permissionRevision!==null&&(!Number.isSafeInteger(actor.permissionRevision)||actor.permissionRevision<0))throw Object.assign(Error('No tenés permiso para corregir vínculos.'),{statusCode:403});}
function plan(snapshot,command,actor,now,receipt=null){
 authorize(actor);if(!command||Object.keys(command).some(name=>!['id','productKey','inventoryKey','reason','expectedHash'].includes(name))||!Reference.key(command.id)||command.id.length<8||!Reference.key(command.productKey)||!Reference.key(command.inventoryKey)||!/^[a-f0-9]{64}$/.test(command.expectedHash||''))throw fail('SV_STOCK_LINK_INPUT','No se identificó la corrección.');
 const reason=typeof command.reason==='string'?command.reason.trim():'';if(!reason||reason.length>240||!Number.isSafeInteger(now)||now<=0)throw fail('SV_STOCK_LINK_INPUT','Ingresá una observación válida.');
 const commandDigest=Reference.digest({uid:actor.uid,command:{...command,reason}});
 if(receipt!==null){if(receipt.uid!==actor.uid||receipt.commandDigest!==commandDigest||receipt.operationId!==command.id)throw fail('SV_STOCK_LINK_REPLAY','La operación ya tiene otros datos.');return{patch:{},result:clone(receipt.result),replayed:true};}
 const access={uid:actor.uid,role:actor.role,permissionRevision:actor.permissionRevision,permissionDigest:actor.permissionDigest};
 if(snapshot.productKey!==command.productKey||Reference.digest(snapshot.access)!==Reference.digest(access)||Reference.digest(snapshot)!==command.expectedHash)throw fail('SV_STOCK_LINK_CONFLICT','Los registros o los permisos cambiaron. Volvé a revisar el vínculo.');
 const reference=Reference.resolve(snapshot,command.inventoryKey);if(reference.status!=='active')throw fail('SV_STOCK_LINK_INACTIVE','El vínculo inactivo existente se conserva sin corregir ni reactivar.');
 const revision=reference.mappingRevision+1;if(!Number.isSafeInteger(revision))throw fail('SV_STOCK_LINK_CONFLICT','La revisión de la asociación requiere revisión.');
 const record={productKey:reference.productKey,inventoryKey:reference.inventoryKey,receiptIdentityKey:reference.receiptIdentityKey,revision,operationId:command.id,uid:actor.uid,reason,ts:now},result={ok:true,committed:true,operationId:command.id,productKey:reference.productKey,inventoryKey:reference.inventoryKey,receiptIdentityKey:reference.receiptIdentityKey,revision};
 const ownReceipt={uid:actor.uid,operationId:command.id,commandDigest,result:clone(result)};
 return{patch:{['sisventas/stock_vinculos/porProducto/'+reference.productKey]:clone(record),['sisventas/stock_vinculos/porInventario/'+reference.inventoryKey]:clone(record),['sisventas/stock_vinculos/operaciones/'+command.id]:ownReceipt},result,replayed:false};
}
module.exports={plan};
