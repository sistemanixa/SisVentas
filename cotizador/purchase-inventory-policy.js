'use strict';
// Internal capability proposal; no claims, store hook, route or UI activation.
const {digest}=require('./labor-guard'),Operational=require('./operational-read-model');
const issued=new WeakMap(),kinds=Object.freeze(['register','edit','cancel','receive']);
const fail=message=>Object.assign(Error(message),{code:'SV_PURCHASE_INVENTORY_CAPABILITY',statusCode:403});
function typed(actor){return actor?.mode==='user'&&actor.financialAction==='ordenes.editar'&&kinds.includes(actor.input?.kind)&&actor.operation==='purchase-inventory-'+actor.input.kind;}
function binding(actor,lease){return {uid:actor.uid,claimsUid:actor.claims?.uid,claimsDigest:digest(actor.claims),opId:actor.opId,digest:actor.transportDigest,operation:actor.operation,kind:actor.input?.kind,role:actor.role,permissionRevision:actor.permissionRevision,permissionDigest:actor.permissionDigest,fence:lease.fence,actorUid:lease.actorUid,leaseOpId:lease.opId,leaseDigest:lease.digest,inputDigest:digest(actor.input)};}
function bound(actor,lease,proof){return proof&&typed(actor)&&digest(binding(actor,lease))===digest(proof.binding)&&actor.uid===actor.claims?.uid&&actor.uid===lease.actorUid&&actor.opId===lease.opId&&actor.transportDigest===lease.digest&&digest(actor.input)===lease.digest;}
function issue(actor,lease,{sourceOrder,patch,preconditions},now=Date.now()){
 if(!typed(actor)||!sourceOrder||!Array.isArray(sourceOrder.items)||sourceOrder._svSummary||sourceOrder._svListSummary||sourceOrder._svPagedSummary||typeof actor.input.orderKey!=='string'||!actor.input.orderKey||/[.#$\[\]/\x00-\x1f\x7f]/.test(actor.input.orderKey)||['__proto__','constructor','prototype'].includes(actor.input.orderKey)||digest(sourceOrder)!==actor.input.expectedHash||!Number.isSafeInteger(now)||lease.expiresAt<=now)throw fail('Falta la compra original y su operación tipada.');
 const orderPath='sisventas/ordenes/'+actor.input.orderKey;
 if(!patch||!Object.hasOwn(patch,orderPath)||patch[orderPath]===null||digest(preconditions?.[orderPath])!==digest(sourceOrder))throw fail('La operación debe guardar orden e inventario conjuntamente.');
 if(digest(Object.keys(patch).sort())!==digest(Object.keys(preconditions||{}).sort()))throw fail('Los originales deben corresponder exactamente al plan.');
 for(const path of Object.keys(patch))if(path!==orderPath&&!/^sisventas\/inventario_operativo\/[^/.#$\[\]\x00-\x1f\x7f]+$/.test(path)||!Object.hasOwn(preconditions||{},path))throw fail('El plan excede sus originales de Compras.');
 // Preparation is derived from the server source, never an input boolean.
 const requiresBalance=actor.input.kind==='register'&&!!sourceOrder.listaMaterialesId;
 const proof={binding:binding(actor,lease),patch:structuredClone(patch),preconditions:structuredClone(preconditions),requiresBalance};
 if(!bound(actor,lease,proof))throw fail('El plan no coincide con actor, lease o solicitud.');
 const capability=Object.freeze({});issued.set(capability,proof);actor.purchaseInventory=capability;
}
function isBound(actor){const proof=issued.get(actor?.purchaseInventory);return !!proof&&typed(actor)&&actor.uid===proof.binding.uid&&actor.role===proof.binding.role&&actor.permissionRevision===proof.binding.permissionRevision&&actor.permissionDigest===proof.binding.permissionDigest&&digest(actor.input)===proof.binding.inputDigest;}
async function validate({actor,lease,patch,operationalSummaries=false,readFresh,now=Date.now()}){
 const proof=issued.get(actor?.purchaseInventory);if(!bound(actor,lease,proof)||lease.expiresAt<=now)throw fail('Falta capacidad vigente de inventario de Compras.');
 const profile=await readFresh('sv_chat_roles/'+actor.uid),permissions=await readFresh('sv_permisos/'+actor.role),reset=await readFresh('sv_access_resets/'+actor.uid);
 if(profile?.activo!==true||profile.rol!==actor.role||digest(permissions)!==actor.permissionDigest||(permissions?.indiceRevision??null)!==(actor.permissionRevision??null)||actor.claims?.svPasswordChangeRequired===true||reset?.required===true||reset?.version!=null&&reset.version!==actor.claims?.svAccessVersion)throw fail('La sesión o los permisos de Compras cambiaron.');
 if(proof.requiresBalance&&(permissions?.indiceVersion!==2||permissions.indiceModulos?.balancecompra!==true||permissions.indiceModulos?.ordenes!==true||Object.values(permissions.bloqueados||{}).includes('balancecompra')||Object.values(permissions.bloqueados||{}).includes('ordenes')))throw fail('La preparación requiere Balance de compra y Órdenes.');
 const expected=structuredClone(proof.patch),configuration=operationalSummaries?await readFresh('sv_operational_read_config'):null;
 for(const [path,original]of Object.entries(proof.preconditions)){
  if(digest(await readFresh(path))!==digest(original))throw fail('La compra o el inventario cambió antes de confirmar.');
  if(configuration?.schema===1&&configuration.ready===true&&Object.hasOwn(expected,path)&&Operational.recordPath(path)===path)Object.assign(expected,Operational.plan(path,original,expected[path],actor.opId));
 }
 const business=Object.fromEntries(Object.entries(patch).filter(([path])=>path!=='sv_labor_guard'&&path!=='sv_labor_receipts/'+actor.opId));
 if(patch.sv_labor_guard!==null||patch['sv_labor_receipts/'+actor.opId]?.actorUid!==actor.uid||patch['sv_labor_receipts/'+actor.opId]?.digest!==lease.digest||digest(business)!==digest(expected))throw fail('El commit no conserva el plan exacto de Compras.');
}
module.exports={issue,isBound,validate,typed,kinds};
