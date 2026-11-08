'use strict';
// Pure evidence inspector, not a queue reader or a remote attestation issuer.
// Gen1 does not acquire a local outbox entry before the HTTP admission gate.
// An empty/missing RTDB event ledger never certifies an empty native backlog.
// This tool classifies caller-supplied records only. No operational authoritative
// inventory provider exists here, so canConcludeDrain ALWAYS remains false.
// Signatures, queueEmpty or authoritative booleans do not change that boundary.
const crypto=require('node:crypto'),{digest}=require('../../cotizador/labor-guard');
const INSTANCE='nixa-sisventas-default-rtdb',PROJECT='nixa-sisventas',MAX_EVENT_AGE_MS=86400000,RETAINED_ARCHIVE='5e01b056b276746540d28917e276a1be3b8590cd8ea13b9fbad3e13980d9d46f';
const FORWARDERS=Object.freeze(['sisventasCommissionPayment','sisventasCommissionPaid','sisventasCommissionEnabled']);
const STATES=new Set(['retained','inflight','acknowledged','expired','review']),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function inspect(input={},options={}){
 const now=options.now??Date.now(),maxAgeMs=options.maxAgeMs??60000,reasons=[],events=[],counts={retainedForRetry:0,expiredOrReview:0,replayPending:0,active:0,completed:0,unmatchedLedger:0};
 const fail=reason=>{if(!reasons.includes(reason))reasons.push(reason);};
 const fresh=at=>Number.isSafeInteger(at)&&at<=now&&now-at<=maxAgeMs;
 const result=()=>({schema:1,scope:'commission-event-delivery-observations-only',remoteVerified:false,canConcludeDrain:false,inventorySupplied:!!plain(input.inventory),locallyConsistent:!!(plain(input.inventory)&&reasons.length===0&&Object.entries(counts).every(([k,n])=>k==='completed'||n===0)),counts,events,reasons,missingExternalEvidence:['authoritative inventory of native deliveries not yet admitted to RTDB','live retry/retention and oldest-delivery observations for all three forwarders','reconciled expired/review/replay dispositions against durable operation receipts'],note:'Caller-supplied observations only. No operational authority or inventory issuer is implemented. Empty ledger and even locally consistent records cannot close the cut or certify historical commissions.'});
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>300000){fail('invalid_clock');return result();}
 const ledger=input.ledger;let records=null;
 if(!plain(ledger)||!fresh(ledger.observedAt)||!(ledger.records===null||plain(ledger.records))){fail('ledger_not_observed');}
 else records=ledger.records||{};
 const p=input.inventory;
 if(!plain(p)){fail('external_native_inventory_missing');return result();}
 if(p.schema!==1||p.kind!=='commission-native-delivery-inventory'||p.project!==PROJECT||p.instance!==INSTANCE||!fresh(p.observedAt)||!hash(p.ledgerSha256)||!plain(ledger)||p.ledgerSha256!==digest(ledger)){fail('inventory_binding_invalid');return result();}
 const w=p.window;if(!plain(w)||!Number.isSafeInteger(w.from)||!Number.isSafeInteger(w.through)||!Number.isSafeInteger(w.admissionClosedAt)||w.from>w.admissionClosedAt||w.admissionClosedAt>w.through||w.through!==p.observedAt||w.from>now-MAX_EVENT_AGE_MS){fail('inventory_window_incomplete');}
 if(!Array.isArray(p.forwarders)||p.forwarders.length!==FORWARDERS.length||new Set(p.forwarders.map(f=>f?.id)).size!==FORWARDERS.length){fail('forwarder_inventory_incomplete');return result();}
 for(const id of FORWARDERS){const f=p.forwarders.find(f=>f?.id===id);if(!f||f.versionId!=='1'||f.sourceArchiveSha256!==RETAINED_ARCHIVE||!fresh(f.observedAt)||!hash(f.proofSha256)){fail('forwarder_source_or_observation_unproven');continue;}if(f.retryEnabled!==true||!Number.isSafeInteger(f.nativeRetentionMs)||f.nativeRetentionMs<MAX_EVENT_AGE_MS||f.forwarderMaxAgeMs!==MAX_EVENT_AGE_MS)fail('retry_or_retention_unproven');}
 if(!Array.isArray(p.pages)||p.pages.length>10000){fail('native_pages_missing');return result();}
 const native=[],ids=new Set();
 for(const id of FORWARDERS){const pages=p.pages.filter(page=>page?.functionId===id);if(!pages.length){fail('native_pages_incomplete');continue;}let cursor=null,ended=false;const cursors=new Set();
  for(const page of pages){if(ended||!plain(page)||page.cursor!==cursor||!fresh(page.observedAt)||page.status!==200||page.coverage!=='retained-inflight-and-terminal-expirations'||!hash(page.proofSha256)||!Array.isArray(page.rows)||page.recordCount!==page.rows.length||page.from!==w?.from||page.through!==w?.through||!(page.nextCursor===null||typeof page.nextCursor==='string'&&page.nextCursor.length>0&&page.nextCursor.length<=512)){fail('native_pages_incomplete');break;}
   const cursorKey=page.cursor===null?'initial':page.cursor;if(cursors.has(cursorKey)){fail('native_pages_incomplete');break;}cursors.add(cursorKey);native.push(...page.rows.map(row=>({row,functionId:id})));cursor=page.nextCursor;ended=cursor===null;
  }if(!ended)fail('native_pages_incomplete');
 }
 if(p.pages.some(page=>!FORWARDERS.includes(page?.functionId)))fail('native_pages_outside_scope');
 const matchedLedger=new Set();
 for(const {row:e,functionId}of native){
  const match=typeof e?.ref==='string'&&e.ref.match(/^sisventas\/(pagos|ventas)\/([A-Za-z0-9_-]{1,128})\/(monto|estadoPago|comisionHabilitada)$/),expected=match&&(match[1]==='pagos'&&match[3]==='monto'?'sisventasCommissionPayment':match[1]==='ventas'&&match[3]==='estadoPago'?'sisventasCommissionPaid':match[1]==='ventas'&&match[3]==='comisionHabilitada'?'sisventasCommissionEnabled':null);
  if(!plain(e)||typeof e.id!=='string'||!e.id||e.id.length>512||/[\r\n]/.test(e.id)||!match||expected!==functionId||!Number.isSafeInteger(e.createdAt)||e.createdAt>now||e.createdAt>w?.through||!STATES.has(e.nativeState)||!hash(e.proofSha256)){fail('native_event_invalid');continue;}
  const eventId=functionId+'\0'+e.id;if(ids.has(eventId)){fail('duplicate_native_event');continue;}ids.add(eventId);
  const source='//firebasedatabase.googleapis.com/projects/_/locations/us-central1/instances/'+INSTANCE,eventHash=crypto.createHash('sha256').update(JSON.stringify([source,e.id,match[1],match[2]])).digest('hex'),record=records?.[eventHash];if(record)matchedLedger.add(eventHash);
  const ageMs=now-e.createdAt;let classification;
  if(e.nativeState==='expired'||e.nativeState==='review'||record?.state==='review'||Number(record?.attempts)>=5&&record?.state!=='completed'||ageMs>MAX_EVENT_AGE_MS&&record?.state!=='completed'){classification='expiredOrReview';}
  else if(e.nativeState==='inflight'||record?.state==='processing'&&Number(record.leaseUntil)>now){classification='active';}
  else if(e.nativeState==='retained'){if(!Number.isSafeInteger(e.retainedUntil)||e.retainedUntil<e.createdAt+MAX_EVENT_AGE_MS||e.retainedUntil<=now)fail('event_retention_not_proven');classification='retainedForRetry';}
  else if(e.nativeState==='acknowledged'&&record?.state==='completed'){classification='completed';}
  else classification='replayPending';
  counts[classification]++;events.push({eventHash,functionId,ageMs,classification,...(classification==='retainedForRetry'?{remainingForwarderMs:Math.max(0,MAX_EVENT_AGE_MS-ageMs)}:{})});
 }
 if(records)for(const [id,record]of Object.entries(records)){if(!hash(id)||!plain(record)||!['completed','review','processing','error'].includes(record.state)){fail('ledger_record_invalid');continue;}if(!matchedLedger.has(id)&&record.state!=='completed'){counts.unmatchedLedger++;fail('ledger_pending_without_native_inventory_match');}}
 if(counts.retainedForRetry)fail('native_retry_retained_not_drained');if(counts.expiredOrReview)fail('event_expired_or_requires_review');if(counts.replayPending)fail('replay_or_terminal_receipt_pending');if(counts.active)fail('delivery_or_processing_inflight');
 return result();
}
module.exports={inspect,FORWARDERS,INSTANCE,PROJECT,MAX_EVENT_AGE_MS,RETAINED_ARCHIVE};
