'use strict';
// Offline bounded overlay: four direct OT files plus two reversible edits of
// the exact production Pages projector. Never ship the newer checkout projector.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const BASE_IMAGE='southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:31933044ffe6297b5873e29da70940fcb40ce04fc8bf9b62f13b569f72b10266';
const BASE_HASHES=Object.freeze({
  "labor-rtdb-store.js": "6493cfa2b6c7cadd9c4571d0d77f3327a64629a9569eb8f0c2a296ae9593be49",
  "labor-runtime.js": "3e11e7062cf94d5abf9d79e4b9b8393bc5a30d583af3973124734d2c22ef1710",
  "ot-lifecycle.js": "007728ce1f4bb5897e24a3ecd60185fe1c8947bb69669d1e4072e547a9db358e",
  "ot-lifecycle-model.js": "ca915f290c3cee23bed006a14056b94ff1e4bccd2d598364ac734eb252ecbe4f",
  "ot-lifecycle-policy.js": "37359c5297eb9aab9e40179057610c4028ed95967d47211ad4f42916686ed4bb",
  "ot-delivery.js": "29c3becb1fe024a8c3be7b4b15e1007b7a126f3dec4b4cf984555ec705250f6f",
  "ot-delivery-model.js": "d9fc4b0dfa16ac55e70d2538bb0af1c484d1fe8f2a153ca1da6f4102b6a8d6ac",
  "ot-delivery-commit-protocol.js": "1c5af3ca6a8bd8fa97de748d34fe7d65d12ace83b15c4b72bbfd6ff749623b51",
  "ot-delivery-attestation.js": "28dba28bcff7c3196127e7cffde55a465daa5ae30e1fe0493633eea4bc46d1ac",
  "ot-material-state.js": "9185566b7962ace1ebbd89b131ffc8244a9285d7d09732479f2bf3414cc8a818",
  "ot-material-rows-model.js": "71bed377f82b2a3cab62abfc8fe23bfa17f8eb34e3c0b4ed905bf97b655bd8b3",
  "ot-personal-scope.js": "50302e9f2ee05afcd53256c0abb2ec53b7df853fc660b374ab352e36eb21486e",
  "ot-physical-confirmation-model.js": "4b9fa3b989b97aa63c0459dbcfe56370604144c536fc8da6353236f0537a32a5",
  "ot-stock-consumption-model.js": "6351a9c512a9fa4f62c8350c7b397946b6aafd7795aacd32a8ecb882fff43397",
  "ot-closed-products.js": "ee4b9f65cf532f984b1b28e77ce914c821e405d47406c6f4e54d8d00cf0c72f6",
  "commercial-models/commercial-money.v1.js": "8d121746445718ca9b765094a3b6077ac94326785e5d47f92c22e41d73a94461",
  "ot-general-consumption-exception.js": "02262a908575e831fafbd920ca7435cd60722d9cf765f5a06783b8cc5ea75e94",
  "commercial-pages-projections.js": "eb59915240fcf037cd680f74c2488003931497d2b2cee29eefa2fd1de355aecd"
});
const PROJECTION='commercial-pages-projections.js';
const PATCHED_PROJECTION_SHA256='78605e1ad7ebc0b73e3b0f7d928d23af0aa9b2524d9c0319ca05d098cd41edf5';
const SOURCES=Object.freeze(['ot-lifecycle.js','ot-delivery.js','ot-delivery-commit-protocol.js','ot-installation-display-delta.js',PROJECTION]);
const DIRECT_SOURCES=Object.freeze(SOURCES.filter(name=>name!==PROJECTION));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const exact=(value,names)=>value&&Object.keys(value).sort().join('|')===[...names].sort().join('|');
function projectionEdits(source){
 const nl=source.includes('\r\n')?'\r\n':'\n',anchor="const same=(a,b)=>require('./labor-guard').canonical(a)===require('./labor-guard').canonical(b);";
 const metadata="  if(safe){if(changes.length){const revision=coverage.revision+1;if(!Number.isSafeInteger(revision))throw Error('Secuencia comercial agotada.');Object.assign(patch,await M.delta(changes,{read:raw,generation:coverage.generation,revision}));patch[M.ROOT+'/coverage']={...coverage,revision};}return;}";
 return[[anchor,anchor+nl+"const InstallationDisplay=require('./ot-installation-display-delta');"],[metadata,metadata.replace('Object.assign(patch,await M.delta(',"Object.assign(patch,config.nativeCollectionsReady!==true&&InstallationDisplay.plan(changes,M)||await M.delta(")]];
}
function rewrite(source,edits,reverse=false){let out=source;for(const [from,to]of reverse?edits.slice().reverse().map(([a,b])=>[b,a]):edits){if(out.split(from).length!==2)throw Error('La edición de proyección debe tener una única ancla');out=out.replace(from,to);}return out;}
function transformProjection(bytes){
 if(!Buffer.isBuffer(bytes)||sha(bytes)!==BASE_HASHES[PROJECTION])throw Error('La proyección base no coincide con producción');
 const source=bytes.toString('utf8'),edits=projectionEdits(source),out=rewrite(source,edits);
 if(rewrite(out,edits,true)!==source||sha(Buffer.from(out))!==PATCHED_PROJECTION_SHA256)throw Error('La transformación modificó código ajeno');return Buffer.from(out);
}
function verifyBase(baseSources){if(!exact(baseSources,Object.keys(BASE_HASHES)))throw Error('La base debe contener exactamente dieciocho fuentes publicadas');for(const[n,h]of Object.entries(BASE_HASHES))if(!Buffer.isBuffer(baseSources[n])||sha(baseSources[n])!==h)throw Error('La imagen publicada cambió: '+n);return true;}
function sourceHashes(sourceRoot){return Object.fromEntries(SOURCES.map(name=>[name,sha(fs.readFileSync(path.join(sourceRoot,'cotizador',name)))]));}
function plan({sources,expectedSourceHashes,baseProjection,baseSources}={}){
 if(!exact(sources,SOURCES)||!exact(expectedSourceHashes,SOURCES))throw Error('Se requieren exactamente cinco fuentes revisadas');if(baseSources!==undefined)verifyBase(baseSources);
 for(const name of SOURCES)if(!Buffer.isBuffer(sources[name])||!sources[name].length||!/^[a-f0-9]{64}$/.test(expectedSourceHashes[name]||'')||sha(sources[name])!==expectedSourceHashes[name])throw Error('La fuente revisada cambió: '+name);
 const files=Object.fromEntries(DIRECT_SOURCES.map(name=>['server/'+name,Buffer.from(sources[name])])),projection=transformProjection(baseProjection);files['server/'+PROJECTION]=projection;
 return{files,manifest:{schema:1,kind:'ot-latency-minimal-overlay',baseImage:BASE_IMAGE,baseFiles:BASE_HASHES,checkoutSourceHashes:{...expectedSourceHashes},files:Object.fromEntries(Object.entries(files).map(([n,b])=>[n,sha(b)])),intentionalArtifactDifferences:{[PROJECTION]:{baseSha256:BASE_HASHES[PROJECTION],checkoutSha256:expectedSourceHashes[PROJECTION],artifactSha256:sha(projection),edits:2,method:'pinned-production-source-reversible-two-anchor-patch',checkoutCopied:false}},preservedFromImage:['index.js','labor-guard.js','labor-rtdb-store.js','labor-runtime.js','labor-db.js','labor-scoped-transaction.js','record-list-model.js','record-list-projections.js','office-stock-policy.js','ot-delete-operational-runtime.js','commercial-pages-model.js','ot-delivery-model.js','ot-delivery-attestation.js','ot-lifecycle-policy.js','ot-material-state.js','ot-physical-confirmation-model.js','ot-general-consumption-exception.js','commercial-models/commercial-money.v1.js'],preservation:{payments:true,permissions:true,commissions:true,stock:true,reservations:true,otDelete:true,rules:true,runtime:true,store:true,nativeCollectionsNotEnabled:true},activation:{ready:false},built:false,deployed:false}};
}
function dockerfile(files){if(!exact(files,SOURCES.map(n=>'server/'+n)))throw Error('COPY fuera de las cinco fuentes revisadas');const check="const f=require('fs'),c=require('crypto'),expected="+JSON.stringify(BASE_HASHES)+";for(const[n,h]of Object.entries(expected))if(c.createHash('sha256').update(f.readFileSync(n)).digest('hex')!==h)throw Error('Unexpected published image source: '+n);";return['FROM '+BASE_IMAGE,'WORKDIR /app','RUN node -e '+JSON.stringify(check),...Object.keys(files).map(n=>'COPY '+n+' /app/'+n.slice(7)),...Object.keys(files).map(n=>'RUN node --check '+n.slice(7)),"RUN node -e \"require('./ot-lifecycle');require('./ot-delivery');require('./ot-delivery-commit-protocol');require('./ot-installation-display-delta');require('./commercial-pages-projections');require('./ot-delete-authority');require('./office-stock-policy');\"",''].join('\n');}
function prepare({sourceRoot,baseDir,outputDir,expectedSourceHashes}={}){
 if(!outputDir||fs.existsSync(outputDir))throw Error('La carpeta de salida debe ser nueva');if(!baseDir)throw Error('Se requiere la proyección de producción exacta');
 const sources=Object.fromEntries(SOURCES.map(n=>[n,fs.readFileSync(path.join(sourceRoot,'cotizador',n))])),baseSources=Object.fromEntries(Object.keys(BASE_HASHES).map(n=>[n,fs.readFileSync(path.join(baseDir,n))])),r=plan({sources,expectedSourceHashes,baseProjection:baseSources[PROJECTION],baseSources}),docker=dockerfile(r.files);
 for(const[n,b]of Object.entries(r.files)){const dest=path.join(outputDir,n);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b,{flag:'wx'});}
 fs.writeFileSync(path.join(outputDir,'Dockerfile'),docker,{flag:'wx'});fs.writeFileSync(path.join(outputDir,'.gcloudignore'),'*\n!Dockerfile\n!manifest.json\n!server/\n!server/**\n',{flag:'wx'});
 const manifest={...r.manifest,dockerfileSha256:sha(Buffer.from(docker))};fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
module.exports=Object.freeze({BASE_IMAGE,BASE_HASHES,PROJECTION,PATCHED_PROJECTION_SHA256,SOURCES,DIRECT_SOURCES,sha,projectionEdits,rewrite,transformProjection,verifyBase,sourceHashes,plan,dockerfile,prepare});
