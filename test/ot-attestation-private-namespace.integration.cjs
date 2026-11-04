'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Harness=require('./helpers/ot-attestation-private-namespace.cjs');
const port=Number(process.env.SV_ATTESTATION_QA_PORT),output=process.env.SV_ATTESTATION_QA_OUTPUT;
const parent='sv_deployment_attestations',marker=parent+'/ot_delivery';
test('composed attestation namespace denies application sessions and forged service claims',{skip:!port,timeout:120000},async t=>{
 const candidate=Harness.compose(),f=await Harness.open(candidate,{port}),results=[];
 const proof={schema:1,activationId:'fictitious-only',rulesSha256:candidate.evidence.candidateSha256,signature:'not-a-real-signature',issuedAt:1,expiresAt:2},seed={sv_chat_roles:{admin_fixture:{rol:'admin',activo:true},tech_fixture:{rol:'tecnico',activo:true}},sv_permisos:{admin:{indiceVersion:2,indiceRevision:7,indiceModulos:{configuracion:true,ordentrabajo:true}},tecnico:{indiceVersion:2,indiceRevision:7,indiceModulos:{ordentrabajo:true}}},sv_labor_config:{schema:1,ready:true,writerSchema:2,otDeliveryVersion:1},[parent]:{ot_delivery:proof,sibling:{sentinel:'preserve-fictitious'}}};
 const fake={admin:true,svLaborService:true,svLaborWriterSchema:2,svOTLifecycleVersion:1,svOTLifecycleKind:'delivery',svOTLifecycleRole:'admin',svOTLifecyclePermissionRevision:7,svOTLifecycleOTKey:'fake-ot',svOTDeliveryCommitVersion:1,svOTDeliveryUnchanged:true,svOTDeliveryHistoricalVerified:true,mode:'commit',fence:'fake-fence',opId:'fake-operation',actorUid:'admin_fixture'};
 const identities=[['administrator','admin_fixture',{}],['administrator forged service','admin_fixture',fake],['technician','tech_fixture',{}],['technician forged service','tech_fixture',{...fake,svOTLifecycleRole:'tecnico',actorUid:'tech_fixture'}],['anonymous',null,null],['service-looking uid forged claims','sv-labor-service',fake]];
 async function owner(fn){let result;await f.environment.withSecurityRulesDisabled(async ctx=>{result=await fn(ctx.database());});return result;}
 async function denied(name,operation){try{await operation();results.push({name,result:'UNEXPECTED_ALLOW'});assert.fail('Application authority exposed private attestation: '+name);}catch(error){if(error.code!=='PERMISSION_DENIED'&&error.code!=='permission-denied'&&!/^Permission denied$/i.test(error.message||''))throw error;results.push({name,result:'PERMISSION_DENIED',sdkError:error.code||error.message});}}
 try{
  await owner(db=>f.sdk.set(f.sdk.ref(db),seed));assert.deepEqual(await owner(async db=>(await f.sdk.get(f.sdk.ref(db,marker))).val()),proof,'Only disabled-rules fixture owner creates/reads its marker');
  for(const [name,uid,claims]of identities){const db=(uid?f.environment.authenticatedContext(uid,claims):f.environment.unauthenticatedContext()).database();
   for(const target of [parent,marker,marker+'/signature'])for(const method of ['read','replace','update','delete'])await t.test(name+' '+method+' '+target,async()=>{
    const r=f.sdk.ref(db,target),replacement=target===parent?{ot_delivery:{schema:999}}:target===marker?{schema:999}:'forged';
    const actions={read:()=>f.sdk.get(r),replace:()=>f.sdk.set(r,replacement),update:()=>f.sdk.update(r,target.endsWith('/signature')?{nested:'forged'}:{signature:'forged'}),delete:()=>f.sdk.remove(r)};await denied(name+' '+method+' '+target,actions[method]);
   });
   await t.test(name+' root read',()=>denied(name+' root read',()=>f.sdk.get(f.sdk.ref(db))));
   await t.test(name+' root multipath marker overwrite',()=>denied(name+' root multipath',()=>f.sdk.update(f.sdk.ref(db),{[marker]:{schema:999},[parent+'/sibling']:null})));
  }
  assert.deepEqual(await owner(async db=>(await f.sdk.get(f.sdk.ref(db,parent))).val()),seed[parent],'All rejected attempts preserve marker and sibling');
  await owner(db=>f.sdk.update(f.sdk.ref(db,marker),{fixtureOwnerCheck:true}));assert.equal(await owner(async db=>(await f.sdk.get(f.sdk.ref(db,marker+'/fixtureOwnerCheck'))).val()),true,'Disabled-rules owner remains a positive control, not an application capability');
  candidate.assertFrozen();assert.equal(results.length,84);assert(results.every(r=>r.result==='PERMISSION_DENIED'));
  if(output){assert(path.isAbsolute(output));fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'attestation-namespace-matrix.json'),JSON.stringify({...f.evidence,buildersFrozenBeforeAndAfter:true,results,ownerControls:'seed/read/update succeeded only withSecurityRulesDisabled in this new demo namespace',scopeLimit:'Not production rules, authentic service signing, expiry/TTL, or deployment acceptance'},null,2));}
 }finally{try{candidate.assertFrozen();}finally{await f.environment.cleanup();}}
});
