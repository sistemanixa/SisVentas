'use strict';
const crypto=require('node:crypto'),path=require('node:path');
function prepare({set,now=Date.now,lastNumber=41,revision=1,coreSource=path.resolve(__dirname,'../..')}={}){
 const atSource=file=>require(path.join(coreSource,file)),Explicit=atSource('cotizador/office-stock-explicit-reference'),Activation=atSource('cotizador/stock-link-activation-contract'),{digest}=atSource('cotizador/labor-guard'),Numbering=atSource('cotizador/purchase-numbering');
 const at=now(),expectedContract={schema:1,stockReferences:Explicit.STOCK_REFERENCES,domains:{stock:'fiction',purchase:'fiction',ot:'fiction',ui:'fiction'}},expectedPins={schema:1,generation:'fiction-purchase-numbering',baselineDigest:'a'.repeat(64),contractDigest:digest(expectedContract),codePins:{stock:'b'.repeat(64),compras:'c'.repeat(64),ot:'d'.repeat(64),ui:'e'.repeat(64)},indexQueryCoverageVersion:1},expectedRulesDigest='f'.repeat(64),{privateKey,publicKey}=crypto.generateKeyPairSync('ed25519'),document={...expectedPins,rulesDigest:expectedRulesDigest,issuedAt:at-1};document.signature=crypto.sign(null,Buffer.from(Activation.payload(document)),privateKey).toString('base64url');
 const mappedAdmission=Explicit.createMappedAdmission({enabled:true,expectedPins,expectedContract,expectedRulesDigest,publicKey,now});set(Explicit.ACTIVATION,document);set(Numbering.PATH,{schema:1,generation:expectedPins.generation,revision,lastNumber,bootstrapOrderCount:3,bootstrapHash:'0'.repeat(64),cohortDigest:digest(expectedPins),lastOperation:'fiction-bootstrap'});
 return {document,expectedPins,mappedAdmission,numbering:Numbering.create({enabled:true,mappedAdmission,now}),verify:read=>mappedAdmission.admit({read})};
}
module.exports={prepare};
