'use strict';
// Offline preflight only. No credentials, compression, network or writes.
const path=require('node:path');
const {files,config}=require('./deploy-secure-hosting.cjs');
const {loadVerifiedRawArtifact}=require('./lib/hosting-raw-contract.cjs');
const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:'';};
try {
 const buffers=loadVerifiedRawArtifact({root:arg('--raw-root')||path.resolve(__dirname,'..'),names:files(),config,
  manifestPath:arg('--raw-manifest'),expectedManifestSha256:arg('--expected-raw-manifest-sha256'),sourceCommit:arg('--expected-raw-source-commit')});
 console.log(JSON.stringify({rawVerified:true,files:buffers.size,bytes:[...buffers.values()].reduce((n,b)=>n+b.length,0),remoteApplied:false,activationAuthorized:false}));
} catch(e) { console.error(e.message);process.exitCode=1; }
