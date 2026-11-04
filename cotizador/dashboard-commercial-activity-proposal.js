'use strict';
// Inactive technical index: originals stay in their domains; Pages owns money/ownership.
const Core=require('./commercial-models/dashboard-activity-model.v2'),Instant=require('./commercial-models/dashboard-activity-instant.v1');
const Pages=require('./commercial-pages-model'),{digest}=require('./labor-guard'),{normalizeRtdb}=require('./payment-membership-index');
const ROOT='sv_dashboard_commercial_activity_proposal/v1',DOMAINS=['ventas','pagos','ordenes_trabajo'],hash=v=>digest(normalizeRtdb(v));
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_COMMERCIAL_ACTIVITY_RECONCILE'});
function check(value,message){if(!value)throw fail(message);}
const safe=(v,n)=>String(v??'').slice(0,n),pageKind=d=>d==='ventas'?'sales':'payments';
function zone(v){try{return Instant.canonicalZone(v);}catch(_){throw fail('Falta una zona IANA explícita.');}}
function context(c){check(c?.schema===3&&c.ready===true&&Pages.key(c.generation)&&Number.isSafeInteger(c.revision)&&c.revision>=1&&c.order===Core.SOURCE_ORDER&&zone(c.timeZone)===c.timeZone&&typeof c.sourceLocale==='string'&&c.sourceLocale.length>0&&DOMAINS.every(d=>c.scopes?.[d]?.all===true),'Cobertura de actividad no preparada.');return c;}
function pagesReady(config,coverage){check(config?.ready===true&&config.schema===1&&coverage?.ready===true&&coverage.schema===1&&coverage.generation===config.generation&&Number.isSafeInteger(coverage.revision)&&coverage.revision>=1,'Pages no está preparado.');}
function point(domain,key,original,page,timeZone){
 check(DOMAINS.includes(domain)&&Pages.key(key),'Dominio o clave inválido.');
 if(!original)return null;
 const ot=domain==='ordenes_trabajo';
 if(!ot)check(page?.key===key&&typeof page.ownerUid==='string'&&(!page.ownerUid||/^[A-Za-z0-9_-]{1,128}$/.test(page.ownerUid))&&Number.isSafeInteger(page[domain==='ventas'?'totalCents':'amountCents'])&&typeof page.cancelled==='boolean','Falta la fila canónica de Pages.');
 const fecha=ot?(original.fechaCierre||original.fecha):original.fecha,ms=Core.legacyMs(fecha,original.ts,zone(timeZone));
 check(!ms||Number.isFinite(ms),'No se puede certificar un instante infinito.');
 // Validate even excluded keys; a later edit must not silently change key ordering.
 Core.eventSort(1,key);
 const row=ms&&!(domain==='pagos'&&page.cancelled)?{key,date:safe(fecha,80),ms,sort:Core.eventSort(ms,key),number:safe(ot?(original.id||original.numero||key):(page.number||page.saleNumber||key),128),client:safe(ot?(original.cliente||'Sin cliente'):page.client,200),status:safe(ot?original.estado:(page.status||(page.cancelled?'anulado':'')),80),ownerUid:ot?'':page.ownerUid,amountCents:ot?null:page[domain==='ventas'?'totalCents':'amountCents']}:null;
 return {schema:3,sourceHash:hash(original),pageHash:ot?null:hash(page),row};
}
const scopes=(domain,p)=>domain==='ordenes_trabajo'?['all']:Pages.scopes(p.row?.ownerUid||p.ownerUid||'');
// Excluded points retain only the canonical UID, so exclusion counts can move with reassignment.
function project(domain,key,original,page,timeZone){const p=point(domain,key,original,page,timeZone);return p?{...p,ownerUid:domain==='ordenes_trabajo'?'':page.ownerUid}:null;}
const empty=(generation,revision)=>({generation,revision,records:0,eligible:0,excluded:0});
function stats(s,c){check(s?.generation===c.generation&&Number.isSafeInteger(s.revision)&&s.revision>=1&&s.revision<=c.revision&&['records','eligible','excluded'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0)&&s.records===s.eligible+s.excluded,'Conteos de actividad incompletos.');return s;}
async function delta(changes,{raw,coverage,revision,preparing=false}){
 const patch={},totals=new Map();
 for(const {domain,key,before,after}of changes){
  patch[ROOT+'/records/'+domain+'/'+key]=after;
  for(const [p,sign]of [[before,-1],[after,1]])if(p)for(const scope of scopes(domain,p)){
   const id=domain+'/'+scope;
   if(!totals.has(id)){const value=await raw(ROOT+'/stats/'+id),proof=await raw(ROOT+'/proof/'+id),known=coverage.scopes?.[domain]?.[scope]===true;if(value){check(known,'Ámbito ajeno al manifiesto.');stats(value,coverage);check(proof===hash(value),'Prueba de conteos inválida.');}else check(sign>0&&proof===null&&(preparing||!known),'Falta un ámbito anterior certificado.');totals.set(id,value?structuredClone(value):empty(coverage.generation,coverage.revision));}
   const s=totals.get(id);s.records+=sign;s[p.row?'eligible':'excluded']+=sign;
   if(p.row)patch[ROOT+'/document/'+id+'/'+p.row.sort]=sign>0?p.row:null;
  }
 }
 for(const[id,s]of totals){s.revision=revision;stats(s,{...coverage,revision});patch[ROOT+'/stats/'+id]=s;patch[ROOT+'/proof/'+id]=hash(s);}
 return patch;
}
// Offline-only preparation, never called by a request or a writer.
async function build({originals,complete=false,pages,pagesEvidence,config,generation,timeZone,sourceLocale}={}){
 check(complete===true&&originals&&DOMAINS.every(d=>originals[d]&&typeof originals[d]==='object'&&!Array.isArray(originals[d])),'Se requiere un snapshot completo explícito de los tres dominios.');
 pagesReady(config,pages?.coverage);
 check(pagesEvidence?.schema===1&&pagesEvidence.kind==='canonical-pages-build-snapshot'&&pagesEvidence.salesHash===hash(originals.ventas)&&pagesEvidence.paymentsHash===hash(originals.pagos)&&pagesEvidence.rowsHash===hash({sales:pages.records?.sales||{},payments:pages.records?.payments||{}})&&pagesEvidence.coverageHash===hash(pages.coverage),'Falta el recibo del mismo snapshot canónico de Pages o sus fuentes/filas cambiaron.');
 check(Object.keys(originals.ventas).length===pages.coverage.sales&&Object.keys(originals.pagos).length===pages.coverage.payments,'El snapshot y Pages difieren.');
 for(const d of ['ventas','pagos'])check(Object.keys(pages.records?.[pageKind(d)]||{}).length===Object.keys(originals[d]).length,'Las filas Pages están incompletas.');
 const coverage=context({schema:3,ready:true,generation,revision:1,order:Core.SOURCE_ORDER,timeZone:zone(timeZone),sourceLocale,pagesGeneration:pages.coverage.generation,pagesRevision:pages.coverage.revision,scopes:Object.fromEntries(DOMAINS.map(d=>[d,{all:true}]))});
 const changes=[];for(const d of DOMAINS)for(const [key,o]of Object.entries(originals[d]))changes.push({domain:d,key,before:null,after:project(d,key,o,pages.records?.[pageKind(d)]?.[key],coverage.timeZone)});
 for(const change of changes)for(const scope of scopes(change.domain,change.after))coverage.scopes[change.domain][scope]=true;
 const patch=await delta(changes,{raw:async()=>null,coverage,revision:1,preparing:true});
 for(const d of DOMAINS)if(!patch[ROOT+'/stats/'+d+'/all']){const s=empty(generation,1);patch[ROOT+'/stats/'+d+'/all']=s;patch[ROOT+'/proof/'+d+'/all']=hash(s);}
 patch[ROOT+'/coverage']=coverage;return {patch,coverage};
}
async function augment({patch,raw,get,beforeCommit}){
 const snapshots=new Map(),read=raw;raw=async path=>{const value=await read(path);snapshots.set(path,digest(value));return value;};
 const keys=new Map(DOMAINS.map(d=>[d,new Set()]));
 for(const path of Object.keys(patch)){
  check(path!=='sisventas'&&!DOMAINS.some(d=>path==='sisventas/'+d),'Actividad requiere escrituras puntuales.');
  const a=path.split('/');if(a[0]==='sisventas'&&keys.has(a[1])&&a[2])keys.get(a[1]).add(a[2]);
  if(path.startsWith(Pages.ROOT+'/records/')){if(a[3]==='sales')keys.get('ventas').add(a[4]);if(a[3]==='payments')keys.get('pagos').add(a[4]);}
 }
 if(![...keys.values()].some(v=>v.size)&&!Object.hasOwn(patch,Pages.ROOT+'/coverage'))return;
 const c=context(await raw(ROOT+'/coverage')),pc=await raw(Pages.ROOT+'/coverage'),config=await raw('sv_commercial_pages_config');pagesReady(config,pc);
 check(c.pagesGeneration===pc.generation&&c.pagesRevision===pc.revision,'Pages cambió sin mantener actividad.');
 const nextPC=patch[Pages.ROOT+'/coverage']||pc;pagesReady(config,nextPC);check(nextPC.generation===pc.generation,'Cambió la generación de Pages.');
 const changes=[];
 for(const [domain,ids]of keys)for(const key of ids){
  const path='sisventas/'+domain+'/'+key,old=await raw(path),original=await get(path),recordPath=ROOT+'/records/'+domain+'/'+key,before=await raw(recordPath),pp=Pages.ROOT+'/records/'+pageKind(domain)+'/'+key;
  const oldPage=domain==='ordenes_trabajo'?null:await raw(pp),page=domain==='ordenes_trabajo'?null:(Object.hasOwn(patch,pp)?patch[pp]:oldPage);
  check(hash(before)===hash(project(domain,key,old,oldPage,c.timeZone)),'El punto anterior de actividad no coincide con sus fuentes.');
  changes.push({domain,key,before,after:project(domain,key,original,page,c.timeZone)});
 }
 const revision=c.revision+1;check(Number.isSafeInteger(revision),'Se agotó la revisión de actividad.');
 const known=structuredClone(c.scopes);for(const change of changes)if(change.after)for(const scope of scopes(change.domain,change.after))known[change.domain][scope]=true;
 Object.assign(patch,await delta(changes,{raw,coverage:c,revision}));patch[ROOT+'/coverage']={...c,revision,pagesRevision:nextPC.revision,scopes:known};
 beforeCommit(async({readFresh})=>{for(const[p,h]of snapshots)check(digest(await readFresh(p))===h,'Las fuentes o pruebas de actividad cambiaron antes del commit.');});
}
module.exports={ROOT,DOMAINS,zone,hash,check,context,stats,pagesReady,project,build,augment,pageKind};
