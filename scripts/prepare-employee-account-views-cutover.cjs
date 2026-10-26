'use strict';
// OFFLINE DEFAULT. Importing this module never authenticates, opens a socket,
// inspects production, deploys, pauses a writer or changes a database rule.
// The CLI only prepares a private local plan. A live adapter is deliberately
// absent until its authentication/metadata contract receives separate review.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const B=require('../cotizador/employee-account-view-bootstrap');
const {digest}=require('../cotizador/labor-guard');
const BASE='sv_employee_account_views/v1',FLAG='sv_labor_config/employeeAccountViews',SERVICE='sv-labor-service';
const SOURCES={ctaemp:'sisventas/ctaemp',gastos:'sisventas/gastos',pagos_realizados:'sisventas/pagos_realizados',auditoria_pagos:'sisventas/auditoria_pagos',empleados:'sisventas/empleados',cargos:'sisventas/config/cargos'};
const GLOBALS=['globalExpenses','globalPaymentBatches','globalPaymentAudit','globalEmployeeDirectory','globalCargoDirectory'];
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v),id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(v),plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=code=>Object.assign(Error('Preparación de vistas no confirmada. Revisá la evidencia privada antes de continuar.'),{code});
const copy=v=>structuredClone(v),equal=(a,b)=>digest(a)===digest(b);
// RTDB stores a tree: empty maps/arrays and null children are absent. This is
// used ONLY to verify derived coverage, never to rewrite or hash originals.
function viewTree(value){if(value===null||value===undefined)return null;if(typeof value!=='object')return value;const result={};for(const [k,v]of Object.entries(value)){const next=viewTree(v);if(next!==null)Object.defineProperty(result,k,{value:next,enumerable:true});}return Object.keys(result).length?result:null;}
function configReady(config){if(!plain(config)||config.schema!==1||config.ready!==true||config.employeeAccountViews?.enabled===true)throw fail('SV_ACCOUNT_CUT_CONFIG');}
function unknownViews(value){if(value==null)return false;return !plain(value)||Object.keys(value).some(k=>!['employees',...GLOBALS].includes(k));}
function prepared(bundle){
 if(!plain(bundle)||bundle.schema!==1||!sha(bundle.expectedCommit)||!hex(bundle.expectedRulesHash)||!hex(bundle.expectedWritersHash)||!hex(bundle.expectedDrainHash)||!hex(bundle.expectedInventoryHash)||!Array.isArray(bundle.approvedImages)||!bundle.approvedImages.length||bundle.approvedImages.some(h=>!hex(h))||!id(bundle.pauseId)||!Array.isArray(bundle.nonces)||!bundle.nonces.length||bundle.nonces.length>100000||bundle.nonces.some(n=>!id(n))||new Set(bundle.nonces).size!==bundle.nonces.length||!hex(bundle.planDigest)||!hex(bundle.sourceDigest)||!hex(bundle.rosterDigest)||!hex(bundle.configDigest)||!hex(bundle.existingViewsDigest))throw fail('SV_ACCOUNT_CUT_PLAN');
 configReady(bundle.config);if(unknownViews(bundle.existingViews)||bundle.configDigest!==digest(bundle.config)||bundle.existingViewsDigest!==digest(bundle.existingViews))throw fail('SV_ACCOUNT_CUT_PLAN');
 if(bundle.nonces[0]!==bundle.pauseId)throw fail('SV_ACCOUNT_CUT_NONCES');
 let cursor=1;const nonce=()=>{if(cursor>=bundle.nonces.length)throw fail('SV_ACCOUNT_CUT_NONCES');return bundle.nonces[cursor++];};
 const plan=B.build(bundle.snapshot,{employeeIds:bundle.employeeIds,existingViews:bundle.existingViews,nonce}),chunks=B.planChunks(plan,{pauseId:bundle.pauseId,nonce,...bundle.limits});
 if(cursor!==bundle.nonces.length||digest({plan,chunks})!==bundle.planDigest||B.privateCoverage(plan).sourceDigest!==bundle.sourceDigest||digest(bundle.employeeIds)!==bundle.rosterDigest)throw fail('SV_ACCOUNT_CUT_PLAN');
 return {plan,chunks:chunks.chunks};
}
function prepare({snapshot,employeeIds,existingViews={},config,expectedCommit,expectedRulesHash,expectedWritersHash,expectedDrainHash,expectedInventoryHash,approvedImages,limits={maxPaths:500,maxBytes:1024*1024}}={},nonce=crypto.randomUUID){
 existingViews=existingViews||{};configReady(config);if(unknownViews(existingViews)||!sha(expectedCommit)||!hex(expectedRulesHash)||!hex(expectedWritersHash)||!hex(expectedDrainHash)||!hex(expectedInventoryHash)||!Array.isArray(approvedImages)||!approvedImages.length||approvedImages.some(h=>!hex(h)))throw fail('SV_ACCOUNT_CUT_INPUT');
 if(!plain(limits)||Object.keys(limits).some(k=>!['maxPaths','maxBytes'].includes(k))||!Number.isInteger(limits.maxPaths)||limits.maxPaths<4||limits.maxPaths>500||!Number.isInteger(limits.maxBytes)||limits.maxBytes<4096||limits.maxBytes>1024*1024)throw fail('SV_ACCOUNT_CUT_LIMITS');
 const nonces=[],allocate=()=>{const next=nonce();if(!id(next))throw fail('SV_ACCOUNT_CUT_NONCES');nonces.push(next);return next;},pauseId=allocate(),plan=B.build(snapshot,{employeeIds,existingViews,nonce:allocate}),chunks=B.planChunks(plan,{pauseId,nonce:allocate,...limits});
 if(chunks.chunks.length>2000||nonces.length>100000)throw fail('SV_ACCOUNT_CUT_LIMITS');
 const bundle={schema:1,expectedCommit,expectedRulesHash,expectedWritersHash,expectedDrainHash,expectedInventoryHash,approvedImages:copy(approvedImages),pauseId,nonces,snapshot:copy(snapshot),employeeIds:copy(employeeIds),existingViews:copy(existingViews),config:copy(config),limits:copy(limits),planDigest:digest({plan,chunks}),sourceDigest:B.privateCoverage(plan).sourceDigest,rosterDigest:digest(employeeIds),configDigest:digest(config),existingViewsDigest:digest(existingViews)};
 return {bundle,summary:{schema:1,planHash:digest(bundle),activationAllowed:plan.complete,issues:plan.issues.length,chunks:chunks.chunks.length,sourceBytes:B.privateCoverage(plan).sourceBytes,patchBytes:chunks.chunks.reduce((sum,c)=>sum+c.bytes,0),originalWrites:0,defaultMode:'LOCAL_PLAN_ONLY'}};
}
function observedWriters(value,approvedImages){
 if(!plain(value)||!plain(value.cotizador)||!plain(value.fiscal))throw fail('SV_ACCOUNT_CUT_WRITERS');
 function targets(observation,name){const {service,revisions}=observation;if(!plain(service)||!plain(revisions)||service.name!=='projects/nixa-sisventas/locations/southamerica-east1/services/'+name||service.reconciling===true||String(service.generation)!==String(service.observedGeneration)||!Array.isArray(service.trafficStatuses)||!service.trafficStatuses.length)throw fail('SV_ACCOUNT_CUT_WRITERS');
  const paths=new Set(service.trafficStatuses.filter(t=>Number(t.percent)>0||typeof t.tag==='string'&&t.tag).map(t=>t.revision));if(!paths.size||[...paths].some(p=>typeof p!=='string'||!p.startsWith(service.name+'/revisions/')))throw fail('SV_ACCOUNT_CUT_WRITERS');
  for(const t of service.traffic||[]){if(!(Number(t.percent)>0||t.tag))continue;const revision=t.revision||service.latestReadyRevision;if(!paths.has(revision))throw fail('SV_ACCOUNT_CUT_WRITERS');}
  for(const p of paths){const rev=revisions[p];if(!plain(rev)||rev.name!==p||rev.reconciling===true||!Array.isArray(rev.containers)||rev.containers.length!==1)throw fail('SV_ACCOUNT_CUT_WRITERS');if(name==='cotizador'){const image=String(rev.containers[0].image||'').match(/@sha256:([a-f0-9]{64})$/),env=Object.fromEntries((rev.containers[0].env||[]).filter(e=>Object.hasOwn(e,'value')).map(e=>[e.name,e.value]));if(!image||!approvedImages.includes(image[1])||env.LABOR_SCOPED_READ_ONLY!=='true'||env.LABOR_SCOPED_ENABLED!=='true')throw fail('SV_ACCOUNT_CUT_NOT_PAUSED');}}
 }
 targets(value.cotizador,'cotizador');targets(value.fiscal,'emitirfactura');return digest(value);
}
// A trusted live adapter must derive this evidence from the complete reviewed
// writer inventory and completed retirement operations. Routing/Ready/elapsed
// time are not proof that an old unfenced ADC request has stopped. No body or
// CLI JSON can supply an adapter; the executable live adapter is still absent.
function verifyDrain(proof,bundle,writers){
 if(!plain(proof)||proof.schema!==1||proof.rulesHash!==bundle.expectedRulesHash||proof.writersHash!==bundle.expectedWritersHash||proof.configDigest!==bundle.configDigest||!Array.isArray(proof.inventory)||!proof.inventory.length||!plain(proof.removed))throw fail('SV_ACCOUNT_CUT_DRAIN');
 const service='projects/nixa-sisventas/locations/southamerica-east1/services/cotizador',active=new Map(),inventory=new Map();
 for(const t of writers.cotizador.service.trafficStatuses){if(!(Number(t.percent)>0||t.tag))continue;const rev=writers.cotizador.revisions[t.revision],image=String(rev.containers[0].image).match(/@sha256:([a-f0-9]{64})$/);active.set(t.revision,image[1]);}
 for(const row of proof.inventory){if(!plain(row)||typeof row.revision!=='string'||!row.revision.startsWith(service+'/revisions/')||!hex(row.imageDigest)||inventory.has(row.revision))throw fail('SV_ACCOUNT_CUT_DRAIN');inventory.set(row.revision,row.imageDigest);}
 if(digest(proof.inventory)!==bundle.expectedInventoryHash)throw fail('SV_ACCOUNT_CUT_DRAIN_INVENTORY');
 for(const [revision,image]of active)if(inventory.get(revision)!==image||Object.hasOwn(proof.removed,revision))throw fail('SV_ACCOUNT_CUT_DRAIN_INVENTORY');
 for(const [revision]of inventory){if(active.has(revision))continue;const record=proof.removed[revision],operation=record?.operation;if(!plain(record)||!plain(operation)||operation.done!==true||Object.hasOwn(operation,'error')||typeof operation.name!=='string'||!/^projects\/nixa-sisventas\/locations\/southamerica-east1\/operations\/[A-Za-z0-9_-]+$/.test(operation.name)||record.probeStatus!==404)throw fail('SV_ACCOUNT_CUT_UNRETIRED_WRITER');}
 if(Object.keys(proof.removed).some(revision=>!inventory.has(revision)||active.has(revision))||digest(proof)!==bundle.expectedDrainHash)throw fail('SV_ACCOUNT_CUT_DRAIN_CHANGED');return true;
}
function createCoordinator({store,inspectCheckout,inspectRules,inspectWriters,inspectDrain,journal,now=Date.now,uuid=crypto.randomUUID,maxDurationMs=600000}={}){
 if(!store||['read','acquire','commit','abort'].some(k=>typeof store[k]!=='function')||[inspectCheckout,inspectRules,inspectWriters,inspectDrain].some(f=>typeof f!=='function')||!journal||['begin','backup','checkpoint','finish'].some(k=>typeof journal[k]!=='function')||!Number.isSafeInteger(maxDurationMs)||maxDurationMs<1000||maxDurationMs>900000)throw fail('SV_ACCOUNT_CUT_ADAPTER');
 return async function apply(bundle,{expectedPlanHash}={}){
  bundle=copy(bundle);const planHash=digest(bundle);if(!hex(expectedPlanHash)||expectedPlanHash!==planHash)throw fail('SV_ACCOUNT_CUT_REVIEW_REQUIRED');const reviewed=prepared(bundle);if(!reviewed.plan.complete)throw fail('SV_ACCOUNT_CUT_INCOMPLETE');
  const began=now();let currentChunk=null,intent=false,writeAttempted=false,previous=null;
  function deadline(){if(!Number.isSafeInteger(now())||now()<began||now()-began>=maxDurationMs)throw fail('SV_ACCOUNT_CUT_DEADLINE');}
  async function checked(){deadline();const checkout=await inspectCheckout();if(!checkout||checkout.clean!==true||checkout.commit!==bundle.expectedCommit)throw fail('SV_ACCOUNT_CUT_CHECKOUT');if(await inspectRules()!==bundle.expectedRulesHash)throw fail('SV_ACCOUNT_CUT_RULES');const writers=await inspectWriters();if(observedWriters(writers,bundle.approvedImages)!==bundle.expectedWritersHash)throw fail('SV_ACCOUNT_CUT_WRITERS_CHANGED');verifyDrain(await inspectDrain(),bundle,writers);deadline();}
  async function source(){const result={};for(const [name,p]of Object.entries(SOURCES)){deadline();result[name]=await store.read(p);deadline();}return result;}
  async function config(){const value=await store.read('sv_labor_config');if(digest(value)!==bundle.configDigest)throw fail('SV_ACCOUNT_CUT_CONFIG_CHANGED');return value;}
  async function commit(patch,tag,work){
   deadline();const opId=tag,lease={fence:uuid(),opId,digest:digest({operation:'prepare-employee-account-views',planHash,opId}),expiresAt:now()+60000,actorUid:SERVICE,mode:'bootstrap'};if(!id(lease.fence)||!id(opId))throw fail('SV_ACCOUNT_CUT_NONCES');
   if(await store.read('sv_labor_receipts/'+opId)!==null)throw fail('SV_ACCOUNT_CUT_RECEIPT_EXISTS');let acquired=false,confirmed=false;
   try{await store.acquire(lease);acquired=true;const live=await store.read('sv_labor_guard');if(!equal(live,lease)||now()>=lease.expiresAt)throw fail('SV_ACCOUNT_CUT_FENCE');await checked();await config();await work();
    if(now()>=lease.expiresAt)throw fail('SV_ACCOUNT_CUT_FENCE');const result={ok:true,committed:true,planHash,chunkId:opId};const finalPatch={...copy(patch),['sv_labor_receipts/'+opId]:{fence:lease.fence,digest:lease.digest,actorUid:SERVICE,result,confirmedAt:now()},sv_labor_guard:null};
    for(const p of Object.keys(finalPatch))if(!p.startsWith(BASE+'/')&&p!==FLAG&&p!=='sv_labor_guard'&&p!=='sv_labor_receipts/'+opId)throw fail('SV_ACCOUNT_CUT_ORIGINAL_WRITE');
    await journal.checkpoint({kind:'intent',chunkId:opId,planHash,paths:Object.keys(patch).length});await checked();if(now()>=lease.expiresAt)throw fail('SV_ACCOUNT_CUT_FENCE');writeAttempted=true;await store.commit(finalPatch,lease,{uid:SERVICE,mode:'bootstrap'});confirmed=true;
    const receipt=await store.read('sv_labor_receipts/'+opId);if(!receipt||receipt.fence!==lease.fence||receipt.digest!==lease.digest||receipt.actorUid!==SERVICE||!equal(receipt.result,result)||await store.read('sv_labor_guard')!==null)throw fail('SV_ACCOUNT_CUT_ACK_UNCONFIRMED');await journal.checkpoint({kind:'confirmed',chunkId:opId,planHash});
   }finally{if(acquired&&!confirmed)try{await store.abort(lease);}catch(_){/* Never retry or clear a different fence after an ambiguous write. */}}
  }
  try{
   await checked();if(await store.read('sv_labor_guard')!==null)throw fail('SV_ACCOUNT_CUT_BUSY');await config();const fresh=await source(),views=await store.read(BASE);if(digest(fresh)!==bundle.sourceDigest||!equal(Object.keys(fresh.empleados||{}).sort(),[...bundle.employeeIds].sort())||digest(views||{})!==bundle.existingViewsDigest)throw fail('SV_ACCOUNT_CUT_SOURCE_CHANGED');
   await journal.begin({planHash,expectedCommit:bundle.expectedCommit,rulesHash:bundle.expectedRulesHash,writersHash:bundle.expectedWritersHash,drainHash:bundle.expectedDrainHash,inventoryHash:bundle.expectedInventoryHash,pauseId:bundle.pauseId});intent=true;await journal.backup({snapshot:fresh,existingViews:views,config:bundle.config,sourceDigest:bundle.sourceDigest,rosterDigest:bundle.rosterDigest});
   for(const chunk of reviewed.chunks){currentChunk=chunk.id;await commit(chunk.patch,chunk.id,async()=>{const currentRevisions={};for(const p of Object.keys(chunk.expectedRevisions))currentRevisions[p]=await store.read(p+'/meta/revision');B.verifyChunk(chunk,{pauseId:bundle.pauseId,previousChunkId:previous,currentRevisions,...(chunk.phase==='finalize'?{sourceSnapshot:await source()}:{})});});previous=chunk.id;}
   currentChunk=uuid();await commit({[FLAG]:{schema:1,enabled:true}},currentChunk,async()=>{if(digest(await source())!==bundle.sourceDigest||!equal(viewTree(await store.read(BASE)),viewTree(reviewed.plan.views)))throw fail('SV_ACCOUNT_CUT_FINAL_COVERAGE');});
   const finalConfig=await store.read('sv_labor_config'),expected={...bundle.config,employeeAccountViews:{schema:1,enabled:true}};if(!equal(finalConfig,expected))throw fail('SV_ACCOUNT_CUT_CONFIG_UNCONFIRMED');
   const result={ok:true,activated:true,planHash,chunks:reviewed.chunks.length,originalWrites:0};await journal.finish(result);return result;
  }catch(error){if(intent)try{await journal.finish({ok:false,code:error.code||'SV_ACCOUNT_CUT_UNCONFIRMED',chunkId:currentChunk,writeAttempted,receiptCheckRequired:writeAttempted});}catch(_){}throw error;}
 };
}
function main(args=process.argv.slice(2)){
 if(args.includes('--apply'))throw fail('SV_ACCOUNT_CUT_LIVE_ADAPTER_NOT_REVIEWED');
 if(args.length!==4||args[0]!=='--input'||args[2]!=='--out'||!args[3].endsWith('.private.json'))throw fail('SV_ACCOUNT_CUT_PLAN_USAGE');
 const inputPath=path.resolve(args[1]),out=path.resolve(args[3]),privateRoot=path.resolve(__dirname,'..','tmp');if(!out.startsWith(privateRoot+path.sep)||inputPath===out||fs.statSync(inputPath).size>128*1024*1024)throw fail('SV_ACCOUNT_CUT_PLAN_USAGE');const value=prepare(JSON.parse(fs.readFileSync(inputPath,'utf8').replace(/^\uFEFF/,'')));fs.writeFileSync(out,JSON.stringify(value.bundle,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify(value.summary));return value.summary;
}
if(require.main===module){try{main();}catch(error){console.error(error.code||'SV_ACCOUNT_CUT_PLAN_INVALID');process.exitCode=1;}}
module.exports={prepare,prepared,createCoordinator,observedWriters,verifyDrain,viewTree,main,BASE,FLAG,SOURCES};
