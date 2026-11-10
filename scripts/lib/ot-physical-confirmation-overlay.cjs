'use strict';
// Offline, bounded overlay. No network, credentials, configuration or data reads.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const BASE_IMAGE='southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:bc50e95981c384c37229872fa25119750f0e9ff5048ea327c50f3e74ee56216e';
const BASE_HASHES=Object.freeze({'labor-rtdb-store.js':'cbf2c04490ced159c30c1a1db00d1e9f98b1e384a3168b2bf71f0a5b7e296472','labor-runtime.js':'349f5ac1f508928e74851fc1197d1767f1075eca25bd66ffd869cfa80dec4687'});
const OUTPUT_HASHES=Object.freeze({'labor-rtdb-store.js':'6493cfa2b6c7cadd9c4571d0d77f3327a64629a9569eb8f0c2a296ae9593be49','labor-runtime.js':'3e11e7062cf94d5abf9d79e4b9b8393bc5a30d583af3973124734d2c22ef1710'});
const SOURCES=Object.freeze(['ot-lifecycle.js','ot-lifecycle-model.js','ot-lifecycle-policy.js','ot-delivery.js','ot-delivery-model.js','ot-delivery-commit-protocol.js','ot-delivery-attestation.js','ot-material-state.js','ot-material-rows-model.js','ot-personal-scope.js','ot-physical-confirmation-model.js','ot-stock-consumption-model.js','ot-closed-products.js','commercial-models/commercial-money.v1.js']);
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const STORE_EDITS=[
 ['requestMs=20000}){','requestMs=20000,verifyOTDeliveryFence}){'],
 ["  require('./office-stock-policy').validate(actor,lease,patch);", "  if(actor?.otLifecycle?.kind==='delivery'){const proof=await verifyOTDeliveryFence?.({read});if(proof?.schema!==1||proof.verified!==true||proof.canonicalOT!==true||proof.inventory!==true||!/^[a-f0-9]{64}$/.test(proof.rulesDigest||''))throw fail(503,'Fence de entrega no verificado.','SV_OT_DELIVERY_NOT_READY');}\n  require('./office-stock-policy').validate(actor,lease,patch);"],
 ["  const token=await accessToken(),destination=target('.json');", "  if(actor?.otLifecycle)Object.assign(override.token,await require('./ot-delivery-commit-protocol').claims({patch,lease,actor,read,query:async(path,field,value)=>{const response=await request('GET',path,undefined,{query:{orderBy:field,equalTo:value}});return response.json();}}));\n  const token=await accessToken(),destination=target('.json');"],
 ['const api={read,acquire,commit,abort,exists:', 'const api={read,acquire,commit,abort,verifyOTDeliveryFence:async()=>verifyOTDeliveryFence?.({read})??null,exists:']
];
const RUNTIME_EDITS=[
 [" const store=require('./labor-rtdb-store').createLaborRtdbStore({databaseURL,accessToken,fetchImpl});", " const verifyOTDeliveryFence=require('./ot-delivery-attestation').createVerifier({env:deleteEnvironment});\n const store=require('./labor-rtdb-store').createLaborRtdbStore({databaseURL,accessToken,fetchImpl,verifyOTDeliveryFence});"]
];
function rewrite(source,edits,reverse=false){let result=source;for(const pair of (reverse?edits.slice().reverse():edits)){const [before,after]=reverse?[pair[1],pair[0]]:pair;if(result.split(before).length!==2)throw Error('Ancla de producción no única');result=result.replace(before,after);}return result;}
function transform(name,bytes){
 if(!Buffer.isBuffer(bytes)||!BASE_HASHES[name]||sha(bytes)!==BASE_HASHES[name])throw Error('La fuente base no coincide con la imagen activa: '+name);
 const edits=name==='labor-rtdb-store.js'?STORE_EDITS:RUNTIME_EDITS,source=bytes.toString('utf8'),result=rewrite(source,edits);
 if(rewrite(result,edits,true)!==source)throw Error('La transformación altera código ajeno');
 const output=Buffer.from(result);if(sha(output)!==OUTPUT_HASHES[name])throw Error('La transformación no coincide con el overlay revisado');return output;
}
function sourceHashes(sourceRoot){return Object.fromEntries(SOURCES.map(name=>[name,sha(fs.readFileSync(path.join(sourceRoot,'cotizador',name)))]));}
function plan({store,runtime,sources,expectedSourceHashes}){
 if(!sources||Object.keys(sources).sort().join('|')!==[...SOURCES].sort().join('|')||!expectedSourceHashes||Object.keys(expectedSourceHashes).sort().join('|')!==[...SOURCES].sort().join('|'))throw Error('El alcance debe contener exactamente la familia OT revisada');
 const files={'server/labor-rtdb-store.js':transform('labor-rtdb-store.js',store),'server/labor-runtime.js':transform('labor-runtime.js',runtime)};
 for(const name of SOURCES){const bytes=sources[name];if(!Buffer.isBuffer(bytes)||!bytes.length||!(/^[a-f0-9]{64}$/.test(expectedSourceHashes[name]))||sha(bytes)!==expectedSourceHashes[name])throw Error('La fuente OT cambió: '+name);files['server/'+name]=Buffer.from(bytes);}
 return {files,manifest:{schema:1,kind:'ot-physical-confirmation-minimal-overlay',baseImage:BASE_IMAGE,baseFiles:BASE_HASHES,files:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,sha(bytes)])),preservedFromImage:['index.js','labor-guard.js','labor-db.js','labor-scoped-transaction.js','record-list-model.js','record-list-projections.js','office-stock-policy.js','ot-delete-operational-runtime.js','commercial-models/commercial-money.js'],preservation:{payments:true,permissions:true,commissions:true,officeStock:true,otDelete:true},activation:{ready:false},built:false,deployed:false}};
}
function prepare({sourceRoot,baseDir,outputDir,expectedSourceHashes}){
 if(!outputDir||fs.existsSync(outputDir))throw Error('La carpeta de salida debe ser nueva');
 const sources=Object.fromEntries(SOURCES.map(name=>[name,fs.readFileSync(path.join(sourceRoot,'cotizador',name))]));
 const result=plan({store:fs.readFileSync(path.join(baseDir,'labor-rtdb-store.js')),runtime:fs.readFileSync(path.join(baseDir,'labor-runtime.js')),sources,expectedSourceHashes});
 for(const [name,bytes]of Object.entries(result.files)){const destination=path.join(outputDir,name);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes,{flag:'wx'});}
 const checkBase="const f=require('fs'),c=require('crypto');const expected="+JSON.stringify(BASE_HASHES)+";for(const[n,h]of Object.entries(expected))if(c.createHash('sha256').update(f.readFileSync(n)).digest('hex')!==h)throw Error('Unexpected active image source: '+n);";
 const docker=['FROM '+BASE_IMAGE,'WORKDIR /app','RUN node -e '+JSON.stringify(checkBase),...Object.keys(result.files).map(name=>'COPY '+name+' /app/'+name.slice(7)),...Object.keys(result.files).map(name=>'RUN node --check '+name.slice(7)),"RUN node -e \"require('./ot-lifecycle');require('./ot-delivery');require('./ot-delivery-commit-protocol');require('./ot-physical-confirmation-model');require('./ot-delete-authority');require('./office-stock-policy');\"",''].join('\n');
 fs.writeFileSync(path.join(outputDir,'Dockerfile'),docker,{flag:'wx'});
 fs.writeFileSync(path.join(outputDir,'.gcloudignore'),'*\n!Dockerfile\n!manifest.json\n!server/\n!server/**\n',{flag:'wx'});
 const manifest={...result.manifest,dockerfileSha256:sha(Buffer.from(docker))};fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
module.exports={BASE_IMAGE,BASE_HASHES,OUTPUT_HASHES,SOURCES,sha,transform,sourceHashes,plan,prepare};
