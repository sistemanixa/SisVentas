'use strict';
// Synthetic immutable package; genuine signature/admission, no production closure claim.
const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const Guard=require('../../cotizador/labor-guard'),Pins=require('../../cotizador/inventory-code-pins'),Contract=require('../../cotizador/inventory-cohort-contract'),Install=require('../../cotizador/inventory-installation-contract'),Activation=require('../../cotizador/stock-link-activation-contract');
function signed(t){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sv-note-gateway-')),serverRoot=path.join(temp,'server'),uiRoot=path.join(temp,'ui');fs.mkdirSync(serverRoot);fs.mkdirSync(uiRoot);
 t.after(()=>{const target=fs.realpathSync(temp),parent=fs.realpathSync(os.tmpdir());a.equal(path.dirname(target),parent);a.ok(path.basename(target).startsWith('sv-note-gateway-'));fs.rmSync(target,{recursive:true,force:true});});
 for(const name of new Set(['stock','compras','ot'].flatMap(group=>Pins.manifest.groups[group])))fs.writeFileSync(path.join(serverRoot,name),'module.exports={};');
 for(const name of ['package.json','package-lock.json'])fs.writeFileSync(path.join(serverRoot,name),'{}');
 for(const name of ['js/core','js/modules','css'])fs.mkdirSync(path.join(uiRoot,name),{recursive:true});
 fs.writeFileSync(path.join(uiRoot,'index.html'),'<script src="./js/app.v3.21.2.js"></script>');fs.writeFileSync(path.join(uiRoot,'sw.js'),'// signed fictitious package');fs.writeFileSync(path.join(uiRoot,'js/app.v3.21.2.js'),'// signed fictitious package');
 const keys=crypto.generateKeyPairSync('ed25519'),contract=Contract.create({generation:'note-gateway-fiction',operationId:'note-gateway-bootstrap',sourceDigest:'a'.repeat(64),runtimeHash:'b'.repeat(64),writers:Contract.REQUIRED.map(id=>({id,state:'closed',sourceHash:'c'.repeat(64),proofHash:'d'.repeat(64)}))}),pins={schema:1,generation:contract.generation,baselineDigest:'e'.repeat(64),contractDigest:Guard.digest(contract),codePins:Pins.calculateCodePins({serverRoot,uiRoot}).codePins,indexQueryCoverageVersion:1},env={INVENTORY_COHORT_PINS_JSON:JSON.stringify(pins),INVENTORY_COHORT_CONTRACT_JSON:JSON.stringify(contract),INVENTORY_RULES_DIGEST:'f'.repeat(64),INVENTORY_COHORT_PUBLIC_KEY:keys.publicKey.export({type:'spki',format:'pem'})},document={...pins,rulesDigest:env.INVENTORY_RULES_DIGEST,issuedAt:Date.now()-1000};
 document.signature=crypto.sign(null,Buffer.from(Activation.payload(document)),keys.privateKey).toString('base64url');const verifier=Pins.createVerifier({serverRoot,uiRoot,env}),marker=Install.createMarker(document,{verifier});a.equal(Pins.isVerifier(verifier),true);return{serverRoot,uiRoot,env,document,marker};
}
module.exports={create:signed};
