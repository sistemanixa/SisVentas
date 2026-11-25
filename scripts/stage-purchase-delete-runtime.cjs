'use strict';
// Offline overlay over the exact published runtime. No build/deploy credentials.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const BASE_IMAGE='southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:55e5d728480cf490b36d78591cf5441095ab05c635ed91631de1c927e41eba50';
const DIRECT=['purchase-order-delete.js','purchase-manual-delete-review.js','purchase-order-delete-model.js','purchase-delete-server.js','commercial-models/purchase-receipt-costs.v1.js'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function prepare({baseDirectory,baseManifest,sourceDirectory,output}){
 if(fs.existsSync(output))throw Error('No sobrescribir una composición anterior.');const original=JSON.parse(fs.readFileSync(baseManifest)),files=original.files;if(!files||Object.keys(files).length!==150)throw Error('Hace falta el manifiesto publicado de 150 archivos.');
 for(const [n,hash]of Object.entries(files)){if(n.split('/').some(v=>v==='..')||sha(fs.readFileSync(path.join(baseDirectory,n)))!==hash)throw Error('El runtime publicado cambió: '+n);}
 const guard=fs.readFileSync(path.join(baseDirectory,'labor-guard.js'),'utf8'),anchor="const actions={'stock.ajustar'";
 if(guard.split(anchor).length!==2||guard.includes("'ordenes.eliminar':"))throw Error('Revisar el contrato original de acciones.');
 const nextGuard=Buffer.from(guard.replace(anchor,"const actions={'ordenes.eliminar':['ordenes','ordenes','eliminar',['admin']],'stock.ajustar'"));
 fs.mkdirSync(output,{recursive:true});fs.mkdirSync(path.join(output,'patch'));const changed={'labor-guard.js':nextGuard};
 for(const n of DIRECT){if(Object.hasOwn(files,n))throw Error('El archivo ya pertenece a la base: '+n);changed[n]=fs.readFileSync(path.join(sourceDirectory,n));}
 for(const [n,bytes]of Object.entries(changed)){const p=path.join(output,'patch',n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);}
 const final={...files,...Object.fromEntries(Object.entries(changed).map(([n,b])=>[n,sha(b)]))};
 fs.writeFileSync(path.join(output,'before.json'),JSON.stringify(files));fs.writeFileSync(path.join(output,'after.json'),JSON.stringify(final));
 const check="const fs=require('fs'),c=require('crypto'),h=JSON.parse(fs.readFileSync(process.argv[1]));for(const[n,s]of Object.entries(h)){if(c.createHash('sha256').update(fs.readFileSync('/app/'+n)).digest('hex')!==s)throw Error('Runtime changed '+n)}";
 fs.writeFileSync(path.join(output,'Dockerfile'),['FROM '+BASE_IMAGE,'WORKDIR /app','COPY before.json after.json /tmp/','RUN node -e '+JSON.stringify(check)+' /tmp/before.json','COPY patch/ /app/','RUN node -e '+JSON.stringify(check)+' /tmp/after.json && node --check purchase-delete-server.js && rm /tmp/before.json /tmp/after.json','CMD ["node","purchase-delete-server.js"]',''].join('\n'));
 fs.writeFileSync(path.join(output,'.gcloudignore'),'.git\nnode_modules\n');
 fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({baseImage:BASE_IMAGE,preserved:149,changed:Object.keys(changed),files:final}));
 return {files:final,changed:Object.keys(changed),baseImage:BASE_IMAGE};
}
module.exports={prepare,BASE_IMAGE,DIRECT};
