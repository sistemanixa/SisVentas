'use strict';
const unavailable=()=>Object.assign(Error('Últimas ventas por creador sin evidencia suficiente.'),{code:'SV_CREATOR_LATEST_NOT_READY',statusCode:503});
function timestamp(fecha,respaldoTs){
 if(fecha instanceof Date)return fecha.getTime();
 const texto=String(fecha||'').trim().split(' ')[0].split('T')[0];let partes;
 if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(texto)){partes=texto.split('-').map(Number);return Date.UTC(partes[0],partes[1]-1,partes[2]);}
 if(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(texto)){partes=texto.split(/[\/-]/).map(Number);return Date.UTC(partes[2]<100?2000+partes[2]:partes[2],partes[1]-1,partes[0]);}
 const nativo=Date.parse(texto);return Number.isNaN(nativo)?parseFloat(respaldoTs)||0:nativo;
}
function evidence(s){try{
 const raw=s.fecha||'';
 if(typeof raw!=='string')return null;
 const fechaOrden=String(s.fechaOrden||s.fechaISO||(()=>{const ts=timestamp(s.fecha,s.ts);if(!ts)return '';const d=new Date(ts);return isNaN(d.getTime())?'':d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');})()||'').slice(0,10);
 const loaderTime=timestamp(fechaOrden||s.fecha,s.ts),loaderTs=Number(s.ts||0);
 return Number.isFinite(loaderTime)&&Number.isFinite(loaderTs)?{schema:1,rawDate:raw,loaderTime,loaderTs}:null;
 }catch(_){return null;}}
const indexKey=k=>/^(0|[1-9]\d*)$/.test(k)&&Number(k)<4294967295;
const ORDER_CONTRACT='raw-locale-desc_loader-time-desc_ts-desc_js-index-first-asc_other-codepoint-asc_v1';
function stableKeyCompare(a,b){
 const ai=indexKey(a),bi=indexKey(b);
 if(ai&&bi)return Number(a)-Number(b);
 if(ai!==bi)return ai?-1:1;
 const ac=Array.from(a,c=>c.codePointAt(0)),bc=Array.from(b,c=>c.codePointAt(0));
 for(let i=0;i<Math.min(ac.length,bc.length);i++)if(ac[i]!==bc[i])return ac[i]-bc[i];
 return ac.length-bc.length;
}
function select({meta,coverage,scope,creator,month,members,locale,expectedLocale}={}){
 const Model=require('./commercial-pages-model');
 if(!coverage?.ready||coverage.schema!==1||coverage.scopes?.[scope]!==true||meta?.generation!==coverage.generation||!Number.isSafeInteger(meta?.revision)||meta.revision<0||meta.revision>coverage.revision||meta?.creatorLatestSchema!==1)throw unavailable();
 if(typeof locale!=='string'||locale!==expectedLocale)throw unavailable();
 let collator;try{collator=new Intl.Collator(locale);if(Intl.Collator.supportedLocalesOf([locale],{localeMatcher:'lookup'})[0]!==locale)throw unavailable();}catch(_){throw unavailable();}
 const count=Model.creatorMonthCount(meta,{creator,month});
 if(members!=null&&(typeof members!=='object'||Array.isArray(members)))throw unavailable();
 const rows=Object.entries(members||{}).map(([key,v])=>{
 if(!Model.key(key)||!v||v.key!==key||v.schema!==1||v.creatorHash!==Model.hash(JSON.stringify(creator))||v.creatorMonth!==month||typeof v.rawDate!=='string'||v.rawDate.slice(0,7)!==month||!Number.isFinite(v.loaderTime)||!Number.isFinite(v.loaderTs))throw unavailable();
 return v;
 });
 if(rows.length!==count)throw unavailable();
 rows.sort((a,b)=>{
 const raw=collator.compare(b.rawDate,a.rawDate);if(raw)return raw;
 const load=b.loaderTime-a.loaderTime||b.loaderTs-a.loaderTs;if(load)return load;
 // Deliberate presentation tie-break; no claim of legacy insertion-order parity.
 return stableKeyCompare(a.key,b.key);
 });
 return {schema:1,orderContract:ORDER_CONTRACT,generation:coverage.generation,revision:coverage.revision,scope,creatorHash:Model.hash(JSON.stringify(creator)),month,locale,count,scanned:rows.length,refs:rows.slice(0,5).map(v=>({key:v.key,rawDate:v.rawDate}))};
}
module.exports={evidence,select,timestamp,stableKeyCompare,ORDER_CONTRACT};

// The caller authorizes scope and supplies a fresh server read; no originals path.
async function readLatest({read,scope,creator,month,locale,expectedLocale}={}){
 const Model=require('./commercial-pages-model');
 if(typeof read!=='function'||!(scope==='all'||typeof scope==='string'&&scope.startsWith('u_')&&Model.key(scope.slice(2)))||typeof creator!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw unavailable();
 const root=Model.ROOT,header=await read(root+'/coverage'),meta=await read(root+'/totals/'+scope);
 const members=await read(root+'/creatorMonths/'+scope+'/'+Model.hash(JSON.stringify(creator))+'/'+month);
 const selected=select({meta,coverage:header,scope,creator,month,members,locale,expectedLocale});
 const rows=await Promise.all(selected.refs.map(async ref=>{
 const row=await read(root+'/records/sales/'+ref.key),member=members[ref.key],order=row?.creatorOrder,fields=['schema','rawDate','loaderTime','loaderTs'];
 if(!row||row.key!==ref.key||row.creatorHash!==selected.creatorHash||row.creatorMonth!==month||scope!=='all'&&row.ownerUid!==scope.slice(2)||!order||Object.prototype.toString.call(order)!=='[object Object]'||Reflect.ownKeys(order).length!==fields.length||fields.some(k=>!Object.prototype.propertyIsEnumerable.call(order,k)||order[k]!==member[k])||!Number.isSafeInteger(row.totalCents))throw unavailable();
 return {...row,creatorRawDate:ref.rawDate};
 }));
 const after=await read(root+'/coverage');
 if(!after?.ready||after.generation!==header.generation||after.revision!==header.revision||after.scopes?.[scope]!==true)throw unavailable();
 return {...selected,rows};
}
module.exports.readLatest=readLatest;
