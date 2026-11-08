'use strict';
// This verifies a signed cut statement plus current small metadata. It never
// reads remote rules, signs a deployment, assigns fence booleans or starts IO.
const crypto=require('node:crypto'),{canonical,digest}=require('./labor-guard');
const Financial=require('./sale-financial-dependencies-model'),Membership=require('./payment-membership-index');
const History=require('./client-history-model');
const PATH='sv_deployment_attestations/commercial_delete';
const OPERATIONS=Object.freeze(['saleDelete','orderDelete','otDelete']);
const PROJECTIONS=Object.freeze(['commercialPages','clientAccounts','clientHistory','paymentMembership','saleFinancialDependencies']);
const fields=['schema','capability','activationId','rulesSha256','artifactSha256','sourceSha256','manifestSha256','pinsSha256','issuedAt'];
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const text=value=>typeof value==='string'&&value.length>0&&value.length<=160&&value.trim()===value;
const exact=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const fail=()=>Object.assign(Error('Falta evidencia vigente del cierre de escritores y proyecciones; no se habilitó la eliminación.'),{statusCode:503,code:'SV_COMMERCIAL_DELETE_ATTESTATION_REQUIRED'});
function validPins(pins){return exact(pins,['schema','sourceSha256','rulesSha256','artifactSha256','manifestSha256','activationId','operationalGeneration','projections'])&&pins.schema===1&&['sourceSha256','rulesSha256','artifactSha256','manifestSha256'].every(key=>hash(pins[key]))&&text(pins.activationId)&&text(pins.operationalGeneration)&&exact(pins.projections,PROJECTIONS)&&PROJECTIONS.every(key=>{const p=pins.projections[key];return exact(p,['schema','generation','minimumRevision'])&&p.schema===1&&text(p.generation)&&Number.isSafeInteger(p.minimumRevision)&&p.minimumRevision>=0;});}
function runtimeReady(value){return value?.coordinated===true&&value.readOnly===false&&['commercialPages','clientAccounts','clientHistory','saleFinancialDependencies','operationalSummaries'].every(key=>value[key]===true);}
function createVerifier({publicKey,pins,now=Date.now}={}){
 let key=null,expected=null;try{if(validPins(pins)){key=crypto.createPublicKey(publicKey);if(key.asymmetricKeyType!=='ed25519')key=null;else expected=structuredClone(pins);}}catch{}
 const issued=new WeakSet();
 function marker(value){
  if(!exact(value,fields.concat('signature'))||typeof value.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(value.signature))return false;
  const payload=Object.fromEntries(fields.map(field=>[field,value[field]])),at=now();
  return payload.schema===2&&payload.capability==='commercial-delete-v1'&&['activationId','rulesSha256','artifactSha256','sourceSha256','manifestSha256'].every(field=>payload[field]===expected[field])&&payload.pinsSha256===digest(expected)&&Number.isSafeInteger(at)&&Number.isSafeInteger(payload.issuedAt)&&payload.issuedAt>=0&&payload.issuedAt<=at&&crypto.verify(null,Buffer.from(canonical(payload)),key,Buffer.from(value.signature,'base64url'));
 }
 async function verify({operation,read,runtime}={}){
  if(!key||!expected||!OPERATIONS.includes(operation)||typeof read!=='function'||!runtimeReady(runtime))return null;
  try{
   const actor=digest(runtime),attestation=await read(PATH);if(!marker(attestation))return null;
   const paths=['sv_labor_config','sv_operational_read_config','sv_commercial_pages_config','sv_client_accounts_config','sv_client_history_config','sv_commercial_pages/v1/coverage','sv_client_accounts/v1/coverage/all','sv_client_history/v1/state',Membership.COVERAGE_PATH,Financial.ROOT+'/coverage','sv_client_history/v1/coverage/all'];
   const values=await Promise.all(paths.map(path=>read(path))),[labor,operational,pages,accounts,history,pc,ac,hc,mc,fc,historyDomains]=values;
   if([labor,operational,pages,accounts,history].some(value=>value?.schema!==1||value.ready!==true)||operational.generation!==expected.operationalGeneration||accounts.writerMode!=='coordinated-v1'||history.writerSchema!==1||hc?.dependencyManifest!==1)return null;
   const coverage={commercialPages:pc,clientAccounts:ac,clientHistory:hc,paymentMembership:mc,saleFinancialDependencies:fc};
   for(const name of PROJECTIONS){const actual=coverage[name],pin=expected.projections[name],revision=name==='paymentMembership'?actual?.sequence:actual?.revision;if(actual?.schema!==1||actual.ready!==true||actual.generation!==pin.generation||!Number.isSafeInteger(revision)||revision<pin.minimumRevision)return null;}
   if(pages.generation!==pc.generation||accounts.generation!==ac.generation||history.generation!==hc.generation)return null;
   if(!['sales','payments'].every(field=>Number.isSafeInteger(pc[field])&&pc[field]>=0)||ac.ownerManifest!==1||ac.ownerEvidenceVersion!==1)return null;
   let historyRecords=0;
   for(const domain of History.domains){const c=historyDomains?.[domain];if(c?.schema!==1||c.ready!==true||c.generation!==hc.generation||!Number.isSafeInteger(c.revision)||c.revision<1||c.revision>hc.revision||!['records','originalRecords','unlinkedRecords'].every(field=>Number.isSafeInteger(c[field])&&c[field]>=0)||c.records<c.originalRecords||c.records<c.unlinkedRecords)return null;historyRecords+=c.records;}
   if(!Number.isSafeInteger(historyRecords)||historyRecords!==hc.records)return null;
   if(historyDomains.ventas.originalRecords!==ac.salesRecords||historyDomains.pagos.originalRecords!==ac.paymentRecords)return null;
   Membership.validateCoverage(mc);Financial.validateCoverage(fc);if(fc.unresolved!==0||mc.paymentCount!==pc.payments||ac.salesRecords!==pc.sales||ac.paymentRecords!==pc.payments)return null;
   if(digest(await read(PATH))!==digest(attestation)||digest(runtime)!==actor||!runtimeReady(runtime))return null;
   const proof=Object.freeze({schema:1,verified:true,operation,activationId:expected.activationId,rulesDigest:expected.rulesSha256,artifactSha256:expected.artifactSha256,manifestSha256:expected.manifestSha256,pinsSha256:digest(expected),attestationSha256:digest(attestation),verificationKind:'signed-commercial-cut-v2',remoteRulesRead:false});issued.add(proof);return proof;
  }catch{return null;}
 }
 async function assertCurrent({proof,readFresh,runtime}={}){
  if(!proof||!issued.has(proof))throw fail();
  const fresh=await verify({operation:proof.operation,read:readFresh,runtime});
  if(!fresh||fresh.attestationSha256!==proof.attestationSha256)throw fail();return fresh;
 }
 return Object.freeze({configured:!!key&&!!expected,verify,available:async input=>!!await verify(input),assertCurrent});
}
module.exports={PATH,OPERATIONS,PROJECTIONS,createVerifier,validPins};
