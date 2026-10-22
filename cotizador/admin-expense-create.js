'use strict';
// Alta explícita por acción del usuario. El índice existente sólo es autoridad
// cuando su bootstrap completo y todos sus escritores siguen bajo el fence.
const crypto=require('node:crypto');
const Index=require('./labor-index');
const {identity}=require('./personal-expenses');
const {digest}=require('./labor-guard');
const {validate}=require('./labor-write-gateway');
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
const fields=new Set(['fecha','vencimiento','tipo','categoria','descripcion','monto','montoPagado','estado','medio','proveedor','comprobante','empleadoId','empleadoNombre','reembolsado','esFijoBase','fotoAdjunta','fotoBase64','usuario','pagos','ts','recurrenciaActiva']);
function allowed(role,cfg){
 if(!roles.includes(role))return false;
 if(cfg!=null&&(!record(cfg)||cfg.indiceVersion!==2||cfg.indiceModulos?.gastos!==true||Object.values(cfg.bloqueados||{}).includes('gastos')))return false;
 const override=cfg?.acciones?.gastos?.administrar;
 return typeof override==='boolean'?override:['admin','administrativo'].includes(role);
}
function requestData(body){
 if(!record(body)||Object.keys(body).some(k=>!['id','projection','datos','foto'].includes(k))||typeof body.id!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id)||!['expense-only','complete'].includes(body.projection)||!record(body.datos))throw fail(400,'Solicitud de gasto inválida');
 if(Buffer.byteLength(JSON.stringify(body))>16*1024*1024)throw fail(413,'El guardado supera el tamaño permitido');
 validate(body.datos);
 if(Object.keys(body.datos).some(k=>!fields.has(k)))throw fail(400,'El alta sólo admite los datos de un gasto nuevo');
 const data=structuredClone(body.datos);
 if(typeof data.descripcion!=='string'||!data.descripcion.trim()||typeof data.monto!=='number'||!Number.isFinite(data.monto)||!data.monto)throw fail(400,'Revisá descripción e importe del gasto');
 for(const k of ['fecha','vencimiento','tipo','categoria','estado','medio','proveedor','comprobante','usuario'])if(data[k]!==undefined&&typeof data[k]!=='string')throw fail(400,'Datos inválidos en '+k);
 for(const k of ['categoria','proveedor','medio','comprobante','vencimiento'])if(typeof data[k]==='string'&&data[k].length>500)throw fail(400,'El campo '+k+' admite hasta 500 caracteres');
 if(data.montoPagado!==undefined&&(typeof data.montoPagado!=='number'||!Number.isFinite(data.montoPagado)))throw fail(400,'Importe pagado inválido');
 if(data.pagos!==undefined&&!record(data.pagos))throw fail(400,'Pagos del gasto inválidos');
 if(data.empleadoId!=null){if(!['string','number'].includes(typeof data.empleadoId))throw fail(400,'Empleado inválido');Index.indexEntries('gastos',String(data.empleadoId),null);}
 if(data.fotoBase64!=null&&typeof data.fotoBase64!=='string')throw fail(400,'Foto inválida');
 if(body.foto!=null&&(typeof body.foto!=='string'||body.projection!=='complete'))throw fail(400,'Foto inválida para este tipo de alta');
 return data;
}
function createAdminExpenseCreate({authorize:authorizeGateway,db,guard,enabled=false,now=Date.now}={}){
 if(typeof authorizeGateway!=='function'||!db||!guard)throw TypeError('Falta el circuito de guardado de gastos');
 function available(){if(!enabled)throw fail(503,'El alta de gastos por índice no está habilitada','SV_ADMIN_EXPENSE_DISABLED');}
 async function access(actor,read){
  if(!actor?.uid||actor.claims?.uid!==actor.uid)throw fail(403,'Sesión requerida');
  const profile=await read('sv_chat_roles/'+actor.uid);
  if(profile?.activo!==true||!roles.includes(profile.rol))throw fail(403,'Usuario sin acceso');
  const cfg=await read('sv_permisos/'+profile.rol);
  if(!allowed(profile.rol,cfg))throw fail(403,'No tenés permiso para administrar gastos');
  return {role:profile.rol,permissionRevision:cfg?.indiceRevision??null,permissionDigest:digest(cfg||{})};
 }
 const read=async path=>(await db.ref(path).get()).val();
 async function authorize(req){available();const actor=await authorizeGateway(req);await access(actor,read);return actor;}
 async function create(actor,body){
  available();const data=requestData(body),authorization=await access(actor,read);
  const signature=identity(data),key='gasto_'+crypto.createHash('sha256').update(signature).digest('hex'),gastoPath='sisventas/gastos/'+key;
  return guard.run({uid:actor.uid,claims:actor.claims,mode:'user',...authorization,financialAction:'gastos.administrar',opId:body.id,transportDigest:digest(body),operation:'admin-expense-create',input:body},async scope=>{
   const current=await access(actor,path=>scope.get(path));
   if(digest(current)!==digest(authorization))throw fail(409,'Los permisos cambiaron. Volvé a revisar la operación.','SV_LABOR_AUTH_CHANGED');
   const config=await scope.get('sv_labor_config');
   if(config?.ready!==true||config.schema!==Index.VERSION)throw fail(503,'El índice de gastos todavía no está preparado. No se guardaron cambios.','SV_GASTO_INDEX_UNREADY');
   const path=Index.bucketPath('gastos','identity',signature),members=await scope.get(path);
   // RTDB entrega arreglos para claves numéricas densas (0/1/2). Son la misma
   // membresía por claves; cada entrada sigue debiendo valer exactamente true.
   if(members!==null&&typeof members!=='object')throw fail(409,'No se pudo verificar el índice de gastos','SV_GASTO_INDEX_INVALID');
   let duplicate=false;
   // En la representación JSON de RTDB, los huecos de un array aparecen null.
   // No son miembros; false u otro valor presente siguen siendo corrupción.
   for(const id of Object.keys(members||{}).filter(id=>!(Array.isArray(members)&&members[id]===null))){
    if(members[id]!==true)throw fail(409,'No se pudo verificar el índice de gastos','SV_GASTO_INDEX_INVALID');
    Index.indexEntries('gastos',id,null);
    const previous=await scope.get('sisventas/gastos/'+id);
    if(!record(previous)||Index.indexEntries('gastos',id,previous)[path+'/'+id]!==true)throw fail(409,'El índice de gastos cambió o requiere revisión','SV_GASTO_INDEX_INVALID');
    duplicate=true;
   }
   if(duplicate||await scope.get(gastoPath))throw fail(409,'Ya existe un gasto con estos mismos datos. No se volvió a guardar.','SV_GASTO_DUPLICATE');
   const actual=structuredClone(data),patch={};
   if(body.projection==='complete'&&data.empleadoId){
    const emp=await scope.get('sisventas/empleados/'+data.empleadoId),movement='gasto_empresa_'+key,movPath='sisventas/ctaemp/'+data.empleadoId+'/'+movement;
    if(!record(emp)||emp.activo===false)throw fail(409,'El empleado cambió o ya no está activo. Actualizá la pantalla.');
    if(await scope.get(movPath))throw fail(409,'Ya existe el movimiento de este gasto. Actualizá la pantalla.');
    actual.empleadoNombre=emp.nombre||data.empleadoNombre||'';
    patch[movPath]={tipo:'gasto_empresa',monto:data.monto,desc:'Gasto empresa: '+data.descripcion,fecha:data.fecha,estado:Number(data.montoPagado)>0?data.estado:'aprobado',montoPagado:Number(data.montoPagado)||0,pagos:data.pagos||{},gastoFbKey:key,empleadoId:data.empleadoId,empleadoNombre:actual.empleadoNombre,ts:data.ts||now(),usuario:data.usuario||''};
   }
   patch[gastoPath]=actual;
   if(body.projection==='complete'&&body.foto&&body.foto!==actual.fotoBase64){
    const photoPath='sisventas/gastos_adjuntos/'+key+'/fotoBase64';
    if(body.foto!==await scope.get(photoPath))patch[photoPath]=body.foto;
   }
   await scope.update(patch);
   return {ok:true,committed:true,key};
  });
 }
 return {authorize,create,capability:()=>({enabled:enabled===true,version:1,projections:['expense-only','complete']})};
}
module.exports={createAdminExpenseCreate,allowed,requestData};
