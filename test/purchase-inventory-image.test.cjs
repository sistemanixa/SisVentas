'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const source=path.resolve(__dirname,'../cotizador');
test('actual Docker COPY payload resolves entire local closure and boots guard/policy/runtime offline',t=>{
 const target=fs.mkdtempSync(path.join(os.tmpdir(),'sv-purchase-image-'));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const copied=[];for(const line of fs.readFileSync(path.join(source,'Dockerfile'),'utf8').split(/\r?\n/)){
  if(!line.startsWith('COPY '))continue;const fields=line.trim().split(/\s+/),dest=fields.at(-1);
  for(const item of fields.slice(1,-1)){if(item.includes('*'))continue;const origin=path.join(source,item);a.ok(fs.existsSync(origin),item);const directory=fs.statSync(origin).isDirectory(),output=path.join(target,directory?dest:path.join(dest,path.basename(item)));a.ok(output.startsWith(target+path.sep));fs.cpSync(origin,output,{recursive:directory});copied.push(item);}
 }
 a.ok(copied.includes('purchase-inventory-policy.js'));a.ok(copied.includes('operational-read-model.js'));
 a.equal(copied.includes('purchase-inventory-command.js'),false,'OFF command is not part of the image without a route');
 const seen=new Set(),pending=['index.js'];while(pending.length){const file=pending.pop();if(seen.has(file))continue;seen.add(file);const absolute=path.join(target,file);a.ok(fs.existsSync(absolute),'missing COPY dependency '+file);const code=fs.readFileSync(absolute,'utf8');for(const match of code.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)){const resolved=require.resolve(path.resolve(path.dirname(absolute),match[1]));a.ok(resolved.startsWith(target+path.sep));pending.push(path.relative(target,resolved));}}
 a.ok(seen.has('purchase-inventory-policy.js'));a.ok(seen.has('operational-read-model.js'));a.ok(seen.size>140);
 const script=`const assert=require('node:assert/strict');global.fetch=()=>{throw Error('No network during payload boot');};const Guard=require('./labor-guard'),Policy=require('./purchase-inventory-policy'),Runtime=require('./labor-runtime');assert.equal(typeof Guard.createLaborGuard({store:{}}).run,'function');assert.equal(Policy.isBound({}),false);const r=Runtime.createLaborRuntime({db:{},databaseURL:'https://fixture.invalid',accessToken:async()=>{throw Error('No credentials during payload boot');}});assert.equal(r.capabilities().coordinated,false);process.stdout.write('offline payload boot OK');`;
 a.equal(execFileSync(process.execPath,['-e',script],{cwd:target,encoding:'utf8',timeout:15000}),'offline payload boot OK');
});
