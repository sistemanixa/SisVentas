'use strict';
// Pure proposal. No transport, persistence, clock, activation or mutation of originals.
const Own=require('./commercial-ownership'),{digest}=require('./labor-guard');
const {normalizeRtdb}=require('./payment-membership-index');
const ACTIVE=Object.freeze(['borrador','revision','aprobado_int','enviado','visto','aceptado']);
const NOTICE_ACTIVE=Object.freeze(ACTIVE.filter(s=>s!=='aceptado'));
const DOCUMENT_ORDER='document-date-desc/budget-key-sha256-v1';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=(message='La proyección de presupuestos requiere revisión.',code='SV_BUDGET_PROPOSAL_INVALID')=>Object.assign(Error(message),{code});
const check=(v,m)=>{if(!v)throw fail(m);};
const key=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const text=(v,max=200)=>typeof v==='string'?v.slice(0,max):'';
const policyHash=s=>digest({users:s.users,identities:s.identities,permissions:s.permissions});
function policy(s){check(object(s)&&['users','identities','permissions'].every(k=>object(s[k])));return Own.profiles(s.users,s.identities);}
function day(raw){
 const s=typeof raw==='string'?raw.trim():'',m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/)||s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:$|\s)/);
 if(!m)return null;let y,n,d;if(s.includes('/')){y=Number(m[3]);if(y<100)y+=2000;n=+m[2];d=+m[1];}else{y=+m[1];n=+m[2];d=+m[3];}
 const date=new Date(Date.UTC(y,n-1,d));if(date.getUTCFullYear()!==y||date.getUTCMonth()!==n-1||date.getUTCDate()!==d)return null;return date.toISOString().slice(0,10);
}
function documentSort(date,id){check(key(id)&&day(date)===date,'Documento sin clave o fecha canónica.');return String(99999999-Number(date.replaceAll('-',''))).padStart(8,'0')+'_'+digest(id);}
const epoch=(s,offset)=>{const d=day(s);return d===null?0:Date.parse(d+'T00:00:00Z')-offset*60000;};
const timestampDay=(n,offset)=>{if(!Number.isFinite(n)||n<=0)return null;const d=new Date(n+offset*60000);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):null;};
function sentDay(row,offset){
 if(typeof row.enviadoTs==='number'&&row.enviadoTs>0)return timestampDay(row.enviadoTs,offset);
 const raw=row.enviadoEn||row.fechaEnvio,d=typeof raw==='number'?timestampDay(raw,offset):day(raw);if(d)return d;
 const audit=Array.isArray(row.audit)?row.audit.slice().reverse():[];
 const event=audit.find(e=>/enviado al cliente/i.test(String(e?.accion||'')));return day(event?.fecha);
}
function projectRecord({key:id,original:row,ownerUid,offsetMinutes:offset}={}){
 check(key(id)&&object(row)&&[Object.prototype,null].includes(Object.getPrototypeOf(row)),'El original debe ser un registro JSON individual.');
 check((ownerUid===''||typeof ownerUid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(ownerUid))&&Number.isInteger(offset)&&Math.abs(offset)<=840,'Falta propietario resuelto u offset válido.');
 try{check(object(normalizeRtdb(row)));}catch(_){throw fail('El original no es un snapshot JSON válido.');}
 const sourceHash=digest(row),amount=parseFloat(row.total);
 const normalized=String(row.estado||'').trim().toLowerCase();
 const admits=!['eliminado','anulado','anulada','cancelado','cancelada'].some(k=>row[k]===true)&&!['anulado','anulada','cancelado','cancelada','eliminado','rechazado','vencido','convertido'].includes(normalized);
 return {key:id,sourceHash,ownerUid,number:text(row.id||row.numero,128),client:text(row.cliente),status:text(row.estado,80),date:text(row.fecha,80),ts:['number','string'].includes(typeof row.ts)?row.ts:null,employeeLabel:text(row.empleado,160),dueRaw:text(row.vence,80),dueDay:day(row.vence),sentDay:sentDay(row,offset),admits,
  approvalStamp:text(String(row.aprobadoEn||''),80),approvedBy:text(row.aprobadoPor,160),reason:text(row.motivo,500),amount:Number.isFinite(amount)?amount:null};
}
function counts(rows){const active=rows.filter(r=>ACTIVE.includes(r.status)).length,converted=rows.filter(r=>r.status==='convertido').length,totalNonCancelled=rows.filter(r=>r.status!=='anulado').length;return {active,converted,totalNonCancelled,conversionPercent:totalNonCancelled?Math.round(converted/totalNonCancelled*100):0};}
function order(a,b){
 const number=r=>parseInt((r.number.match(/^PP-(\d{4})$/i)||[])[1],10)||0,na=number(a),nb=number(b);if(na&&nb&&na!==nb)return nb-na;
 const ta=parseInt(a.ts,10)||0,tb=parseInt(b.ts,10)||0;if(ta!==tb)return tb-ta;
 return b.date.split('/').reverse().join('-').localeCompare(a.date.split('/').reverse().join('-'));
}
function summarize(entries){
 const scopes={all:Object.keys(entries)};for(const row of Object.values(entries))if(row.ownerUid)(scopes['u_'+row.ownerUid]??=[]).push(row.key);
 return Object.fromEntries(Object.entries(scopes).map(([name,keys])=>[name,{keys,counts:counts(keys.map(k=>entries[k]))}]));
}
function build({records,complete,users,identities,permissions,generation,revision=1,offsetMinutes}={}){
 check(complete===true&&object(records),'Falta una fuente completa de presupuestos.');check(key(generation)&&Number.isSafeInteger(revision)&&revision>=1&&Number.isInteger(offsetMinutes)&&Math.abs(offsetMinutes)<=840);
 const authority={users,identities,permissions},people=policy(authority),entries=Object.fromEntries(Object.entries(records).map(([id,row])=>[id,projectRecord({key:id,original:row,ownerUid:Own.owner(row,'presupuestos',people)||'',offsetMinutes})]));
 return {schema:1,proposal:true,activationAuthorized:false,generation,revision,complete:true,offsetMinutes,documentOrder:DOCUMENT_ORDER,policyHash:policyHash(authority),sourceCount:Object.keys(records).length,unresolvedOwners:Object.values(entries).filter(e=>!e.ownerUid).length,entries,scopes:summarize(entries),receipts:{}};
}
function scope(model,{uid,users,identities,permissions}={}){
 check(model?.schema===1&&model.proposal===true&&model.complete===true&&model.activationAuthorized===false);
 const authority={users,identities,permissions},people=policy(authority),person=people.find(p=>p.uid===uid);
 if(!person||!Own.eligible(person.role,'presupuestos',permissions))throw fail('Usuario sin alcance comercial.','SV_BUDGET_PROPOSAL_ACCESS');
 if(policyHash(authority)!==model.policyHash)throw fail('La política cambió; reconstruí la propuesta.','SV_BUDGET_PROPOSAL_POLICY_CHANGED');
 const name=person.role==='admin'?'all':'u_'+uid,selected=model.scopes[name]||{keys:[],counts:counts([])};
 return {name,uid,role:person.role,rows:selected.keys.map(k=>model.entries[k]),counts:structuredClone(selected.counts),generation:model.generation,revision:model.revision};
}
function metrics(model,actor){const s=scope(model,actor);return {schema:1,scope:s.name,generation:s.generation,revision:s.revision,complete:true,counts:s.counts};}
function recent(model,actor){
 const s=scope(model,actor),candidates=s.rows.slice().sort(order).slice(0,60).map((r,i)=>({key:r.key,number:r.number,client:r.client,status:r.status,ms:r.ts?Number(r.ts)||0:epoch(r.date,model.offsetMinutes),budgetOrder:i,domainOrder:3})).filter(r=>r.ms).sort((a,b)=>b.ms-a.ms||a.budgetOrder-b.budgetOrder).slice(0,5);
 return {scope:s.name,generation:s.generation,revision:s.revision,semantics:'legacy-number-window-60',candidateWindow:60,mergeLimit:5,completeForBudgetContribution:false,completeGlobalTopFive:false,completeMixedActivity:false,certifiedActivityInstant:false,rows:candidates};
}
function documentPrefix(model,actor,{context}={}){
 const s=scope(model,actor),grant=s.name==='all'?'all':'own',revision=actor.permissions?.[s.role]?.indiceRevision||0;
 check(context?.uid===s.uid&&context.role===s.role&&context.permissionRevision===revision&&context.auth&&context.db&&['ventas','pagos','ordenes_trabajo','presupuestos'].every(domain=>Object.hasOwn(context.grants||{},domain)&&[null,'all','own','assigned'].includes(context.grants[domain]))&&context.grants.presupuestos===grant&&!context.viewing&&context.online!==false,'El contexto no coincide con el prefijo autorizado.');
 check(model.documentOrder===DOCUMENT_ORDER,'El orden documental requiere reconstrucción.');
 const base={schema:1,domain:'presupuestos',kind:'verified-recent-prefix',context:{...context},scope:grant,generation:s.generation,revision:s.revision,order:DOCUMENT_ORDER,fromStart:true,filter:'all',precision:'day',certifiedActivityInstant:false};
 if(s.rows.some(r=>!day(r.date)))return {...base,kind:'incomplete-budget-prefix',complete:false,reason:'unknown-document-dates',rows:[],exhausted:false};
 const rows=s.rows.map(r=>{const date=day(r.date),sort=documentSort(date,r.key);return {key:r.key,date,sort,number:r.number,client:r.client,status:r.status,ownerUid:r.ownerUid,amountCents:null};}).sort((a,b)=>a.sort<b.sort?-1:a.sort>b.sort?1:0);
 return {...base,complete:true,completeDocumentDatePrefix:true,exhausted:rows.length<=5,rows:rows.slice(0,5)};
}
function legacyMonth(model,actor,{month,employeeLabel}={}){
 check(/^\d{4}-(0[1-9]|1[0-2])$/.test(month)&&typeof employeeLabel==='string');const s=scope(model,actor),rows=s.rows.filter(r=>r.employeeLabel===employeeLabel&&r.date.slice(0,7)===month),converted=rows.filter(r=>r.status==='convertido').length;
 return {scope:s.name,month,total:rows.length,converted,conversionPercent:rows.length?Math.round(converted/rows.length*100):0,authorFacetOnly:true};
}
function notices(model,actor,{asOfDay,horizonDays,expiryEnabled,noResponseEnabled,canApprove,canApproveWithinLimit,after=0,limit=20}={}){
 check(day(asOfDay)===asOfDay&&Number.isInteger(horizonDays)&&horizonDays>=0&&horizonDays<=30&&[expiryEnabled,noResponseEnabled,canApprove,canApproveWithinLimit].every(v=>typeof v==='boolean')&&Number.isSafeInteger(after)&&after>=0&&Number.isInteger(limit)&&limit>=1&&limit<=50);
 const s=scope(model,actor),today=epoch(asOfDay,0),in48=new Date(today+2*86400000).toISOString().slice(0,10),rows=[];let badgeCount=0,upcoming48Count=0;
 for(const r of s.rows.slice().sort((a,b)=>a.key.localeCompare(b.key))){
  if(!r.admits)continue;
  if(NOTICE_ACTIVE.includes(r.status)&&r.dueRaw&&r.dueRaw<=in48){badgeCount++;if(r.dueRaw>=asOfDay)upcoming48Count++;}
  const add=(kind,extra={})=>rows.push({key:r.key,kind,id:kind==='approval'?'ppto_aprob_'+r.number:kind==='approved'?'ppto_aprobado_int_'+r.number+'_'+r.approvalStamp:kind==='expiry'?'ppto_vence_'+r.number:'ppto_sinresp_'+r.number,number:r.number,client:r.client,status:r.status,...extra});
  if(canApprove&&r.status==='revision')add('approval',{reason:r.reason});
  if(canApproveWithinLimit&&r.status==='aprobado_int'&&r.ownerUid===s.uid)add('approved',{approvedBy:r.approvedBy,approvalStamp:r.approvalStamp});
  // Existing UI returns before no-response checks when the due date is absent/invalid.
  if(!r.dueRaw||!r.dueDay)continue;
  const days=Math.round((epoch(r.dueDay,0)-today)/86400000);
  if(expiryEnabled&&days>=0&&days<=horizonDays)add('expiry',{days,urgent:days<=1,amount:r.amount});
  if(noResponseEnabled&&r.status==='enviado'&&r.sentDay){const elapsed=Math.max(0,Math.floor((today-epoch(r.sentDay,0))/86400000));if(elapsed>=5)add('no-response',{days:elapsed,sentDay:r.sentDay});}
 }
 return {scope:s.name,generation:s.generation,revision:s.revision,asOfDay,total:rows.length,badgeCount,upcoming48Count,rows:rows.slice(after,after+limit),next:after+limit<rows.length?after+limit:null,allNoticesReturned:after===0&&rows.length<=limit,shownDedupApplied:false};
}
function apply(model,command,authority){
 check(model?.schema===1&&model.proposal===true&&model.complete===true&&model.activationAuthorized===false);
 check(object(command)&&key(command.id)&&Number.isSafeInteger(command.expectedRevision)&&Array.isArray(command.changes)&&command.changes.length>0);
 const people=policy(authority);if(policyHash(authority)!==model.policyHash)throw fail('La política cambió.','SV_BUDGET_PROPOSAL_POLICY_CHANGED');
 const hash=digest(command),receipt=Object.hasOwn(model.receipts,command.id)?model.receipts[command.id]:null;if(receipt){if(receipt!==hash)throw fail('El identificador corresponde a otro intento.','SV_BUDGET_PROPOSAL_CONFLICT');return structuredClone(model);}
 if(model.revision!==command.expectedRevision)throw fail('La revisión cambió.','SV_BUDGET_PROPOSAL_CONFLICT');
 const next=structuredClone(model),seen=new Set();for(const c of command.changes){check(key(c.key)&&!seen.has(c.key));seen.add(c.key);if((model.entries[c.key]?.sourceHash??digest(null))!==c.beforeHash)throw fail('El original cambió.','SV_BUDGET_PROPOSAL_CONFLICT');if(c.after===null)delete next.entries[c.key];else next.entries[c.key]=projectRecord({key:c.key,original:c.after,ownerUid:Own.owner(c.after,'presupuestos',people)||'',offsetMinutes:model.offsetMinutes});}
 next.revision++;check(Number.isSafeInteger(next.revision));next.sourceCount=Object.keys(next.entries).length;next.unresolvedOwners=Object.values(next.entries).filter(e=>!e.ownerUid).length;next.scopes=summarize(next.entries);next.receipts[command.id]=hash;return next;
}
module.exports={ACTIVE,NOTICE_ACTIVE,DOCUMENT_ORDER,documentSort,projectRecord,build,scope,metrics,recent,documentPrefix,legacyMonth,notices,apply,day};
