'use strict';
// Cut-only PREPARER. Does not publish rules, write RTDB or authorize a cut.
// The executor must hold exclusive deployment authority and recheck these
// preconditions immediately before publishing the signed marker.
const crypto=require('node:crypto'),A=require('../../cotizador/ot-delivery-attestation');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function prepare({reviewed,reviewedArtifactBytes,readInstalledRules,readOperationalConfig,privateKey,now=Date.now(),validForMs}={}){
 if(!reviewed||!/^[a-f0-9]{64}$/.test(reviewed.rulesSha256||'')||!/^[a-f0-9]{64}$/.test(reviewed.artifactSha256||'')||typeof reviewed.configGeneration!=='string'||!reviewed.configGeneration||typeof reviewed.activationId!=='string'||!reviewed.activationId||reviewed.canonicalOT!==true||reviewed.inventory!==true||reviewed.exclusivePublication!==true||typeof readInstalledRules!=='function'||typeof readOperationalConfig!=='function'||!Number.isSafeInteger(now)||!Number.isSafeInteger(validForMs)||validForMs<=0||validForMs>A.MAX_VALIDITY_MS)throw Error('Incomplete reviewed cut preconditions.');
 if((!Buffer.isBuffer(reviewedArtifactBytes)&&typeof reviewedArtifactBytes!=='string')||hash(reviewedArtifactBytes)!==reviewed.artifactSha256)throw Error('Reviewed artifact bytes differ from the pinned SHA.');
 const bytes=await readInstalledRules();if(!Buffer.isBuffer(bytes)&&typeof bytes!=='string')throw Error('Exact installed rule bytes required.');if(hash(bytes)!==reviewed.rulesSha256)throw Error('Installed rule SHA differs from reviewed artifact.');
 const config=await readOperationalConfig();if(config?.schema!==1||config.ready!==true||config.generation!==reviewed.configGeneration)throw Error('Installed generation differs from reviewed artifact.');
 const payload={schema:1,capability:'ot-delivery-v1',activationId:reviewed.activationId,rulesSha256:reviewed.rulesSha256,configGeneration:reviewed.configGeneration,artifactSha256:reviewed.artifactSha256,issuedAt:now,expiresAt:now+validForMs,canonicalOT:true,inventory:true};
 const key=crypto.createPrivateKey(privateKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 cut-only key required.');
 const value={...payload,signature:crypto.sign(null,Buffer.from(A.canonical(payload)),key).toString('base64url')};
 return{path:A.PATH,value,publicationAuthorized:false,preconditions:{rulesSha256:reviewed.rulesSha256,configGeneration:reviewed.configGeneration,artifactSha256:reviewed.artifactSha256,exclusivePublication:true,revokeMarkerBeforeAnyRulesOrGenerationChange:true}};
}
module.exports={prepare};
