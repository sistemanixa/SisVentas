'use strict';
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
const fields=['nombre','usuario','activo','tipoEmpleado','legajo','cargo','cargoId'];
const key=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
function project(employees,cargos,own){const staff={},rates={};for(const [key,e] of Object.entries(employees||{})){staff[key]=key===own?{...e}:Object.fromEntries(fields.filter(f=>e[f]!==undefined).map(f=>[f,e[f]]));}const cargo=employees?.[own]?.cargoId;for(const [key,c]of Object.entries(cargos||{}))rates[key]=key===cargo?{...c}:{nombre:c.nombre||''};return {empleados:staff,cargos:rates};}
function createEmployeeDirectory({auth,db,queryReader}){
 const read=async path=>(await db.ref(path).get()).val();
 async function authority(claims){
  if(!key(claims?.uid)||claims.svPasswordChangeRequired===true)throw fail(403,'Actualizá tu acceso y volvé a ingresar');
  const [role,reset]=await Promise.all([read('sv_chat_roles/'+claims.uid),read('sv_access_resets/'+claims.uid)]);
  if(role?.activo!==true||!['admin','administrativo','vendedor','tecnico','tecnico_vendedor'].includes(role.rol)||reset?.required===true||reset?.version!==undefined&&reset?.version!==null&&claims.svAccessVersion!==reset.version)throw fail(403,'Usuario sin acceso');
  const cfg=await read('sv_permisos/'+role.rol)||{},blocked=Object.values(cfg.bloqueados||{});
  const ownAccess=!blocked.includes('ctaemp')||(!blocked.includes('dashboard')&&(typeof cfg.acciones?.dashboard?.miCuenta==='boolean'?cfg.acciones.dashboard.miCuenta:role.rol!=='admin'));
  return {uid:claims.uid,role:role.rol,ownAccess,claims};
 }
 async function authorize(req){
  const match=String(req.headers.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!match)throw fail(401,'Sesión requerida');
  let claims;try{claims=await auth.verifyIdToken(match[1],true);}catch(_){throw fail(401,'Sesión inválida');}
  return authority(claims);
 }
 async function profile(identity){
  if(!key(identity?.uid))throw fail(403,'Perfil no verificado');
  const rows=typeof queryReader==='function'?await queryReader('sv_usuarios','uid',identity.uid):(await db.ref('sv_usuarios').orderByChild('uid').equalTo(identity.uid).get()).val();
  const matches=Object.entries(rows||{}).filter(([,p])=>p?.uid===identity.uid&&p.activo!==false);
  if(matches.length!==1||!key(matches[0][0])||matches[0][1].rol&&identity.role&&matches[0][1].rol!==identity.role)throw fail(403,'Perfil no verificado');
  return {key:matches[0][0],value:matches[0][1]};
 }
 async function readDirectory(identity){
  const p=await profile(identity),[employees,cargos]=await Promise.all(['sisventas/empleados','sisventas/config/cargos'].map(async path=>await read(path)||{}));
  const own=key(p.value.empleadoFbKey)&&employees[p.value.empleadoFbKey]?.activo!==false&&employees[p.value.empleadoFbKey]?p.value.empleadoFbKey:'';
  if(identity.ownAccess&&own){
   const binding=await read('sv_empleado_uid/'+identity.uid);
   if(!binding)throw fail(409,'Actualizá tu cuenta para completar el acceso personal.','SV_EMPLOYEE_BINDING_REQUIRED');
   if(binding.perfilFbKey!==p.key)throw fail(409,'El vínculo personal requiere revisión del administrador.');
  }
  // GET nunca crea ni reemplaza identidades. La proyección privada sigue siendo sólo propia.
  return project(employees,cargos,identity.ownAccess?own:'');
 }
 async function prepare(identity){
  const current=await authority(identity.claims);if(current.uid!==identity.uid||current.role!==identity.role||!current.ownAccess)throw fail(403,'Tu acceso personal cambió. Volvé a ingresar');
  const p=await profile(current),employee=key(p.value.empleadoFbKey)?await read('sisventas/empleados/'+p.value.empleadoFbKey):null;
  if(!employee||employee.activo===false)throw fail(403,'No hay un empleado activo vinculado a tu cuenta');
  const ref=db.ref('sv_empleado_uid/'+current.uid),before=(await ref.get()).val();
  if(before){if(before.perfilFbKey!==p.key)throw fail(409,'El vínculo personal requiere revisión del administrador.');return {ready:true,created:false};}
  let conflict=false;
  const result=await ref.transaction(value=>{conflict=!!value&&value.perfilFbKey!==p.key;return value?undefined:{perfilFbKey:p.key};},undefined,false);
  if(conflict||result.snapshot?.val()?.perfilFbKey!==p.key)throw fail(409,'El vínculo personal cambió. Volvé a consultar');
  return {ready:true,created:result.committed===true};
 }
 return {authorize,read:readDirectory,prepare};
}
module.exports={createEmployeeDirectory,project};
