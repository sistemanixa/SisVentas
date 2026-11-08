'use strict';
// Local evidence and cryptography only. No discovery, RTDB writes or activation.
const fs=require('node:fs'),crypto=require('node:crypto'),Files=require('./commercial-cut-file-evidence.cjs'),Inputs=require('./commercial-delete-attestation-inputs.cjs'),API=require('../../cotizador/commercial-delete-attestation'),{digest,canonical}=require('../../cotizador/labor-guard');
const METADATA=Object.freeze(['sv_labor_guard','sv_labor_config','sv_operational_read_config','sv_commercial_pages_config','sv_client_accounts_config','sv_client_history_config','sv_commercial_pages/v1/coverage','sv_client_accounts/v1/coverage/all','sv_client_history/v1/state','sv_labor_indexes/paymentRefs_v1/coverage','sv_sale_financial_dependencies/v1/coverage','sv_client_history/v1/coverage/all']);
const runtimeFields=['coordinated','readOnly','commercialPages','clientAccounts','clientHistory','saleFinancialDependencies','operationalSummaries'],prepared=new WeakMap();
const fail=()=>Object.assign(Error('La evidencia del corte comercial requiere revisión; no se emitió el acta.'),{code:'SV_COMMERCIAL_DELETE_CUT_REQUIRED'});
function exact(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))throw fail();}
function checked(input,options){
 exact(input,['bundle','activationId','operationalGeneration','before','after','runtime']);exact(options,['expectedBaselineSha256','now','maxAgeMs']);
 const result=Files.validate(input.bundle,options),manifest=JSON.parse(fs.readFileSync(input.bundle.manifest.path,'utf8')),pause=JSON.parse(fs.readFileSync(input.bundle.pause.path,'utf8')),fiscal=JSON.parse(fs.readFileSync(input.bundle.fiscal.path,'utf8'));
 const pins=Inputs.prepare({manifest,activationId:input.activationId,operationalGeneration:input.operationalGeneration}).pins;
 exact(input.runtime,runtimeFields);if(runtimeFields.some(k=>input.runtime[k]!== (k!=='readOnly')))throw fail();
 for(const snapshot of [input.before,input.after]){exact(snapshot,['observedAt','metadata']);exact(snapshot.metadata,METADATA);const at=Date.parse(snapshot.observedAt);if(!Number.isSafeInteger(at)||at<Date.parse(pause.drainedAt)||at<Date.parse(fiscal.observedAt)||at>options.now||options.now-at>options.maxAgeMs||snapshot.metadata.sv_labor_guard!==null||snapshot.metadata.sv_labor_config?.sdkAdmissionPaused!==true||snapshot.metadata.sv_labor_config?.writerSchema!==2)throw fail();}
 if(Date.parse(input.before.observedAt)>Date.parse(input.after.observedAt)||digest(input.before.metadata)!==digest(input.after.metadata))throw fail();
 // Candidate bytes must be represented by real supplied, hash-checked files.
 const artifacts=new Set(input.bundle.artifacts.map(r=>r.sha256));for(const field of ['sourceSha256','rulesSha256','artifactSha256'])if(!artifacts.has(pins[field]))throw fail();
 if(result.manifestSha256!==pins.manifestSha256)throw fail();return{pins,result};
}
function prepare(input,options){try{if(Buffer.byteLength(JSON.stringify(input))>2*1024*1024)throw fail();const stored={input:structuredClone(input),options:structuredClone(options)},value=checked(stored.input,stored.options),handle=Object.freeze({path:API.PATH,pins:structuredClone(value.pins),evidenceSha256:digest(stored),scope:'supplied-local-evidence-only',remoteVerified:false,activationAuthorized:false});prepared.set(handle,stored);return handle;}catch{throw fail();}}
async function sign(handle,{privateKey,publicKey,now}={}){try{
 const stored=prepared.get(handle);if(!stored||!Number.isSafeInteger(now)||now<stored.options.now)throw fail();
 const {pins}=checked(stored.input,{...stored.options,now});
 const key=crypto.createPrivateKey(privateKey);if(key.asymmetricKeyType!=='ed25519')throw fail();const pub=crypto.createPublicKey(publicKey);if(pub.asymmetricKeyType!=='ed25519'||!crypto.createPublicKey(key).export({type:'spki',format:'der'}).equals(pub.export({type:'spki',format:'der'})))throw fail();
 const payload={schema:2,capability:'commercial-delete-v1',activationId:pins.activationId,rulesSha256:pins.rulesSha256,artifactSha256:pins.artifactSha256,sourceSha256:pins.sourceSha256,manifestSha256:pins.manifestSha256,pinsSha256:digest(pins),issuedAt:now},marker={...payload,signature:crypto.sign(null,Buffer.from(canonical(payload)),key).toString('base64url')};
 const verifier=API.createVerifier({publicKey,pins,now:()=>now});for(const snapshot of [stored.input.before,stored.input.after])for(const operation of API.OPERATIONS){const proof=await verifier.verify({operation,runtime:stored.input.runtime,read:async path=>path===API.PATH?marker:structuredClone(snapshot.metadata[path])});if(!proof)throw fail();}
 // Re-read every referenced local file after cryptographic and metadata checks.
 checked(stored.input,{...stored.options,now});return Object.freeze({path:API.PATH,marker:Object.freeze(marker),pins:structuredClone(pins),evidenceSha256:handle.evidenceSha256,scope:'supplied-local-evidence-only',remoteVerified:false,activationAuthorized:false});
 }catch{throw fail();}}
module.exports={prepare,sign,METADATA};
