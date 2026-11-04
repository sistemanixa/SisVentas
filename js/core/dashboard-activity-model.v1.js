(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardActivityModel=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
// Pure merge contract, not a loader or permission provider. A host must obtain
// authorized, fresh prefixes independently of every list/search in memory.
// Existing commercial pages certify DOCUMENT DATE, not creation/update time.
// This ordering is an explicit proposal. It must not replace the legacy UI's
// timestamp order until that product decision and every source are resolved.
const DOMAINS=Object.freeze(['ventas','pagos','ordenes_trabajo','presupuestos']),ORDER='document-date-desc/source-order-v1',LIMIT=5;
const inventory=Object.freeze({
 ventas:Object.freeze({existing:true,reader:'SVCommercialPagesReader.page(sales)',index:'sv_commercial_pages/v1/pages/{scope}/sales',precision:'day',request:'cursor:null, take:5, filters:{}',limit:'The Dashboard host currently asks for active sales; that filtered prefix cannot certify all sales activity.'}),
 pagos:Object.freeze({existing:true,reader:'SVCommercialPagesReader.page(payments)',index:'sv_commercial_pages/v1/pages/{scope}/payments',precision:'day',request:'cursor:null, take:5, filters:{cancelled:false}, native:true',limit:'Native sort also encodes timestamp within the day; preserve that source order. Fewer than five rows with hasMore:true is incomplete.'}),
 ordenes_trabajo:Object.freeze({existing:false,reader:'SVRecordLists is a complete summary-list reader, not a scoped top-five reader',index:'sisventas/listados_resumen/ordenes_trabajo',precision:'unverified',proposal:'An explicitly new scoped date/key index or authorized bounded backend query with coverage is needed. Do not query a root or slice otData.'}),
 presupuestos:Object.freeze({existing:false,reader:'A verified recent-budget provider must supply the same envelope',precision:'day',proposal:'Coordinate the separate budget projection; pptoData and an arbitrary list page are not proof.'})
});
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const key=value=>typeof value==='string'&&value.length>0&&value.length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
const compare=(a,b)=>a<b?-1:a>b?1:0;
function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const year=Number(value.slice(0,4)),month=Number(value.slice(5,7)),day=Number(value.slice(8));if(year<1||month<1||month>12)return false;const leap=year%4===0&&(year%100!==0||year%400===0);return day>=1&&day<=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1];}
function sortKey(date,id){if(!validDate(date)||!key(id))throw Error('Actividad sin identidad o fecha verificadas.');const hex=Array.from(new TextEncoder().encode(id),byte=>byte.toString(16).padStart(2,'0')).join('');return String(99999999-Number(date.replaceAll('-',''))).padStart(8,'0')+'_'+hex;}
function formatCents(cents){if(!Number.isSafeInteger(cents))throw Error('Importe de actividad incompleto.');const absolute=Math.abs(cents),units=String(Math.trunc(absolute/100)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');return (cents<0?'-':'')+'$ '+units+','+String(absolute%100).padStart(2,'0');}
function sameContext(a,b){return plain(a)&&plain(b)&&a.uid===b.uid&&a.role===b.role&&a.auth===b.auth&&a.db===b.db&&a.permissionRevision===b.permissionRevision;}
function contextValid(c){return plain(c)&&key(c.uid)&&typeof c.role==='string'&&!!c.role&&c.auth&&c.db&&Number.isSafeInteger(c.permissionRevision)&&c.permissionRevision>=0&&plain(c.grants)&&DOMAINS.every(domain=>Object.hasOwn(c.grants,domain)&&[null,'all','own','assigned'].includes(c.grants[domain]))&&!c.viewing&&c.online!==false;}
const label=Object.freeze({ventas:'Venta',pagos:'Cobro',ordenes_trabajo:'OT',presupuestos:'Presupuesto'});
function event(domain,row,context,scope){
 if(!plain(row)||!key(row.key)||!validDate(row.date))throw Error('Fila incompleta.');
 const canonical=sortKey(row.date,row.key);
 if(domain==='pagos'&&row.nativeSchema===1){const stamp=row.sort?.slice(9,25),reverse=typeof stamp==='string'&&/^[a-f0-9]{16}$/.test(stamp)?Number.parseInt(stamp,16):NaN;if(!Number.isSafeInteger(reverse)||reverse<0||reverse>Number.MAX_SAFE_INTEGER||row.sort!==canonical.slice(0,9)+stamp+canonical.slice(9))throw Error('Orden del cobro incompleto.');}
 else if(row.sort!==canonical)throw Error('Orden incompleto.');
 if(scope==='own'&&row.ownerUid!==context.uid)throw Error('Actividad fuera de alcance.');
 if(scope==='assigned'&&(!Array.isArray(row.authorizedUids)||!row.authorizedUids.every(key)||!row.authorizedUids.includes(context.uid)))throw Error('Falta verificar la asignación.');
 if(domain==='pagos'&&row.cancelled!==false)throw Error('El prefijo incluye un cobro no vigente.');
 const cents=domain==='ordenes_trabajo'?null:row.amountCents;if(cents!==null&&(!Number.isSafeInteger(cents)||cents<0))throw Error('Importe no certificado.');
 if(!['number','client','status'].every(field=>typeof row[field]==='string'))throw Error('Presentación incompleta.');
 return {id:domain+'/'+row.key,domain,key:row.key,type:label[domain],number:row.number,client:row.client,status:row.status,date:row.date,precision:'day',sort:row.sort,amountCents:cents,amountLabel:cents===null?null:formatCents(cents)};
}
function incomplete(reason){return {schema:1,complete:false,reason};}
function inspect(domain,source,context,expected){
 if(!plain(source)||source.schema!==1||source.domain!==domain||source.kind!=='verified-recent-prefix')return {state:incomplete('missing-authoritative-prefix'),rows:[]};
 if(!sameContext(source.context,context)||source.scope!==context.grants[domain])return {state:incomplete('authorization-context-changed'),rows:[]};
 if(!plain(expected)||source.generation!==expected.generation||source.revision!==expected.revision||!key(source.generation)||!Number.isSafeInteger(source.revision)||source.revision<1)return {state:incomplete('coverage-changed-or-missing'),rows:[]};
 if(source.order!==ORDER||source.fromStart!==true||source.filter!==(domain==='pagos'?'non-cancelled':'all')||!Array.isArray(source.rows)||source.rows.length>50||typeof source.exhausted!=='boolean')return {state:incomplete('not-an-authoritative-first-prefix'),rows:[]};
 if(source.rows.length<LIMIT&&!source.exhausted)return {state:incomplete('prefix-not-exhausted'),rows:[]};
 try{const rows=source.rows.map(row=>event(domain,row,context,source.scope)),seen=new Set();for(let i=0;i<rows.length;i++){if(seen.has(rows[i].key)||i&&compare(rows[i-1].sort,rows[i].sort)>=0)throw Error('Orden incompleto.');seen.add(rows[i].key);}return {state:{schema:1,complete:true,generation:source.generation,revision:source.revision,scope:source.scope},rows:rows.slice(0,LIMIT)};}catch(_){return {state:incomplete('invalid-or-unauthorized-row'),rows:[]};}
}
function merge({context,sources,expected}={}){
 const states={},rows=[];if(!contextValid(context))return {schema:1,complete:false,status:'incomplete',precision:'day',items:[],sources:Object.fromEntries(DOMAINS.map(domain=>[domain,incomplete('invalid-context')]))};
 for(const domain of DOMAINS){if(context.grants[domain]===null){states[domain]={schema:1,complete:true,excluded:true};continue;}const result=inspect(domain,sources?.[domain],context,expected?.[domain]);states[domain]=result.state;rows.push(...result.rows);}
 rows.sort((a,b)=>compare(b.date,a.date)||DOMAINS.indexOf(a.domain)-DOMAINS.indexOf(b.domain)||compare(a.sort,b.sort));const complete=Object.values(states).every(state=>state.complete);
 return {schema:1,complete,status:complete?(rows.length?'ready':'empty'):'incomplete',precision:'day',items:rows.slice(0,LIMIT),sources:states};
}
// Adapter for the existing commercial reader result. request describes the
// actual query issued by the host; search/continuation/filter memory is invalid.
function commercialPrefix({domain,request,result,context,scope}={}){
 const kind=domain==='ventas'?'sales':domain==='pagos'?'payments':null;
 if(!kind||!plain(request)||request.kind!==kind||request.cursor!==null||request.take!==LIMIT||request.search!==undefined||!plain(request.filters)||Object.keys(request.filters).length!==(domain==='pagos'?1:0)||domain==='pagos'&&(request.filters.cancelled!==false||request.native!==true)||!plain(result)||!Array.isArray(result.rows)||result.rows.length>LIMIT||result.rows.some(row=>!plain(row)||domain==='pagos'&&row.nativeSchema!==1)||typeof result.hasMore!=='boolean')return null;
 const rows=result.rows.map(row=>({key:row.key,date:row.date,sort:row.sort,number:domain==='ventas'?row.number:row.saleNumber,client:row.client,status:domain==='ventas'?(row.cancelled?'anulada':row.status):(row.cancelled?'anulado':'registrado'),amountCents:domain==='ventas'?row.totalCents:row.amountCents,ownerUid:row.ownerUid,cancelled:row.cancelled,nativeSchema:row.nativeSchema}));
 return {schema:1,domain,kind:'verified-recent-prefix',context,scope,generation:result.generation,revision:result.revision,order:ORDER,fromStart:true,filter:domain==='pagos'?'non-cancelled':'all',exhausted:!result.hasMore,rows};
}
const orderingDecision=Object.freeze({status:'proposal',uiSemanticsApproved:false,globalOrder:'document date descending, then fixed domain order, then certified source order',limit:'Not equivalent to global creation/update timestamp. Budget contribution coverage or a 60-row legacy scan is not a top-five proof.'});
return Object.freeze({DOMAINS,ORDER,LIMIT,inventory,orderingDecision,sortKey,formatCents,merge,commercialPrefix});
});
