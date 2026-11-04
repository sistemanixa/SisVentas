'use strict';
// Not mounted. Uses existing business authentication, UID profile and domain policies.
const M=require('./dashboard-commercial-activity-proposal'),Own=require('./commercial-ownership'),Policy=require('./domain-read-policy');
const {createBusinessAuth}=require('./user-access'),{actorPin}=require('./dashboard-budget-reader-proposal'),Core=require('./commercial-models/dashboard-activity-model.v2');
const CreatorLatest=require('./commercial-creator-latest');
const Pages=require('./commercial-pages-model'),{digest}=require('./labor-guard');
function createAuthority({auth,db}){
 const business=createBusinessAuth(auth,db);
 async function fresh(req,domain){
  M.check(M.DOMAINS.includes(domain),'Dominio inválido.');
  const token=String(req?.headers?.authorization||'').match(/^Bearer\s+(\S+)$/i);M.check(token&&!req.viewing&&!req.headers['x-sv-view-as'],'Se requiere una sesión directa.');
  const claims=await business.verifyIdToken(token[1]);M.check(/^[A-Za-z0-9_-]{1,128}$/.test(claims.uid),'UID inválido.');
  const identity=(await db.ref('sv_chat_roles/'+claims.uid).get()).val();M.check(identity?.activo===true&&Policy.internalRoles.includes(identity.rol),'Acceso inactivo.');
  const config=(await db.ref('sv_permisos/'+identity.rol).get()).val();
  M.check(config?.indiceVersion===2&&Number.isSafeInteger(config.indiceRevision)&&config.indiceRevision>=0,'Permisos sin revisión verificable.');
  const users=(await db.ref('sv_usuarios').orderByChild('uid').equalTo(claims.uid).limitToFirst(2).get()).val(),people=Own.profiles(users,{[claims.uid]:identity});M.check(people.length===1,'Identidad duplicada o inactiva.');
  const modules=m=>Own.moduleAllowed(identity.rol,m,{[identity.rol]:config}),actions=a=>{const[g,k]=a.split('.'),v=config.acciones?.[g]?.[k];return typeof v==='boolean'?v:identity.rol==='admin';};
  M.check(modules('dashboard')&&Policy.allows(domain,identity.rol,modules,actions),'Módulo no autorizado.');
  return {uid:claims.uid,realUid:claims.uid,role:identity.rol,name:people[0].name,claims,permissionRevision:config.indiceRevision,permissionDigest:digest(config)};
 }
 return {fresh};
}
function createReader({auth,db,enabled=false,getLegacyContext,getAsOfDay}={}){
 M.check(typeof getLegacyContext==='function'&&typeof db?.ref==='function'&&typeof auth?.verifyIdToken==='function','Falta contexto explícito o transporte.');
 const authority=createAuthority({auth,db}),raw=async p=>(await db.ref(p).get()).val();
 async function read(req,domain){
  M.check(enabled===true&&M.DOMAINS.includes(domain),'Proveedor inactivo o dominio inválido.');
  const actor=await authority.fresh(req,domain),pin=actorPin(actor),legacy=structuredClone(await getLegacyContext()),scope=domain==='ordenes_trabajo'||actor.role==='admin'?'all':'u_'+actor.uid;
  const paths=[M.ROOT+'/coverage',M.ROOT+'/stats/'+domain+'/'+scope,M.ROOT+'/proof/'+domain+'/'+scope,Pages.ROOT+'/coverage','sv_commercial_pages_config'];
  if(domain==='ventas')paths.push(Pages.ROOT+'/totals/'+scope);
  const asOfDay=domain==='ventas'&&typeof getAsOfDay==='function'?await getAsOfDay():null;
  const before=await Promise.all(paths.map(raw)),[coverage,storedStats,proof,pc,config,totals]=before,c=M.context(coverage);M.pagesReady(config,pc);
  M.check(c.timeZone===M.zone(legacy.timeZone)&&c.sourceLocale===legacy.sourceLocale&&c.pagesGeneration===pc.generation&&c.pagesRevision===pc.revision,'Contexto o Pages desactualizado.');
  const known=c.scopes?.[domain]?.[scope]===true,st=storedStats||{generation:c.generation,revision:c.revision,records:0,eligible:0,excluded:0};M.check(known?!!storedStats:!storedStats&&proof===null,'Ámbito sin certificado.');
  M.stats(st,c);M.check(known?proof===M.hash(st):proof===null,'Prefijo sin prueba de cobertura.');
  const snap=await db.ref(M.ROOT+'/document/'+domain+'/'+scope).orderByKey().limitToFirst(5).get(),rows=[];
  snap.forEach(child=>{const value=child.val(),r={...value,amountCents:value?.amountCents??null},fields=['key','date','ms','sort','number','client','status','ownerUid','amountCents'];M.check(r&&Object.keys(r).length===9&&fields.every(k=>Object.hasOwn(r,k))&&r.sort===child.key&&r.sort===Core.eventSort(r.ms,r.key)&&typeof r.date==='string'&&r.date.length<=80&&typeof r.number==='string'&&r.number.length<=128&&typeof r.client==='string'&&r.client.length<=200&&typeof r.status==='string'&&r.status.length<=80&&typeof r.ownerUid==='string'&&(domain==='ordenes_trabajo'?r.amountCents===null&&r.ownerUid==='':Number.isSafeInteger(r.amountCents)),'Fila de actividad inválida.');rows.push(r);});
  M.check(rows.length===Math.min(5,st.eligible),'Prefijo truncado o incompleto.');
  let creatorMonthly;
  if(domain==='ventas'){
   creatorMonthly={schema:1,complete:false};
   if(typeof asOfDay==='string'&&/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(asOfDay)&&pc.scopes?.[scope]===true&&totals?.generation===pc.generation&&Number.isSafeInteger(totals.revision)&&totals.revision>=1&&totals.revision<=pc.revision){
    try{creatorMonthly={schema:1,complete:true,creator:actor.name,month:asOfDay.slice(0,7),scope,generation:pc.generation,revision:pc.revision,count:Pages.creatorMonthCount(totals,{creator:actor.name,month:asOfDay.slice(0,7)})};}catch(e){if(e.code!=='SV_COMMERCIAL_PAGES_NOT_READY')throw e;}
   }
  }
  let creatorLatest;
  if(domain==='ventas'){
   creatorLatest={schema:1,complete:false};
   if(creatorMonthly?.complete===true){
    try{
     const evidence=new Map();let stable=true;
     const read=async path=>{const value=await raw(path),h=M.hash(value);if(evidence.has(path)&&evidence.get(path)!==h)stable=false;else evidence.set(path,h);return value;};
     const latest=await CreatorLatest.readLatest({read,scope,creator:actor.name,month:creatorMonthly.month,locale:c.sourceLocale,expectedLocale:legacy.sourceLocale});
     const verified=await Promise.all([...evidence].map(async([path,h])=>M.hash(await raw(path))===h));
     if(stable&&verified.every(Boolean)&&latest.generation===pc.generation&&latest.revision===pc.revision&&latest.count===creatorMonthly.count){
      const rows=latest.rows.map(row=>({key:row.key,number:row.number,client:row.client,clientRecordKey:row.clientRecordKey,rawDate:row.creatorRawDate,totalCents:row.totalCents}));
      creatorLatest={schema:1,complete:true,creator:actor.name,month:latest.month,scope,generation:latest.generation,revision:latest.revision,locale:latest.locale,orderContract:latest.orderContract,count:latest.count,rows};
     }
    }catch(_){/* Optional latest evidence never substitutes originals or blocks the count. */}
   }
  }
  const finalActor=await authority.fresh(req,domain),after=await Promise.all(paths.map(raw));M.check(digest(actorPin(finalActor))===digest(pin)&&before.every((v,i)=>M.hash(v)===M.hash(after[i]))&&M.hash(legacy)===M.hash(await getLegacyContext())&&asOfDay===(domain==='ventas'&&typeof getAsOfDay==='function'?await getAsOfDay():null),'Actor o cobertura cambió durante la lectura.');
  const recent={schema:2,domain,kind:'verified-legacy-instant-prefix',scope:scope==='all'?'all':'own',generation:c.generation,revision:c.revision,order:Core.SOURCE_ORDER,timeZone:c.timeZone,sourceLocale:c.sourceLocale,fromStart:true,filter:domain==='pagos'?'legacy-not-annulled':'legacy-ms-truthy',exhausted:st.eligible<=5,rows};
  const context={uid:actor.uid,role:actor.role,auth,db,permissionRevision:actor.permissionRevision,timeZone:c.timeZone,sourceLocale:c.sourceLocale,grants:Object.fromEntries(Core.DOMAINS.map(d=>[d,d===domain?recent.scope:null]))};
  M.check(Core.merge({context,sources:{[domain]:{...recent,context}},expected:{[domain]:{generation:c.generation,revision:c.revision}}}).complete,'Prefijo no autorizado.');
  return {schema:2,proposal:true,uid:actor.uid,role:actor.role,permissionRevision:actor.permissionRevision,recent,...(creatorMonthly?{creatorMonthly,creatorLatest}:{}),coverage:{records:st.records,eligible:st.eligible,excluded:st.excluded},mixedActivityComplete:false,notificationCenterComplete:false};
 }
 return Object.freeze({read});
}
module.exports={createAuthority,createReader};
