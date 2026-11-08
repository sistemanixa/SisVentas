'use strict';
// Inspects supplied bytes from the existing fiscal job and sale-marker model.
// No IO, new signature, readiness switch or assertion of remote completeness.
const {digest}=require('../../cotizador/labor-guard');
const FISCAL_ROOT='sv_fiscal_emissions',SALE_ROOT='sisventas/ventas',states=['despachada','autorizada','rechazada'];
const fail=()=>Object.assign(Error('El inventario fiscal requiere revisión.'),{code:'SV_CUT_OPERATIONAL_EVIDENCE'}),object=v=>v&&typeof v==='object'&&!Array.isArray(v),safeKey=v=>typeof v==='string'&&v.length>0&&v.length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','prototype','constructor'].includes(v);
function inspectFiscal({jobs,salesByKey}={}){
 if(!object(jobs)||!object(salesByKey)||Object.keys(jobs).length>100000)throw fail();
 const counts={jobs:0,rejected:0,attached:0,ambiguousJobs:0,pendingAttachments:0,conflictingAttachments:0},issues=[];
 for(const [id,job]of Object.entries(jobs)){
  if(!/^[a-f0-9]{64}$/.test(id)||!object(job)||job.operationId!==id||!safeKey(job.ventaKey)||!['factura','nota_credito'].includes(job.clase)||!states.includes(job.estado))throw fail();counts.jobs++;
  if(!Object.hasOwn(salesByKey,job.ventaKey))throw fail();const sale=salesByKey[job.ventaKey];if(sale!==null&&!object(sale))throw fail();
  if(!job.resultado){if(job.estado==='rechazada'){counts.rejected++;continue;}counts.ambiguousJobs++;issues.push({operationId:id,kind:'result-unknown'});continue;}
  if(!object(job.resultado)||typeof job.resultado.cae!=='string'||!job.resultado.cae.trim()||job.estado!=='autorizada'){counts.ambiguousJobs++;issues.push({operationId:id,kind:'result-state-conflict'});continue;}
  const marker=sale?.emisionesFiscales?.[id];if(!marker){counts.pendingAttachments++;issues.push({operationId:id,kind:sale===null?'sale-missing':'attachment-missing'});continue;}
  const markerCae=String(marker.cae||marker.resultado?.cae||'');if(markerCae!==job.resultado.cae||marker.clase!==job.clase){counts.conflictingAttachments++;issues.push({operationId:id,kind:'attachment-conflict'});continue;}
  counts.attached++;
 }
 return Object.freeze({schema:1,scope:'supplied-existing-fiscal-records-only',jobsSha256:digest(jobs),salesSha256:digest(salesByKey),counts:Object.freeze(counts),issues,allSuppliedJobsReconciled:counts.ambiguousJobs===0&&counts.pendingAttachments===0&&counts.conflictingAttachments===0,jobInventoryComplete:null,activeRequests:null,canConcludeDrain:false,requiredExternalEvidence:['complete-enumeration-of-sv_fiscal_emissions','point-read-each-referenced-sale-marker','all-access-admission-blocked-including-old-revisions-and-tags','accepted-http-executions-finished-or-otherwise-provably-excluded'],remoteVerified:false});
}
const observations=Object.freeze({fiscalJobs:{path:FISCAL_ROOT,fields:['operationId','ventaKey','clase','estado','resultado'],reason:'Enumerate all jobs; no age-based expiry or automatic redispatch.'},sales:{path:SALE_ROOT+'/<ventaKey>',fields:['emisionesFiscales/<operationId>'],reason:'Compare the durable fiscal result with its existing sale attachment.'},httpGap:{requestRegistry:null,serverExecutionDeadline:null,reason:'No accepted-request registry is present; the external fiscal fetch has no AbortSignal. A request timeout alone is not evidence that execution ended.'}});
module.exports={inspectFiscal,observations,FISCAL_ROOT,SALE_ROOT};
