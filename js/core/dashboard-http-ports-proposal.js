(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./dashboard-activity-aggregate-proposal'):root.SVDashboardActivityAggregateProposal,typeof module==='object'&&module.exports?require('./dashboard-activity-model.v2'):root.SVDashboardActivityModelV2);if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardHTTPPortsProposal=api;})(typeof globalThis==='object'?globalThis:this,function(Aggregate,Core){
'use strict';
const ROUTES=Object.freeze({presupuestos:'/commercial/dashboard/presupuestos/actividad-v2',avisos:'/commercial/dashboard/presupuestos/avisos',ventas:'/commercial/dashboard/ventas/actividad-v2',pagos:'/commercial/dashboard/pagos/actividad-v2',ordenes_trabajo:'/commercial/dashboard/ordenes_trabajo/actividad-v2'});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),integer=v=>Number.isSafeInteger(v)&&v>=0,copy=v=>structuredClone(v);
const fail=(code='SV_DASHBOARD_HTTP_CONTRACT',statusCode=409)=>Object.assign(Error('No se pudo verificar Dashboard.'),{code,statusCode});
const check=(ok,code)=>{if(!ok)throw fail(code);};
async function discard(response){try{await response?.body?.cancel?.();}catch(_){/* Preserve the first authority/context error. */}}
function baseURL(value,host,allowLoopback){
 check(typeof value==='string'&&value===host?.SISVENTAS_FUNCTIONS?.cotizadorProveedor&&!/[\\\s%]/.test(value),'SV_DASHBOARD_HTTP_BASE');let u;try{u=new URL(value);}catch(_){throw fail('SV_DASHBOARD_HTTP_BASE',400);}
 check((u.protocol==='https:'||allowLoopback===true&&u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname))&&!u.username&&!u.password&&!u.search&&!u.hash&&!value.split('/').some(p=>p==='.'||p==='..'),'SV_DASHBOARD_HTTP_BASE');return u.href.replace(/\/$/,'');
}
function identity(r,c,schema){check(object(r)&&r.schema===schema&&r.uid===c.uid&&r.role===c.role&&r.permissionRevision===c.permissionRevision,'SV_DASHBOARD_HTTP_IDENTITY');}
function revision(r){check(typeof r.generation==='string'&&r.generation&&Number.isSafeInteger(r.revision)&&r.revision>=1);return r.generation+'|'+r.revision;}
function activity(r,domain,c){
 identity(r,c,2);const p=r.recent;check(object(p)&&p.domain===domain&&p.scope===c.grants[domain]&&p.timeZone===c.timeZone&&p.sourceLocale===c.sourceLocale);revision(p);
 check(Array.isArray(p.rows)&&p.rows.every(row=>object(row)&&Object.keys(row).length===9&&['key','date','ms','sort','number','client','status','ownerUid','amountCents'].every(k=>Object.hasOwn(row,k))&&typeof row.date==='string'&&row.date.length<=80&&typeof row.number==='string'&&row.number.length<=128&&typeof row.client==='string'&&row.client.length<=200&&typeof row.status==='string'&&row.status.length<=80&&typeof row.ownerUid==='string'&&(domain!=='ordenes_trabajo'||row.ownerUid==='')&&(['ventas','pagos'].includes(domain)?Number.isSafeInteger(row.amountCents):row.amountCents===null)));
 const context={...c,grants:Object.fromEntries(Core.DOMAINS.map(d=>[d,d===domain?c.grants[d]:null]))};check(Core.merge({context,sources:{[domain]:{...p,context}},expected:{[domain]:{generation:p.generation,revision:p.revision}}}).complete);
 if(domain==='presupuestos'){
  check(r.scope===p.scope&&revision(r)===revision(p)&&object(r.counts)&&['active','converted','totalNonCancelled'].every(k=>integer(r.counts[k]))&&r.counts.active+r.counts.converted<=r.counts.totalNonCancelled&&r.counts.conversionPercent===(r.counts.totalNonCancelled?Math.round(100*r.counts.converted/r.counts.totalNonCancelled):0));
  const b=r.badge,horizon=new Date(Date.parse(c.asOfDay+'T00:00:00Z')+2*86400000).toISOString().slice(0,10);check(object(b)&&b.complete===true&&b.asOfDay===c.asOfDay&&b.horizon===horizon&&integer(b.badgeCount)&&integer(b.upcoming48Count)&&b.upcoming48Count<=b.badgeCount&&b.contract==='legacy-raw-lex/v1');
  if(Object.hasOwn(r,'monthly'))monthly(r,c);
 }else{const s=r.coverage;check(object(s)&&['records','eligible','excluded'].every(k=>integer(s[k]))&&s.eligible+s.excluded===s.records&&p.rows.length===Math.min(5,s.eligible)&&p.exhausted===(s.eligible<=5));}
 if(domain==='ventas'&&Object.hasOwn(r,'creatorMonthly'))r={...r,creatorMonthly:creatorMonthly(r.creatorMonthly,c)};
 if(domain==='ventas'&&Object.hasOwn(r,'creatorLatest'))r={...r,creatorLatest:creatorLatest(r.creatorLatest,c)};
 return r;
}
function creatorMonthly(m,c){
 const fields=['schema','complete','creator','month','scope','generation','revision','count'];
 if(!object(m)||m.schema!==1||m.complete!==true||Object.keys(m).length!==fields.length||!fields.every(k=>Object.hasOwn(m,k))||m.creator!==c.employeeLabel||m.month!==c.month||m.scope!==(c.grants.ventas==='all'?'all':'u_'+c.uid)||typeof m.generation!=='string'||!m.generation||!Number.isSafeInteger(m.revision)||m.revision<1||!integer(m.count))return {schema:1,complete:false};
 return m;
}
function creatorLatest(m,c){
 const fields=['schema','complete','creator','month','scope','generation','revision','locale','orderContract','count','rows'],rowFields=['key','number','client','clientRecordKey','rawDate','totalCents'];
 const key=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
 const order='raw-locale-desc_loader-time-desc_ts-desc_js-index-first-asc_other-codepoint-asc_v1';
 if(!object(m)||m.schema!==1||m.complete!==true||Object.keys(m).length!==fields.length||!fields.every(k=>Object.hasOwn(m,k))||m.creator!==c.employeeLabel||m.month!==c.month||m.scope!==(c.grants.ventas==='all'?'all':'u_'+c.uid)||typeof m.generation!=='string'||!m.generation||!Number.isSafeInteger(m.revision)||m.revision<1||m.locale!==c.sourceLocale||m.orderContract!==order||!integer(m.count)||!Array.isArray(m.rows)||m.rows.length!==Math.min(5,m.count))return {schema:1,complete:false};
 const seen=new Set();for(const row of m.rows){if(!object(row)||Object.keys(row).length!==rowFields.length||!rowFields.every(k=>Object.hasOwn(row,k))||!key(row.key)||seen.has(row.key)||typeof row.number!=='string'||row.number.length>128||typeof row.client!=='string'||row.client.length>200||!(row.clientRecordKey===''||key(row.clientRecordKey))||typeof row.rawDate!=='string'||row.rawDate.slice(0,7)!==m.month||!Number.isSafeInteger(row.totalCents))return {schema:1,complete:false};seen.add(row.key);}
 return m;
}
function noticeRow(r,c){
 const fields=['key','ownerUid','number','client','status','date','ts','employeeLabel','dueRaw','dueDay','sentDay','admits','approvalStamp','approvedBy','reason','amount','noticeLegacy'];
 check(object(r)&&Object.keys(r).length===fields.length&&fields.every(k=>Object.hasOwn(r,k))&&typeof r.key==='string'&&r.key.length>0&&r.key.length<=128&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(r.key)&&!['__proto__','constructor','prototype'].includes(r.key)&&r.admits===true&&typeof r.ownerUid==='string'&&(c.grants.presupuestos==='all'||r.ownerUid===c.uid));
 for(const[k,max]of [['number',128],['client',200],['status',80],['date',80],['employeeLabel',160],['dueRaw',80],['approvalStamp',80],['approvedBy',160],['reason',500]])check(typeof r[k]==='string'&&r[k].length<=max);
 check([r.dueDay,r.sentDay].every(v=>v===null||typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))&&(r.ts===null||typeof r.ts==='string'||typeof r.ts==='number'&&Number.isFinite(r.ts))&&(r.amount===null||typeof r.amount==='number'&&Number.isFinite(r.amount)));
 const l=r.noticeLegacy,keys=['schema','idPresent','sentTs','sentRaw','auditSentRaw',...(l?.idPresent===true?['idValue']:[])];check(object(l)&&Object.keys(l).length===keys.length&&keys.every(k=>Object.hasOwn(l,k))&&l.schema===1&&typeof l.idPresent==='boolean'&&(!l.idPresent||typeof l.idValue==='string'&&l.idValue.length<=128)&&(l.sentTs===null||typeof l.sentTs==='number'&&Number.isFinite(l.sentTs)&&l.sentTs>0)&&['sentRaw','auditSentRaw'].every(k=>typeof l[k]==='string'&&l[k].length<=32||typeof l[k]==='number'&&Number.isFinite(l[k])));return r;
}
function notices(r,c){identity(r,c,1);revision(r);check(r.scope===c.grants.presupuestos&&r.complete===true&&Array.isArray(r.rows));const seen=new Set();for(const row of r.rows){noticeRow(row,c);check(!seen.has(row.key));seen.add(row.key);}return {schema:2,uid:r.uid,role:r.role,permissionRevision:r.permissionRevision,scope:r.scope,generation:r.generation,revision:r.revision,notices:{complete:true,rows:r.rows},notificationCenterComplete:false,mixedActivityComplete:false};}
function monthly(r,c){
 const m=r.monthly;check(object(m),'SV_DASHBOARD_HTTP_MONTH_MISSING');identity(m,c,1);check(revision(m)===revision(r)&&m.complete===true&&m.scope===(c.grants.presupuestos==='all'?'all':'u_'+c.uid)&&m.month===c.month&&m.employeeLabel===c.employeeLabel&&/^[a-f0-9]{64}$/.test(m.policyHash)&&integer(m.records)&&integer(m.converted)&&m.converted<=m.records&&m.conversionPercent===(m.records?Math.round(100*m.converted/m.records):0)&&typeof m.absenceCertified==='boolean'&&(m.bucketRevision===null?m.absenceCertified&&m.records===0&&m.converted===0:Number.isSafeInteger(m.bucketRevision)&&m.bucketRevision>=1&&m.bucketRevision<=m.revision&&!m.absenceCertified),'SV_DASHBOARD_HTTP_MONTH_CONTRACT');return m;
}
/** Fixed five GETs only. baseURL and host configuration are trusted bootstrap inputs. */
function create({enabled=false,baseURL:configuredBase,host=globalThis,capture,valid,fetchImpl=globalThis.fetch,requestMs=10000,allowLoopback=false}={}){
 check(typeof capture==='function'&&typeof valid==='function'&&typeof fetchImpl==='function'&&Number.isInteger(requestMs)&&requestMs>=100&&requestMs<=30000,'SV_DASHBOARD_HTTP_SETUP');
 const base=baseURL(configuredBase,host,allowLoopback),pins=new WeakMap();
 function live(c){let current;try{current=capture();if(!valid(c)||!Aggregate.same(c,Aggregate.snapshot(current))||current.viewing||current.viewUid&&current.viewUid!==c.uid||current.realUid&&current.realUid!==c.uid||host.SISVENTAS_FUNCTIONS?.cotizadorProveedor!==configuredBase)throw Error();const signature=current.configSignature??current.permissionSignature;if(!pins.has(c))pins.set(c,signature);if(pins.get(c)!==signature)throw Error();}catch(_){throw fail('SV_ACTIVITY_CONTEXT_RETIRED');}}
 async function get(kind,c){
  check(enabled===true,'SV_DASHBOARD_HTTP_DISABLED');check(Object.hasOwn(ROUTES,kind),'SV_DASHBOARD_HTTP_ROUTE');live(c);check(c.grants[kind==='avisos'?'presupuestos':kind]!==null,'SV_DASHBOARD_HTTP_DENIED');
  const controller=new AbortController(),timeout=fail('SV_DASHBOARD_HTTP_TIMEOUT',503);let done=false,expired=false,timer;
  function active(){if(expired)throw timeout;if(done)throw fail('SV_ACTIVITY_CONTEXT_RETIRED');live(c);}
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;controller.abort();reject(timeout);},requestMs);});
  try{return await Promise.race([deadline,(async()=>{
   check(typeof c.user.getIdToken==='function','SV_DASHBOARD_HTTP_TOKEN');const token=await c.user.getIdToken();active();check(typeof token==='string'&&token&&!/[\r\n]/.test(token),'SV_DASHBOARD_HTTP_TOKEN');const url=base+ROUTES[kind];
   const response=await fetchImpl(url,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});
   try{active();}catch(e){await discard(response);throw e;}
   check(response&&response.redirected!==true&&(!response.url||response.url===url),'SV_DASHBOARD_HTTP_REDIRECT');if(!response.ok){await discard(response);throw fail('SV_DASHBOARD_HTTP_DENIED',Number.isInteger(response.status)?response.status:503);}check(response.status===200,'SV_DASHBOARD_HTTP_CONTRACT');
   const value=await response.json();active();return copy(kind==='avisos'?notices(value,c):activity(value,kind,c));
  })()]);}catch(e){if(e?.code==='SV_ACTIVITY_CONTEXT_RETIRED'||e?.code?.startsWith('SV_DASHBOARD_HTTP_'))throw e;throw fail('SV_DASHBOARD_HTTP_UNAVAILABLE',503);}finally{done=true;clearTimeout(timer);controller.abort();}
 }
 function budget(c){return get('presupuestos',c);}
 function port(kind){const wrapped=Aggregate.port({capture,valid,read:async q=>kind==='budget'?budget(q.context):kind==='month'?monthly(await get('presupuestos',q.context),q.context):get(q.domain,q.context)});return Object.freeze({async read(q){check(object(q)&&Object.keys(q).length===(kind==='commercial'?3:2)&&q.schema===1&&Object.hasOwn(q,'context')&&(kind!=='commercial'||['ventas','pagos','ordenes_trabajo'].includes(q.domain)),'SV_DASHBOARD_HTTP_ROUTE');return wrapped.read(q);}});}
 const ports=Object.freeze({budget:port('budget'),commercial:port('commercial'),month:port('month')});
 return Object.freeze({ports,async read(kind='dashboard'){check(kind==='dashboard'||kind==='notices','SV_DASHBOARD_HTTP_ROUTE');const c=Aggregate.snapshot(capture());live(c);return kind==='dashboard'?budget(c):get('avisos',c);}});
}
return Object.freeze({create,ROUTES});
});
