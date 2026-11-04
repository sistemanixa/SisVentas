'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A=require('../cotizador/ot-delivery-attestation'),Cut=require('../scripts/lib/ot-delivery-attestation-cut.cjs'),Rules=require('../scripts/lib/ot-delivery-attestation-rules.cjs');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
async function fixture(){
 const keys=crypto.generateKeyPairSync('ed25519'),publicKey=keys.publicKey.export({format:'pem',type:'spki'}),privateKey=keys.privateKey.export({format:'pem',type:'pkcs8'}),rules=Buffer.from('{"rules":{".read":false,".write":false}}'),artifact=Buffer.from('reviewed fictional deployment artifact'),now=Date.now();
 const reviewed={rulesSha256:hash(rules),artifactSha256:hash(artifact),configGeneration:'delivery-gen-new',activationId:'cut-activation-fictional-2',canonicalOT:true,inventory:true,exclusivePublication:true},config={schema:1,ready:true,generation:reviewed.configGeneration};
 const state={marker:null,proof:{schema:1,activationId:reviewed.activationId,rulesSha256:reviewed.rulesSha256,artifactSha256:reviewed.artifactSha256,configGeneration:reviewed.configGeneration,exclusivePublication:true,sdkAdmissionPaused:true,commercialAdmissionPaused:true,fiscalAdmissionPaused:true,guardEmpty:true,httpDrained:true,fiscalReconciled:true,writersClosed:true,completedSteps:['revoke-marker','pause-and-drain']}};
 let ruleReads=0;const publisher={readMarker:async()=>structuredClone(state.marker),readCutProof:async()=>structuredClone(state.proof),publishMarker(){assert.fail('Offline helper cannot publish');},reopen(){assert.fail('Offline helper cannot reopen');},restore(){assert.fail('Never restore stale marker');}};
 const input={reviewed,reviewedArtifactBytes:artifact,readInstalledRules:async()=>{ruleReads++;return rules;},readOperationalConfig:async()=>config,publisher,privateKey,now},prepared=await Cut.prepare(input);
 const env={OT_DELIVERY_ENABLED:'true',OT_DELIVERY_ATTESTATION_PUBLIC_KEY:publicKey,OT_DELIVERY_EXPECTED_RULES_SHA256:reviewed.rulesSha256,OT_DELIVERY_EXPECTED_GENERATION:reviewed.configGeneration,OT_DELIVERY_EXPECTED_ARTIFACT_SHA256:reviewed.artifactSha256,OT_DELIVERY_ACTIVATION_ID:reviewed.activationId};
 return{publicKey,privateKey,rules,artifact,now,reviewed,config,prepared,input,publisher,state,ruleReads:()=>ruleReads,env};
}
function sign(f,payload){return {...payload,signature:crypto.sign(null,Buffer.from(A.canonical(payload)),f.privateKey).toString('base64url')};}
test('offline prepare requires observed revoked/pause/drain sequence and exact installed rules twice, without publication',async()=>{
 const f=await fixture();assert.equal(f.ruleReads(),2);assert.equal(f.prepared.path,A.PATH);assert.equal(f.prepared.value.schema,2);assert.equal(f.prepared.value.capability,'ot-delivery-v2');assert.equal(f.prepared.value.expiresAt,undefined);assert.equal(f.prepared.publicationAuthorized,false);assert.equal(f.state.marker,null);assert.equal(f.prepared.preconditions.revokeMarkerBeforeAnyRulesOrGenerationChange,true);assert.equal(f.prepared.preconditions.privilegedWritersOutsidePublisherObservable,false);assert(!JSON.stringify(f.prepared).includes('PRIVATE KEY'));
});
test('prepare rejects mismatching rules, artifact, generation, authority and legacy validity options',async()=>{
 const f=await fixture();for(const variation of [{readInstalledRules:async()=>Buffer.from('{}')},{readOperationalConfig:async()=>({...f.config,generation:'old'})},{reviewedArtifactBytes:Buffer.from('other')},{reviewed:{...f.reviewed,exclusivePublication:false}},{validForMs:86400000}])await assert.rejects(Cut.prepare({...f.input,...variation}));
});
for(const field of ['exclusivePublication','sdkAdmissionPaused','commercialAdmissionPaused','fiscalAdmissionPaused','guardEmpty','httpDrained','fiscalReconciled','writersClosed','activationId','rulesSha256','artifactSha256','configGeneration'])test('incomplete publisher proof fails closed: '+field,async()=>{
 const f=await fixture();delete f.state.proof[field];await assert.rejects(Cut.prepare(f.input));assert.equal(f.state.marker,null);
});
test('missing callbacks, unobserved/non-revoked marker and wrong step order cannot prepare',async()=>{
 const f=await fixture();for(const publisher of [undefined,{}, {...f.publisher,readCutProof:undefined},{...f.publisher,readMarker:async()=>undefined},{...f.publisher,readMarker:async()=>f.prepared.value}])await assert.rejects(Cut.prepare({...f.input,publisher}));
 f.state.proof.completedSteps.reverse();await assert.rejects(Cut.prepare(f.input));assert.equal(f.state.marker,null);
});
test('drift or observation failure on final preparation check releases no marker and never restores an old one',async()=>{
 for(const variation of ['proof','rules','generation','marker','error']){
  const f=await fixture();let calls=0;const publisher={...f.publisher,readCutProof:async()=>{if(++calls===2){if(variation==='proof')f.state.proof.httpDrained=false;if(variation==='rules')f.input.readInstalledRules=async()=>Buffer.from('changed');if(variation==='generation')f.config.generation='changed';if(variation==='marker')f.state.marker=f.prepared.value;if(variation==='error')throw Error('Observation failed');}return structuredClone(f.state.proof);}};
  const input={...f.input,publisher,readInstalledRules:()=>f.input.readInstalledRules()};await assert.rejects(Cut.prepare(input));assert.equal(calls,2);
 }
});
test('runtime remains valid after 24 hours and a year, with two fresh reads per verification and stable proof',async()=>{
 const f=await fixture(),reads=[],read=async p=>{reads.push(p);return p===A.PATH?f.prepared.value:f.config;};
 const first=await A.createVerifier({env:f.env,now:()=>f.now+86400001})({read}),later=await A.createVerifier({env:f.env,now:()=>f.now+366*86400000})({read});assert.equal(first.verified,true);assert.equal(first.attestationSchema,2);assert.equal(first.schema,1);assert.equal(first.remoteRulesRead,false);assert.equal(first.verificationKind,'signed-deployment-attestation-v2');assert.deepEqual(first,later);assert.deepEqual(reads,[A.PATH,'sv_operational_read_config',A.PATH,'sv_operational_read_config']);
});
test('artifact byte drift during callback observation cannot release a signature',async()=>{
 const f=await fixture(),bytes=Buffer.from(f.artifact);let calls=0;
 const publisher={...f.publisher,readCutProof:async()=>{if(++calls===2)bytes[0]^=1;return structuredClone(f.state.proof);}};await assert.rejects(Cut.prepare({...f.input,reviewedArtifactBytes:bytes,publisher}),/artifact bytes differ/);assert.equal(f.state.marker,null);
});
test('disabled and malformed enabled flags never read or activate',async()=>{
 const f=await fixture();for(const enabled of ['false','TRUE',true,1,null]){let reads=0;assert.equal(await A.createVerifier({env:{...f.env,OT_DELIVERY_ENABLED:enabled}})({read:async()=>{reads++;return f.prepared.value;}}),null);assert.equal(reads,0);}
});
for(const field of ['OT_DELIVERY_ENABLED','OT_DELIVERY_ATTESTATION_PUBLIC_KEY','OT_DELIVERY_EXPECTED_RULES_SHA256','OT_DELIVERY_EXPECTED_GENERATION','OT_DELIVERY_EXPECTED_ARTIFACT_SHA256','OT_DELIVERY_ACTIVATION_ID'])test('missing deployment environment keeps disabled without reads: '+field,async()=>{
 const f=await fixture(),env={...f.env};delete env[field];let calls=0;assert.equal(await A.createVerifier({env})({read:async()=>{calls++;throw Error('must not read');}}),null);assert.equal(calls,0);
});
for(const variation of ['missing','signature','rules','generation','artifact','activation','future','negativeTime','revoked','readError','unknownField','v1','mixedExpires','missingField','notReady'])test('V2 verifier rejects '+variation,async()=>{
 const f=await fixture(),{signature,...payload}=f.prepared.value;let value={...f.prepared.value};
 if(variation==='signature')value.signature='a'.repeat(86);if(variation==='rules')value=sign(f,{...payload,rulesSha256:'b'.repeat(64)});if(variation==='artifact')value=sign(f,{...payload,artifactSha256:'b'.repeat(64)});if(variation==='activation')value=sign(f,{...payload,activationId:'old-cut'});if(variation==='future')value=sign(f,{...payload,issuedAt:f.now+10000});if(variation==='negativeTime')value=sign(f,{...payload,issuedAt:-1});if(variation==='unknownField')value=sign(f,{...payload,bypass:true});if(variation==='v1')value=sign(f,{...payload,schema:1,capability:'ot-delivery-v1',expiresAt:f.now+86400000});if(variation==='mixedExpires')value=sign(f,{...payload,expiresAt:f.now+86400000});if(variation==='missingField'){delete value.activationId;}
 const result=await A.createVerifier({env:f.env,now:()=>f.now+100})({read:async p=>{if(variation==='readError')throw Error('private failure');if(p===A.PATH)return ['missing','revoked'].includes(variation)?null:value;return {...f.config,generation:variation==='generation'?'old':f.config.generation,ready:variation!=='notReady'};}});assert.equal(result,null);
});
test('post-publication verification requires the exact marker while still paused/drained and never reopens itself',async()=>{
 const f=await fixture(),options={...f.input,prepared:f.prepared,publicKey:f.publicKey};await assert.rejects(Cut.verifyPublished(options));f.state.marker=f.prepared.value;const result=await Cut.verifyPublished(options);assert.equal(result.publicationVerified,true);assert.equal(result.reopenAuthorized,false);assert.equal(result.publicationAuthorized,false);
 f.state.marker={...f.prepared.value,activationId:'other'};await assert.rejects(Cut.verifyPublished(options));f.state.marker=f.prepared.value;f.config.generation='changed';await assert.rejects(Cut.verifyPublished(options));f.config.generation=f.reviewed.configGeneration;f.state.proof.httpDrained=false;await assert.rejects(Cut.verifyPublished(options));
});
test('private namespace authority stays unchanged',()=>{
 const source={rules:{'.read':false,'.write':false,sisventas:{'.read':false,'.write':false}}},before=structuredClone(source),out=Rules.prepare(source);assert.deepEqual(source,before);assert.deepEqual(out.rules.sv_deployment_attestations.ot_delivery,{'.read':false,'.write':false});for(const rules of [{'.read':'auth != null','.write':false},{'.read':false,'.write':false,$any:{'.write':'auth != null'}},{'.read':false,'.write':false,sv_deployment_attestations:{'.write':'auth != null'}}])assert.throws(()=>Rules.prepare({rules}));
});
test('actual runtime/store commit rereads revocation after preflight and sends no second PATCH',async()=>{
 const f=await fixture(),Policy=require('../cotizador/ot-lifecycle-policy'),cfg={indiceVersion:2,indiceRevision:1,indiceModulos:{ordentrabajo:true},acciones:{ot:{entregarMateriales:true}}},profile={rol:'admin',activo:true},requests=[];let marker=f.prepared.value;
 const runtime=require('../cotizador/labor-runtime').createLaborRuntime({db:{ref(){return{};}},databaseURL:'https://fixture.invalid/',accessToken:async()=> 'fictional',enabled:true,commercialPages:true,clientAccounts:true,clientHistory:true,deliveryEnvironment:f.env,fetchImpl:async(url,options)=>{const u=new URL(url);requests.push({path:u.pathname,method:options.method});if(options.method==='PATCH')return new Response('',{status:200});const p=decodeURIComponent(u.pathname).replace(/^\//,'').replace(/\.json$/,'');const values={'sv_operational_read_config':f.config,'sv_chat_roles/u':profile,'sv_permisos/admin':cfg};return new Response(JSON.stringify(p===A.PATH?marker:values[p]??null),{status:200});}});
 assert.equal((await runtime.store.verifyOTDeliveryFence()).verified,true);const context=Policy.authority(profile,cfg,'delivery'),actor={uid:'u',claims:{uid:'u'},mode:'user',role:'admin',operation:'ot-lifecycle',opId:'attestation-command-2',otClosed:false};actor.otLifecycle=Policy.issue({uid:'u',otKey:'ot',saleKey:'s',operationId:actor.opId,kind:'delivery',...context});const lease={actorUid:'u',opId:actor.opId,fence:'fictional',expiresAt:f.now+30000};await runtime.store.commit({},lease,actor);assert.equal(requests.filter(r=>r.method==='PATCH').length,1);marker=null;await assert.rejects(runtime.store.commit({},lease,actor),{code:'SV_OT_DELIVERY_NOT_READY'});assert.equal(requests.filter(r=>r.method==='PATCH').length,1);assert(!requests.some(r=>r.path.includes('.settings')));
});
