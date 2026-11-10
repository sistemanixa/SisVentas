'use strict';
// Offline COPY-only patch over the exact already-published OT image. No rules,
// server hooks, financial code, build submission or deployment is performed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const BASE_IMAGE='southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:bac6e9652731363b25386e95b1336a352ba5c4b5624972196e3a0c7d9604e1fe';
// The complete seventeen-file manifest of that published overlay, pinned rather
// than trusting current checkout files or a floating registry tag.
const BASE_HASHES=Object.freeze({
  "labor-rtdb-store.js": "6493cfa2b6c7cadd9c4571d0d77f3327a64629a9569eb8f0c2a296ae9593be49",
  "labor-runtime.js": "3e11e7062cf94d5abf9d79e4b9b8393bc5a30d583af3973124734d2c22ef1710",
  "ot-lifecycle.js": "2054fc51e5809e1b309f6cde40da3d1625ba2348951a3b39015d73dc4b759dfa",
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
  "ot-general-consumption-exception.js": "02262a908575e831fafbd920ca7435cd60722d9cf765f5a06783b8cc5ea75e94"
});
const SOURCES=Object.freeze(['ot-lifecycle.js']);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const exact=(value,names)=>value&&Object.keys(value).sort().join('|')===[...names].sort().join('|');
function verifyBase(baseSources){if(!exact(baseSources,Object.keys(BASE_HASHES)))throw Error('La base debe contener exactamente los diecisiete archivos publicados');for(const [name,h]of Object.entries(BASE_HASHES))if(!Buffer.isBuffer(baseSources[name])||sha(baseSources[name])!==h)throw Error('La imagen base publicada cambió: '+name);return true;}
function sourceHashes(sourceRoot){return Object.fromEntries(SOURCES.map(name=>[name,sha(fs.readFileSync(path.join(sourceRoot,'cotizador',name)))]));}
function plan({sources,expectedSourceHashes,baseSources}={}){
 if(!exact(sources,SOURCES)||!exact(expectedSourceHashes,SOURCES))throw Error('El overlay debe contener exactamente una fuentes OT revisadas');if(baseSources!==undefined)verifyBase(baseSources);
 const files={};for(const name of SOURCES){const bytes=sources[name];if(!Buffer.isBuffer(bytes)||!bytes.length||!/^[a-f0-9]{64}$/.test(expectedSourceHashes[name]||'')||sha(bytes)!==expectedSourceHashes[name])throw Error('La fuente OT cambió: '+name);files['server/'+name]=Buffer.from(bytes);}
 return{files,manifest:{schema:1,kind:'ot-scope-read-minimal-overlay',baseImage:BASE_IMAGE,baseFiles:BASE_HASHES,files:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,sha(bytes)])),preservedFromImage:['index.js','labor-guard.js','labor-rtdb-store.js','labor-runtime.js','labor-db.js','labor-scoped-transaction.js','record-list-model.js','record-list-projections.js','office-stock-policy.js','ot-delete-operational-runtime.js','ot-delivery.js','ot-delivery-model.js','ot-delivery-attestation.js','ot-lifecycle-policy.js','commercial-models/commercial-money.js','commercial-models/commercial-money.v1.js'],preservation:{payments:true,permissions:true,commissions:true,officeStock:true,reservations:true,otDelete:true,rules:true,runtime:true,store:true},activation:{ready:false},built:false,deployed:false}};
}
function dockerfile(files){
 if(!exact(files,SOURCES.map(n=>'server/'+n)))throw Error('COPY fuera de las una fuentes OT');
 const check="const f=require('fs'),c=require('crypto'),expected="+JSON.stringify(BASE_HASHES)+";for(const[n,h]of Object.entries(expected))if(c.createHash('sha256').update(f.readFileSync(n)).digest('hex')!==h)throw Error('Unexpected published OT image source: '+n);";
 return['FROM '+BASE_IMAGE,'WORKDIR /app','RUN node -e '+JSON.stringify(check),...Object.keys(files).map(name=>'COPY '+name+' /app/'+name.slice(7)),...Object.keys(files).map(name=>'RUN node --check '+name.slice(7)),"RUN node -e \"require('./ot-lifecycle');require('./ot-general-consumption-exception');require('./ot-material-state');require('./ot-delivery-commit-protocol');require('./ot-physical-confirmation-model');require('./ot-delete-authority');require('./office-stock-policy');\"",''].join('\n');
}
function prepare({sourceRoot,baseDir,outputDir,expectedSourceHashes}={}){
 if(!outputDir||fs.existsSync(outputDir))throw Error('La carpeta de salida debe ser nueva');
 const sources=Object.fromEntries(SOURCES.map(name=>[name,fs.readFileSync(path.join(sourceRoot,'cotizador',name))])),baseSources=baseDir?Object.fromEntries(Object.keys(BASE_HASHES).map(name=>[name,fs.readFileSync(path.join(baseDir,name))])):undefined,result=plan({sources,expectedSourceHashes,baseSources}),docker=dockerfile(result.files);
 for(const [name,bytes]of Object.entries(result.files)){const dest=path.join(outputDir,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'});}
 fs.writeFileSync(path.join(outputDir,'Dockerfile'),docker,{flag:'wx'});fs.writeFileSync(path.join(outputDir,'.gcloudignore'),'*\n!Dockerfile\n!manifest.json\n!server/\n!server/**\n',{flag:'wx'});
 const manifest={...result.manifest,dockerfileSha256:sha(Buffer.from(docker))};fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
module.exports=Object.freeze({BASE_IMAGE,BASE_HASHES,SOURCES,sha,verifyBase,sourceHashes,plan,dockerfile,prepare});
