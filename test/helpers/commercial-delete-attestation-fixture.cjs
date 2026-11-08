'use strict';
const crypto=require('node:crypto');
const Cut=require('../../scripts/lib/commercial-cut-evidence.cjs'),Inputs=require('../../scripts/lib/commercial-delete-attestation-inputs.cjs'),API=require('../../cotizador/commercial-delete-attestation');
const {digest,canonical}=require('../../cotizador/labor-guard'),{apply}=require('./labor-ui-flow.cjs');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
async function fixture(records={ventas:{s:{id:'V-FICTIONAL',total:100,fecha:'2026-11-01',clienteFbKey:'c',responsableUid:'u'}}}){
 const f=await require('./coordinated-backend.cjs').createCoordinatedBackend(records);
 const Financial=require('../../cotizador/sale-financial-dependencies-model');
 const financial=await Financial.prepare({ventas:f.get('sisventas/ventas'),gastos:{},ctaemp:{},comisiones_generacion:{},sv_commission_generation:{}},{generation:'fixture-financial'});apply(f.state,financial.patch);
 apply(f.state,{'sv_client_accounts_config/writerMode':'coordinated-v1',sv_operational_read_config:{schema:1,ready:true,generation:'fixture-operational'}});
 const candidate={sourceSha256:sha('fictional-source'),rulesSha256:sha('fictional-rules'),artifactSha256:sha('fictional-artifact')};
 const meta={commercialPages:f.get('sv_commercial_pages/v1/coverage'),clientAccounts:f.get('sv_client_accounts/v1/coverage/all'),clientHistory:f.get('sv_client_history/v1/state'),paymentMembership:f.get('sv_labor_indexes/paymentRefs_v1/coverage'),saleFinancialDependencies:f.get(Financial.ROOT+'/coverage')};
 const writers=[...new Set(Object.values(Cut.REQUIRED).flat())].map(domain=>({id:domain,domain,entrypoint:'fictional/'+domain,transport:'sdk',fence:'sdk-idle',proofSha256:sha(domain)}));
 const projections=Cut.PROJECTIONS.map(name=>({name,schema:1,generation:meta[name].generation,revision:meta[name].revision??meta[name].sequence,sourceSha256:candidate.sourceSha256,proofSha256:sha(name)}));
 const manifest={schema:1,observed:{...candidate},candidate,writers,operations:Object.keys(Cut.REQUIRED).map(name=>({name,writerIds:Cut.REQUIRED[name],fences:Cut.REQUIRED[name].map(domain=>({domain,rulesSha256:candidate.rulesSha256,proofSha256:sha(domain)})),projections:structuredClone(projections),tests:Cut.CIRCUITS.map(circuit=>({circuit,result:'passed',runner:'fictional-only',artifactSha256:sha(circuit),sourceSha256:candidate.sourceSha256,rulesSha256:candidate.rulesSha256,projectionSha256:sha(Cut.canonical(projections))}))}))};
 const prepared=Inputs.prepare({manifest,activationId:'fictional-activation',operationalGeneration:'fixture-operational'}),pins=prepared.pins,keys=crypto.generateKeyPairSync('ed25519'),publicKey=keys.publicKey.export({type:'spki',format:'pem'}),now=1000;
 const payload={schema:2,capability:'commercial-delete-v1',activationId:pins.activationId,rulesSha256:pins.rulesSha256,artifactSha256:pins.artifactSha256,sourceSha256:pins.sourceSha256,manifestSha256:pins.manifestSha256,pinsSha256:digest(pins),issuedAt:999};
 const marker={...payload,signature:crypto.sign(null,Buffer.from(canonical(payload)),keys.privateKey).toString('base64url')};apply(f.state,{[API.PATH]:marker});
 const runtime={coordinated:true,readOnly:false,commercialPages:true,clientAccounts:true,clientHistory:true,saleFinancialDependencies:true,operationalSummaries:true};
 const verifier=API.createVerifier({publicKey,pins,now:()=>now}),read=path=>f.store.read(path),input={operation:'saleDelete',read,runtime};
 return {...f,prepared,manifest,pins,publicKey,marker,runtime,verifier,input};
}
module.exports={fixture};
