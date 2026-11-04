'use strict';
// Offline/read-only contract. No network client, scheduler, lock, publication,
// reopening or restore. The existing publisher supplies current observations;
// their authenticity and exclusive deployment authority remain cut preconditions.
const crypto=require('node:crypto'),A=require('../../cotizador/ot-delivery-attestation');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const bindings=['activationId','rulesSha256','configGeneration','artifactSha256'];
const requirements=['exclusivePublication','sdkAdmissionPaused','commercialAdmissionPaused','fiscalAdmissionPaused','guardEmpty','httpDrained','fiscalReconciled','writersClosed'];
function review(reviewed,bytes){
 if(!reviewed||!/^[a-f0-9]{64}$/.test(reviewed.rulesSha256||'')||!/^[a-f0-9]{64}$/.test(reviewed.artifactSha256||'')||typeof reviewed.configGeneration!=='string'||!reviewed.configGeneration||typeof reviewed.activationId!=='string'||!reviewed.activationId||reviewed.canonicalOT!==true||reviewed.inventory!==true||reviewed.exclusivePublication!==true)throw Error('Incomplete reviewed cut preconditions.');
 if((!Buffer.isBuffer(bytes)&&typeof bytes!=='string')||hash(bytes)!==reviewed.artifactSha256)throw Error('Reviewed artifact bytes differ from the pinned SHA.');
 return Object.fromEntries([...bindings,'canonicalOT','inventory','exclusivePublication'].map(k=>[k,reviewed[k]]));
}
async function observe({reviewed,readInstalledRules,readOperationalConfig,publisher,marker}){
 if(typeof readInstalledRules!=='function'||typeof readOperationalConfig!=='function'||typeof publisher?.readMarker!=='function'||typeof publisher?.readCutProof!=='function')throw Error('Publisher observation callbacks required.');
 const proof=await publisher.readCutProof();
 if(!proof||proof.schema!==1||bindings.some(k=>proof[k]!==reviewed[k])||requirements.some(k=>proof[k]!==true))throw Error('Publisher pause/drain/exclusive writer proof is incomplete.');
 if(!Array.isArray(proof.completedSteps)||proof.completedSteps.join(',')!=='revoke-marker,pause-and-drain')throw Error('Publisher must revoke before pausing and draining.');
 const current=await publisher.readMarker();
 if(marker===null?current!==null:!current||A.canonical(current)!==A.canonical(marker))throw Error('Deployment marker differs from the required publication phase.');
 const bytes=await readInstalledRules();if(!Buffer.isBuffer(bytes)&&typeof bytes!=='string')throw Error('Exact installed rule bytes required.');if(hash(bytes)!==reviewed.rulesSha256)throw Error('Installed rule SHA differs from reviewed artifact.');
 const config=await readOperationalConfig();if(config?.schema!==1||config.ready!==true||config.generation!==reviewed.configGeneration)throw Error('Installed generation differs from reviewed artifact.');
}
async function prepare(options={}){
 const {reviewedArtifactBytes,privateKey,now=Date.now()}=options;
 if(Object.hasOwn(options,'validForMs')||!Number.isSafeInteger(now)||now<0)throw Error('V2 has no daily validity/expiry option.');
 // Snapshot reviewed bindings before invoking asynchronous publisher callbacks.
 const reviewed=review(options.reviewed,reviewedArtifactBytes),observed={...options,reviewed,marker:null};
 await observe(observed);
 const payload={schema:2,capability:'ot-delivery-v2',activationId:reviewed.activationId,rulesSha256:reviewed.rulesSha256,configGeneration:reviewed.configGeneration,artifactSha256:reviewed.artifactSha256,issuedAt:now,canonicalOT:true,inventory:true};
 const key=crypto.createPrivateKey(privateKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 cut-only key required.');
 await observe(observed);
 review(reviewed,reviewedArtifactBytes);
 const value={...payload,signature:crypto.sign(null,Buffer.from(A.canonical(payload)),key).toString('base64url')};
 return{path:A.PATH,value,publicationAuthorized:false,preconditions:{...reviewed,revokeMarkerBeforeAnyRulesOrGenerationChange:true,publicationSequence:['revoke-marker','pause-and-drain','verify-installed-rules-and-generation','publish-exact-marker','verify-published-marker','reopen'],privilegedWritersOutsidePublisherObservable:false}};
}
async function verifyPublished(options={}){
 const reviewed=review(options.reviewed,options.reviewedArtifactBytes),prepared=options.prepared;
 if(prepared?.path!==A.PATH||!A.verify(prepared.value,{publicKey:options.publicKey,...reviewed,now:options.now??Date.now()}))throw Error('Exact reviewed V2 marker required before reopening.');
 const observed={...options,reviewed,marker:structuredClone(prepared.value)};
 await observe(observed);await observe(observed);
 review(reviewed,options.reviewedArtifactBytes);
 return{publicationVerified:true,publicationAuthorized:false,reopenAuthorized:false,activationId:reviewed.activationId,artifactSha256:reviewed.artifactSha256};
}
module.exports={prepare,verifyPublished};
