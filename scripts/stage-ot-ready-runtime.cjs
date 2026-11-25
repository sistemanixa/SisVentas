'use strict';
// Offline, three-file overlay over the immutable published image. No credentials or network.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Overlay=require('../cotizador/ot-ready-overlay');
const BASE_IMAGE='southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:6b6276dd6b53f3ea745be726e0b277eaabf7d571a44e1948932756303045a01a';
const EXPECTED={'ot-lifecycle.js':'adcbed88fbb31c728f74cd48a11f914e30e8b9e5f003c836fd811f2342f07c06','ot-delivery.js':'ec832de98bd3e7c296dfd9b7142e82c8b64bcefbf329ee04c82b3074f6eafeb0','ot-lifecycle-policy.js':'37359c5297eb9aab9e40179057610c4028ed95967d47211ad4f42916686ed4bb'};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function prepare({runtimeDirectory,output}){
 if(!path.isAbsolute(runtimeDirectory)||!path.isAbsolute(output)||fs.existsSync(output))throw Error('Usá un destino nuevo y rutas absolutas.');
 const changes={};for(const [name,hash]of Object.entries(EXPECTED)){const b=fs.readFileSync(path.join(runtimeDirectory,name));if(sha(b)!==hash)throw Error('La base publicada no coincide: '+name);changes[name]=name==='ot-lifecycle-policy.js'?b:Overlay.apply(name,b);}
 const before="kind==='stockrepair'?'ajustarStockOficina':null",after="kind==='stockrepair'?'ajustarStockOficina':kind==='close'?'editar':null",policy=changes['ot-lifecycle-policy.js'].toString('utf8');
 if(policy.split(before).length!==2||policy.includes(after))throw Error('Revisar permiso original de cierre.');changes['ot-lifecycle-policy.js']=Buffer.from(policy.replace(before,after));
 const final=Object.fromEntries(Object.entries(changes).map(([n,b])=>[n,sha(b)]));
 fs.mkdirSync(path.join(output,'patch'),{recursive:true});for(const[n,b]of Object.entries(changes))fs.writeFileSync(path.join(output,'patch',n),b);
 const check="const f=require('fs'),c=require('crypto'),m="+JSON.stringify(final)+";for(const[n,h]of Object.entries(m))if(c.createHash('sha256').update(f.readFileSync(n)).digest('hex')!==h)throw Error(n)";
 fs.writeFileSync(path.join(output,'Dockerfile'),['FROM '+BASE_IMAGE,'WORKDIR /app','COPY patch/ /app/','RUN node -e '+JSON.stringify(check)+' && node --check ot-lifecycle.js && node --check ot-delivery.js && node --check ot-lifecycle-policy.js',''].join('\n'));
 fs.writeFileSync(path.join(output,'.gcloudignore'),'.git\nnode_modules\n');
 const manifest={schema:1,baseImage:BASE_IMAGE,original:EXPECTED,changed:final,preserved:'all other image files and inherited configuration'};fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));return manifest;
}
module.exports={prepare,BASE_IMAGE,EXPECTED};
