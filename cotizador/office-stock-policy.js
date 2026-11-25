'use strict';
const {digest}=require('./labor-guard'),issued=new WeakMap();
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const fail=message=>Object.assign(Error(message),{statusCode:403,code:'SV_OFFICE_STOCK_CAPABILITY'});
const reservedClaims=()=>({svOfficeStockVersion:0,svOfficeStockInventoryKey:'',svOfficeStockRole:'',svOfficeStockPermissionRevision:null,svOfficeStockPreconditionVersion:0,svOfficeStockSourcePresent:null});
const stamp=(actor,lease)=>digest({uid:actor.uid,claims:actor.claims,role:actor.role,permissionRevision:actor.permissionRevision,permissionDigest:actor.permissionDigest,mode:actor.mode,operation:actor.operation,action:actor.financialAction,opId:actor.opId,input:actor.input,transportDigest:actor.transportDigest,lease:{actorUid:lease.actorUid,opId:lease.opId,fence:lease.fence,digest:lease.digest,mode:lease.mode,expiresAt:lease.expiresAt}});
function issue(actor,lease,inventoryKey,inventory,original){
 if(!actor||!lease||actor.mode!=='user'||actor.operation!=='office-stock-adjustment'||actor.financialAction!=='stock.ajustar'||actor.uid!==actor.claims?.uid||actor.uid!==lease.actorUid||actor.opId!==lease.opId||actor.input?.id!==actor.opId||actor.transportDigest!==lease.digest||digest(actor.input)!==lease.digest||typeof lease.fence!=='string'||!lease.fence||!Number.isSafeInteger(lease.expiresAt)||lease.expiresAt<=0||lease.mode!=='user'||!['admin','administrativo'].includes(actor.role)||!/^[a-f0-9]{64}$/.test(actor.permissionDigest||'')||typeof inventoryKey!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(inventoryKey)||['constructor','prototype','__proto__'].includes(inventoryKey)||!object(inventory))throw fail('Falta una operación propia de ajuste de Stock.');
 if(actor.officeStock||actor.officeStockLink||actor.otLifecycle||actor.otDeleteOperationalProof||actor.purchaseInventory)throw fail('El ajuste no admite capacidades mezcladas.');
 if(original!==undefined&&original!==null&&!object(original))throw fail('La precondición requiere el inventario original leído por servidor.');
 const known=arguments.length>=5&&original!==undefined,cap=Object.freeze({uid:actor.uid,opId:actor.opId,fence:lease.fence,inventoryKey,role:actor.role,permissionRevision:actor.permissionRevision});
 issued.set(cap,{inventory:structuredClone(inventory),stamp:stamp(actor,lease),preconditionVersion:known?1:0,sourcePresent:known?original!==null:null});actor.officeStock=cap;
}
function token(actor,lease){
 const cap=actor?.officeStock,proof=issued.get(cap);
 if(!proof||!lease||actor.mode!=='user'||actor.operation!=='office-stock-adjustment'||actor.financialAction!=='stock.ajustar'||cap.uid!==actor.uid||cap.uid!==lease.actorUid||cap.opId!==actor.opId||cap.opId!==lease.opId||cap.fence!==lease.fence||stamp(actor,lease)!==proof.stamp)return reservedClaims();
 return{svOfficeStockVersion:1,svOfficeStockInventoryKey:cap.inventoryKey,svOfficeStockRole:cap.role,svOfficeStockPermissionRevision:cap.permissionRevision,svOfficeStockPreconditionVersion:proof.preconditionVersion,svOfficeStockSourcePresent:proof.sourcePresent};
}
function validate(actor,lease,patch){
 if(!actor?.officeStock&&actor.operation!=='office-stock-adjustment')return;
 const t=token(actor,lease);if(t.svOfficeStockVersion!==1)throw fail('Falta la capacidad interna de ajuste.');
 const stock='sisventas/inventario_operativo/'+t.svOfficeStockInventoryKey,allowed=new Set([stock,'sisventas/compras_resumen/inventario_operativo/'+t.svOfficeStockInventoryKey,'sv_labor_receipts/'+actor.opId,'sv_labor_guard']);
 if(Object.keys(patch).some(path=>!allowed.has(path))||!Object.hasOwn(patch,stock))throw fail('El ajuste intentó guardar fuera del producto.');
 const clean=value=>{const out=structuredClone(value);delete out._svReadRevision;delete out._svReadOperation;return out;};
 if(digest(clean(patch[stock]))!==digest(clean(issued.get(actor.officeStock).inventory)))throw fail('El ajuste no coincide con el plan autorizado.');
}
module.exports={issue,token,validate,reservedClaims};
