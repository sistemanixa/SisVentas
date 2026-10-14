'use strict';
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
function project(periods){return Object.values(periods||{}).filter(p=>p&&typeof p.empleadoId==='string'&&p.empleadoId&&typeof p.desde==='string'&&typeof p.hasta==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.desde)&&/^\d{4}-\d{2}-\d{2}$/.test(p.hasta)&&!['rechazado','cancelado'].includes(String(p.estado||'').trim().toLowerCase())).map(p=>({empleadoId:p.empleadoId,empleadoNombre:String(p.empleadoNombre||''),desde:p.desde,hasta:p.hasta}));}
function createEmployeeAvailability({auth,db}){
 async function authorize(req){
  const match=String(req.headers.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!match)throw fail(401,'Sesión requerida');
  let token;try{token=await auth.verifyIdToken(match[1],true);}catch(_){throw fail(401,'Sesión inválida');}
  const identity=(await db.ref('sv_chat_roles/'+token.uid).get()).val();
  if(identity?.activo!==true||!['admin','administrativo','vendedor','tecnico','tecnico_vendedor'].includes(identity.rol))throw fail(403,'Usuario sin acceso');
  const cfg=(await db.ref('sv_permisos/'+identity.rol).get()).val()||{};
  if(Object.values(cfg.bloqueados||{}).includes('ordentrabajo'))throw fail(403,'Sin acceso a órdenes de trabajo');
  return {uid:token.uid};
 }
 async function read(){return project((await db.ref('sisventas/vacaciones').get()).val());}
 return {authorize,read};
}
module.exports={project,createEmployeeAvailability};
