'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const BASE_IMAGE_DIGEST='sha256:813a22a1b2614280109ddecd2320c5ac9a768963c8cc2cf80bc6e00f52ef813b';
const FILES=Object.freeze({
 'index.js':'bff5551748755a7ea7370b6c213dca89d9ba817419269c468a7a8a3de8efbb0c',
 'tecnoprices-login.js':'61de81562c642a3481eab004dbe328242779642961855263acda5c9e96b9c322',
 'budget-presentation-trial.js':'6559e9588a4c484afd45e9de5b36881a1d5271dff03b362f49104b2e6a4a29eb',
 'budget-presentation-trial-model.js':'2c817da2d3b1fd5909eff3b60de92adbff978bddce9536eac7a7394681b8dd5e'
});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function files(root){
 for(const [file,expected]of Object.entries(FILES)){const bytes=fs.readFileSync(path.join(root,file));assert.equal(sha(bytes),expected,'Unexpected artifact: '+file);new(require('node:vm').Script)(bytes.toString('utf8'),{filename:file});}
 const patch=require(path.join(path.resolve(root),'tecnoprices-overlay-attach.cjs'));
 const original=patch.revert(fs.readFileSync(path.join(root,'index.js'),'utf8'));
 assert.equal(sha(original),'c20743a481d1c51fed8e1631aec015ca12f4cf7ed10dc914015d57e3b652c9eb');
 const helper=fs.readFileSync(path.join(root,'tecnoprices-login.js'));patch.verifyHelper(helper);
 return {scope:'filesystem-contract-only',files:Object.keys(FILES).length,exactReversal:true,containerExecutionProven:false};
}
function imageConfig(base,combined){
 assert(base.RepoDigests?.some(value=>value.endsWith('@'+BASE_IMAGE_DIGEST)),'Base image must exist locally by its exact repository digest');
 assert(base.Config&&combined.Config,'Missing image configuration');
 const keys=['Env','Entrypoint','Cmd','User','WorkingDir','ExposedPorts','Volumes','Healthcheck','StopSignal','Shell'];
 for(const key of keys)assert.deepEqual(combined.Config[key],base.Config[key],'Image configuration changed: '+key);
 return {scope:'image-config-only',baseDigest:BASE_IMAGE_DIGEST,unchanged:keys,serviceResourcesVerified:false};
}
async function authorization(root){
 const api=require(path.join(path.resolve(root),'budget-presentation-trial.js')).create({model:{},auth:{verifyIdToken:async()=>{throw Error('fictional revoked token');}},db:{ref(){throw Error('No reads permitted in unauthenticated checks');}}});
 await assert.rejects(api.authorize({headers:{}}),{statusCode:401});
 await assert.rejects(api.authorize({headers:{authorization:'Bearer fictitious-invalid'}}),{statusCode:401});
 return{unauthenticated:401,revokedToken:401,realAuthUsed:false};
}
if(require.main===module)(async()=>{
 const mode=process.argv[2];
 if(mode==='files'||mode==='container'){const root=process.argv[3];assert(root,'Expected filesystem root');const result={...files(root),authorization:await authorization(root)};
  if(mode==='container'){const load=require('node:module').createRequire(path.join(path.resolve(root),'index.js'));assert.equal(typeof load('playwright').request.newContext,'function');result.runtime={node:process.versions.node,playwright:load('playwright/package.json').version,apiRequestFactory:true};result.scope='container-invocation-contract';result.containerExecutionProven=false;}
  process.stdout.write(JSON.stringify(result)+'\n');}
 else if(mode==='config'){const read=file=>{const value=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(value)?value[0]:value;};process.stdout.write(JSON.stringify(imageConfig(read(process.argv[3]),read(process.argv[4])))+'\n');}
 else throw Error('Expected files/container ROOT or config BASE_INSPECT_FILE COMBINED_INSPECT_FILE');
})().catch(()=>{process.stderr.write('Container contract failed; private source/config values withheld.\n');process.exitCode=1;});
module.exports={FILES,BASE_IMAGE_DIGEST,files,imageConfig,authorization};
