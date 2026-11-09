'use strict';
const Contract=require('./ot-delete-operational-contract');
function create({env=process.env,read,exists,runtime,now=Date.now}={}){
 let pins=null;try{if(typeof env.OT_DELETE_OPERATIONAL_PINS_JSON==='string'&&env.OT_DELETE_OPERATIONAL_PINS_JSON.length<=32768)pins=JSON.parse(env.OT_DELETE_OPERATIONAL_PINS_JSON);}catch{}
 const verifier=Contract.createVerifier({publicKey:env.OT_DELETE_OPERATIONAL_PUBLIC_KEY,pins,now}),configured=env.OT_DELETE_OPERATIONAL_READY==='true'&&verifier.configured,state=()=>typeof runtime==='function'?runtime():null;
 const fail=()=>Object.assign(Error('Falta la activación verificada de eliminación de OT.'),{statusCode:503,code:'SV_OT_DELETE_OPERATIONAL_NOT_READY'});
 async function capture(){if(!configured)throw fail();const proof=await verifier.verify({operation:'otDelete',read,exists,runtime:state()});if(!proof)throw fail();return proof;}
 async function assertCurrent(proof,reader=read){if(!configured)throw fail();return verifier.assertCurrent({proof,readFresh:reader,existsFresh:exists,runtime:state()});}
 async function available(){try{await capture();return true;}catch{return false;}}
 async function commitClaims({patch,lease,actor,readFresh=read}={}){if(!configured)throw fail();return verifier.claims({proof:actor?.otDeleteOperationalProof,patch,lease,actor,readFresh,existsFresh:exists,runtime:state()});}
 return Object.freeze({configured,capture,assertCurrent,available,commitClaims});
}
module.exports={create};
