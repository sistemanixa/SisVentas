'use strict';
// Presentation boundary only. Stored plans and monetary calculations stay private.
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function text(value,max=160){return typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';}
function description(saleId,client){
 const id=text(saleId,128).replace(/^#+/,'');
 return 'Comisión venta '+(id?'#'+id:'sin identificar')+(text(client)?' · '+text(client):'');
}
const reasons=new Map([
 ['La venta no tiene comisión habilitada','La venta no tiene comisión habilitada'],
 ['La venta está anulada o es sin cargo','La venta está anulada o es sin cargo'],
 ['Revisar la coherencia de ítems e importes de la venta','Revisar la coherencia de ítems e importes de la venta'],
 ['La venta todavía no está totalmente cobrada','La venta todavía no está totalmente cobrada'],
 ['Revisar la identidad o actividad de los comisionados','Revisar la identidad o actividad de los comisionados'],
 ['Tope de comisión inválido','Revisar la configuración de comisiones'],
 ['Porcentaje de comisión inválido','Revisar la configuración de comisiones'],
 ['No hay un porcentaje de comisión configurado','No hay una comisión configurada para esta venta'],
 ['Ya hay comisiones vinculadas. Se conservan sin cambios','Ya hay comisiones vinculadas. Se conservan sin cambios'],
 ['Hay registros previos o parciales. Requieren conciliación sin sobrescribirlos','Hay registros previos o parciales. Requieren conciliación sin sobrescribirlos'],
 ['Faltan costos originales; no se usa el catálogo actual','Falta verificar información original de los ítems indicados'],
 ['Revisar cantidades y costos originales de los ítems','Revisar la información original de los ítems'],
 ['La ganancia original no es positiva','La venta no tiene una comisión aplicable'],
 ['La generación incompleta requiere conciliación','La generación incompleta requiere conciliación'],
 ['La generación está en curso o pendiente de reintento','La generación está en curso o pendiente de reintento'],
 ['Fuera del corte automático','Fuera del corte automático']
]);
const statuses=new Set(['lista','generada','existente','revision','no_aplica','pendiente_cobro','historica','procesando','pendiente_confirmacion']);
function response(value){
 const source=object(value)?value:{},known=statuses.has(source.status),result={status:known?source.status:'revision'};
 if(own(source,'motivo')||!known)result.motivo=source.motivo===''&&known?'':reasons.get(source.motivo)||'Revisá el estado de la comisión.';
 for(const field of ['ventaId','ventaFbKey'])if(typeof source[field]==='string')result[field]=text(source[field],128);
 if(typeof source.reutilizada==='boolean')result.reutilizada=source.reutilizada;
 if(typeof source.digest==='string'&&/^[a-f0-9]{64}$/.test(source.digest))result.digest=source.digest;
 if(Array.isArray(source.participantes))result.participantes=source.participantes.filter(object).flatMap(person=>{
  if(typeof person.empleadoFbKey!=='string'||!text(person.empleadoFbKey,128))return [];
  const row={empleadoFbKey:text(person.empleadoFbKey,128)};
  if(typeof person.nombre==='string')row.nombre=text(person.nombre);
  if(typeof person.monto==='number'&&Number.isFinite(person.monto)&&person.monto>=0)row.monto=person.monto;
  return [row];
 });
 if(Array.isArray(source.faltantes))result.faltantes=source.faltantes.filter(object).flatMap(item=>{
  const row={};if(Number.isSafeInteger(item.indice)&&item.indice>=0)row.indice=item.indice;
  if(typeof item.codigo==='string')row.codigo=text(item.codigo,128);
  return Object.keys(row).length?[row]:[];
 });
 return result;
}
const busy='La comisión se está generando en otra sesión. Reintentá';
const errors=new Map([
 ...[busy,'Método no permitido','Volvé a tu cuenta para generar comisiones','Solicitud inválida','Venta inválida','Venta no disponible','Sesión requerida','Sesión inválida','Sin acceso','Usuario sin acceso','Módulo no disponible','Registro no disponible','Generación de comisiones pendiente de habilitación','Generación automática no habilitada','Enviá únicamente la referencia de la venta','Ya existe un registro en el destino. No se sobrescribió','El control cambió. No se reemplazó ningún registro','La venta cambió. Las comisiones creadas se conservaron para revisión','La base cambió durante una generación incompleta. Requiere revisión','La base de la comisión cambió. No se continuará automáticamente','La venta o su configuración cambiaron. Revisá el cálculo otra vez'].map(message=>[message,message]),
 ['Revisar cantidades y costos originales de los ítems','Revisar la información original de los ítems']
]);
function errorMessage(error){
 return errors.get(error?.message)||(error?.statusCode===401?'Sesión inválida':error?.statusCode===403?'Sin acceso':error?.statusCode===404?'Venta no disponible':error?.statusCode===400?'Solicitud inválida':error?.statusCode===409?'La comisión requiere revisión. Volvé a comprobarla.':'La generación quedó pendiente de reintento seguro');
}
module.exports={description,response,errorMessage};
