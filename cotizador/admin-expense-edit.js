'use strict';
const {digest,parts}=require('./labor-guard');
const Payments=require('./bonus-payment');
const Create=require('./admin-expense-create');
const Money=require('./commercial-models/commercial-money');
const fields=['fecha','vencimiento','tipo','categoria','descripcion','desc','monto','medio','proveedor','comprobante','empleadoId','empleadoFbKey','empleadoNombre','esFijoBase','recurrenciaActiva','tipoPagable','origen','legacyKey','movimientoCtaKey','gastoFbKey','gastoKey','montoPagado','saldoPagadoLegacy','pagos','estado','reembolsado','montoCompensado','compensaciones','adelantoCompensado','adelantosAplicados','sueldoBase','sueldoBruto','bonificacion','mes','periodoDescuento','fechaPago','requiereAprobacion','aprobadoPor','aprobadoTs','fechaAprobacion','bajaAdministrativa'];
const base=row=>Object.fromEntries(fields.filter(k=>row?.[k]!==undefined).map(k=>[k,row[k]]));
const fail=(message,statusCode=409)=>Object.assign(Error(message),{statusCode,code:'SV_EXPENSE_EDIT_CONFLICT'});
function createAdminExpenseEdit({authorize,store,guard,enabled=false,now=Date.now}){
 async function access(actor,read){
  if(actor?.claims?.uid!==actor?.uid||!actor?.uid)throw fail('Sesión requerida',403);
  const profile=await read('sv_chat_roles/'+actor.uid),cfg=profile?.rol?await read('sv_permisos/'+profile.rol):null,reset=await read('sv_access_resets/'+actor.uid);
  if(profile?.activo!==true||!Create.allowed(profile.rol,cfg)||(typeof cfg?.acciones?.gastos?.editar==='boolean'?!cfg.acciones.gastos.editar:!['admin','administrativo'].includes(profile.rol))||actor.claims.svPasswordChangeRequired===true||reset?.required===true||reset?.version!=null&&reset.version!==actor.claims.svAccessVersion)throw fail('No tenés permiso para editar gastos',403);
  return {role:profile.rol,permissionRevision:cfg?.indiceRevision??null,permissionDigest:digest(cfg||{}),name:String(profile.nombre||'')};
 }
 async function execute(actor,body){
  if(!enabled)throw fail('Recargá para actualizar el guardado de Gastos',503);
  if(!body||Object.keys(body).some(k=>!['id','key','expectedHash','datos','foto'].includes(k))||typeof body.key!=='string'||parts(body.key).length!==1||!/^[a-f0-9]{64}$/.test(body.expectedHash||''))throw fail('Edición de gasto inválida',400);
  const data=Create.requestData({id:body.id,projection:'complete',datos:body.datos,...(body.foto?{foto:body.foto}:{})}),permission=await access(actor,p=>store.read(p));
  return guard.run({uid:actor.uid,claims:actor.claims,...permission,mode:'command',financialAction:'gastos.administrar',recoverReceipt:true,opId:body.id,transportDigest:digest(body),operation:'admin-expense-edit',input:body},async scope=>{
   const currentPermission=await access(actor,p=>scope.get(p));if(digest(permission)!==digest(currentPermission))throw fail('Los permisos cambiaron. Volvé a abrir el gasto.');
   const path='sisventas/gastos/'+body.key,original=await scope.get(path),visible=await store.readAsUser(path,actor);
   if(!original||digest(original)!==digest(visible)||digest(base(original))!==body.expectedHash)throw fail('El gasto o sus pagos cambiaron. Volvé a abrirlo.');
   if(original.bajaAdministrativa)throw fail('El gasto fue retirado. Se conserva su historial.');
   if(Number(data.montoPagado||0)!==Number(original.montoPagado||0))throw fail('Corregí los pagos desde Historial de pagos.');
   const linked=await Payments.resolveExpenseMovement(original,body.key,scope);
   if(!linked.path&&(original.empleadoFbKey||original.empleadoId)){const employeeKey=String(original.empleadoFbKey||original.empleadoId),account=await scope.get('sisventas/ctaemp/'+employeeKey),matches=Object.entries(account||{}).filter(([,m])=>m&&(m.gastoFbKey===body.key||m.gastoKey===body.key));if(matches.length>1)throw fail('Hay más de un movimiento vinculado. Revisá el gasto antes de corregirlo.');if(matches.length){linked.path='sisventas/ctaemp/'+employeeKey+'/'+matches[0][0];linked.movement=matches[0][1];}}
   const movement=linked.movement,oldEmployee=String(original.empleadoFbKey||original.empleadoId||''),employee=String(data.empleadoId||''),amountChanged=Number(data.monto)!==Number(original.monto),employeeChanged=employee!==oldEmployee;
   if(amountChanged&&Number(data.monto)<Payments.paymentTotal(original))throw fail('El importe no puede ser menor que lo ya pagado.');
   const advance=['adelanto','adelanto_personal'].includes(String(original.tipoPagable||original.origen||movement?.tipo||'').toLowerCase());
   if(advance&&employeeChanged)throw fail('Anulá el adelanto y cargá uno nuevo al otro empleado.');
   if(advance&&amountChanged&&Number(movement?.montoCompensado||original.montoCompensado||0)>0)throw fail('El adelanto ya fue compensado. Revisá la liquidación.');
   if(movement&&(amountChanged||employeeChanged)&&(Number(movement.monto)!==Number(original.monto)||Payments.paymentTotal(movement)!==Payments.paymentTotal(original)))throw fail('El gasto y su movimiento requieren revisión.');
   const actual=structuredClone(original),patch={};
   for(const k of ['fecha','vencimiento','tipo','categoria','descripcion','monto','medio','proveedor','comprobante','empleadoId','empleadoNombre','esFijoBase','recurrenciaActiva'])if(data[k]!==undefined)actual[k]=data[k];
   if(actual.fijoGenerado===true)actual.esFijoBase=false;
   if(employeeChanged&&employee){if(parts(employee).length!==1)throw fail('Empleado inválido',400);const person=await scope.get('sisventas/empleados/'+employee);if(!person||person.activo===false)throw fail('El empleado ya no está activo.');actual.empleadoNombre=person.nombre||'';}
   if(employeeChanged&&movement){if(!employee)throw fail('No se puede quitar un vínculo con movimientos.');const newPath='sisventas/ctaemp/'+employee+'/'+linked.path.split('/').at(-1);if(await scope.get(newPath))throw fail('Ya existe un movimiento en la cuenta destino.');patch[linked.path]=null;actual.empleadoFbKey=employee;actual.legacyKey=newPath.slice('sisventas/'.length);linked.path=newPath;}
   else if(employeeChanged&&actual.empleadoFbKey)actual.empleadoFbKey=employee||null;
   if(amountChanged){const paid=Payments.paymentTotal(original);actual.estado=paid===0?'pendiente':Money.sum([Number(actual.monto),-paid])===0?'pagado':'pagado_parcial';if(original.requiereAprobacion===true||['rechazado','pendiente_aprobacion','anulado'].includes(original.estado))actual.estado=original.estado;}
   if(movement){const next=structuredClone(movement);if(amountChanged)next.monto=actual.monto;if(data.fecha!==original.fecha)next.fecha=data.fecha;if(data.medio!==original.medio)next.medioPago=data.medio;if(employeeChanged){next.empleadoId=employee;next.empleadoNombre=actual.empleadoNombre;}patch[linked.path]=next;}
   if(body.foto){if(!/^data:(?:image\/(?:png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=\r\n]+$/.test(body.foto))throw fail('Comprobante inválido',400);actual.fotoAdjunta=true;patch['sisventas/gastos_adjuntos/'+body.key+'/fotoBase64']=body.foto;}
   patch[path]=actual;
   patch['sisventas/auditoria_pagos/expense_edit_'+body.id]={accion:'editar_gasto',gastoFbKey:body.key,uid:actor.uid,usuario:permission.name,ts:now(),anterior:base(original),posterior:base(actual)};
   scope.beforeCommit(async({readFresh})=>{if(digest(await access(actor,readFresh))!==digest(permission))throw fail('Los permisos cambiaron antes de guardar.');});
   await scope.update(patch);return {ok:true,committed:true,key:body.key};
  });
 }
 return {authorize,execute};
}
module.exports={createAdminExpenseEdit,base};
