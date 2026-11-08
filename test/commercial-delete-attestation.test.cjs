'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Cut=require('../scripts/lib/commercial-cut-evidence.cjs'),Inputs=require('../scripts/lib/commercial-delete-attestation-inputs.cjs'),API=require('../cotizador/commercial-delete-attestation');
const {digest,canonical}=require('../cotizador/labor-guard'),{apply}=require('./helpers/labor-ui-flow.cjs');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const {fixture}=require('./helpers/commercial-delete-attestation-fixture.cjs');
test('offline helper preserves non-authority; bare readiness flags never enable provider',async()=>{
 const f=await fixture();assert.equal(f.prepared.remoteVerified,false);assert.equal(f.prepared.activationAuthorized,false);
 let calls=0;assert.equal(await API.createVerifier().available({...f.input,read:()=>{calls++;}}),false);assert.equal(calls,0);
 delete f.state.sv_deployment_attestations.commercial_delete;assert.equal(await f.verifier.available(f.input),false);
});
for(const operation of API.OPERATIONS)test('signed fictional '+operation+' verifies only bounded metadata and revalidates without writes',async()=>{
 const f=await fixture(),before=structuredClone(f.state);f.reads.length=0;
 const proof=await f.verifier.verify({...f.input,operation});assert.equal(proof?.verified,true);assert.equal(proof.remoteRulesRead,false);
 assert.equal(f.reads.length,13);assert(f.reads.every(([,path])=>!path.startsWith('sisventas/')));
 assert.equal((await f.verifier.assertCurrent({proof,readFresh:f.input.read,runtime:f.runtime})).verified,true);assert.deepEqual(f.state,before);assert.equal(f.commits.length,0);
});
for(const field of ['publicKey','pins'])test('missing '+field+' is OFF without reads',async()=>{const f=await fixture(),options={publicKey:f.publicKey,pins:f.pins};delete options[field];f.reads.length=0;assert.equal(await API.createVerifier(options).verify(f.input),null);assert.equal(f.reads.length,0);});
for(const field of ['rulesSha256','artifactSha256','sourceSha256','manifestSha256','activationId','pinsSha256','signature','issuedAt'])test('changed signed marker '+field+' stays OFF',async()=>{
 const f=await fixture();apply(f.state,{[API.PATH+'/'+field]:field==='issuedAt'?1001:'changed'});assert.equal(await f.verifier.available(f.input),false);
});
for(const path of ['sv_labor_config/ready','sv_operational_read_config/ready','sv_commercial_pages_config/ready','sv_client_accounts_config/ready','sv_client_history_config/ready','sv_commercial_pages/v1/coverage/ready','sv_client_accounts/v1/coverage/all/ready','sv_client_history/v1/state/ready','sv_labor_indexes/paymentRefs_v1/coverage/ready','sv_sale_financial_dependencies/v1/coverage/ready'])test('revoked '+path+' rejects existing proof at final validation',async()=>{
 const f=await fixture(),proof=await f.verifier.verify(f.input);assert(proof);apply(f.state,{[path]:false});
 await assert.rejects(f.verifier.assertCurrent({proof,readFresh:f.input.read,runtime:f.runtime}),{code:'SV_COMMERCIAL_DELETE_ATTESTATION_REQUIRED'});
});
test('marker revocation inside a real guard prevents commit',async()=>{
 const f=await fixture(),proof=await f.verifier.verify(f.input),before=structuredClone(f.state.sisventas);
 await assert.rejects(f.guard.run({uid:'u',claims:{uid:'u'},mode:'user',opId:'attestation-revoked-fixture',operation:'proof-only'},async scope=>{
  await f.verifier.assertCurrent({proof,readFresh:scope.get,runtime:f.runtime});
  scope.beforeCommit(async({readFresh})=>{apply(f.state,{[API.PATH]:null});await f.verifier.assertCurrent({proof,readFresh,runtime:f.runtime});});
  await scope.update({'sisventas/ventas/s':null});
 }),{code:'SV_COMMERCIAL_DELETE_ATTESTATION_REQUIRED'});
 assert.equal(f.commits.length,0);assert.deepEqual(f.state.sisventas,before);
});
test('reader errors, changing marker mid-read and forged proof fail closed',async()=>{
 const f=await fixture(),proof=await f.verifier.verify(f.input);
 assert.equal(await f.verifier.verify({...f.input,read:async()=>{throw Error('offline');}}),null);
 await assert.rejects(f.verifier.assertCurrent({proof:{...proof},readFresh:f.input.read,runtime:f.runtime}));
 let count=0;assert.equal(await f.verifier.verify({...f.input,read:async path=>{if(path===API.PATH&&++count===2)return null;return f.input.read(path);}}),null);
});
for(const field of ['coordinated','clientAccounts','clientHistory','commercialPages','saleFinancialDependencies','operationalSummaries','readOnly'])test('runtime prerequisite '+field+' cannot be supplied by an attestation',async()=>{
 const f=await fixture();f.runtime[field]=field==='readOnly';f.reads.length=0;assert.equal(await f.verifier.available(f.input),false);assert.equal(f.reads.length,0);
});
for(const path of ['sv_operational_read_config/generation','sv_commercial_pages/v1/coverage/generation','sv_client_accounts/v1/coverage/all/generation','sv_client_history/v1/state/generation','sv_labor_indexes/paymentRefs_v1/coverage/generation','sv_sale_financial_dependencies/v1/coverage/generation','sv_client_history_config/writerSchema','sv_client_accounts_config/writerMode','sv_client_history/v1/state/dependencyManifest'])test('generation/protocol drift '+path+' is OFF',async()=>{
 const f=await fixture();apply(f.state,{[path]:'changed'});assert.equal(await f.verifier.available(f.input),false);
});
test('manifest completeness and shared projection inputs are required before pin preparation',async()=>{
 const f=await fixture();f.manifest.operations[0].fences.pop();assert.throws(()=>Inputs.prepare({manifest:f.manifest,activationId:'cut',operationalGeneration:'op'}));
 const g=await fixture();g.manifest.operations[1].projections[0].generation='different';assert.throws(()=>Inputs.prepare({manifest:g.manifest,activationId:'cut',operationalGeneration:'op'}));
});
for(const [path,value] of Object.entries({'sv_commercial_pages/v1/coverage/sales':null,'sv_client_accounts/v1/coverage/all/ownerManifest':0,'sv_client_accounts/v1/coverage/all/ownerEvidenceVersion':0,'sv_client_history/v1/coverage/all/equipos':null,'sv_client_history/v1/coverage/all/tickets/ready':false,'sv_client_history/v1/coverage/all/ventas/originalRecords':99,'sv_client_accounts/v1/coverage/all/paymentRecords':99,'sv_sale_financial_dependencies/v1/coverage/unresolved':1,'sv_labor_indexes/paymentRefs_v1/coverage/buildDigest':'bad'}))test('incomplete projection metadata remains OFF: '+path,async()=>{
 const f=await fixture();apply(f.state,{[path]:value});assert.equal(await f.verifier.available(f.input),false);
});
test('stale projection floor, unknown operation and mutable caller pins cannot grant admission',async()=>{
 const f=await fixture();assert.equal(await f.verifier.verify({...f.input,operation:'otherDelete'}),null);
 f.pins.activationId='caller-mutated';assert.equal(await f.verifier.available(f.input),true,'pins were copied at verifier creation');
 apply(f.state,{'sv_commercial_pages/v1/coverage/revision':0});assert.equal(await f.verifier.available(f.input),false);
});
