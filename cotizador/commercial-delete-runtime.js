'use strict';
const Attestation=require('./commercial-delete-attestation'),Protocol=require('./commercial-delete-commit-protocol');
const fail=()=>Object.assign(Error('La eliminación protegida todavía no tiene una activación vigente.'),{statusCode:503,code:'SV_COMMERCIAL_DELETE_ATTESTATION_REQUIRED'});
function create({env=process.env,read,runtime,now=Date.now}={}){
 let pins=null;try{if(typeof env.COMMERCIAL_DELETE_PINS_JSON==='string'&&env.COMMERCIAL_DELETE_PINS_JSON.length<=32768)pins=JSON.parse(env.COMMERCIAL_DELETE_PINS_JSON);}catch{}
 const verifier=Attestation.createVerifier({publicKey:env.COMMERCIAL_DELETE_ATTESTATION_PUBLIC_KEY,pins,now}),protocol=Protocol.create({verifier,pins});
 const configured=env.COMMERCIAL_DELETE_ENABLED==='true'&&verifier.configured;
 const state=()=>typeof runtime==='function'?runtime():null;
 async function capture(operation,reader=read){if(!configured)throw fail();const proof=await verifier.verify({operation,read:reader,runtime:state()});if(!proof)throw fail();return proof;}
 async function assertCurrent(proof,reader=read){if(!configured)throw fail();return verifier.assertCurrent({proof,readFresh:reader,runtime:state()});}
 async function available(){if(!configured)return false;return verifier.available({operation:'saleDelete',read,runtime:state()});}
 async function commitClaims({patch,lease,actor,readFresh=read}={}){return protocol.claims({proof:configured?actor?.commercialDeleteProof:null,patch,lease,actor,readFresh,runtime:state()});}
 return Object.freeze({configured,capture,assertCurrent,available,commitClaims});
}
module.exports={create};
