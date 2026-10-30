'use strict';
const {affected,parts,digest}=require('./labor-guard');
const {flatten}=require('./labor-db');
const ExpenseRemoval=require('./expense-removal-policy');
const BonusBatch=require('./labor-bonus-batch');
const SACBatch=require('./labor-sac-batch');
const CostCorrection=require('./sale-cost-correction');
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
const forbidden=path=>/^(sv_labor_[^/]*|sv_commission_generation|sv_commission_events)(\/|$)/.test(path);
const normalizationFields={ventas:['clienteFbKey','clienteKey','clienteId'],presupuestos:['clienteFbKey','clienteKey','ventaFbKey','ventaGeneradaFbKey'],pagos:['ventaFbKey','ventaKey','clienteFbKey','clienteKey'],ordenesTrabajo:['ventaFbKey','ventaKey','clienteFbKey','clienteKey'],ordenes_trabajo:['ventaFbKey','ventaKey','clienteFbKey','clienteKey'],reclamos:['clienteFbKey','clienteKey'],productos:['categoriaFbKey','categoriaKey']};
function normalizationTarget(path,value){const p=parts(path);return p[0]==='sisventas'&&p.length===4&&normalizationFields[p[1]]?.includes(p[3])&&(typeof value==='string'&&!!value.trim()||typeof value==='number'&&Number.isFinite(value))||p.length===4&&p[0]==='sisventas'&&p[1]==='mantenimiento'&&p[2]==='normalizaciones'&&value&&typeof value==='object'&&!Array.isArray(value);}
function normalizationSource(path){const p=parts(path);return p[0]==='sisventas'&&p.length===3&&[...Object.keys(normalizationFields),'clientes','clientes_unificados','clientes_unificados_indice','categorias'].includes(p[1])||p.length===4&&p[0]==='sisventas'&&p[1]==='mantenimiento'&&p[2]==='normalizaciones';}
function validate(value,depth=0){
 if(depth>30||value===undefined||typeof value==='number'&&!Number.isFinite(value)||!['object','string','number','boolean'].includes(typeof value))throw fail(400,'Datos de guardado inválidos');
 if(value&&typeof value==='object')for(const [key,child]of Object.entries(value)){parts(key);validate(child,depth+1);}
}
function specific(path){
 parts(path);if(['sisventas','sisventas/config'].includes(path)||forbidden(path))throw fail(400,'Esta operación requiere guardar registros individuales');
}
function createLaborWriteGateway({auth,db,guard,store,enabled=false}){
 async function authorize(req){
  if(!enabled)throw fail(503,'El nuevo circuito todavía no está habilitado');
  if(req.method!=='POST')throw fail(405,'Método no permitido');
  if(new URL(req.url,'http://localhost').searchParams.has('verComo'))throw fail(403,'Volvé a tu cuenta para guardar');
  const match=String(req.headers?.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!match)throw fail(401,'Sesión requerida');
  let identity;try{identity=await auth.verifyIdToken(match[1],true);}catch(_){throw fail(401,'La sesión venció; volvé a ingresar');}
  const role=(await db.ref('sv_chat_roles/'+identity.uid).get()).val();
  if(role?.activo!==true||!['admin','administrativo','vendedor','tecnico','tecnico_vendedor','distribuidor'].includes(role.rol))throw fail(403,'Usuario sin acceso');
  return {uid:identity.uid,claims:identity};
 }
 async function write(actor,body){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['id','kind','path','value','expectedHash','expectedHashes','purpose'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id)||!['set','patch','compare','atomic'].includes(body.kind)||typeof body.path!=='string')throw fail(400,'Solicitud de guardado inválida');
  if(!actor?.uid||!actor.claims||actor.claims.uid!==actor.uid)throw fail(403,'Sesión requerida');
  if(Buffer.byteLength(JSON.stringify(body))>16*1024*1024)throw fail(413,'El guardado supera el tamaño permitido');
  const costCorrection=body.purpose===CostCorrection.PURPOSE;
  const normalization=body.purpose==='relationship-normalization',removal=body.purpose==='expense-removal',bonus=body.purpose===BonusBatch.PURPOSE,sac=body.purpose===SACBatch.PURPOSE,sacMigration=body.purpose===SACBatch.MIGRATION_PURPOSE;
  if(body.purpose!==undefined&&(!(normalization||removal||bonus||sac||sacMigration||costCorrection)||body.kind!=='atomic'))throw fail(400,'Propósito de guardado inválido');
  let patch;
  if(['patch','atomic'].includes(body.kind)){
   if(body.expectedHash!==undefined)throw fail(400,'Comparación inválida');
   if(body.path)parts(body.path);patch=flatten(body.path,body.value);
   if(!Object.keys(patch).length||Object.keys(patch).length>10000)throw fail(400,'Cambios de guardado inválidos');
   for(const [path,value]of Object.entries(patch)){specific(path);validate(value);}
   if(!Object.keys(patch).some(affected)&&!normalization)throw fail(400,'La operación no pertenece a este circuito');
   if(normalization&&Object.entries(patch).some(([p,v])=>!normalizationTarget(p,v)))throw fail(400,'El plan de normalización excede sus referencias permitidas');
  }else{specific(body.path);if(!affected(body.path))throw fail(400,'La operación no pertenece a este circuito');validate(body.value);patch={[body.path]:body.value};}
  if(body.kind==='compare'&&!/^[a-f0-9]{64}$/.test(body.expectedHash))throw fail(400,'Falta verificar la versión del registro');
  if(body.kind!=='atomic'&&body.expectedHashes!==undefined)throw fail(400,'Comparación inválida');
  const expected=body.kind==='compare'?{[body.path]:body.expectedHash}:body.kind==='atomic'?body.expectedHashes:{};
  if(body.kind==='atomic'){
   if(!expected||typeof expected!=='object'||Array.isArray(expected)||!Object.keys(expected).length||Object.keys(expected).length>128)throw fail(400,'Comparación de registros inválida');
   for(const [path,hash]of Object.entries(expected)){specific(path);if(!/^[a-f0-9]{64}$/.test(hash)||normalization&&!normalizationSource(path))throw fail(400,'Comparación de registros inválida');}
   for(const path of Object.keys(patch))if((normalization||affected(path))&&!Object.keys(expected).some(base=>path===base||path.startsWith(base+'/')))throw fail(400,'Falta verificar un registro del guardado');
  }
  if(removal)ExpenseRemoval.describe(body);
  if(bonus)BonusBatch.describe(body);
  if(sac)SACBatch.describe(body);
  if(sacMigration)SACBatch.describeMigration(body);
  async function normalizationAccess(read){const profile=await read('sv_chat_roles/'+actor.uid),cfg=await read('sv_permisos/admin');if(profile?.activo!==true||profile.rol!=='admin'||cfg&&(cfg.indiceVersion!==2||cfg.indiceModulos?.configuracion!==true||Object.values(cfg.bloqueados||{}).includes('configuracion'))||cfg?.acciones?.mantenimiento?.normalizar===false)throw fail(403,'Sólo el administrador autorizado puede aplicar la normalización');return {role:'admin',permissionRevision:cfg?.indiceRevision??null,permissionDigest:digest(cfg||{})};}
  async function removalAccess(read){const profile=await read('sv_chat_roles/'+actor.uid),cfg=await read('sv_permisos/admin');if(profile?.activo!==true||profile.rol!=='admin'||cfg&&(cfg.indiceVersion!==2||cfg.indiceModulos?.gastos!==true||Object.values(cfg.bloqueados||{}).includes('gastos'))||cfg?.acciones?.gastos?.eliminar===false)throw fail(403,'Sólo el administrador autorizado puede eliminar gastos');return {role:'admin',permissionRevision:cfg?.indiceRevision??null,permissionDigest:digest(cfg||{})};}
  async function bonusAccess(read){const profile=await read('sv_chat_roles/'+actor.uid),role=profile?.rol;if(profile?.activo!==true||!['admin','administrativo','vendedor','tecnico_vendedor','tecnico'].includes(role))throw fail(403,'Usuario sin acceso para bonificar');const cfg=await read('sv_permisos/'+role),override=cfg?.acciones?.empleados?.bonificar;if(cfg&&(cfg.indiceVersion!==2||cfg.indiceModulos?.empleados!==true||Object.values(cfg.bloqueados||{}).includes('empleados'))||(typeof override==='boolean'?!override:role!=='admin'))throw fail(403,'No tenés permiso para dar bonificaciones');return {role,permissionRevision:cfg?.indiceRevision??null,permissionDigest:digest(cfg||{})};}
  async function sacAccess(read){const profile=await read('sv_chat_roles/'+actor.uid),role=profile?.rol,module=sacMigration?'configuracion':'empleados',group=sacMigration?'mantenimiento':'empleados',action=sacMigration?'migrar':'registrarHaberes';if(profile?.activo!==true||!['admin','administrativo','vendedor','tecnico_vendedor','tecnico'].includes(role)||sacMigration&&role!=='admin')throw fail(403,'Usuario sin acceso para esta operación de SAC');const cfg=await read('sv_permisos/'+role),override=cfg?.acciones?.[group]?.[action];if(cfg&&(cfg.indiceVersion!==2||cfg.indiceModulos?.[module]!==true||Object.values(cfg.bloqueados||{}).includes(module))||(typeof override==='boolean'?!override:role!=='admin'))throw fail(403,sacMigration?'No tenés permiso para migrar el SAC histórico':'No tenés permiso para registrar haberes');return {role,permissionRevision:cfg?.indiceRevision??null,permissionDigest:digest(cfg||{})};}
  const initialRead=async path=>(await db.ref(path).get()).val(),normalizationContext=normalization?await normalizationAccess(initialRead):null,removalContext=removal?await removalAccess(initialRead):null,bonusContext=bonus?await bonusAccess(initialRead):null,sacContext=sac||sacMigration?await sacAccess(initialRead):null;
  const result=await guard.run({uid:actor.uid,claims:actor.claims,mode:'user',...(normalization?{...normalizationContext,financialAction:'mantenimiento.normalizar'}:{}),...(removal?{...removalContext,financialAction:'gastos.eliminar'}:{}),...(bonus?{...bonusContext,financialAction:'empleados.bonificar'}:{}),...(sac||sacMigration?{...sacContext,financialAction:sacMigration?'mantenimiento.migrar':'empleados.registrarHaberes'}:{}),opId:body.id,transportDigest:digest(body),operation:'legacy-'+body.kind,input:body},async scope=>{
   if(normalization&&digest(await normalizationAccess(path=>scope.get(path)))!==digest(normalizationContext))throw fail(409,'Los permisos cambiaron. Volvé a revisar la operación.','SV_LABOR_AUTH_CHANGED');
   if(removal&&digest(await removalAccess(path=>scope.get(path)))!==digest(removalContext))throw fail(409,'Los permisos cambiaron. Volvé a revisar la operación.','SV_LABOR_AUTH_CHANGED');
   if(bonus&&digest(await bonusAccess(path=>scope.get(path)))!==digest(bonusContext))throw fail(409,'Los permisos cambiaron. Volvé a revisar la operación.','SV_LABOR_AUTH_CHANGED');
   if((sac||sacMigration)&&digest(await sacAccess(path=>scope.get(path)))!==digest(sacContext))throw fail(409,'Los permisos cambiaron. Volvé a revisar la operación.','SV_LABOR_AUTH_CHANGED');
   for(const [path,hash]of Object.entries(expected)){
    // La lectura conserva el permiso del usuario, además del control de escritura
    // evaluado por Firebase para el PATCH final, nunca un resultado Admin público.
    const current=scope.getAsUser?await scope.getAsUser(path):await store.readAsUser(path,actor);
    if(digest(current)!==hash)throw fail(409,'El registro cambió. Se volverá a comprobar.','SV_CAS_CONFLICT');
   }
   if(normalization)for(const [path,value]of Object.entries(patch)){
    const p=parts(path);if(p[1]==='mantenimiento')continue;
    const current=await scope.get(path);
    if(current!==null&&current!==''&&current!==value)throw fail(409,'Una referencia ya cambió. Revisá el plan antes de aplicar.','SV_CAS_CONFLICT');
   }
   if(costCorrection)await CostCorrection.validate({scope,actor,patch,expected,digest});
   await scope.update(patch);
   return {ok:true,committed:true};
  });
  // El recibo guarda sólo la confirmación. No duplica ventas ni adjuntos; el
  // digest ya verifica que un replay corresponde al mismo valor solicitado.
  return {...result,...(body.kind==='compare'?{value:result.operationalRevision!=null?{...body.value,_svReadRevision:result.operationalRevision,_svReadOperation:result.operationalOperation}:body.value}:{})};
 }
 async function resolve(actor,body){
  if(!actor?.uid||actor.claims?.uid!==actor.uid)throw fail(403,'Sesión requerida');
  if(!body||Object.keys(body).some(k=>!['id','digest'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id)||!/^[a-f0-9]{64}$/.test(body.digest))throw fail(400,'Identificador de comprobación inválido');
  try{
   // Reservar el MISMO intento antes de declararlo rechazado. Si una petición
   // demorada llega después, encuentra este recibo y no puede volver a guardar.
   const result=await guard.run({uid:actor.uid,claims:actor.claims,mode:'user',opId:body.id,transportDigest:body.digest,operation:'resolve'},async()=>({ok:false,committed:false,code:'SV_LABOR_CANCELLED',mensaje:'El intento no se guardó. Podés volver a intentarlo.'}));
   return {ok:true,status:result.ok===true&&result.committed===true?'confirmed':'rejected'};
  }catch(error){if(error.statusCode===423)return {ok:true,status:'pending'};throw error;}
 }
 return {authorize,write,resolve};
}
module.exports={createLaborWriteGateway,validate,specific};
