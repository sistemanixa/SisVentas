'use strict';
// Local files only. No credentials, discovery, network, writes or activation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Evidence=require('./commercial-cut-evidence.cjs');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw Object.assign(Error('Evidencia local de corte incompleta, distinta u obsoleta.'),{code:'SV_CUT_FILE_EVIDENCE'});};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=2048;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function fields(v,names){if(!object(v)||Object.keys(v).length!==names.length||names.some(k=>!Object.hasOwn(v,k)))fail();}
function rows(values,key){if(!Array.isArray(values)||!values.length)fail();const result=new Map();for(const v of values){const id=key(v);if(!text(id)||result.has(id))fail();result.set(id,v);}return result;}
function validate(bundle,{expectedBaselineSha256,now,maxAgeMs}={}){
 fields(bundle,['schema','manifest','baseline','inventory','declarations','pause','fiscal','artifacts']);
 if(bundle.schema!==2||!hash(expectedBaselineSha256)||!Number.isSafeInteger(now)||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<=0||maxAgeMs>86400000)fail();
 // Explicit absolute paths only; never traverse directories or follow links.
 function read(ref){
  fields(ref,['path','sha256']);if(!text(ref.path)||!path.isAbsolute(ref.path)||!hash(ref.sha256))fail();
  const stat=fs.lstatSync(ref.path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>20*1024*1024)fail();
  const bytes=fs.readFileSync(ref.path);if(digest(bytes)!==ref.sha256)fail();return bytes;
 }
 function json(ref){try{return JSON.parse(read(ref).toString('utf8'));}catch(_){fail();}}
 const manifest=json(bundle.manifest),baseline=read(bundle.baseline);
 if(digest(baseline)!==expectedBaselineSha256||manifest.observed.rulesSha256!==expectedBaselineSha256)fail();
 const result=Evidence.validate(manifest);
 const artifacts=rows(bundle.artifacts,r=>r?.sha256);for(const ref of artifacts.values())read(ref);
 function covered(value){if(Array.isArray(value)){value.forEach(covered);return;}if(!object(value))return;for(const [key,v]of Object.entries(value)){if(key.endsWith('Sha256')&&key!=='projectionSha256'&&!artifacts.has(v))fail();covered(v);}}
 covered(manifest); // projectionSha256 is a canonical in-manifest digest, not a file.
 const inventory=json(bundle.inventory);
 fields(inventory,['schema','observedAt','baselineSha256','scopes','accesses']);
 const observed=Date.parse(inventory.observedAt);if(inventory.schema!==1||!Number.isFinite(observed)||observed>now||now-observed>maxAgeMs||inventory.baselineSha256!==expectedBaselineSha256)fail();
 const scopes=rows(inventory.scopes,r=>r?.id);
 for(const s of scopes.values()){fields(s,['id','kind','complete','proofSha256']);if(!['cloud-run','functions','browser','private-tools'].includes(s.kind)||s.complete!==true||!artifacts.has(s.proofSha256))fail();}
 for(const kind of ['cloud-run','functions','browser','private-tools'])if(![...scopes.values()].some(s=>s.kind===kind))fail();
 const accesses=rows(inventory.accesses,r=>r?.id),declarations=rows(bundle.declarations,r=>r?.id),usedWriters=new Set();
 if(accesses.size!==declarations.size)fail();
 for(const a of accesses.values()){
  fields(a,['id','scopeId','revision','url','trafficPercent','tag','proofSha256']);
  if(!scopes.has(a.scopeId)||!text(a.revision)||!text(a.url)||!Number.isFinite(a.trafficPercent)||a.trafficPercent<0||a.trafficPercent>100||typeof a.tag!=='string'||!artifacts.has(a.proofSha256))fail();
  const d=declarations.get(a.id);fields(d,['id','accessSha256','writerIds','excludedProofSha256']);
  if(d.accessSha256!==digest(Evidence.canonical(a))||!Array.isArray(d.writerIds)||new Set(d.writerIds).size!==d.writerIds.length)fail();
  if(!d.writerIds.length){if(!artifacts.has(d.excludedProofSha256))fail();}
  else {if(d.excludedProofSha256!==null)fail();for(const id of d.writerIds){if(!manifest.writers.some(w=>w.id===id))fail();usedWriters.add(id);}}
 }
 if(manifest.writers.some(w=>!usedWriters.has(w.id)))fail();
 const pause=json(bundle.pause);fields(pause,['schema','baselineSha256','inventorySha256','manifestSha256','pausedAt','drainedAt','sources','accesses']);
 const paused=Date.parse(pause.pausedAt),drained=Date.parse(pause.drainedAt);
 if(pause.schema!==1||pause.baselineSha256!==expectedBaselineSha256||pause.inventorySha256!==bundle.inventory.sha256||pause.manifestSha256!==bundle.manifest.sha256||!Number.isFinite(paused)||!Number.isFinite(drained)||paused<observed||drained<paused||drained>now||now-paused>maxAgeMs)fail();
 const sources=rows(pause.sources,s=>s?.name);
 if(sources.size!==7)fail();for(const name of ['sales','payments','budgets','customers','users','identities','permissions']){const s=sources.get(name);fields(s,['name','paused','drained','proofSha256']);if(s.paused!==true||s.drained!==true||!artifacts.has(s.proofSha256))fail();}
 const pausedAccesses=rows(pause.accesses,a=>a?.id);if(pausedAccesses.size!==accesses.size)fail();
 for(const id of accesses.keys()){const a=pausedAccesses.get(id);fields(a,['id','paused','inFlight','proofSha256']);if(a.paused!==true||a.inFlight!==0||!artifacts.has(a.proofSha256))fail();}
 // Empty financial leases do not account for accepted HTTP execution or durable
 // fiscal jobs: reservation/result persistence can happen outside that lease.
 const fiscal=json(bundle.fiscal);
 fields(fiscal,['schema','baselineSha256','inventorySha256','manifestSha256','pauseSha256','observedAt','admissionBlocked','admissionAccessIds','activeRequests','ambiguousJobs','pendingAttachments','jobInventoryComplete','markersReconciled','resultsReconciled','guardEmpty','admissionProofSha256','requestsProofSha256','jobInventorySha256','reconciliationProofSha256','guardProofSha256']);
 const fiscalObserved=typeof fiscal.observedAt==='string'?Date.parse(fiscal.observedAt):NaN;
 if(fiscal.schema!==1||fiscal.baselineSha256!==expectedBaselineSha256||fiscal.inventorySha256!==bundle.inventory.sha256||fiscal.manifestSha256!==bundle.manifest.sha256||fiscal.pauseSha256!==bundle.pause.sha256||!Number.isFinite(fiscalObserved)||fiscalObserved<drained||fiscalObserved>now||now-fiscalObserved>maxAgeMs)fail();
 if(fiscal.admissionBlocked!==true||fiscal.activeRequests!==0||fiscal.ambiguousJobs!==0||fiscal.pendingAttachments!==0||fiscal.jobInventoryComplete!==true||fiscal.markersReconciled!==true||fiscal.resultsReconciled!==true||fiscal.guardEmpty!==true)fail();
 const fiscalAccesses=rows(fiscal.admissionAccessIds,id=>id);
 if(fiscalAccesses.size!==accesses.size||[...accesses.keys()].some(id=>!fiscalAccesses.has(id)))fail();
 for(const key of ['admissionProofSha256','requestsProofSha256','jobInventorySha256','reconciliationProofSha256','guardProofSha256'])if(!artifacts.has(fiscal[key]))fail();
 const jobs=json(artifacts.get(fiscal.jobInventorySha256));
 fields(jobs,['schema','observedAt','baselineSha256','inventorySha256','manifestSha256','complete','ambiguousJobs','pendingAttachments','markersReconciled','resultsReconciled']);
 const jobsObserved=typeof jobs.observedAt==='string'?Date.parse(jobs.observedAt):NaN;
 if(jobs.schema!==1||jobs.baselineSha256!==expectedBaselineSha256||jobs.inventorySha256!==bundle.inventory.sha256||jobs.manifestSha256!==bundle.manifest.sha256||!Number.isFinite(jobsObserved)||jobsObserved<drained||jobsObserved>now||now-jobsObserved>maxAgeMs||jobs.observedAt!==fiscal.observedAt)fail();
 if(jobs.complete!==fiscal.jobInventoryComplete||jobs.ambiguousJobs!==fiscal.ambiguousJobs||jobs.pendingAttachments!==fiscal.pendingAttachments||jobs.markersReconciled!==fiscal.markersReconciled||jobs.resultsReconciled!==fiscal.resultsReconciled)fail();
 return {...result,schema:2,scope:'offline-files-and-declared-observations-only',inventorySha256:bundle.inventory.sha256,baselineSha256:expectedBaselineSha256,fiscalSha256:bundle.fiscal.sha256,remoteVerified:false,activationAuthorized:false};
}
module.exports={validate,digest};
