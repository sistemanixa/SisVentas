'use strict';
const {digest}=require('./labor-guard'),Policy=require('./purchase-inventory-policy'),Sources=require('./purchase-current-pending-sources');
const OPERATION='purchase-current-pending-reconcile';
const fail=(statusCode,code,message)=>Object.assign(Error(message),{statusCode,code,svLaborAttempted:false});
const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!['constructor','prototype','__proto__'].includes(value);
function create({authorize,store,guard,assertAdmission,mappedAdmission,sourcePort,queryPage=store?.queryPage,enabled=false,now=Date.now}={}){
 const sources=sourcePort===undefined?Sources.create({enabled,mappedAdmission,now}):sourcePort;
 function ready(){if(enabled!==true||!Sources.isAuthority(sources)||typeof authorize!=='function'||typeof store?.read!=='function'||typeof store?.readAsUser!=='function'||typeof guard?.run!=='function'||typeof assertAdmission!=='function'||typeof queryPage!=='function')throw fail(503,'SV_PURCHASE_CURRENT_PENDING_DISABLED','La conciliación de pendientes todavía no está habilitada.');}
 async function access(req,read,expected){
  const identity=await authorize(req);if(!key(identity?.uid)||identity.uid!==identity.claims?.uid||expected&&identity.uid!==expected.uid||identity.viewing||identity.viewAs||identity.realUid&&identity.realUid!==identity.uid||identity.claims.svPasswordChangeRequired===true)throw fail(403,'SV_PURCHASE_CURRENT_PENDING_AUTH','La sesión de administrador cambió.');
  const profile=await read('sv_chat_roles/'+identity.uid),permissions=await read('sv_permisos/admin'),reset=await read('sv_access_resets/'+identity.uid);
  if(profile?.activo!==true||profile.rol!=='admin'||permissions?.indiceVersion!==2||permissions.indiceModulos?.ordenes!==true||permissions.indiceModulos?.configuracion!==true||['ordenes','configuracion'].some(module=>Object.values(permissions.bloqueados||{}).includes(module))||permissions.acciones?.ordenes?.editar===false||permissions.acciones?.mantenimiento?.migrar===false||reset?.required===true||reset?.version!=null&&reset.version!==identity.claims.svAccessVersion)throw fail(403,'SV_PURCHASE_CURRENT_PENDING_AUTH','La conciliación requiere mantenimiento de administrador y edición de Compras vigentes.');
  return{...identity,role:'admin',permissionRevision:permissions.indiceRevision??null,permissionDigest:digest(permissions)};
 }
 async function execute(req,raw){
  ready();if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==3||!['id','orderKey','expectedHash'].every(key=>Object.hasOwn(raw,key))||!key(raw.id)||raw.id.length<8||!key(raw.orderKey)||!/^[a-f0-9]{64}$/.test(raw.expectedHash||''))throw fail(400,'SV_PURCHASE_CURRENT_PENDING_INPUT','Controles de conciliación inválidos.');
  const body=structuredClone(raw),checked=await access(req,path=>store.read(path)),actor={...checked,mode:'user',financialAction:'ordenes.editar',operation:OPERATION,opId:body.id,input:body,transportDigest:digest(body),recoverReceipt:true};
  return guard.run(actor,async scope=>{
   const live=await access(req,path=>scope.get(path),checked);if(digest(live)!==digest(checked))throw fail(409,'SV_PURCHASE_CURRENT_PENDING_AUTH_CHANGED','La sesión o los permisos cambiaron.');
   await assertAdmission({read:path=>scope.get(path),lease:scope.lease,identity:live,phase:'execute'});
   const sourceOrder=await scope.getAsUser('sisventas/ordenes/'+body.orderKey);if(!sourceOrder||digest(sourceOrder)!==body.expectedHash)throw fail(409,'SV_PURCHASE_CONFLICT','La orden cambió. Volvé a abrirla.');
   const loaded=await sources.load({actor,lease:scope.lease,sourceOrder,guard,read:path=>scope.get(path),queryPage:(...args)=>scope.queryPage(...args)});
   const plan=Policy.issueCurrentPendingBaseline(actor,scope.lease,{sourceOrder,sourcePort:sources,evidence:loaded.evidence,at:now()},now());
   scope.beforeCommit(async({readFresh,queryPageFresh})=>{
    const fresh=await access(req,readFresh,checked);if(digest(fresh)!==digest(checked))throw fail(409,'SV_PURCHASE_CURRENT_PENDING_AUTH_CHANGED','La autorización de mantenimiento cambió.');
    await assertAdmission({read:readFresh,lease:scope.lease,identity:fresh,phase:'commit'});
    await sources.assertFresh(loaded.evidence,{actor,lease:scope.lease,sourceOrder,guard,readFresh,queryPageFresh});
    const final=await access(req,readFresh,checked);if(digest(final)!==digest(checked))throw fail(409,'SV_PURCHASE_CURRENT_PENDING_AUTH_CHANGED','La sesión cambió antes del commit.');
   });
   await scope.update(plan.patch);return plan.result;
  });
 }
 return Object.freeze({execute});
}
module.exports={create,OPERATION};
