'use strict';
// Offline composition only; historical baseline stays private and is never fetched.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function compose({source,baselinePath}){
 const load=p=>require(path.join(source,p)),bytes=fs.readFileSync(baselinePath),baseline=JSON.parse(bytes),Pause=load('scripts/lib/sdk-admission-pause-rules.cjs');
 const specs=[['commercial-write-cut-rules.cjs','prepare'],['sdk-admission-pause-rules.cjs','strip'],['ot-lifecycle-rules.cjs','build'],['ot-delivery-fence.cjs','prepare'],['ot-delivery-attestation-rules.cjs','prepare'],['sdk-admission-pause-rules.cjs','prepare']];
 let rules=baseline;const stages=specs.map(([file,method])=>{const p=path.join(source,'scripts/lib',file);rules=require(p)[method](rules);return {file:'scripts/lib/'+file,method,builderSha256:sha(fs.readFileSync(p)),outputSha256:sha(JSON.stringify(rules)),bytes:Buffer.byteLength(JSON.stringify(rules))};});
 const deps=new Set();function visit(file){if(deps.has(file)||!file.startsWith(path.resolve(source)+path.sep))return;deps.add(file);for(const child of require.cache[file]?.children||[])visit(child.filename);}for(const[file]of specs)visit(require.resolve(path.join(source,'scripts/lib',file)));
 return {rules,manifest:{schema:1,source:'67f0418cc2b67618b0b3d89cfed365c2acd352b9',targetVersion:'v3.19.4',baselineKind:'historical-local-rules-only-not-fresh-remote',baselineSha256:sha(bytes),baselineBytes:bytes.length,stages,dependencies:[...deps].sort().map(file=>({file:path.relative(source,file).replaceAll('\\','/'),sha256:sha(fs.readFileSync(file))})),rulesSha256:sha(JSON.stringify(rules)),remoteVerified:false,activationAuthorized:false,candidatePackageProvidedToThisRuleFixture:false,publisherExclusiveProof:false}};
}
module.exports={compose,sha};
