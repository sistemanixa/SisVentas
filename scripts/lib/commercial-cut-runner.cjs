'use strict';
// Transport-neutral orchestration only. No credentials, network, filesystem,
// signing authority or production adapter are provided here.
// Adapter trust boundary:
// - observe must collect fresh authenticated observations, not echo the request.
//   Proof hashes identify retained evidence for each access and fiscal control.
// - inspect is an authoritative durable operation lookup bound to id + digest;
//   'notApplied' must prove absence, never mean timeout/missing response.
// - perform must enforce id + digest idempotently at its authoritative boundary,
//   including two concurrent executors. Its return value is deliberately ignored.
// - readPreparation retrieves immutable private bytes by their canonical digest.
// - freezeEpoch identifies the continuously excluded source set. The adapter
//   must change/reject it if any writer was reopened or exclusion was lost.
// - activation records are fresh point readbacks consumed by the existing real
//   signature/capability verifier; keys and activation pins are independently
//   pinned. No 'signatureVerified' boolean is accepted in place of the marker.
// baseline -> pausedRules -> candidateRules are distinct reviewed transitions;
// the candidate must preserve the SDK pause envelope. Reopen changes flags,
// never removes that envelope. Snapshot bytes retain their original timestamp:
// reentry checks a fresh unchanged source fingerprint and continuous freeze,
// rather than expiring stable bytes or manufacturing a newer snapshot date.
// Journal load/CAS must be durable, linearizable and exclusive per cutId. A CAS
// failure/uncertain ACK stops this invocation. There is no automatic restore,
// unpause-on-error, signing, attestation install or financial write fallback.
const {digest}=require('../../cotizador/labor-guard');
const Preparation=require('./commercial-cut-preparation.cjs');
const crypto=require('node:crypto'),Attestation=require('../../cotizador/commercial-delete-attestation');
const PHASES=Object.freeze(['preflight','pauseAdmission','drain','freeze','snapshotPrepare','installWriters','installDerived','activateWhilePaused','verify','publish','reopen']);
const CONFIGS=Object.freeze(['sv_commercial_pages_config','sv_client_accounts_config','sv_client_history_config','sv_labor_config/writerSchema']);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const equal=(a,b)=>digest(a)===digest(b);
function fail(code,message){return Object.assign(Error(message),{code});}
function need(ok,message='La evidencia del corte requiere revisión.'){if(!ok)throw fail('SV_CUT_EVIDENCE',message);}
function exact(v,keys){need(object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)));}
function installation(prepared){
 need(object(prepared?.patch)&&object(prepared?.activation));
 for(const path of Object.keys(prepared.patch))need(Preparation.ROOTS.includes(path),'El plan intenta modificar un original o una raíz no permitida.');
 need(Object.keys(prepared.patch).length===Preparation.ROOTS.length);
 for(const path of Object.keys(prepared.activation))need(CONFIGS.includes(path),'Configuración de instalación no permitida.');
 need(Object.keys(prepared.activation).length===CONFIGS.length);
 return {patch:structuredClone(prepared.patch),activation:structuredClone(prepared.activation)};
}
function validatePins(p){
 exact(p,['schema','cutId','sessionId','baselineSha256','pausedRulesSha256','inventorySha256','artifactSha256','sourceSha256','candidateRulesSha256','activationPinsSha256','attestationPublicKeySha256','accessIds']);
 need(p.schema===1&&/^[A-Za-z0-9_-]{1,100}$/.test(p.cutId)&&typeof p.sessionId==='string'&&p.sessionId.length>0&&p.sessionId.length<=200);
 for(const k of ['baselineSha256','pausedRulesSha256','inventorySha256','artifactSha256','sourceSha256','candidateRulesSha256','activationPinsSha256','attestationPublicKeySha256'])need(hash(p[k]));
 need(Array.isArray(p.accessIds)&&p.accessIds.length>0&&p.accessIds.every(id=>typeof id==='string'&&id.length>0&&id.length<=200)&&new Set(p.accessIds).size===p.accessIds.length);
}
function create({adapter,journal,now=Date.now,maxAgeMs=60000}={}){
 need(adapter&&['observe','perform','inspect','readPreparation'].every(k=>typeof adapter[k]==='function'));
 need(journal&&typeof journal.load==='function'&&typeof journal.compareAndSwap==='function');
 need(Number.isSafeInteger(maxAgeMs)&&maxAgeMs>0&&maxAgeMs<=300000);
 let running=false;
 function fresh(v){need(Number.isSafeInteger(v)&&v<=now()&&now()-v<=maxAgeMs,'La observación está vencida.');}
 async function observation(o,p,state,{phase,after=false}={}){
 need(object(o)&&o.schema===1&&hash(o.proofSha256));fresh(o.observedAt);
 for(const k of ['sessionId','inventorySha256','artifactSha256','sourceSha256'])need(o[k]===p[k],'La sesión o el paquete cambió.');
 const derived=state.completed.includes('installDerived')||(phase==='installDerived'&&after);
 const paused=state.completed.includes('pauseAdmission')||(phase==='pauseAdmission'&&after);
 need(o.rulesSha256===(derived?p.candidateRulesSha256:paused?p.pausedRulesSha256:p.baselineSha256),'Cambió la baseline de reglas.');
 need(Array.isArray(o.accesses)&&o.accesses.length===p.accessIds.length&&new Set(o.accesses.map(a=>a.id)).size===p.accessIds.length&&p.accessIds.every(id=>o.accesses.some(a=>a.id===id)),'Inventario de accesos incompleto.');
 const reopened=state.completed.includes('reopen')||(phase==='reopen'&&after);
 for(const a of o.accesses){need(hash(a.httpProofSha256)&&hash(a.sdkProofSha256)&&hash(a.runtimeProofSha256));need(['open','blocked'].includes(a.httpAdmission)&&['open','blocked'].includes(a.sdkAdmission));
  if(paused)need(a.httpAdmission===(reopened?'open':'blocked')&&a.sdkAdmission===(reopened?'open':'blocked'),'Admisión no comprobada por HTTP y SDK.');
  if(state.completed.includes('installWriters')||(phase==='installWriters'&&after))need(a.runtime==='compatible','Existe un escritor incompatible.');
 }
 const drained=state.completed.includes('drain')||(phase==='drain'&&after);
 if(drained){need(o.guard?.active===false&&hash(o.guard.proofSha256));need(o.accesses.every(a=>a.activeRequests===0),'Hay requests activos.');const f=o.fiscal;need(object(f)&&hash(f.proofSha256)&&f.jobInventoryComplete===true&&f.activeRequests===0&&f.ambiguousJobs===0&&f.pendingAttachments===0&&f.markersReconciled===true&&f.resultsReconciled===true,'Drenaje fiscal separado incompleto.');}
 const activated=state.completed.includes('activateWhilePaused')||(phase==='activateWhilePaused'&&after);
 const frozen=state.completed.includes('freeze')||(phase==='freeze'&&after);if(frozen){need(o.ready===activated,'Freeze/activación no comprobados.');need(hash(o.freezeEpoch)&&(!state.freezeEpoch||o.freezeEpoch===state.freezeEpoch),'La continuidad del freeze cambió.');}
 if(state.preparationSha256)need(o.snapshotSourcesSha256===state.snapshotSourcesSha256,'Las fuentes cambiaron desde el snapshot.');
 if(derived)need(o.derived?.complete===true&&o.derived.preparationSha256===state.preparationSha256&&hash(o.derived.proofSha256),'Falta readback de derivados.');
 if(state.completed.includes('publish')||(phase==='publish'&&after))need(o.web?.artifactSha256===p.artifactSha256&&o.web.cold===true&&o.web.warm===true&&o.web.serviceWorker===true&&hash(o.web.proofSha256),'Publicación no comprobada.');
 if(state.completed.includes('verify')||(phase==='verify'&&after)){const checks=o.acceptance;need(object(checks)&&hash(checks.proofSha256)&&['readOnly','accounts','history','deletions','ot','permissions','historicalTotals','receiptRecovery'].every(k=>checks[k]===true),'Falta aceptación integral del conjunto.');}
 if(activated){const v=o.activation;need(object(v)&&object(v.records)&&object(v.runtime)&&digest(v.pins)===p.activationPinsSha256,'Acta o pins de activación no coinciden.');let key;try{key=crypto.createPublicKey(v.publicKey);}catch{need(false);}need(crypto.createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex')===p.attestationPublicKeySha256,'Clave de acta distinta de la revisada.');need(v.pins.sourceSha256===p.sourceSha256&&v.pins.rulesSha256===p.candidateRulesSha256&&v.pins.artifactSha256===p.artifactSha256&&v.pins.activationId===p.cutId);const verifier=Attestation.createVerifier({publicKey:v.publicKey,pins:v.pins,now});for(const operation of Attestation.OPERATIONS)need(await verifier.verify({operation,runtime:v.runtime,read:async path=>structuredClone(v.records[path]??null)}),'Firma, configuración o capacidades de activación inconsistentes.');}
 return o;
 }
 async function preparation(ref,capturedAt){need(hash(ref));const value=await adapter.readPreparation(ref);need(digest(value)===ref,'El artefacto preparado cambió.');const at=Date.parse(value.input?.snapshotManifest?.observedAt);need(Number.isSafeInteger(at)&&at<=now()&&(capturedAt===undefined||at===capturedAt),'La fecha original del snapshot cambió.');await Preparation.verify(value.artifact,value.input);need(Object.values(value.artifact.manifest.issues).every(n=>n===0),'La preparación contiene conflictos pendientes.');installation(value.artifact);return value;}
 async function run(pins){
 need(!running,'Ya hay una ejecución local en curso.');validatePins(pins);running=true;
 try{
  const p=structuredClone(pins),pinsSha256=digest(p);let saved=await journal.load(p.cutId),revision=saved?.revision??null,state=saved?.value;
  if(state){need(state.schema===1&&state.pinsSha256===pinsSha256&&Array.isArray(state.completed)&&equal(state.completed,PHASES.slice(0,state.completed.length)),'Journal ajeno o fases alteradas.');need(!state.pending||state.pending.phase===PHASES[state.completed.length]);}
  else state={schema:1,pinsSha256,completed:[],pending:null,preparationSha256:null,snapshotSourcesSha256:null,drainedAt:null,frozenAt:null,freezeEpoch:null,snapshotCapturedAt:null};
  async function persist(next){const result=await journal.compareAndSwap(p.cutId,revision,structuredClone(next));need(result&&Number.isSafeInteger(result.revision)&&result.revision>=0&&result.revision!==revision,'Conflicto del journal: no continuar.');revision=result.revision;state=next;}
  async function payload(phase){let install=null;if(phase==='installDerived'){const prep=await preparation(state.preparationSha256,state.snapshotCapturedAt);install=installation(prep.artifact);}return {phase,pins:p,preparationSha256:state.preparationSha256,snapshotSourcesSha256:state.snapshotSourcesSha256,...(install?{installation:install}:{})};}
  while(state.completed.length<PHASES.length){
   const phase=PHASES[state.completed.length],command=await payload(phase),inputSha256=digest(command),operationId=p.cutId+'-'+phase;
   if(state.pending)need(state.pending.operationId===operationId&&state.pending.inputSha256===inputSha256,'El comando pendiente cambió.');
   else {const before=await observation(await adapter.observe({phase,pins:p}),p,state,{phase});await persist({...state,pending:{phase,operationId,inputSha256,observedAt:before.observedAt}});}
   let receipt=await adapter.inspect({operationId,phase,inputSha256,pins:p});
   function inspect(r){need(object(r)&&r.operationId===operationId&&r.phase===phase&&r.inputSha256===inputSha256&&hash(r.proofSha256));fresh(r.observedAt);need(['notApplied','applied','uncertain','partial'].includes(r.status));return r;}
   inspect(receipt);
   if(receipt.status==='partial'||receipt.status==='uncertain')throw fail('SV_CUT_UNCERTAIN','Resultado incierto o parcial: conservar pausa y conciliar; no repetir.');
   if(receipt.status==='notApplied'){
    await observation(await adapter.observe({phase,pins:p}),p,state,{phase});
    let actionError;try{await adapter.perform({...command,operationId,inputSha256});}catch(e){actionError=e;}
    receipt=inspect(await adapter.inspect({operationId,phase,inputSha256,pins:p}));
    if(receipt.status!=='applied')throw fail(receipt.status==='notApplied'?'SV_CUT_NOT_APPLIED':'SV_CUT_UNCERTAIN',actionError?'La operación no pudo confirmarse; conservar pausa y consultar el recibo.':'La fase no está confirmada; conservar pausa.');
   }
   let next={...state,completed:[...state.completed,phase],pending:null};
   if(phase==='snapshotPrepare'){const prep=await preparation(receipt.preparationSha256,receipt.capturedAt);need(Number.isSafeInteger(receipt.capturedAt)&&Number.isSafeInteger(receipt.appliedAt)&&receipt.capturedAt>=state.pending.observedAt&&receipt.capturedAt>=state.frozenAt&&receipt.capturedAt>=state.drainedAt&&receipt.capturedAt<=receipt.appliedAt&&receipt.appliedAt-receipt.capturedAt<=maxAgeMs&&receipt.appliedAt<=receipt.observedAt,'El snapshot no prueba captura fresca posterior al drenaje y freeze.');need(hash(receipt.snapshotSourcesSha256)&&receipt.snapshotSourcesSha256===digest(prep.artifact.manifest.sourceFingerprints));next.preparationSha256=receipt.preparationSha256;next.snapshotSourcesSha256=receipt.snapshotSourcesSha256;next.snapshotCapturedAt=receipt.capturedAt;}
   const after=await observation(await adapter.observe({phase,pins:p}),p,next,{phase,after:true});
   if(phase==='drain')next.drainedAt=after.observedAt;
   if(phase==='freeze'){next.frozenAt=after.observedAt;next.freezeEpoch=after.freezeEpoch;}
   await persist(next);
  }
  await observation(await adapter.observe({phase:'complete',pins:p}),p,state,{phase:'complete'});
  return {schema:1,complete:true,cutId:p.cutId,phases:[...state.completed],journalRevision:revision,remoteVerifiedByRunner:false};
 }finally{running=false;}
 }
 return Object.freeze({run});
}
module.exports={create,PHASES,installation,validatePins};
