'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('./helpers/commercial-delete-atomic-fixture.cjs'),{apply}=require('./helpers/labor-ui-flow.cjs');
const M=require('../cotizador/payment-membership-index'),Protocol=require('../cotizador/commercial-delete-commit-protocol');
const fields=Protocol.membershipFields,coverage=M.COVERAGE_PATH;
async function fixture(){const f=await require('./helpers/commercial-delete-attestation-fixture.cjs').fixture({ventas:{s:{id:'V-FICTIONAL',total:100,subtotal:100,fecha:'2026-11-01',clienteFbKey:'c',responsableUid:'u'}},pagos:{p:{ventaFbKey:'s',clienteFbKey:'c',responsableUid:'u',monto:20,fecha:'2026-11-01'}}});return{...f,rules:require('../scripts/lib/commercial-delete-atomic-rules.cjs').prepare(F.baseline(),{pins:f.pins}),protocol:Protocol.create({verifier:f.verifier,pins:f.pins})};}
function checksum(c){return M.digest({schema:c.schema,matcherHash:c.matcherHash,paymentCount:c.paymentCount,membershipCount:c.membershipCount,relationAccumulator:c.relationAccumulator});}
function changed(c,field){const out=structuredClone(c);out[field]=typeof out[field]==='number'?out[field]+1:(out[field]==='f'.repeat(64)?'e':'f').repeat(64);return out;}
async function exercise({beforeField,afterField,claimPhase,claimField,wholePhase,inheritedPhase,swap=false,staleAfter=false,validReplacement,invalidAfter=false,shape='whole',poison=false,success=false,replay=false}={}){
 const f=await fixture(),proof=await f.verifier.verify(f.input);assert(proof);const originalCoverage=f.get(coverage),business=structuredClone(f.state.sisventas),raw=f.store.commit;let derived=0,decisions=0,emitted;
 const incoming={uid:'u'};if(poison){for(const phase of ['Before','After']){const values={...Object.fromEntries(Object.keys(fields).map(name=>[name,'FICTITIOUS_UNTRUSTED'])),Unknown:'FICTITIOUS_UNTRUSTED'};incoming[Protocol.PREFIX+'Membership'+phase]=poison==='inherited'?Object.create(values):poison==='json-prototype'?JSON.parse(JSON.stringify({...values,['__proto__']:{Sequence:'FICTITIOUS_UNTRUSTED',Polluted:true}})):values;}incoming[Protocol.PREFIX+'MembershipBeforeUnknown']='FICTITIOUS_UNTRUSTED';}
 const actor={uid:'u',claims:incoming,mode:'user',role:'admin',permissionRevision:1,opId:'independent-membership-binding',operation:'sale-delete',input:{ventaKey:'s'}};
 f.store.commit=async(patch,lease,actualActor)=>{
  assert(f.get('sv_labor_guard'));let commit=structuredClone(patch);assert(Object.hasOwn(commit,coverage),'real guard generates the membership coverage delta');let expectedAfter=structuredClone(commit[coverage]);M.validateCoverage(expectedAfter);
  if(invalidAfter){commit[coverage].buildDigest='f'.repeat(64);}
  if(shape==='leaves'){delete commit[coverage];for(const [k,v]of Object.entries(expectedAfter))commit[coverage+'/'+k]=v;}
  if(shape==='ancestor'){const root=M.INDEX_ROOT,initial=f.get(root);for(const [p,v]of Object.entries(commit))if(p.startsWith(root+'/')){apply(initial,{[p.slice(root.length+1)]:v});delete commit[p];}commit[root]=initial;}
  const claims=await f.protocol.claims({patch:commit,lease,actor:actualActor,proof,readFresh:f.input.read,runtime:f.runtime});derived++;emitted=structuredClone(claims);const reads=f.reads.length;
  for(const phase of ['Before','After']){const tuple=claims[Protocol.PREFIX+'Membership'+phase];assert.deepEqual(Object.keys(tuple).sort(),Object.keys(fields).sort());assert([Object.prototype,null].includes(Object.getPrototypeOf(tuple)));for(const [name,field]of Object.entries(fields)){assert(Object.hasOwn(tuple,name),'only owned derived fields are trusted');assert.equal(tuple[name],(phase==='Before'?originalCoverage:expectedAfter)[field]);}}
  assert.notEqual(claims.svCommercialDeleteMembershipBefore.Digest,claims.svCommercialDeleteMembershipAfter.Digest);assert(claims.svCommercialDeleteMembershipAfter.Sequence>claims.svCommercialDeleteMembershipBefore.Sequence);
  if(poison){assert.equal(claims.svCommercialDeleteMembershipBeforeUnknown,null);for(const phase of ['Before','After']){assert.equal(Object.hasOwn(claims[Protocol.PREFIX+'Membership'+phase],'Unknown'),false);assert.equal(Object.hasOwn(claims[Protocol.PREFIX+'Membership'+phase],'__proto__'),false);assert.equal(claims[Protocol.PREFIX+'Membership'+phase].Polluted,undefined);}}
  if(beforeField)apply(f.state,{[coverage]:changed(originalCoverage,beforeField)});
  if(afterField)commit[coverage]=changed(expectedAfter,afterField);
  if(validReplacement){const changedTuple=structuredClone(validReplacement==='before'?originalCoverage:expectedAfter);changedTuple.relationAccumulator='b'.repeat(64);changedTuple.buildDigest=checksum(changedTuple);M.validateCoverage(changedTuple);if(validReplacement==='before')apply(f.state,{[coverage]:changedTuple});else commit[coverage]=changedTuple;}
  if(claimField){const tuple=claims[Protocol.PREFIX+'Membership'+claimPhase];tuple[claimField]=typeof tuple[claimField]==='number'?tuple[claimField]+1:'f'.repeat(64);}
  if(swap){const b=Protocol.PREFIX+'MembershipBefore',a=Protocol.PREFIX+'MembershipAfter';[claims[b],claims[a]]=[claims[a],claims[b]];}
  if(staleAfter)claims[Protocol.PREFIX+'MembershipAfter']=structuredClone(claims[Protocol.PREFIX+'MembershipBefore']);
  if(wholePhase){const key=Protocol.PREFIX+'Membership'+wholePhase;claims[key]={Sequence:claims[key].Sequence};}
  if(inheritedPhase){const key=Protocol.PREFIX+'Membership'+inheritedPhase;claims[key]=Object.create(claims[key]);}
  decisions++;const allowed=F.checkCommit(f,commit,lease,actualActor,JSON.parse(JSON.stringify(claims)));assert.equal(f.reads.length,reads,'no fresh GET masks tuple substitution after derived claims');if(!allowed)throw Object.assign(Error('Atomic tuple binding rejected'),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});return raw(commit,lease,actualActor);
 };
 const invoke=()=>f.guard.run(actor,async scope=>{await f.verifier.assertCurrent({proof,readFresh:scope.get,runtime:f.runtime});scope.beforeCommit(({readFresh})=>f.verifier.assertCurrent({proof,readFresh,runtime:f.runtime}));await scope.update({'sisventas/ventas/s':null,'sisventas/pagos/p':null});return{committed:true};});
 if(success){const result=await invoke();assert.equal(f.commits.length,1);assert.equal(derived,1);assert.equal(decisions,1);M.validateCoverage(f.get(coverage));assert.equal(f.get(coverage).paymentCount,0);assert.equal(f.get('sisventas/ventas/s'),null);assert.equal(f.get('sisventas/pagos/p'),null);assert(await f.verifier.verify(f.input));if(replay){const state=structuredClone(f.state);assert.deepEqual(await invoke(),result);assert.equal(f.commits.length,1);assert.equal(derived,1);assert.deepEqual(f.state,state);}}
 else{await assert.rejects(invoke,{code:invalidAfter?'SV_PAYMENT_INDEX_INVALID':'SV_LABOR_COMMIT_UNCONFIRMED'});assert.equal(f.commits.length,0);assert.deepEqual(f.state.sisventas,business);assert.equal(f.get('sv_labor_receipts/'+actor.opId),null);assert.equal(derived,invalidAfter?0:1);assert.equal(decisions,invalidAfter?0:1);}
 assert.equal(f.get('sv_labor_guard'),null);return emitted;
}
for(const [name,field]of Object.entries(fields)){
 test('post-claim before snapshot field substitution is rejected '+name,()=>exercise({beforeField:field}));
 test('post-claim after PATCH field substitution is rejected '+name,()=>exercise({afterField:field}));
 for(const claimPhase of ['Before','After'])test('forged derived '+claimPhase+' claim cannot substitute '+name,()=>exercise({claimPhase,claimField:name}));
}
for(const phase of ['before','after'])test('canonically valid replacement tuple with recomputed digest still must match captured '+phase+' claims',()=>exercise({validReplacement:phase}));
test('swapping or replacing whole nested tuple objects never trusts missing or inherited bindings',async()=>{await exercise({swap:true});for(const phase of ['Before','After']){await exercise({wholePhase:phase});await exercise({inheritedPhase:phase});}});
test('valid after tuple cannot be authorized using the before claims',()=>exercise({staleAfter:true}));
test('protocol rejects invalid after checksum before emitting any claims',()=>exercise({invalidAfter:true}));
for(const shape of ['whole','leaves','ancestor'])test('legitimate independently validated before/after tuple succeeds '+shape,()=>exercise({shape,success:true,replay:true}));
test('incoming forged unknown and prototype-backed tuple maps are neutralized by real derivation',async()=>{for(const poison of [true,'inherited','json-prototype'])await exercise({poison,success:true,replay:true});});
