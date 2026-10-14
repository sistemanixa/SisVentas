'use strict';
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const fields=['nombre','usuario','activo','tipoEmpleado','legajo','cargo','cargoId'];
function project(employees,cargos,own){const staff={},rates={};for(const [key,e] of Object.entries(employees||{})){staff[key]=key===own?{...e}:Object.fromEntries(fields.filter(f=>e[f]!==undefined).map(f=>[f,e[f]]));}const cargo=employees?.[own]?.cargoId;for(const [key,c]of Object.entries(cargos||{}))rates[key]=key===cargo?{...c}:{nombre:c.nombre||''};return {empleados:staff,cargos:rates};}
function createEmployeeDirectory({auth,db}){
 async function authorize(req){const match=String(req.headers.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!match)throw fail(401,'Sesión requerida');let user;try{user=await auth.verifyIdToken(match[1],true);}catch(_){throw fail(401,'Sesión inválida');}const role=(await db.ref('sv_chat_roles/'+user.uid).get()).val();if(role?.activo!==true||!['admin','administrativo','vendedor','tecnico','tecnico_vendedor'].includes(role.rol))throw fail(403,'Usuario sin acceso');const cfg=(await db.ref('sv_permisos/'+role.rol).get()).val()||{},blocked=Object.values(cfg.bloqueados||{});const ownAccess=!blocked.includes('ctaemp')||(!blocked.includes('dashboard')&&(typeof cfg.acciones?.dashboard?.miCuenta==='boolean'?cfg.acciones.dashboard.miCuenta:role.rol!=='admin'));return {uid:user.uid,ownAccess};}
 async function read(identity){const profiles=(await db.ref('sv_usuarios').orderByChild('uid').equalTo(identity.uid).get()).val()||{},matches=Object.entries(profiles).filter(([,p])=>p.uid===identity.uid&&p.activo!==false);if(matches.length!==1)throw fail(403,'Perfil no verificado');const [key,profile]=matches[0];const [employees,cargos]=await Promise.all(['sisventas/empleados','sisventas/config/cargos'].map(async p=>(await db.ref(p).get()).val()||{}));const own=typeof profile.empleadoFbKey==='string'&&employees[profile.empleadoFbKey]?.activo!==false&&employees[profile.empleadoFbKey]?profile.empleadoFbKey:'';
 const binding={perfilFbKey:key};const ref=db.ref('sv_empleado_uid/'+identity.uid);const before=(await ref.get()).val();if(before?.perfilFbKey!==key)await ref.set(binding);
 return project(employees,cargos,identity.ownAccess?own:'');}
 return {authorize,read};
}
module.exports={createEmployeeDirectory,project};
