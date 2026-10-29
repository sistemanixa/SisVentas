'use strict';
const fail=()=>Object.assign(Error('No se pudo verificar el cobro autorizado para esta venta'),{statusCode:403,code:'SV_COMMISSION_COLLECTION_PROOF'});
const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const operation=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,160}$/.test(value);
// A stored receipt is evidence of one confirmed collection, never a general
// commercial permission. This function performs no reads or writes.
function collectionProofReferences(receipt,saleKey){
 const result=receipt?.result;
 if(!key(saleKey)||result?.ok!==true||result.committed!==true||!key(result.grupoPago)||!Array.isArray(result.links)||!result.links.length||result.links.length>100||result.links.some(link=>!key(link?.ventaKey)||!key(link?.pagoKey)))throw fail();
 const links=result.links.filter(link=>link.ventaKey===saleKey);if(links.length!==1)throw fail();
 return {groupKey:result.grupoPago,paymentKey:links[0].pagoKey};
}
function validateCollectionProof({actor,saleKey,operationId,receipt,profile,permissions,group,payment,reset}={}){
 if(!key(saleKey)||!operation(operationId)||!actor?.uid||actor.viewing||actor.realUid&&actor.realUid!==actor.uid||actor.claims?.uid!==actor.uid)throw fail();
 const role=profile?.rol,allowed=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
 if(profile?.activo!==true||!allowed.includes(role)||actor.role!==role)throw fail();
 if(actor.claims.svPasswordChangeRequired===true||reset?.required===true||reset?.version!=null&&actor.claims.svAccessVersion!==reset.version)throw fail();
 const cfg=permissions||{},override=cfg.acciones?.cobranzas?.registrar;
 if(Object.values(cfg.bloqueados||{}).includes('cobranzas')||permissions&&(cfg.indiceVersion!==2||cfg.indiceModulos?.cobranzas!==true)||(typeof override==='boolean'?!override:!['admin','administrativo'].includes(role)))throw fail();
 if(receipt?.actorUid!==actor.uid||!Number.isFinite(receipt?.confirmedAt)||receipt.confirmedAt<=0||!/^[a-f0-9]{64}$/.test(receipt.digest||''))throw fail();
 const {groupKey,paymentKey}=collectionProofReferences(receipt,saleKey);
 // Annulment and generic write receipts do not carry a registration group.
 if(group?.commandId!==operationId||group.commandDigest!==receipt.digest||group.pagoKeys?.[paymentKey]!==true||payment?.grupoPago!==groupKey||payment.anulado===true||String(payment.estado||'').toLowerCase()==='anulado'||!Number.isFinite(payment.monto)||payment.monto<=0)throw fail();
 const refs=['ventaFbKey','ventaKey','ventaGeneradaFbKey','ventaOrigenFbKey'].map(k=>payment[k]).filter(v=>v!=null&&v!=='');
 if(!refs.length||refs.some(value=>value!==saleKey))throw fail();
 return {saleKey,operationId,uid:actor.uid};
}
module.exports={validateCollectionProof,collectionProofReferences,validCollectionOperationId:operation};
