'use strict';
const {digest}=require('./labor-guard'),Model=require('./ot-metadata-model'),Policy=require('./ot-metadata-policy'),Assigned=require('./ot-personal-scope');
const CONFIG='sv_ot_metadata_config',key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v),fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
function createOTMetadata({db,store,guard,enabled=false,now=Date.now,isInstalled}){
 const read=async path=>(await db.ref(path).get()).val();
 const identityCheck=identity=>{if(!identity?.uid||identity.claims?.uid!==identity.uid||identity.viewing)throw fail(401,'Sesión requerida.');};
 async function activation(){const cfg=await read(CONFIG),installed=typeof isInstalled==='function'?await isInstalled({read,exists:path=>store.exists(path)}):null;if(installed===false&&cfg===null&&typeof store.exists==='function'&&await store.exists(CONFIG)===false)return null;if(installed!==true||!enabled||cfg?.schema!==1||cfg.ready!==true||!key(cfg.generation))throw fail(503,'El guardado seguro de OT está pendiente de habilitar.','SV_OT_METADATA_DISABLED');return cfg;}
 async function assigned(ot,uid,role,reader,query){
  if(!['tecnico','tecnico_vendedor'].includes(role))return;
  const binding=await reader('sv_empleado_uid/'+uid),account=key(binding?.perfilFbKey)?await reader('sv_usuarios/'+binding.perfilFbKey):null;
  if(!account||account.uid!==uid||account.activo===false||!key(account.empleadoFbKey))throw fail(403,'El vínculo del técnico requiere revisión.');
  const employee=await reader('sisventas/empleados/'+account.empleadoFbKey),hasKey=['tecnicoFbKey','empleadoFbKey','tecnicoKey'].some(field=>ot[field]!=null&&String(ot[field]).trim()),directory=!hasKey&&employee?.nombre?await query('sisventas/empleados','nombre',employee.nombre):{};
  if(!employee||employee.activo===false||!Assigned.assigned(ot,{...employee,fbKey:account.empleadoFbKey},Object.fromEntries(Object.entries(directory).map(([id,value])=>[id,{...value,fbKey:id}]))))throw fail(403,'La OT no está asignada a tu cuenta.');
 }
 async function available(identity,{otKey,kind}={}){
  identityCheck(identity);if(!key(otKey)||!Model.kinds.includes(kind))throw fail(400,'Solicitud de OT inválida.');const config=await activation();if(!config)return{ok:true,version:1,installed:false};
  const profile=await read('sv_chat_roles/'+identity.uid),cfg=await read('sv_permisos/'+profile?.rol),context=Model.authority(profile,cfg,kind),ot=await store.readAsUser('sisventas/ordenes_trabajo/'+otKey,identity);if(!ot)throw fail(409,'La OT ya no existe.');await assigned(ot,identity.uid,context.role,read,(...args)=>store.query(...args));return{ok:true,version:1,installed:true,ready:true,otKey,otRevision:ot._svListRevision??0,expectedOTHash:digest(ot)};
 }
 async function execute(identity,body){let started=false;try{
  identityCheck(identity);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(field=>!['id','otKey','expectedOTHash','kind','changes'].includes(field))||!key(body.id)||body.id.length<8||!key(body.otKey)||!/^[a-f0-9]{64}$/.test(body.expectedOTHash||'')||!Model.kinds.includes(body.kind))throw fail(400,'Solicitud de OT inválida.');
  const config=await activation();if(!config)throw fail(503,'El guardado seguro de OT no está instalado.','SV_OT_METADATA_DISABLED');const profile=await read('sv_chat_roles/'+identity.uid),cfg=await read('sv_permisos/'+profile?.rol),context=Model.authority(profile,cfg,body.kind,body.changes),path='sisventas/ordenes_trabajo/'+body.otKey;
  const actor={uid:identity.uid,claims:identity.claims,mode:'user',...context,opId:body.id,transportDigest:digest(body),operation:'ot-metadata',input:body};actor.otMetadata=Policy.issue({uid:identity.uid,otKey:body.otKey,operationId:body.id,kind:body.kind,operations:body.kind==='batch'?body.changes.operations:undefined,generation:config.generation,...context});
  started=true;const result=await guard.run(actor,async scope=>{
   const snapshots=new Map(),queries=[],track=async p=>{const value=await scope.get(p);snapshots.set(p,structuredClone(value));return value;},query=async(...args)=>{const rows=await scope.query(...args);queries.push({args,rows:structuredClone(rows)});return rows;};
   const ot=await scope.getAsUser(path);if(!ot||digest(ot)!==body.expectedOTHash)throw fail(409,'La OT cambió. Volvé a abrirla.','SV_CAS_CONFLICT');
   const reset=await track('sv_access_resets/'+identity.uid);if(identity.claims.svPasswordChangeRequired||reset?.required||reset?.version!=null&&reset.version!==identity.claims.svAccessVersion)throw fail(403,'Actualizá tu acceso y volvé a ingresar.');
   if(digest(await track(CONFIG))!==digest(config))throw fail(409,'La habilitación de OT cambió.');
   await assigned(ot,identity.uid,context.role,track,query);const directory=await track('sv_chat_directorio/'+identity.uid),plan=Model.plan({ot,kind:body.kind,changes:body.changes,actor:{uid:identity.uid,role:context.role,name:directory?.nombre||identity.uid},at:new Date(now()).toISOString()});
   scope.beforeCommit(async({readFresh,readFreshAsUser})=>{
    const settled=await Promise.allSettled([readFresh('sv_chat_roles/'+identity.uid),readFresh('sv_permisos/'+context.role),readFreshAsUser(path)]),failed=settled.find(value=>value.status==='rejected');if(failed)throw failed.reason;const [profile,cfg,original]=settled.map(value=>value.value);Policy.validate(actor,profile,cfg);if(digest(original)!==body.expectedOTHash)throw fail(409,'La OT cambió antes de confirmar.','SV_CAS_CONFLICT');
    if(await isInstalled({read:readFresh,exists:p=>store.exists(p)})!==true)throw fail(409,'La instalación del circuito OT cambió.');
    const checks=[...snapshots].map(([p,value])=>async()=>{if(digest(await readFresh(p))!==digest(value))throw fail(409,'La identidad o habilitación de OT cambió.');});for(const entry of queries)checks.push(async()=>{if(digest(await store.query(...entry.args))!==digest(entry.rows))throw fail(409,'La asignación del técnico cambió.');});
    for(let i=0;i<checks.length;i+=6){const settled=await Promise.allSettled(checks.slice(i,i+6).map(check=>check())),failed=settled.find(value=>value.status==='rejected');if(failed)throw failed.reason;}
   });
   await scope.update({[path]:plan.next});return{ok:true,committed:true,operationId:body.id};
  });return{...result,ot:await store.readAsUser(path,identity)};
 }catch(error){if(!started)error.svLaborAttempted=false;throw error;}}
 return{available,execute};
}
module.exports={createOTMetadata,CONFIG};
