(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardActivityModelV2=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
// Inactive legacy-instant contract. Prefix providers certify their complete source order.
const DOMAINS=Object.freeze(['ventas','pagos','ordenes_trabajo','presupuestos']),LIMIT=5,ORDER='legacy-ms-desc/domain-source-order-v2',SOURCE_ORDER='legacy-ms-desc/source-ordinal-v2';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),key=v=>typeof v==='string'&&v.length>0&&v.length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v);
// Intentionally matches fechaMs321, including truthiness, year remapping and Date rollover.
function legacyMs(f,ts){if(ts)return Number(ts)||0;let d=null,m;f=String(f||'');if((m=f.match(/^(\d{4})-(\d{2})-(\d{2})/)))d=new Date(+m[1],+m[2]-1,+m[3]);else if((m=f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))){let y=+m[3];if(y<100)y+=2000;d=new Date(y,+m[2]-1,+m[1]);}return d?d.getTime():0;}
function budgetCompare(a,b,sourceLocale){const na=parseInt((String(a.id||a.numero||'').match(/^PP-(\d{4})$/i)||[])[1],10)||0,nb=parseInt((String(b.id||b.numero||'').match(/^PP-(\d{4})$/i)||[])[1],10)||0;if(na&&nb&&na!==nb)return nb-na;const ta=parseInt(a.ts,10)||0,tb=parseInt(b.ts,10)||0;if(ta!==tb)return tb-ta;const fa=(a.fecha||'').split('/').reverse().join('-'),fb=(b.fecha||'').split('/').reverse().join('-');return fb.localeCompare(fa,sourceLocale);}
function eventSort(ms,ordinal){
 if(!Number.isFinite(ms)||!ms||!Number.isSafeInteger(ordinal)||ordinal<0)throw Error('Unverifiable legacy instant or source ordinal');
 const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,ms,false);const bits=view.getBigUint64(0,false),sign=1n<<63n,mask=(1n<<64n)-1n,descending=(bits&sign)?bits:(~(bits^sign)&mask);
 return descending.toString(16).padStart(16,'0')+'_'+ordinal.toString(16).padStart(14,'0');
}
function contextValid(c){return object(c)&&key(c.uid)&&typeof c.role==='string'&&!!c.role&&c.auth&&c.db&&Number.isSafeInteger(c.permissionRevision)&&c.permissionRevision>=0&&typeof c.timeZone==='string'&&c.timeZone.length>0&&typeof c.sourceLocale==='string'&&c.sourceLocale.length>0&&object(c.grants)&&DOMAINS.every(d=>Object.hasOwn(c.grants,d)&&[null,'all','own','assigned'].includes(c.grants[d]))&&!c.viewing&&c.online!==false;}
const same=(a,b)=>object(a)&&a.uid===b.uid&&a.role===b.role&&a.auth===b.auth&&a.db===b.db&&a.permissionRevision===b.permissionRevision&&a.timeZone===b.timeZone&&a.sourceLocale===b.sourceLocale&&object(a.grants)&&DOMAINS.every(d=>a.grants[d]===b.grants[d]);
const incomplete=reason=>({schema:2,complete:false,reason});
function inspect(domain,source,context,expected){
 if(!object(source)||source.schema!==2||source.domain!==domain||source.kind!=='verified-legacy-instant-prefix')return {state:incomplete('missing-authoritative-instant-prefix'),rows:[]};
 if(!same(source.context,context)||source.scope!==context.grants[domain]||source.timeZone!==context.timeZone||source.sourceLocale!==context.sourceLocale)return {state:incomplete('authorization-or-timezone-changed'),rows:[]};
 if(!object(expected)||source.generation!==expected.generation||source.revision!==expected.revision||!key(source.generation)||!Number.isSafeInteger(source.revision)||source.revision<1)return {state:incomplete('coverage-changed-or-missing'),rows:[]};
 if(source.order!==SOURCE_ORDER||source.fromStart!==true||source.filter!==(domain==='pagos'?'legacy-not-annulled':'legacy-ms-truthy')||!Array.isArray(source.rows)||source.rows.length>LIMIT||typeof source.exhausted!=='boolean'||source.rows.length<LIMIT&&!source.exhausted)return {state:incomplete('not-an-authoritative-first-instant-prefix'),rows:[]};
 try{
  const seen=new Set(),ordinals=new Set(),rows=[];let previous='';
  for(const row of source.rows){
   if(!object(row)||!key(row.key)||seen.has(row.key)||ordinals.has(row.sourceOrdinal)||row.sort!==eventSort(row.ms,row.sourceOrdinal)||previous&&row.sort<=previous||![row.number,row.client,row.status].every(v=>typeof v==='string')||source.scope==='own'&&row.ownerUid!==context.uid||source.scope==='assigned'&&(!Array.isArray(row.authorizedUids)||!row.authorizedUids.includes(context.uid))||domain==='pagos'&&row.anulado)throw Error('Unverifiable row');
   previous=row.sort;seen.add(row.key);ordinals.add(row.sourceOrdinal);rows.push({...row,domain,id:domain+'/'+row.key});
  }
  return {state:{schema:2,complete:true,generation:source.generation,revision:source.revision,scope:source.scope},rows};
 }catch(_){return {state:incomplete('invalid-or-unauthorized-instant-row'),rows:[]};}
}
function merge({context,sources,expected}={}){
 if(!contextValid(context))return {schema:2,complete:false,status:'incomplete',items:[],sources:Object.fromEntries(DOMAINS.map(d=>[d,incomplete('invalid-context')]))};
 const states={},rows=[];for(const domain of DOMAINS){if(context.grants[domain]===null){states[domain]={schema:2,complete:true,excluded:true};continue;}const result=inspect(domain,sources?.[domain],context,expected?.[domain]);states[domain]=result.state;rows.push(...result.rows);}
 // Equivalent to the renderer's stable b.ms-a.ms sort over concatenated source arrays.
 rows.sort((a,b)=>b.ms-a.ms||DOMAINS.indexOf(a.domain)-DOMAINS.indexOf(b.domain)||a.sourceOrdinal-b.sourceOrdinal);
 const complete=Object.values(states).every(s=>s.complete);return {schema:2,complete,status:complete?(rows.length?'ready':'empty'):'incomplete',order:ORDER,precision:'legacy-instant',items:rows.slice(0,LIMIT),sources:states};
}
function budgetPrefix({result,captured,context}={}){
 if(!contextValid(context)||!same(captured,context)||!object(result)||result.schema!==2||result.uid!==context.uid||result.role!==context.role||result.permissionRevision!==context.permissionRevision||result.scope!==context.grants.presupuestos||result.recent?.schema!==2||result.recent.timeZone!==context.timeZone||result.recent.sourceLocale!==context.sourceLocale||result.recent.generation!==result.generation||result.recent.revision!==result.revision)return null;
 return {...result.recent,context:{...context}};
}
return Object.freeze({DOMAINS,LIMIT,ORDER,SOURCE_ORDER,legacyMs,budgetCompare,eventSort,merge,budgetPrefix});
});
