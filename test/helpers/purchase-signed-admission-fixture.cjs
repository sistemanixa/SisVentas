'use strict';
const crypto=require('node:crypto'),Activation=require('../../cotizador/stock-link-activation-contract');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function cohort({activationPins,expectedRulesDigest='7'.repeat(64)}={}){
 const pins=Activation.pins(activationPins||{schema:1,generation:'fiction-common-cohort',baselineDigest:'e'.repeat(64),contractDigest:'f'.repeat(64),codePins:{stock:'a'.repeat(64),compras:'b'.repeat(64),ot:'c'.repeat(64),ui:'d'.repeat(64)},indexQueryCoverageVersion:1}),keys=crypto.generateKeyPairSync('ed25519');
 const document={...pins,rulesDigest:expectedRulesDigest,issuedAt:Date.now()-1000};document.signature=crypto.sign(null,Buffer.from(Activation.payload(document)),keys.privateKey).toString('base64url');
 function verify(value){if(!Activation.verify(value,{expectedPins:pins,expectedRulesDigest,publicKey:keys.publicKey}))throw Object.assign(Error('La cohorte firmada de Stock/Compras/OT/UI no coincide.'),{code:'SV_PURCHASE_INVENTORY_NOT_READY',statusCode:503});}
 return {pins,document,verify,publicKey:keys.publicKey,cohortDigest:sha(JSON.stringify(pins))};
}
module.exports={cohort};
