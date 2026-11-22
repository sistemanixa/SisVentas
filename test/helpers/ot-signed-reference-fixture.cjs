'use strict';
// Synthetic cohort only. Ephemeral signing keys never leave this process.
const crypto=require('node:crypto');
function signedReference({Explicit,Activation,Reference,now=Date.now}){
 const expectedContract={schema:1,stockReferences:Explicit.STOCK_REFERENCES,domains:{stock:'fiction-stock',purchase:'fiction-purchase',ot:'fiction-ot',ui:'fiction-ui'}},expectedPins={schema:1,generation:'fiction-ot-cohort',baselineDigest:Reference.digest('fiction-baseline'),contractDigest:Reference.digest(expectedContract),codePins:Object.fromEntries(['stock','compras','ot','ui'].map(name=>[name,Reference.digest('fiction-code-'+name)])),indexQueryCoverageVersion:1},expectedRulesDigest=Reference.digest('fiction-rules-not-deployed'),{privateKey,publicKey}=crypto.generateKeyPairSync('ed25519'),document={...expectedPins,rulesDigest:expectedRulesDigest,issuedAt:now()-1};
 document.signature=crypto.sign(null,Buffer.from(Activation.payload(document)),privateKey).toString('base64url');
 const authority=Explicit.createMappedAdmission({enabled:true,expectedPins,expectedContract,expectedRulesDigest,publicKey,now});
 function seed(data){data.sv_stock_reference_config={activation:structuredClone(document)};for(const record of Object.values(data.sisventas.stock_vinculos?.porProducto||{})){
  const operationId='fixture-link-'+record.productKey,uid='fiction-link-owner',mapping={...record,operationId,uid,reason:'Asociación ficticia preexistente',ts:document.issuedAt},result={ok:true,committed:true,operationId,productKey:record.productKey,inventoryKey:record.inventoryKey,receiptIdentityKey:record.receiptIdentityKey,revision:record.revision};
  data.sisventas.stock_vinculos.porProducto[record.productKey]=mapping;data.sisventas.stock_vinculos.porInventario[record.inventoryKey]=structuredClone(mapping);data.sisventas.stock_vinculos.operaciones??={};data.sisventas.stock_vinculos.operaciones[operationId]={uid,operationId,commandDigest:Reference.digest(['fiction-link',mapping]),result};data.sv_labor_receipts??={};data.sv_labor_receipts[operationId]={actorUid:uid,digest:Reference.digest(['fiction-transport',mapping]),fence:'fiction-link-fence',confirmedAt:document.issuedAt,result:structuredClone(result)};
 }}
 return {authority,seed,document,expectedContract,expectedPins,expectedRulesDigest};
}
module.exports={signedReference};
