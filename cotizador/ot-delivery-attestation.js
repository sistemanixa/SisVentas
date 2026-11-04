'use strict';
// A signed deployment attestation is not a fresh observation of remote rules.
// Only the cut process holds the signing key; runtime receives a public key and
// reviewed expected hashes. Two small reads per check, no timers/rules polling.
const crypto=require('node:crypto');
const PATH='sv_deployment_attestations/ot_delivery';
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=value=>JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const fields=['schema','capability','activationId','rulesSha256','configGeneration','artifactSha256','issuedAt','canonicalOT','inventory'];
function verify(value,{publicKey,rulesSha256,configGeneration,artifactSha256,activationId,now=Date.now()}={}){
 try{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length+1||fields.some(k=>!Object.hasOwn(value,k))||typeof value.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(value.signature))return null;
  const payload=Object.fromEntries(fields.map(k=>[k,value[k]]));
  if(!hash(rulesSha256)||!hash(artifactSha256)||!configGeneration||!activationId||payload.schema!==2||payload.capability!=='ot-delivery-v2'||payload.rulesSha256!==rulesSha256||payload.configGeneration!==configGeneration||payload.artifactSha256!==artifactSha256||payload.activationId!==activationId||payload.canonicalOT!==true||payload.inventory!==true||!Number.isSafeInteger(now)||!Number.isSafeInteger(payload.issuedAt)||payload.issuedAt<0||payload.issuedAt>now)return null;
  const key=crypto.createPublicKey(publicKey);if(key.asymmetricKeyType!=='ed25519'||!crypto.verify(null,Buffer.from(canonical(payload)),key,Buffer.from(value.signature,'base64url')))return null;
  // schema:1 remains the fence-proof interface; the signed payload is V2.
  // Age never renews authority: marker/config revocation does.
  return{schema:1,attestationSchema:2,verified:true,canonicalOT:true,inventory:true,rulesDigest:rulesSha256,configGeneration,artifactSha256,activationId,issuedAt:payload.issuedAt,attestationSha256:sha(canonical(value)),verificationKind:'signed-deployment-attestation-v2',remoteRulesRead:false};
 }catch{return null;}
}
function createVerifier({env=process.env,now=Date.now}={}){
 const expected={publicKey:env.OT_DELIVERY_ATTESTATION_PUBLIC_KEY,rulesSha256:env.OT_DELIVERY_EXPECTED_RULES_SHA256,configGeneration:env.OT_DELIVERY_EXPECTED_GENERATION,artifactSha256:env.OT_DELIVERY_EXPECTED_ARTIFACT_SHA256,activationId:env.OT_DELIVERY_ACTIVATION_ID};
 let configured=false;try{configured=env.OT_DELIVERY_ENABLED==='true'&&hash(expected.rulesSha256)&&hash(expected.artifactSha256)&&typeof expected.configGeneration==='string'&&expected.configGeneration.length>0&&typeof expected.activationId==='string'&&expected.activationId.length>0&&crypto.createPublicKey(expected.publicKey).asymmetricKeyType==='ed25519';}catch{}
 return async function verifyOTDeliveryFence({read}={}){
  if(!configured||typeof read!=='function')return null;
  try{const [attestation,config]=await Promise.all([read(PATH),read('sv_operational_read_config')]);if(config?.schema!==1||config.ready!==true||config.generation!==expected.configGeneration)return null;return verify(attestation,{...expected,now:now()});}catch{return null;}
 };
}
module.exports={PATH,canonical,verify,createVerifier};
