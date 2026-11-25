'use strict';
const Reference=require('./office-stock-reference'),Plan=require('./office-stock-link-plan'),Stock=require('./office-stock');
const issued=new WeakMap(),prefix='sisventas/stock_vinculos';
const fail=message=>Object.assign(Error(message),{statusCode:403,code:'SV_STOCK_LINK_CAPABILITY'});
function reservedClaims(){return{svStockLinkVersion:0,svStockLinkProductKey:'',svStockLinkInventoryKey:'',svStockLinkReceiptIdentityKey:'',svStockLinkRole:'',svStockLinkPermissionRevision:null};}
function sanitizeClaims(claims){return Object.fromEntries(Object.entries(claims||{}).filter(([name])=>!name.startsWith('svStockLink')));}
function bound(actor,lease,proof){return proof&&actor.mode==='user'&&actor.operation==='office-stock-link'&&actor.financialAction==='stock.ajustar'&&actor.uid===proof.uid&&actor.claims?.uid===proof.uid&&Reference.digest(actor.claims)===proof.claimsDigest&&Reference.digest(actor.input)===proof.inputDigest&&actor.uid===lease.actorUid&&actor.opId===proof.opId&&lease.opId===proof.opId&&lease.fence===proof.fence&&lease.digest===proof.digest&&lease.expiresAt===proof.expiresAt&&lease.mode===proof.leaseMode&&actor.transportDigest===proof.digest&&actor.role===proof.role&&actor.permissionRevision===proof.permissionRevision&&actor.permissionDigest===proof.permissionDigest&&!actor.viewAs;}
function issue(actor,lease,{snapshot,command,now}){
 if(actor?.officeStockLink||actor?.officeStock||actor?.otLifecycle||actor?.otDeleteOperationalProof)throw fail('La corrección no admite otra capacidad de escritura.');
 const proof={uid:actor?.uid,opId:command?.id,fence:lease?.fence,digest:lease?.digest,expiresAt:lease?.expiresAt,leaseMode:lease?.mode,claimsDigest:Reference.digest(actor?.claims),inputDigest:Reference.digest(actor?.input),role:actor?.role,permissionRevision:actor?.permissionRevision,permissionDigest:actor?.permissionDigest};
 if(!lease||typeof lease.fence!=='string'||!lease.fence||!/^[a-f0-9]{64}$/.test(lease.digest||'')||!Number.isFinite(lease.expiresAt)||lease.expiresAt<=now||!bound(actor,lease,proof)||Reference.digest(command)!==proof.digest||Reference.digest(actor.input)!==proof.digest)throw fail('La corrección no coincide con la operación coordinada.');
 const plan=Plan.plan(snapshot,command,actor,now),capability=Object.freeze({version:1});
 issued.set(capability,{...proof,patch:structuredClone(plan.patch),result:structuredClone(plan.result),productKey:command.productKey,inventoryKey:command.inventoryKey,receiptIdentityKey:plan.result.receiptIdentityKey});
 actor.officeStockLink=capability;return plan;
}
function token(actor,lease){const proof=issued.get(actor?.officeStockLink);if(!bound(actor,lease,proof))return reservedClaims();return{svStockLinkVersion:1,svStockLinkProductKey:proof.productKey,svStockLinkInventoryKey:proof.inventoryKey,svStockLinkReceiptIdentityKey:proof.receiptIdentityKey,svStockLinkRole:proof.role,svStockLinkPermissionRevision:proof.permissionRevision};}
async function validate(actor,lease,patch,read,now=Date.now()){
 const touches=Object.keys(patch||{}).some(path=>path==='sisventas'||path===prefix||path.startsWith(prefix+'/'));
 if(!touches&&!actor?.officeStockLink&&actor?.operation!=='office-stock-link')return;
 const proof=issued.get(actor?.officeStockLink);if(!bound(actor,lease,proof)||!Number.isFinite(lease.expiresAt)||lease.expiresAt<=now)throw fail('Falta una capacidad vigente de corrección de vínculo.');
 if(actor.officeStock||actor.otLifecycle||actor.otDeleteOperationalProof)throw fail('La corrección no admite capacidades mezcladas.');
 const receiptPath='sv_labor_receipts/'+proof.opId,expected=[...Object.keys(proof.patch),receiptPath,'sv_labor_guard'].sort();
 if(Reference.digest(Object.keys(patch).sort())!==Reference.digest(expected)||patch.sv_labor_guard!==null)throw fail('La corrección intentó escribir fuera del plan.');
 for(const path of Object.keys(proof.patch))if(Reference.digest(patch[path])!==Reference.digest(proof.patch[path]))throw fail('La asociación no coincide con el plan autorizado.');
 const receipt=patch[receiptPath];if(!receipt||receipt.actorUid!==proof.uid||receipt.fence!==proof.fence||receipt.digest!==proof.digest||Reference.digest(receipt.result)!==Reference.digest(proof.result)||!Number.isSafeInteger(receipt.confirmedAt)||receipt.confirmedAt<=0)throw fail('El recibo coordinado no coincide con la corrección.');
 if(typeof read!=='function')throw fail('Falta revalidar los permisos actuales.');
 const profile=await read('sv_chat_roles/'+proof.uid),permissions=await read('sv_permisos/'+proof.role),context=Stock.context(profile,permissions);
 if(context.role!==proof.role||context.permissionRevision!==proof.permissionRevision||context.permissionDigest!==proof.permissionDigest||actor.claims?.svPasswordChangeRequired===true)throw fail('La sesión o los permisos cambiaron.');
}
module.exports={issue,token,validate,reservedClaims,sanitizeClaims};
