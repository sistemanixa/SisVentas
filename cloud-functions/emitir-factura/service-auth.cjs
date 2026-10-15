'use strict';
const known=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
const defaultBlocked={admin:[],administrativo:['configuracion'],vendedor:['configuracion','facturas','ordenes'],tecnico_vendedor:['configuracion','facturas','ordenes'],tecnico:['configuracion','facturas','ordenes','clientes']};
function fail(status,message){const e=Error(message);e.statusCode=status;throw e;}
function permitted(role,cfg,module,action,defaults){if(!known.includes(role))return false;const blocked=Array.isArray(cfg?.bloqueados)?cfg.bloqueados:defaultBlocked[role];if(blocked.includes(module))return false;if(!action)return true;const [group,...name]=action.split('.'),override=cfg?.acciones?.[group]?.[name.join('_')];return typeof override==='boolean'?override:defaults.includes(role);}
function policy(service,body={}){
 if(service==='fiscal-test')return {module:'configuracion'};
 if(service==='fiscal'){
 if(body.accion==='consultar_cuit')return {module:'clientes'};
 if(body.accion==='recuperar_identidad_fiscal')return {module:'facturas',action:'facturas.recuperarDatos',defaults:['admin']};
 if(body.esNotaCredito)return {module:'facturas',action:'facturas.notaCredito',defaults:['admin']};
 return {module:'facturas'};
 }
 if(service==='learn')return {module:'configuracion',action:'configuracion.aprenderIA',defaults:['admin']};
 if(service==='purchase-import')return {module:'ordenes'};
 return {module:'dashboard',action:'dashboard.asistente',defaults:known};
}
async function authorize({admin,authorization,service,body}){
 const m=String(authorization||'').match(/^Bearer\s+(\S+)$/i);if(!m)fail(401,'Sesión requerida');
 let user;try{user=await admin.auth().verifyIdToken(m[1],true);}catch(_){fail(401,'Sesión inválida o vencida');}
 await assertAccessReady(admin,user);
 const identity=(await admin.database().ref('sv_chat_roles/'+user.uid).get()).val();
 if(identity?.activo!==true||!known.includes(identity.rol))fail(403,'Usuario sin acceso al servicio');
 const cfg=(await admin.database().ref('sv_permisos/'+identity.rol).get()).val()||{};
 const p=policy(service,body);if(!permitted(identity.rol,cfg,p.module,p.action,p.defaults))fail(403,'Sin permiso para esta operación');
 return {uid:user.uid,role:identity.rol};
}
async function assertAccessReady(admin,user){
 const state=(await admin.database().ref('sv_access_resets/'+user.uid).get()).val();
 if(user.svPasswordChangeRequired===true||(state&&(state.required||state.version!==user.svAccessVersion)))fail(403,'Actualizá tu contraseña y volvé a ingresar');
}
module.exports={authorize,permitted,policy,assertAccessReady};
