'use strict';
// Pure verification only. Server-owned expected pins/key/digest; no IO or marker writes.
const crypto=require('node:crypto');
const codes=['stock','compras','ot','ui'],hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const stable=v=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
function pins(value){if(!value||Object.keys(value).sort().join(',')!==['schema','generation','baselineDigest','contractDigest','codePins','indexQueryCoverageVersion'].sort().join(',')||value.schema!==1||!key(value.generation)||!hex(value.baselineDigest)||!hex(value.contractDigest)||!Number.isSafeInteger(value.indexQueryCoverageVersion)||value.indexQueryCoverageVersion<1||!value.codePins||Object.keys(value.codePins).sort().join(',')!==codes.slice().sort().join(',')||codes.some(k=>!hex(value.codePins[k])))throw Error('Pins de cohorte incompletos.');return structuredClone(value);}
function payload(document){return JSON.stringify(stable(Object.fromEntries(Object.entries(document).filter(([k])=>k!=='signature'))));}
function verify(document,{expectedPins,expectedRulesDigest,publicKey,now=Date.now()}={}){
 try{const expected=pins(expectedPins),names=[...Object.keys(expected),'rulesDigest','issuedAt','signature'].sort();if(!document||Object.keys(document).sort().join(',')!==names.join(',')||!hex(expectedRulesDigest)||document.rulesDigest!==expectedRulesDigest||!Number.isSafeInteger(document.issuedAt)||document.issuedAt<=0||document.issuedAt>now||typeof document.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(document.signature))return false;for(const k of Object.keys(expected))if(JSON.stringify(stable(document[k]))!==JSON.stringify(stable(expected[k])))return false;const verifier=publicKey?.type==='public'?publicKey:crypto.createPublicKey(publicKey);return verifier.asymmetricKeyType==='ed25519'&&crypto.verify(null,Buffer.from(payload(document)),verifier,Buffer.from(document.signature,'base64url'));}catch{return false;}
}
module.exports={pins,payload,verify,codes};
