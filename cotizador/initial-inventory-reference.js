'use strict';
// Server-only composition. Structural zero is never evidence of previous stock.
const {digest}=require('./labor-guard'),B=require('./inventory-absence-evidence'),Explicit=require('./office-stock-explicit-reference'),Catalog=require('./office-stock-catalog-coverage'),IO=require('./office-stock-reference-io'),Reference=require('./office-stock-reference'),Wire=require('./purchase-wire-envelope'),Model=require('./initial-inventory-model'),{assertFresh:compareFresh}=require('./office-stock-reference-port');
const authorities=new WeakSet(),proofs=new WeakMap(),fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_INITIAL_INVENTORY_UNPROVEN'});
function create({enabled=false,mappedAdmission,absenceAuthority,now=Date.now}={}){
 const owner=Object.freeze({});
 function ready(){if(enabled!==true||!Explicit.isMappedAdmission(mappedAdmission)||!B.isAuthority(absenceAuthority))throw fail('Falta la autoridad de ausencia y cohorte instalada.');}
 function bound(actor,lease){
  if(!actor||actor.mode!=='user'||actor.uid!==actor.claims?.uid||actor.viewAs||actor.viewing||actor.realUid&&actor.realUid!==actor.uid||actor.claims?.svPasswordChangeRequired===true||actor.opId!==actor.input?.id||actor.opId!==lease?.opId||actor.uid!==lease.actorUid||lease.mode!=='user'||typeof lease.fence!=='string'||!lease.fence||!Number.isSafeInteger(lease.expiresAt)||lease.expiresAt<=now()||actor.transportDigest!==lease.digest)throw fail('La coordinación de inventario inicial no está vigente.');
  if(['purchase-manual-create','purchase-list-generate','purchase-inventory-edit'].includes(actor.operation)){if(actor.financialAction!=='ordenes.editar')throw fail('La operación no admite inventario inicial.');Wire.assertBound(actor,lease);}
  else if(actor.operation!=='office-stock-adjustment'||actor.financialAction!=='stock.ajustar'||digest(actor.input)!==actor.transportDigest)throw fail('La operación no admite inventario inicial.');
  return digest({uid:actor.uid,claims:actor.claims,role:actor.role,permissionRevision:actor.permissionRevision,permissionDigest:actor.permissionDigest,operation:actor.operation,action:actor.financialAction,input:actor.input,transportDigest:actor.transportDigest,lease});
 }
 async function resolve(selection,ports={}){
  ready();if(!selection||Object.keys(selection).some(field=>field!=='productKey')||!Reference.key(selection.productKey)||typeof ports.read!=='function'||typeof ports.queryPage!=='function')throw fail('Faltan las fuentes originales de inventario inicial.');
  const {productKey}=selection,{actor,lease}=ports,stamp=bound(actor,lease),points=IO.memoRead(ports.read),read=points.read,ranges=new Map(),onQuery=async(path,options,value)=>ranges.set(digest({path,options}),{kind:'range',path,options:structuredClone(options),hash:digest(value)});
  if(actor.operation==='purchase-inventory-edit')Wire.assertEditSource(actor,productKey,await read('sisventas/ordenes/'+actor.input.orderKey));
  const resolved=await Explicit.resolveUnmapped({mappedAdmission,productKey,read,queryPage:ports.referencePhase?.queryPage??ports.queryPage,referencePhase:ports.referencePhase,onQuery});
  if(resolved.resolution!=='discovered-absence'||resolved.inventory!==null||resolved.reference.inventoryKey!==productKey||resolved.reference.receiptIdentityKey!==productKey||resolved.reference.status!=='active'||resolved.product.activo!==true||resolved.product.fbKey!==undefined&&resolved.product.fbKey!==productKey)throw fail('El inventario existente o ambiguo no puede inicializarse.');
  const product={...resolved.product,fbKey:productKey},values=[productKey,product.id,product.codigo,product.cod].filter(value=>value!==null&&value!==undefined&&String(value)!==''),aliases=[...new Set(values.flatMap(value=>[String(value),Catalog.normalize(value)]))].sort();
  if(aliases.some(value=>!value||value.length>768))throw fail('Los alias del producto requieren revisión.');
  const context={productKey,aliases,actor,lease,read},sourceEvidence=await absenceAuthority.verifyAbsence(context);
  if(!B.isEvidence(sourceEvidence)||!absenceAuthority.isEvidence(sourceEvidence))throw fail('La prueba de fuentes no fue emitida por la autoridad instalada.');
  const sources=absenceAuthority.inspect(sourceEvidence,context);
  if(sources.generation!==resolved.cohort.generation||sources.contractDigest!==resolved.cohort.contractDigest)throw fail('Las pruebas pertenecen a cohortes distintas.');
  const initial=Model.build({productKey,product,original:null}),readSet=[...[...points.values].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,value])=>({path,hash:digest(value)})),...[...ranges].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,value])=>value)];
  if(bound(actor,lease)!==stamp)throw fail('La operación cambió durante la prueba.');
  const evidence=Object.freeze({});proofs.set(evidence,{owner,stamp,productKey,aliases,sourceEvidence,product:structuredClone(product),reference:structuredClone(resolved.reference),initial:structuredClone(initial),readSet:structuredClone(readSet)});
  return{product,inventory:null,reference:structuredClone(resolved.reference),initialInventory:structuredClone(initial.inventory),readSet:structuredClone(readSet),evidence};
 }
 function inspect(evidence,{actor,lease}={}){ready();const proof=proofs.get(evidence);if(proof?.owner!==owner||bound(actor,lease)!==proof.stamp)throw fail('La prueba inicial pertenece a otra operación.');return{productKey:proof.productKey,product:structuredClone(proof.product),reference:structuredClone(proof.reference),initial:structuredClone(proof.initial)};}
 async function assertFresh(evidence,ports={}){inspect(evidence,ports);const proof=proofs.get(evidence);if(typeof ports.readFresh!=='function')throw fail('Falta la lectura fresca de las fuentes.');const read=IO.memoRead(ports.readFresh).read;await compareFresh(proof.readSet,read,ports.queryFresh,ports.queryPageFresh);await absenceAuthority.assertFresh(proof.sourceEvidence,{productKey:proof.productKey,aliases:proof.aliases,actor:ports.actor,lease:ports.lease,read});inspect(evidence,ports);}
 const authority=Object.freeze({resolve,inspect,assertFresh,isEvidence:evidence=>proofs.get(evidence)?.owner===owner});authorities.add(authority);return authority;
}
module.exports={create,isAuthority:value=>authorities.has(value)};
