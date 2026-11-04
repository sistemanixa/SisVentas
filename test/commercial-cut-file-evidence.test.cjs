'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Cut=require('../scripts/lib/commercial-cut-file-evidence.cjs'),E=require('../scripts/lib/commercial-cut-evidence.cjs');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sv-cut-evidence-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));let sequence=0;
 const files=[];function file(value){const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value));const ref={path:path.join(dir,(sequence++)+'.json'),sha256:Cut.digest(bytes)};fs.writeFileSync(ref.path,bytes);files.push(ref);return ref;}
 const baseline=file('fictional baseline'),proof=file('fictional proof'),source=file('fictional source'),candidateRules=file('fictional candidate rules');
 const manifest={schema:1,observed:{sourceSha256:source.sha256,rulesSha256:baseline.sha256,artifactSha256:proof.sha256},candidate:{sourceSha256:source.sha256,rulesSha256:candidateRules.sha256,artifactSha256:proof.sha256}};
 manifest.writers=[...new Set(Object.values(E.REQUIRED).flat())].map(domain=>({id:domain,domain,entrypoint:'fixture/'+domain,transport:'server',fence:'coordinated',proofSha256:proof.sha256}));
 manifest.operations=Object.keys(E.REQUIRED).map(name=>{const projections=E.PROJECTIONS.map(name=>({name,schema:1,generation:'fixture',revision:1,sourceSha256:source.sha256,proofSha256:proof.sha256}));return {name,writerIds:E.REQUIRED[name],fences:E.REQUIRED[name].map(domain=>({domain,rulesSha256:candidateRules.sha256,proofSha256:proof.sha256})),projections,tests:E.CIRCUITS.map(circuit=>({circuit,result:'passed',runner:'fictional offline',artifactSha256:proof.sha256,sourceSha256:source.sha256,rulesSha256:candidateRules.sha256,projectionSha256:Cut.digest(E.canonical(projections))}))};});
 const kinds=['cloud-run','functions','browser','private-tools'];
 const inventory={schema:1,observedAt:'2026-11-04T10:00:00Z',baselineSha256:baseline.sha256,scopes:kinds.map(id=>({id,kind:id,complete:true,proofSha256:proof.sha256})),accesses:kinds.map((scopeId,i)=>({id:scopeId,scopeId,revision:'fixture-rev-'+i,url:'https://fixture.invalid/'+i,trafficPercent:i===0?100:0,tag:i===1?'old-tag':'',proofSha256:proof.sha256}))};
 const declarations=inventory.accesses.map((a,i)=>({id:a.id,accessSha256:Cut.digest(E.canonical(a)),writerIds:i===0?manifest.writers.map(w=>w.id):[],excludedProofSha256:i===0?null:proof.sha256}));
 const manifestRef=file(manifest),inventoryRef=file(inventory);
 const pause={schema:1,baselineSha256:baseline.sha256,inventorySha256:inventoryRef.sha256,manifestSha256:manifestRef.sha256,pausedAt:'2026-11-04T10:01:00Z',drainedAt:'2026-11-04T10:02:00Z',sources:['sales','payments','budgets','customers','users','identities','permissions'].map(name=>({name,paused:true,drained:true,proofSha256:proof.sha256})),accesses:inventory.accesses.map(a=>({id:a.id,paused:true,inFlight:0,proofSha256:proof.sha256}))};
 const bundle={schema:1,manifest:manifestRef,baseline,inventory:inventoryRef,declarations,pause:file(pause),artifacts:[baseline,proof,source,candidateRules]};
 return {bundle,manifest,inventory,pause,file,proof,options:{expectedBaselineSha256:baseline.sha256,now:Date.parse('2026-11-04T10:03:00Z'),maxAgeMs:3600000}};
}
test('explicit external fictional files validate without certifying remote state or authorization',t=>{const f=fixture(t),r=Cut.validate(f.bundle,f.options);assert.equal(r.remoteVerified,false);assert.equal(r.activationAuthorized,false);assert.equal(r.scope,'offline-files-and-declared-observations-only');});
for(const mutation of ['tampered-file','missing-file','wrong-baseline','missing-old-access','changed-revision','changed-url','changed-traffic','changed-tag','missing-scope','incomplete-scope','stale','future','missing-proof','missing-source-pause','not-paused','in-flight','old-inventory-pause','old-manifest-pause','drained-before-pause','extra-declaration','unmapped-writer','relative-path'])test('rejects '+mutation,t=>{
 const f=fixture(t),{bundle:b,options:o}=f;
 if(mutation==='tampered-file')fs.appendFileSync(f.proof.path,'tamper');
 if(mutation==='missing-file')fs.unlinkSync(f.proof.path);
 if(mutation==='wrong-baseline')o.expectedBaselineSha256='0'.repeat(64);
 if(mutation==='missing-old-access')b.declarations.splice(1,1);
 for(const [name,key,value]of [['changed-revision','revision','other'],['changed-url','url','https://other.invalid/'],['changed-traffic','trafficPercent',12],['changed-tag','tag','new']])if(mutation===name){f.inventory.accesses[1][key]=value;b.inventory=f.file(f.inventory);}
 if(mutation==='missing-scope'){f.inventory.scopes.pop();b.inventory=f.file(f.inventory);}
 if(mutation==='incomplete-scope'){f.inventory.scopes[0].complete=false;b.inventory=f.file(f.inventory);}
 if(mutation==='stale')o.now+=7200000;
 if(mutation==='future')o.now-=7200000;
 if(mutation==='missing-proof')b.artifacts=b.artifacts.filter(r=>r!==f.proof);
 if(mutation==='missing-source-pause'){f.pause.sources.pop();b.pause=f.file(f.pause);}
 if(mutation==='not-paused'){f.pause.accesses[1].paused=false;b.pause=f.file(f.pause);}
 if(mutation==='in-flight'){f.pause.accesses[1].inFlight=1;b.pause=f.file(f.pause);}
 if(mutation==='old-inventory-pause'){f.pause.inventorySha256='0'.repeat(64);b.pause=f.file(f.pause);}
 if(mutation==='old-manifest-pause'){f.pause.manifestSha256='0'.repeat(64);b.pause=f.file(f.pause);}
 if(mutation==='drained-before-pause'){f.pause.drainedAt='2026-11-04T10:00:00Z';b.pause=f.file(f.pause);}
 if(mutation==='extra-declaration')b.declarations.push({...b.declarations[0],id:'unknown'});
 if(mutation==='unmapped-writer')b.declarations[0].writerIds.pop();
 if(mutation==='relative-path')b.baseline.path='relative.json';
 assert.throws(()=>Cut.validate(b,o));
});
