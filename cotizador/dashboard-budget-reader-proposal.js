'use strict';
// Inactive proposal. Uses existing commercial authority; never reads budget originals.
const Own=require('./commercial-ownership'),{createBusinessAuth}=require('./user-access');
const Index=require('./dashboard-budget-incremental-plan-proposal'),Model=require('./dashboard-budget-projection-proposal');
const {digest}=require('./labor-guard'),{normalizeRtdb}=require('./payment-membership-index');
const ROOT=Index.ROOT,ROUTE='/commercial/dashboard/presupuestos',ORDER=Model.DOCUMENT_ORDER;
const hash=v=>digest(normalizeRtdb(v));
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const uid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const key=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode,code:'SV_BUDGET_READ_PROPOSAL'});
const check=(v,message,status=409)=>{if(!v)throw fail(status,message);};
function selection(req,route=ROUTE){
 check(req?.method==='GET','Método no permitido.',405);
 check(typeof req.url==='string'&&req.url.startsWith('/'),'Solicitud inválida.',400);
 const url=new URL(req.url,'http://localhost'),headers=req.headers||{};
 check(url.pathname===route&&!url.search&&!url.hash&&!req.viewing&&!headers['x-sv-view-as'],'La lectura no admite vistas ni filtros.',400);
 check(req.body===undefined&&!headers['transfer-encoding']&&(headers['content-length']===undefined||String(headers['content-length'])==='0'),'La lectura no admite cuerpo.',400);
}
function createIndexPorts(db){
 check(typeof db?.ref==='function','Falta el adaptador RTDB.',503);
 const scope='(?:all|u_[A-Za-z0-9_-]{1,128})';
 const point=new RegExp('^'+ROOT+'/(?:coverage|policy|stats/'+scope+'|scopeProof/'+scope+')$');
 const indexed=new RegExp('^'+ROOT+'/(document|noticeBadge)/'+scope+'$');
 return Object.freeze({
  async raw(path){check(point.test(path),'Lectura puntual fuera del contrato.',400);const value=(await db.ref(path).get()).val();check(value!==undefined,'Metadata ausente.');return value;},
  async query(spec){
   const match=indexed.exec(spec?.path||'');check(match&&spec.orderBy==='key'&&Number.isInteger(spec.limit)&&spec.limit>=1&&spec.limit<=50,'Consulta fuera del contrato.',400);
   check(Object.keys(spec).every(k=>['path','orderBy','limit','startAt','startAfter'].includes(k)),'Filtro no admitido.',400);
   let query=db.ref(spec.path).orderByKey();
   const bounds=['startAt','startAfter'].filter(k=>Object.hasOwn(spec,k));
   check(match[1]==='document'?bounds.length===0:bounds.length===1,'Rango no certificado.',400);
   for(const bound of bounds){check(typeof spec[bound]==='string'&&spec[bound].length>0&&Buffer.byteLength(spec[bound])<=768,'Cursor inválido.',400);query=query[bound](spec[bound]);}
   const snapshot=await query.limitToFirst(spec.limit).get(),rows=[];
   check(typeof snapshot?.forEach==='function','Página RTDB inválida.');
   snapshot.forEach(child=>{rows.push({sort:child.key,value:child.val()});});
   check(rows.length<=spec.limit,'Página excedida.');return rows;
  }
 });
}
function actorPin(actor){return {uid:actor.uid,realUid:actor.realUid,role:actor.role,name:actor.name,permissionRevision:actor.permissionRevision,permissionDigest:actor.permissionDigest,claimsHash:digest(actor.claims)};}
function projectDocuments(children,stats,actor){
 check(stats.unknownDates===0,'Fechas desconocidas: no hay prefijo completo.');
 check(children.length===Math.min(5,stats.records),'Prefijo incompleto.');
 let previous='';const seen=new Set();return children.map(child=>{
  const row={...child.value,amountCents:child.value?.amountCents??null};
  check(object(child.value)&&Object.keys(row).length===8&&['key','date','sort','number','client','status','ownerUid','amountCents'].every(k=>Object.hasOwn(row,k)),'Fila de actividad incompleta.');
  const sort=typeof row.date==='string'&&Model.day(row.date)===row.date?Model.documentSort(row.date,row.key):null;
  check(key(row.key)&&sort===child.sort&&row.sort===sort&&(!previous||sort>previous)&&!seen.has(row.key)&&[row.number,row.client,row.status].every(v=>typeof v==='string')&&row.number.length<=128&&row.client.length<=200&&row.status.length<=80&&row.amountCents===null&&(row.ownerUid===''||uid(row.ownerUid))&&(actor.role==='admin'||row.ownerUid===actor.uid),'Fila de actividad fuera de alcance u orden.');
  previous=sort;seen.add(row.key);return row;
 });
}
function createBudgetAuthority({auth,db}={}){
 check(typeof auth?.verifyIdToken==='function'&&typeof db?.ref==='function','Falta autenticación.',503);
 const commercial=Own.createCommercialOwnership({auth:createBusinessAuth(auth,db),db,enabled:true,scopedReads:true,
  queryReader:async(path,field,value)=>{check(path==='sv_usuarios'&&field==='uid'&&uid(value),'Consulta de identidad inválida.',403);return (await db.ref(path).orderByChild(field).equalTo(value).limitToFirst(2).get()).val();}});
 async function fresh(req){
  const actor=await commercial.authorize(req,'presupuestos');
  check(uid(actor.uid)&&actor.uid===actor.realUid&&!actor.viewing&&actor.claims?.uid===actor.uid,'Actor no verificable.',403);
  const config=(await db.ref('sv_permisos/'+actor.role).get()).val();
  check(object(config)&&config.indiceVersion===2&&Number.isSafeInteger(config.indiceRevision)&&config.indiceRevision>=0&&config.indiceRevision===actor.permissionRevision&&digest(config)===actor.permissionDigest,'Los permisos cambiaron.');
  check(Own.moduleAllowed(actor.role,'dashboard',{[actor.role]:config})&&Own.eligible(actor.role,'presupuestos',{[actor.role]:config}),'Dashboard o presupuestos no habilitado.',403);
  return actor;
 }
 return Object.freeze({fresh});
}
function createDashboardBudgetReader({auth,db,enabled=false,getAsOfDay,maxBadgePages=100}={}){
 check(typeof getAsOfDay==='function','Falta fecha del servidor.',503);
 const ports=createIndexPorts(db),{fresh}=createBudgetAuthority({auth,db});
 async function read(req){
  selection(req);check(enabled===true,'Lector propuesto no habilitado.',503);
  const actor=await fresh(req),pin=actorPin(actor),scope=actor.role==='admin'?'all':'u_'+actor.uid;
  const paths=[ROOT+'/coverage',ROOT+'/policy',ROOT+'/stats/'+scope,ROOT+'/scopeProof/'+scope],before=await Promise.all(paths.map(p=>ports.raw(p))),[coverage,policy,stats,proof]=before;
  check(coverage?.ready===true&&coverage.documentOrder===ORDER&&policy?.hash===coverage.policyHash&&stats?.generation===coverage.generation&&stats?.revision<=coverage.revision&&proof===hash(stats),'Metadata incompleta o desactualizada.');
  const authorize=async()=>{check(digest(actorPin(await fresh(req)))===digest(pin),'Actor o permisos cambiaron.');return {scope,policyHash:policy.hash};};
  const asOfDay=await getAsOfDay();
  const [badge,children]=await Promise.all([Index.badgeCounts({...ports,authorize,asOfDay,pageSize:50,maxPages:maxBadgePages}),ports.query({path:ROOT+'/document/'+scope,orderBy:'key',limit:5})]);
  check(badge.generation===coverage.generation&&badge.revision===coverage.revision,'La generación cambió durante la lectura.');
  const rows=projectDocuments(children,stats,actor);
  const finalActor=await fresh(req),after=await Promise.all(paths.map(p=>ports.raw(p)));
  check(digest(actorPin(finalActor))===digest(pin)&&before.every((v,i)=>hash(v)===hash(after[i])),'El contexto cambió durante la lectura.');
  return {schema:1,proposal:true,uid:actor.uid,role:actor.role,permissionRevision:actor.permissionRevision,scope:actor.role==='admin'?'all':'own',generation:coverage.generation,revision:coverage.revision,
   counts:{active:stats.active,converted:stats.converted,totalNonCancelled:stats.totalNonCancelled,conversionPercent:stats.totalNonCancelled?Math.round(stats.converted/stats.totalNonCancelled*100):0},
   recent:{schema:1,domain:'presupuestos',kind:'verified-recent-prefix',scope:actor.role==='admin'?'all':'own',generation:coverage.generation,revision:coverage.revision,order:ORDER,fromStart:true,filter:'all',exhausted:stats.records<=5,rows,precision:'day',certifiedActivityInstant:false},
   badge:{asOfDay:badge.asOfDay,horizon:badge.horizon,badgeCount:badge.badgeCount,upcoming48Count:badge.upcoming48Count,complete:true,contract:badge.contract},notificationCenterComplete:false};
 }
 async function handle(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
  try{const body=await read(req);res.statusCode=200;res.end(JSON.stringify(body));}
  catch(error){res.statusCode=[400,401,403,405,409,503].includes(error.statusCode)?error.statusCode:503;res.end(JSON.stringify({error:'No se pudo verificar el Dashboard de presupuestos.',code:'SV_BUDGET_READ_PROPOSAL'}));}
 }
 return Object.freeze({read,handle});
}
module.exports={ROUTE,selection,actorPin,createIndexPorts,createBudgetAuthority,createDashboardBudgetReader};
