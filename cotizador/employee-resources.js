'use strict';
const {digest}=require('./labor-guard'),Clothing=require('./employee-clothing-model'),Categories=require('./expense-categories-model'),Policy=require('./employee-resources-policy');
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
// RTDB omits empty arrays/maps. Restore only structural empties, never movements.
const clothing=v=>v?{...v,garments:v.garments||{},events:Array.isArray(v.events)?v.events:Object.values(v.events||{}),operations:v.operations||{}}:Clothing.create();
const categories=v=>v?{...v,entries:v.entries||[],operations:v.operations||{}}:Categories.createState();
function context(identity,profile,cfg,reset,domain,write=true){
 if(!key(identity?.uid)||identity.claims?.uid!==identity.uid||identity.viewing||identity.claims.svPasswordChangeRequired===true||reset?.required===true||reset?.version!=null&&reset.version!==identity.claims.svAccessVersion||profile?.activo!==true)throw fail(403,'Volvé a tu sesión propia habilitada.');
 const role=profile.rol,module=domain==='clothing'?'empleados':'gastos',action=domain==='clothing'?'indumentaria':'categorias',explicit=cfg?.acciones?.[module]?.[action];
 if(!['admin','administrativo','vendedor','tecnico','tecnico_vendedor'].includes(role)||cfg==null&&!['admin','administrativo'].includes(role)||cfg!=null&&(cfg.indiceVersion!==2||cfg.indiceModulos?.[module]!==true||Object.values(cfg.bloqueados||{}).includes(module))||!(domain==='categories'&&!write)&&(typeof explicit==='boolean'?!explicit:!['admin','administrativo'].includes(role)))throw fail(403,'No tenés permiso para esta sección.');
 return {role,permissionRevision:cfg?.indiceRevision??null,permissionDigest:digest(cfg||{}),profileDigest:digest(profile),resetDigest:digest(reset)};
}
function create({authorize,store,guard,enabled=false,now=Date.now}){
 if(typeof authorize!=='function'||!store||!guard)throw Error('Falta conectar el circuito laboral.');
 // The native commit adapter and paired validators must explicitly attest support.
 // A generic Admin write or the old guard cannot silently become this writer.
 function ready(){if(!enabled||store.employeeResourcesCommitVersion!==1)throw fail(503,'Indumentaria y categorías están pendientes de habilitar.','SV_EMPLOYEE_RESOURCES_NOT_READY');}
 async function access(identity,domain,read=path=>store.read(path),write=true){
  ready();if(!Policy.ROOTS[domain])throw fail(400,'Sección inválida.');
  const profile=await read('sv_chat_roles/'+identity?.uid),cfg=profile?.rol?await read('sv_permisos/'+profile.rol):null,reset=await read('sv_access_resets/'+identity?.uid);
  return context(identity,profile,cfg,reset,domain,write);
 }
 async function authorizeRequest(req){if(new URL(req.url,'http://localhost').searchParams.has('verComo')||req.headers?.['x-sv-view-as']||req.headers?.['x-sisventas-view-as'])throw fail(403,'Volvé a tu cuenta para continuar.');return authorize(req);}
 async function read(identity,domain,view={}){
  const actor=await access(identity,domain,undefined,false),state=await store.read(Policy.ROOTS[domain]);
  if(digest(await access(identity,domain,undefined,false))!==digest(actor))throw fail(409,'Los permisos cambiaron. Volvé a abrir la sección.');
  if(domain==='categories'){const s=categories(state);return{state:{schema:s.schema,revision:s.revision,entries:s.entries,operations:{}},permissionRevision:actor.permissionRevision};}
  if(!object(view)||Object.keys(view).some(k=>!['employeeId','cursor','query','revision'].includes(k))||view.employeeId!==undefined&&!key(view.employeeId)||view.cursor!==undefined&&(typeof view.cursor!=='string'||view.cursor.length>257||!/^[A-Za-z0-9_-]+~[A-Za-z0-9_-]+$/.test(view.cursor))||view.query!==undefined&&(typeof view.query!=='string'||view.query.length>120)||view.revision!==undefined&&(!/^\d+$/.test(String(view.revision))||!Number.isSafeInteger(Number(view.revision))))throw fail(400,'Consulta de indumentaria inválida.');
  const s=clothing(state),normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),q=normalize(view.query).trim();
  if(view.cursor&&view.revision===undefined||view.revision!==undefined&&Number(view.revision)!==s.revision)throw fail(409,'El stock cambió. Actualizá el listado para continuar.','SV_EMPLOYEE_RESOURCES_PAGE_CHANGED');
  const rows=Clothing.inventory(s).map(v=>({...v,key:v.garmentId+'~'+v.variantId})).filter(v=>(q?normalize([v.name,v.size,v.color].join(' ')).includes(q):v.quantity>0)&&(!view.cursor||v.key>view.cursor)).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0),inventory=rows.slice(0,50);
  const history=view.employeeId?Clothing.employeeHistory(s,view.employeeId).slice(-50).reverse().map(e=>{const garment=s.garments[e.garmentId],variant=garment?.variants.find(v=>v.id===e.variantId),returned=s.events.filter(v=>v.type==='employee.return'&&v.deliveryOperationId===e.operationId).reduce((n,v)=>n+v.quantity,0);return{...e,name:garment?.name||'',size:variant?.size||'',color:variant?.color||'',returnable:e.type==='employee.deliver'?e.quantity-returned:0};}):[];
  return {state:{projection:'employee-clothing-read-v1',schema:1,revision:s.revision,inventory,history,complete:rows.length<=50,cursor:rows.length>50?inventory.at(-1).key:null,employeeId:view.employeeId||null},permissionRevision:actor.permissionRevision};
 }
 async function execute(identity,body){
  if(!object(body)||Object.keys(body).some(k=>!['id','domain','expectedRevision','permissionRevision','command'].includes(k))||!key(body.id)||body.id.length<8||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||!object(body.command))throw fail(400,'Operación inválida.');
  const actor=await access(identity,body.domain);if(body.permissionRevision!==actor.permissionRevision)throw fail(409,'Los permisos cambiaron. Volvé a abrir la sección.','SV_EMPLOYEE_RESOURCES_AUTH_CHANGED');
  const runner={uid:identity.uid,claims:identity.claims,mode:'user',...actor,opId:body.id,operation:'employee-resources-'+body.domain,input:body,transportDigest:digest(body)};
  return guard.run(runner,async scope=>{
   const path=Policy.ROOTS[body.domain],before=await scope.get(path),state=body.domain==='clothing'?clothing(before):categories(before);
   if(state.revision!==body.expectedRevision)throw fail(409,'El registro cambió. Actualizá antes de guardar.','SV_EMPLOYEE_RESOURCES_CONFLICT');
   const references=new Map(),at=new Date(now()).toISOString();let next;
   if(body.domain==='clothing'){
    if(Object.hasOwn(body.command,'actorId')||Object.hasOwn(body.command,'at')||Object.hasOwn(body.command,'operationId'))throw fail(400,'La autoría se registra en el servidor.');
    const c={...body.command,operationId:body.id,actorId:identity.uid,at};
    if(c.type==='stock.receive'){if(!key(c.gastoRef))throw fail(400,'Elegí un gasto existente.');const ref='sisventas/gastos/'+c.gastoRef,v=await scope.get(ref);if(!v||v.eliminado===true||v.anulado===true)throw fail(409,'El gasto vinculado ya no está disponible.');references.set(ref,v);}
    if(['employee.deliver','employee.return'].includes(c.type)){if(!key(c.employeeId))throw fail(400,'Elegí un empleado activo.');const ref='sisventas/empleados/'+c.employeeId,v=await scope.get(ref);if(!v||v.activo===false||v.eliminado===true)throw fail(409,'El empleado ya no está activo.');references.set(ref,v);}
    next=Clothing.apply(state,c);
   }else{
    const {type,...command}=body.command;if(!['create','update','deactivate'].includes(type)||Object.hasOwn(command,'operationId')||Object.hasOwn(command,'expectedRevision'))throw fail(400,'Operación de categoría inválida.');
    next=Categories[type](state,{...command,operationId:body.id,expectedRevision:body.expectedRevision});
   }
   scope.beforeCommit(async({readFresh})=>{if(digest(await access(identity,body.domain,readFresh))!==digest(actor))throw fail(409,'Los permisos cambiaron. Volvé a revisar.','SV_EMPLOYEE_RESOURCES_AUTH_CHANGED');if(digest(await readFresh(path))!==digest(before))throw fail(409,'El registro cambió. Actualizá antes de guardar.','SV_EMPLOYEE_RESOURCES_CONFLICT');for(const[p,v]of references)if(digest(await readFresh(p))!==digest(v))throw fail(409,'El gasto o empleado cambió. Volvé a revisar.','SV_EMPLOYEE_RESOURCES_REFERENCE_CHANGED');});
   next={...next,audit:{...(state.audit||{}),[body.id]:{actorUid:identity.uid,at,type:body.command.type}}};
   if(Buffer.byteLength(JSON.stringify(next))>2*1024*1024)throw fail(409,'El historial necesita archivarse antes de agregar más registros.','SV_EMPLOYEE_RESOURCES_CAPACITY');
   Policy.issue(runner,scope.lease,body.domain,next);await scope.update({[path]:next});return{ok:true,committed:true,revision:next.revision,operationId:body.id};
  });
 }
 return{authorize:authorizeRequest,read,execute};
}
module.exports={create,context};
