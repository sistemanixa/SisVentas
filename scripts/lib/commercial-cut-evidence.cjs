'use strict';
const crypto=require('node:crypto');
const Operational=require('./operational-write-fence.cjs');
const OTPolicy=require('../../cotizador/ot-delete-policy');
const FINANCIAL=Object.freeze(['ventas','gastos','ctaemp','comisiones_generacion','sv_commission_generation']);
const REQUIRED=Object.freeze({
 saleDelete:Object.freeze([...new Set([...FINANCIAL,'ventas','pagos','presupuestos','ordenes_trabajo','reclamos','clientes','clientes_unificados','clientes_unificados_indice',...Operational.domains])]),
 orderDelete:Object.freeze([...new Set([...FINANCIAL,'ventas','pagos','presupuestos','ordenes_trabajo','reclamos','clientes','clientes_unificados','clientes_unificados_indice',...Operational.domains])]),
 otDelete:Object.freeze([...new Set([...FINANCIAL,...OTPolicy.domains,'ordenes_trabajo',...Operational.domains])])
});
const CIRCUITS=Object.freeze(['authorization','sdk-idle','guard-live','atomic-projections','concurrency','receipt-replay','legacy-relations']);
const PROJECTIONS=Object.freeze(['commercialPages','clientAccounts','clientHistory','paymentMembership','saleFinancialDependencies']);
const fail=message=>{throw Object.assign(Error(message),{code:'SV_COMMERCIAL_CUT_EVIDENCE'});};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=512;
function fields(value,allowed,required=allowed){if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key))||required.some(key=>!Object.hasOwn(value,key)))fail('Estructura de evidencia inválida.');}
function unique(rows,key,label){if(!Array.isArray(rows)||!rows.length)fail('Falta '+label+'.');const ids=new Set();for(const row of rows){const id=key(row);if(!text(id)||ids.has(id))fail('Entrada duplicada o inválida en '+label+'.');ids.add(id);}return ids;}
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(object(value))return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';return JSON.stringify(value);}
function validate(input){
 fields(input,['schema','observed','candidate','writers','operations']);if(input.schema!==1)fail('Versión de manifiesto inválida.');
 for(const name of ['observed','candidate']){fields(input[name],['sourceSha256','rulesSha256','artifactSha256']);for(const value of Object.values(input[name]))if(!hash(value))fail('Faltan huellas SHA256 de '+name+'.');}
 const writerIds=unique(input.writers,row=>row?.id,'escritores'),writers=new Map();
 for(const row of input.writers){fields(row,['id','domain','entrypoint','transport','fence','proofSha256']);if(!text(row.domain)||!text(row.entrypoint)||!['sdk','server','legacy-sdk'].includes(row.transport)||!['coordinated','sdk-idle'].includes(row.fence)||!hash(row.proofSha256)||row.transport!=='server'&&row.fence!=='sdk-idle')fail('Escritor sin cierre demostrable.');writers.set(row.id,row);}
 const operations=unique(input.operations,row=>row?.name,'operaciones');if(operations.size!==Object.keys(REQUIRED).length||Object.keys(REQUIRED).some(name=>!operations.has(name)))fail('Se requieren los tres circuitos destructivos: saleDelete, orderDelete y otDelete.');
 for(const operation of input.operations){
  fields(operation,['name','writerIds','fences','projections','tests']);
  const selected=unique(operation.writerIds,value=>value,'referencias de escritores');for(const id of selected)if(!writerIds.has(id))fail('Referencia de escritor inexistente.');
  const domainSet=unique(operation.fences,row=>row?.domain,'fences');
  for(const domain of REQUIRED[operation.name])if(!domainSet.has(domain))fail('Falta fence de '+domain+'.');
  for(const fence of operation.fences){fields(fence,['domain','rulesSha256','proofSha256']);if(fence.rulesSha256!==input.candidate.rulesSha256||!hash(fence.proofSha256))fail('Fence no vinculado a reglas candidatas.');if(![...selected].some(id=>writers.get(id).domain===fence.domain))fail('Dominio sin escritores inventariados.');}
  for(const id of selected)if(!domainSet.has(writers.get(id).domain))fail('Escritor sin fence.');
  for(const writer of writers.values())if(domainSet.has(writer.domain)&&!selected.has(writer.id))fail('Se omitió un escritor del dominio.');
  const projectionNames=unique(operation.projections,row=>row?.name,'proyecciones');
  for(const name of PROJECTIONS)if(!projectionNames.has(name))fail('Falta proyección '+name+'.');
  for(const projection of operation.projections){fields(projection,['name','schema','generation','revision','sourceSha256','proofSha256']);if(projection.schema!==1||!text(projection.generation)||!Number.isSafeInteger(projection.revision)||projection.revision<0||projection.sourceSha256!==input.candidate.sourceSha256||!hash(projection.proofSha256))fail('Proyección sin generación o vínculo de fuente.');}
  const circuits=unique(operation.tests,row=>row?.circuit,'pruebas');for(const circuit of CIRCUITS)if(!circuits.has(circuit))fail('Falta prueba de '+circuit+'.');
  for(const result of operation.tests){fields(result,['circuit','result','runner','artifactSha256','sourceSha256','rulesSha256','projectionSha256']);if(result.result!=='passed'||!text(result.runner)||!hash(result.artifactSha256)||result.sourceSha256!==input.candidate.sourceSha256||result.rulesSha256!==input.candidate.rulesSha256||result.projectionSha256!==crypto.createHash('sha256').update(canonical(operation.projections)).digest('hex'))fail('Prueba fallida o desvinculada del candidato.');}
 }
 return {schema:1,manifestSha256:crypto.createHash('sha256').update(canonical(input)).digest('hex'),scope:'offline-consistency-only',remoteVerified:false,activationAuthorized:false};
}
module.exports={validate,FINANCIAL,REQUIRED,CIRCUITS,PROJECTIONS,canonical};
