'use strict';
// Deliberate opt-in red baseline: real guard/protocol/commit, atomic Snapshot
// evaluator from reviewed fixture. No emulator, remote rules, readiness or IO.
const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('./helpers/commercial-delete-atomic-fixture.cjs'),{apply}=require('./helpers/labor-ui-flow.cjs'),{digest}=require('../cotizador/labor-guard');
const Membership=require('../cotizador/payment-membership-index'),Financial=require('../cotizador/sale-financial-dependencies-model');
// Frozen red source: ffe013326eaafdd35c4e7ff22f7902f2151f61dd.
const enabled=process.env.SV_DELETE_AUTHORITY_PARITY_QA==='1';
const history='sv_client_history/v1/coverage/all',accounts='sv_client_accounts/v1/coverage/all',pages='sv_commercial_pages/v1/coverage';
const cases=[
 ['history-ready',history+'/ventas/ready',false],['history-schema',history+'/ventas/schema',0],['history-generation',history+'/ventas/generation','revoked-generation'],['history-revision',history+'/ventas/revision',999],
 ['history-records-negative',history+'/ventas/records',-1],['history-original-negative',history+'/ventas/originalRecords',-1],['history-unlinked-negative',history+'/ventas/unlinkedRecords',-1],['history-sales-count-mismatch',history+'/ventas/originalRecords',99],['history-payments-count-mismatch',history+'/pagos/originalRecords',99],
 ['owner-manifest',accounts+'/ownerManifest',0],['owner-evidence',accounts+'/ownerEvidenceVersion',0],['account-sales-count-mismatch',accounts+'/salesRecords',99],['account-payment-count-mismatch',accounts+'/paymentRecords',99],
 ['membership-matcher',Membership.COVERAGE_PATH+'/matcherHash','f'.repeat(64)],['membership-digest',Membership.COVERAGE_PATH+'/buildDigest','f'.repeat(64)],['membership-payment-count',Membership.COVERAGE_PATH+'/paymentCount',99],['membership-too-many-relations',Membership.COVERAGE_PATH+'/membershipCount',99],
 ['financial-source-format',Financial.ROOT+'/coverage/sources/gastos','invalid'],['financial-negative-count',Financial.ROOT+'/coverage/counts/gastos',-1],['pages-negative-sales',pages+'/sales',-1],['pages-negative-payments',pages+'/payments',-1]
];
const configPaths=['sv_labor_config','sv_operational_read_config','sv_commercial_pages_config','sv_client_accounts_config','sv_client_history_config'];
const configDigest=f=>digest(configPaths.map(p=>f.get(p)));
const get=(root,path)=>path.split('/').reduce((v,k)=>v?.[k],root)??null;
function revoke(f,sample){apply(f.state,{[sample[1]]:sample[2]});if(['membership-matcher','membership-payment-count','membership-too-many-relations'].includes(sample[0])){const c=f.get(Membership.COVERAGE_PATH),image={schema:c.schema,matcherHash:c.matcherHash,paymentCount:c.paymentCount,membershipCount:c.membershipCount,relationAccumulator:c.relationAccumulator};apply(f.state,{[Membership.COVERAGE_PATH+'/buildDigest']:Membership.digest(image)});assert.equal(f.get(Membership.COVERAGE_PATH+'/buildDigest'),Membership.digest(image),'matcher/count mutations retain a consistent coverage checksum');}}
function checkCommit(f,...args){const exact=f.rules;f.rules=structuredClone(exact);function adapt(node){for(const [k,v]of Object.entries(node))if(typeof v==='string')node[k]=v.replaceAll('.matches(','.match(');else if(v&&typeof v==='object')adapt(v);}adapt(f.rules);try{return F.checkCommit(f,...args);}finally{f.rules=exact;}}
// Rules String.matches is mapped to JS String.match only inside this evaluator.
async function makeFixture(withPayment){if(!withPayment)return F.create();const f=await require('./helpers/commercial-delete-attestation-fixture.cjs').fixture({ventas:{s:{id:'V-FICTIONAL',total:100,subtotal:100,fecha:'2026-11-01',clienteFbKey:'c',responsableUid:'u'}},pagos:{p:{ventaFbKey:'s',clienteFbKey:'c',responsableUid:'u',monto:20,fecha:'2026-11-01'}}});return{...f,rules:require('../scripts/lib/commercial-delete-atomic-rules.cjs').prepare(F.baseline(),{pins:f.pins}),protocol:require('../cotizador/commercial-delete-commit-protocol').create({verifier:f.verifier,pins:f.pins})};}
async function run({sample,when='after',shouldReject=true,withPayment=false}={}){
 const f=await makeFixture(withPayment),proof=await f.verifier.verify(f.input);assert(proof,'valid signed fixture required');
 const business=structuredClone(f.state.sisventas),cfg=configDigest(f),rawCommit=f.store.commit;const beforeHistory=structuredClone(f.get('sv_client_history/v1')),beforeMembership=f.get(Membership.COVERAGE_PATH);let derived=0,atomicAllowed=null,verifierAcceptsSnapshot=null,claimsVersion=null;
 f.store.commit=async(patch,lease,actor)=>{
  assert(f.get('sv_labor_guard'),'actual lease held at entry commit');
  if(sample&&when==='before')revoke(f,sample);
  const claims=await f.protocol.claims({patch,lease,actor,proof,readFresh:f.input.read,runtime:f.runtime});derived++;claimsVersion=claims.svCommercialDeleteVersion;assert.equal(claimsVersion,1);
  const readsAtDerivation=f.reads.length;if(sample&&when==='after')revoke(f,sample);
  if(sample&&sample[1].startsWith('sv_operational_read_config')===false)assert.equal(configDigest(f),cfg,'global configuration remains identical');
  // An immutable copy at the PATCH frontier supplies diagnostic verifier reads;
  // it performs no store GET and cannot narrow the demonstrated race window.
  const atomicBefore=structuredClone(f.state);verifierAcceptsSnapshot=!!await f.verifier.verify({...f.input,read:async p=>structuredClone(get(atomicBefore,p))});
  atomicAllowed=checkCommit(f,patch,lease,actor,claims);assert.equal(f.reads.length,readsAtDerivation,'no store GET after claims and before atomic evaluation');
  if(!atomicAllowed)throw Object.assign(Error('Atomic authority rejected'),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});
  const result=await rawCommit(patch,lease,actor);assert.equal(f.reads.length,readsAtDerivation,'no store GET hides the claim-to-PATCH window');return result;
 };
 const outcome=await f.guard.run({uid:'u',claims:{uid:'u'},mode:'user',role:'admin',permissionRevision:1,opId:'independent-authority-parity',operation:'sale-delete',input:{ventaKey:'s'}},async scope=>{
  await f.verifier.assertCurrent({proof,readFresh:scope.get,runtime:f.runtime});scope.beforeCommit(({readFresh})=>f.verifier.assertCurrent({proof,readFresh,runtime:f.runtime}));await scope.update({'sisventas/ventas/s':null,...(withPayment?{'sisventas/pagos/p':null}:{})});return{committed:true};
 }).then(value=>({value}),error=>({error:error.code||error.message}));
 const info={scenario:sample?.[0]||'unchanged',when,path:sample?.[1],derived,claimsVersion,verifierAcceptsSnapshot,atomicAllowed,outcome,commits:f.commits.length,configUnchanged:configDigest(f)===cfg,saleExists:!!f.get('sisventas/ventas/s')};console.log(JSON.stringify(info));
 if(shouldReject){assert.equal(f.commits.length,0,'revoked metadata must reject at the atomic commit frontier');assert.deepEqual(f.state.sisventas,business);assert.equal(f.get('sv_labor_receipts/independent-authority-parity'),null);assert.equal(f.get('sv_labor_guard'),null);assert(outcome.error);if(when==='before'){assert.equal(derived,0);assert.equal(outcome.error,'SV_COMMERCIAL_DELETE_ATTESTATION_REQUIRED');}else{assert.equal(derived,1);assert.equal(verifierAcceptsSnapshot,false);assert.equal(atomicAllowed,false);}}
 else{assert.equal(f.commits.length,1);assert.equal(derived,1);assert.equal(verifierAcceptsSnapshot,true);assert.equal(atomicAllowed,true);assert.equal(f.get('sisventas/ventas/s'),null);assert.equal(f.get('sv_labor_guard'),null);assert(f.get('sv_labor_receipts/independent-authority-parity'));}
 return{f,beforeHistory,beforeMembership};
}
for(const sample of cases){
 test('pre-claim verifier excludes revoked metadata '+sample[0],{skip:!enabled},()=>run({sample,when:'before'}));
 test('safe atomic contract excludes post-claim metadata revocation '+sample[0],{skip:!enabled},()=>run({sample,when:'after'}));
}
test('unchanged valid metadata permits real commit with derived claims',{skip:!enabled},()=>run({shouldReject:false}));
test('already protected operational readiness rejects post-claim commit',{skip:!enabled},()=>run({sample:['operational-ready','sv_operational_read_config/ready',false]}));

for(const withPayment of [false,true])test('legitimate commit advances affected revisions and leaves untouched history older '+withPayment,{skip:!enabled},async()=>{const {f,beforeHistory,beforeMembership}=await run({shouldReject:false,withPayment});const state=f.get('sv_client_history/v1/state'),coverage=f.get('sv_client_history/v1/coverage/all');assert(state.revision>beforeHistory.state.revision);assert.equal(coverage.ventas.revision,state.revision);assert.equal(coverage.tickets.revision,beforeHistory.coverage.all.tickets.revision);assert(coverage.tickets.revision<state.revision);if(withPayment){console.log(JSON.stringify({scenario:'payment-positive-coverage',before:beforeHistory.coverage.all,after:coverage}));assert.equal(coverage.pagos.revision,state.revision);const next=f.get(Membership.COVERAGE_PATH);assert(next.sequence>beforeMembership.sequence);assert.notEqual(next.buildDigest,beforeMembership.buildDigest);assert.equal(next.paymentCount,0);}assert(await f.verifier.verify(f.input),'updated real verifier must accept legitimate post-commit coverage');console.log(JSON.stringify({scenario:'legitimate-revision-advance',withPayment,global:state.revision,affected:coverage.ventas.revision,untouched:coverage.tickets.revision,membershipSequence:f.get(Membership.COVERAGE_PATH).sequence}));});
