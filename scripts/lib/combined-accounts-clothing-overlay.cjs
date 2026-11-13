'use strict';
// Pure build-time composition. No credentials, IO, deployment or data mutations.
const crypto=require('node:crypto'),Accounts=require('./client-account-runtime-overlay.cjs'),Clothing=require('./employee-resources-runtime-overlay.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function derive(options){
 const result=Accounts.deriveNative(options),files={...result.files};
 for(const [name,transform]of [['index.js',Clothing.index],['labor-rtdb-store.js',Clothing.store]])files[name]=Buffer.from(transform(files[name].toString('utf8')));
 const manifest={...result.manifest,kind:'accounts-clothing-native-derived-four',files:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,{...result.manifest.files[name],payloadSha256:sha(bytes),employeeResourcesOverlay:['index.js','labor-rtdb-store.js'].includes(name)}]))};
 return {files,manifest};
}
module.exports=Object.freeze({derive,NAMES:Accounts.NAMES,BASE_HASHES:Accounts.BASE_HASHES,BASE_IMAGE:Accounts.BASE_IMAGE});
