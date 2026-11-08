'use strict';
// Expected red until the authoritative publisher/config writers share the
// lease, or the commit's rules atomically reject their revoked authority.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/commercial-delete-attestation-fixture.cjs');
const {apply}=require('./helpers/labor-ui-flow.cjs');
const API=require('../cotizador/commercial-delete-attestation');
for(const target of [API.PATH,'sv_operational_read_config/ready'])test('safe contract: authoritative revocation after proof check must exclude commit: '+target,{skip:process.env.SV_DELETE_ATTESTATION_REVOCATION_QA!=='1'},async()=>{
 const f=await fixture(),proof=await f.verifier.verify(f.input);assert(proof);
 const before=structuredClone(f.state.sisventas),commit=f.store.commit;
 f.store.commit=async(...args)=>{
  assert(f.get('sv_labor_guard'),'lease is still held after every final check');
  // Simulated privileged publisher bypass. No SDK or remote rule claim.
  apply(f.state,{[target]:target===API.PATH?null:false});return commit(...args);
 };
 const outcome=await f.guard.run({uid:'u',claims:{uid:'u'},mode:'user',opId:'authority-race-fixture',operation:'proof-only'},async scope=>{
  await f.verifier.assertCurrent({proof,readFresh:scope.get,runtime:f.runtime});
  scope.beforeCommit(({readFresh})=>f.verifier.assertCurrent({proof,readFresh,runtime:f.runtime}));
  await scope.update({'sisventas/ventas/s':null});return {committed:true};
 }).then(value=>({value}),error=>({error:error.code||error.message}));
 console.log(JSON.stringify({target,boundary:'store.commit after assertCurrent',outcome,commits:f.commits.length,saleExists:!!f.get('sisventas/ventas/s')}));
 assert.equal(f.commits.length,0,'safe contract requires authoritative revocation and the business PATCH to share an atomic exclusion');
 assert.deepEqual(f.state.sisventas,before);
});
