'use strict';
const View=require('./commercial-view-protocol'),Policy=require('./commercial-edit-policy');
const fail=(statusCode,code,message)=>Object.assign(Error(message),{statusCode,code});
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const eq=(a,b)=>View.canonical(a)===View.canonical(b);
const moduleFor=(domain,action)=>domain==='presupuestos'?'presupuesto':action==='crear'?'venta':'detalle';
function access(profile,cfg,domain,action,claims){
 const role=profile?.rol,module=moduleFor(domain,action),defaults=action==='crear'?['admin','administrativo','vendedor','tecnico_vendedor']:['admin','administrativo'];
 if(profile?.activo!==true||claims?.svPasswordChangeRequired===true||typeof role!=='string')throw fail(403,'SV_COMMERCIAL_AUTH','La sesión no está habilitada.');
 if(cfg&&(cfg.indiceVersion!==2||cfg.indiceModulos?.[module]!==true||Object.values(cfg.bloqueados||{}).includes(module)))throw fail(403,'SV_COMMERCIAL_PERMISSION','El módulo no está habilitado.');
 const grant=cfg?.acciones?.[domain]?.[action];if(typeof grant==='boolean'?!grant:!defaults.includes(role))throw fail(403,'SV_COMMERCIAL_PERMISSION','No tenés permiso para modificar esta ficha.');
 return {role,permissionRevision:cfg?.indiceRevision??null,permissionDigest:View.digest(cfg||{})};
}
function authorizeRecord(actor,record){if(!record||!object(record))throw fail(404,'SV_COMMERCIAL_MISSING','Ficha no disponible.');if(actor.role!=='admin'&&record.responsableUid!==actor.uid)throw fail(403,'SV_COMMERCIAL_OWNER','La ficha no está asignada a tu cuenta.');}
function validate(body){
 if(!object(body)||Object.keys(body).some(k=>!['id','action','domain','recordKey','expectedRevision','changes'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id)||body.action!=='edit'||!View.nonce(body.expectedRevision)||!object(body.changes))throw fail(400,'SV_COMMERCIAL_COMMAND','Solicitud comercial inválida.');
 View.domainKey(body.domain,body.recordKey);if(Buffer.byteLength(JSON.stringify(body))>8*1024*1024)throw fail(413,'SV_COMMERCIAL_SIZE','La ficha supera el tamaño permitido.');
 require('./labor-write-gateway').validate(body);
}
function createCommercialDocumentCommands({authorize,guard,db,store,costResolver=require('./commercial-canonical-cost').resolve}={}){
 if(typeof authorize!=='function'||!guard?.run||!db?.ref||!store?.read)throw TypeError('Falta el circuito comercial protegido');
 const read=async path=>(await db.ref(path).get()).val(),transport=require('./commercial-public-transport').createCommercialPublicTransport({guard,db,store});
 async function execute(actor,body){
  if(!actor?.uid||actor.claims?.uid!==actor.uid||actor.viewing||actor.realUid&&actor.realUid!==actor.uid)throw fail(403,'SV_COMMERCIAL_AUTH','Volvé a tu cuenta para guardar.');validate(body);
  const paths=View.domainKey(body.domain,body.recordKey),profilePath='sv_chat_roles/'+actor.uid,profile=await read(profilePath),cfgPath='sv_permisos/'+profile?.rol,cfg=await read(cfgPath),captured=access(profile,cfg,body.domain,'editar',actor.claims);
  if(actor.role&&actor.role!==captured.role)throw fail(409,'SV_COMMERCIAL_AUTH_CHANGED','La sesión cambió.');
  const commandActor={uid:actor.uid,claims:actor.claims,mode:'user',...captured,opId:body.id,transportDigest:View.digest(body),operation:'commercial-document-edit',input:body};
  const ack=await guard.run(commandActor,async scope=>{
   if(!View.active(await scope.get('sv_labor_config')))throw fail(503,'SV_COMMERCIAL_PROTOCOL_OFF','El nuevo circuito comercial todavía no está habilitado.');
   const currentProfile=await scope.get(profilePath),currentCfg=await scope.get(cfgPath),checked=access(currentProfile,currentCfg,body.domain,'editar',actor.claims);
   if(!eq(checked,captured))throw fail(409,'SV_COMMERCIAL_AUTH_CHANGED','Los permisos cambiaron.');
   const raw=await scope.get(paths.raw);authorizeRecord({...actor,role:captured.role},raw);
   const [source,row]=await Promise.all([scope.get(paths.source),scope.get(paths.row)]);
   if(source?.schema!==1||source.revision!==body.expectedRevision||source.digest!==View.digest(raw)||row?.meta?.schema!==1||row.meta.ready!==true||row.meta.revision!==body.expectedRevision)throw fail(409,'SV_COMMERCIAL_VERSION','La ficha cambió. Volvé a abrirla antes de guardar.');
   const commissionFields=['comisionHabilitada','comisionadoPrincipal','comisionadoPrincipalFbKey','comisionado2','comisionado2FbKey','empleado','empleadoFbKey'];
   if(commissionFields.some(name=>Object.hasOwn(body.changes,name)&&!eq(body.changes[name],raw[name]))){const grant=currentCfg?.acciones?.ventas?.configurarComision;if(body.domain!=='ventas'||(typeof grant==='boolean'?!grant:captured.role!=='admin'))throw fail(403,'SV_COMMERCIAL_COMMISSION_PERMISSION','No tenés permiso para cambiar los participantes de la comisión.');}
   const sources=new Map([[paths.raw,View.digest(raw)],[paths.source,View.digest(source)],[paths.row,View.digest(row)]]);
   const resolver=typeof costResolver==='function'?async line=>costResolver(line,{scope,actor:{...actor,role:captured.role},domain:body.domain,recordKey:body.recordKey,read:async path=>{const value=await scope.get(path);sources.set(path,View.digest(value));return value;}}):undefined;
   const next=await View.mergeRecord(raw,body.changes,{domain:body.domain,id:body.recordKey,revision:body.expectedRevision,resolveCost:resolver});
   await Policy.validateEdit({raw:{...raw,fbKey:body.recordKey},next,domain:body.domain,actor:{...actor,role:captured.role},cfg:currentCfg,read:async path=>{const value=await scope.get(path);sources.set(path,View.digest(value));return value;}});
   if(typeof scope.beforeCommit!=='function')throw fail(503,'SV_COMMERCIAL_REVALIDATION','La comprobación comercial no está disponible.');
   scope.beforeCommit(async({readFresh})=>{
    const freshProfile=await readFresh(profilePath),freshCfg=await readFresh(cfgPath),fresh=access(freshProfile,freshCfg,body.domain,'editar',actor.claims);
    if(!eq(fresh,captured))throw fail(409,'SV_COMMERCIAL_AUTH_CHANGED','Los permisos cambiaron antes de guardar.');
    if(!View.active(await readFresh('sv_labor_config')))throw fail(503,'SV_COMMERCIAL_PROTOCOL_OFF','El circuito comercial se retiró antes de guardar.');
    for(const [path,hash]of sources)if(View.digest(await readFresh(path))!==hash)throw fail(409,'SV_COMMERCIAL_VERSION','La ficha o su referencia de costo cambió antes de guardar.');
   });
   await scope.update({[paths.raw]:next});return {ok:true,committed:true,recordKey:body.recordKey};
  });
  try{const raw=await store.read(paths.raw);if(!raw)return {...ack,record:null,currentView:false};const value=await transport.projectRecord({...actor,role:captured.role},body.domain,body.recordKey,raw);return {...ack,record:value,currentView:true};}
  catch(_){return {...ack,record:null,currentView:false};}
 }
 return {authorize,execute};
}
module.exports={createCommercialDocumentCommands,access,validate};