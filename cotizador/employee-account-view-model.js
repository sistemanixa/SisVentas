'use strict';
// A derived read model. It never converts money, repairs records or copies an
// unreviewed object. Incomplete legacy rows remain private and retire readiness.
const VERSION=1;
const Calculations=require('./commission-calculations');
const Directory=require('./employee-directory');
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const normalize=value=>typeof value==='string'?value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[ \t]+/g,'_'):'';
const canonicalTypes=new Set(['comision','bonificacion','sueldo','haber','aguinaldo','hextra','hs_extra','horas_extra','adelanto','cargo','transporte','materiales','gasto_empresa','otro']);
const genericTypes=new Set(['variable','fijo','compra','gasto']);
const common=new Set(('fbKey tipo tipoPagable origen empleadoId empleadoFbKey empFbKey empleadoNombre nombreEmpleado ventaId ventaFbKey numeroVenta ventaNumero saleId cliente clienteNombre nombreCliente clientName gastoFbKey gastoKey movimientoCtaKey movFbKey legacyKey monto importe montoPagado saldoPagadoLegacy moneda fecha fechaPago fechaTrabajo fechaImputacion fechaAprobacion fechaRechazo fechaAnulacion fechaRetiro mes periodo periodoTrabajo periodoComputo ts estado requiereAprobacion aprobadoPor aprobadoTs rechazadoPor rechazadoTs anulado anuladoPor anuladoTs retirado retiradoPor retiradoTs reembolsado medio medioPago usuario usuarioUid usuarioPago usuarioCarga actorUid rol generadoPor solicitadoPor solicitadoTs origenCarga origenLegacy migradoDesdeLegacy migradoAGastos modificadoPor modificadoTs editadoPor editadoTs pagadoTs categoria').split(' '));
const ordinary=new Set(('descripcion desc detalle motivo observaciones nota notas fechaVencimiento vencimiento proveedor comprobanteSolicitudUrl fotoBase64 fotoUrl fotoAdjunta esFijoBase fijoBaseKey fijoGenerado mesGenerado reglaPeriodicaKey recurrenciaId montoOriginal montoCompensado saldoPendiente compensado compensadoTs periodoDescuento adelantoCompensado sueldo sueldoBase sueldoBruto sueldoNeto bonificacion total aguinaldo semestre mejorSueldo hsExtra horas dias valorHora valorHoraExtra valorHoraAplicado valorHoraExtraAplicado diasMesAplicados cargoId cargoNombre cargoIdAplicado operacionId bonificacionConceptoId bonificacionConceptoNombre bonificacionCantidad bonificacionValorUnitario bonificacionGrupoId bonificacionGrupoTotal bonificacionGrupoPersonas registradoPor creadoPor creadoTs modificadoFecha baseSalarial variacionPct aumentoPct porcentajeAumento').split(' '));
const payment=new Set(('monto importe fecha ts medio moneda usuario usuarioUid uid actorUid rol origen estado anulado anuladoTs anuladoPor fechaAnulacion editadoTs editadoPor corregidoTs corregidoPor lotePagoKey loteKey pagoKey gastoFbKey movimientoCtaKey operacionId referencia comprobanteId').split(' '));
const paymentText=new Set(['concepto','descripcion','detalle','motivo','observaciones','nota','motivoAnulacion','motivoEdicion']);
const receiptPublic=new Set(['id','comprobanteId','externo','comprobanteExterno','tipo','type','nombre','name','ts']);
const receiptPrivate=new Set(['data','base64','url','src','ruta','path','size','tamano']);
const application=new Set(['adelantoFbKey','movFbKey','gastoFbKey','gastoKey','key','monto','montoOriginal','fecha','descripcion','desc','ts']);
const salaryHistory=new Set(['anterior','nuevo','fecha','ts','tipo','usuario','usuarioUid','rol','motivo','valorHora','valorHoraExtra','variacionPct','aumentoPct','porcentaje','porcentajeAumento']);
const retirement=new Set(['uid','usuario','ts','auditKey']);
for(const field of ['recurrenciaActiva','recurrenciaGenerada','recurrenciaMes','reglaPeriodicaFbKey','fijoMes','fijoBaseFbKey','creadoPorRol','periodico','periodicoDia','motivoRechazo'])ordinary.add(field);
payment.add('accion');
const aliases=['empleadoId','empleadoFbKey'];
const key=value=>typeof value==='string'&&value.length>0&&Buffer.byteLength(value)<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)&&!['__proto__','prototype','constructor'].includes(value);
function entries(value){if(!object(value))throw Error('shape');const descriptors=Object.getOwnPropertyDescriptors(value);if(Object.values(descriptors).some(d=>!own(d,'value')))throw Error('shape');return Object.entries(value);}
function scalar(value){if(value===null||['string','boolean'].includes(typeof value)||typeof value==='number'&&Number.isFinite(value))return value;throw Error('shape');}
function money(value){return typeof value==='number'?Number.isFinite(value):typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())&&Number.isFinite(Number(value));}
function text(value){return typeof value==='string'?value:'';}
function legacyOwner(record){const value=text(record.legacyKey);if(!value.startsWith('ctaemp/'))return '';const match=/^ctaemp\/([^/]+)\/([^/]+)$/.exec(value);return match&&key(match[1])&&key(match[2])?match[1]:null;}
function ownerOfExpense(record){
 if(record==null)return{owner:'',owners:[],complete:true};
 try{entries(record);const owners=[];let complete=true;for(const field of aliases)if(own(record,field)&&record[field]!==null&&record[field]!==''){if(!key(record[field]))complete=false;else owners.push(record[field]);}const legacy=legacyOwner(record);if(legacy===null)complete=false;else if(legacy)owners.push(legacy);const unique=[...new Set(owners)];return{owner:unique.length===1&&complete?unique[0]:'',owners:unique,complete:complete&&unique.length<=1};}catch(_){return{owner:'',owners:[],complete:false};}
}
function strictSale(record){for(const field of ['ventaId','numeroVenta','ventaNumero','saleId']){const value=text(record[field]).replace(/^#/,'');if(value.length<=64&&/^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/.test(value))return value;}for(const field of ['descripcion','desc','detalle']){const match=/^Comisi[oó]n venta #?([A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*)(?=$|[ \t]*(?:[·|—–]|\r?\n))/i.exec(text(record[field]).trimStart());if(match&&match[1].length<=64)return match[1];}return '';}
function caption(record){const sale=strictSale(record);if(!sale)return 'Comisión';let client='';for(const field of ['cliente','clienteNombre','nombreCliente','clientName']){const value=text(record[field]);if(value&&value.length<=240&&!/[\x00-\x1f\x7f<>\u202a-\u202e\u2066-\u2069]/.test(value)){client=value;break;}}return 'Comisión · Venta #'+sale+(client?' · '+client:'');}
function classify(record){
 try{entries(record);const payable=normalize(record.tipoPagable),type=normalize(record.tipo),origin=normalize(record.origen),signals=[payable,type,origin].filter(value=>canonicalTypes.has(value)),legacyPrefix=['descripcion','desc','detalle'].some(field=>/^Comisi[oó]n(?:$|[ \t·:|—–])/i.test(text(record[field]).trimStart()));if((signals.includes('comision')||legacyPrefix)&&signals.some(value=>value!=='comision'))return 'unknown';
  if(payable)return canonicalTypes.has(payable)?payable:'unknown';
  if(canonicalTypes.has(type))return type;
  if(origin==='comision')return 'comision';
  const legacy=['descripcion','desc','detalle'].some(field=>/^Comisi[oó]n(?:$|[ \t·:|—–])/i.test(text(record[field]).trimStart()));
  if(legacy&&(!type||genericTypes.has(type)))return strictSale(record)?'comision':'unknown';
  if(genericTypes.has(type))return 'gasto';return 'unknown';
 }catch(_){return 'unknown';}
}
function recordFields(value,fields,strict,extra){const result={};for(const [field,next]of entries(value)){if(fields.has(field))Object.defineProperty(result,field,{value:scalar(next),writable:true,enumerable:true,configurable:true});else if(extra&&extra(field,next,result))continue;else if(strict)throw Error('unknown');}return result;}
function collection(value,project){
 if(value===null)return null;if(Array.isArray(value)){if(Object.getPrototypeOf(value)!==Array.prototype||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!own(d,'value')))throw Error('shape');return Array.prototype.map.call(value,next=>next===null?null:project(next));}
 const result={};for(const [id,next]of entries(value)){if(!key(id))throw Error('shape');Object.defineProperty(result,id,{value:next===null?null:project(next),writable:true,enumerable:true,configurable:true});}return result;
}
function projectReceipt(value,commission){if(value===null)return null;const fields=new Set(receiptPublic);if(!commission)for(const field of receiptPrivate)fields.add(field);const result=recordFields(value,fields,!commission);if(commission){for(const field of ['nombre','name'])if(own(result,field))result[field]='Comprobante de pago';for(const field of ['tipo','type'])if(result[field]!=null&&result[field]!==''&&(typeof result[field]!=='string'||!/^(?:application\/pdf|image\/(?:png|jpeg|webp))$/i.test(result[field])))throw Error('schema');}return result;}
function projectPayment(value,commission,depth=0){
 if(depth>8)throw Error('shape');entries(value);if(depth===0&&!own(value,'monto')||own(value,'monto')&&!money(value.monto)||own(value,'importe')&&value.importe!==null&&!money(value.importe))throw Error('shape');const fields=new Set(payment);if(!commission)for(const field of paymentText)fields.add(field);
 return recordFields(value,fields,!commission,(field,next,result)=>{
  if(field==='comprobante'){result[field]=typeof next==='string'?(commission?null:next):projectReceipt(next,commission);return true;}
  if(['ajustes','historial','ediciones'].includes(field)){result[field]=collection(next,item=>projectPayment(item,commission,depth+1));return true;}
  if(['anterior','nuevo'].includes(field)){result[field]=next===null?null:projectPayment(next,commission,depth+1);return true;}return false;
 });
}
// Exact interpretation used by the existing CTA expense adapter. Legacy-only
// descriptions may be rebuilt only when both accounting interpretations agree.
function legacyCtaType(record){
 const norm=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(),type=norm(record.tipoPagable||record.origen||record.tipo||'');
 if(type==='comision')return 'comision';if(type==='bonificacion')return 'bonificacion';const category=norm(record.categoria||''),description=norm(record.descripcion||record.desc||record.detalle||'');
 if(category==='personal'){if(description.indexOf('haber ')===0||description.indexOf('sueldo ')>=0)return 'sueldo';if(description.indexOf('hs extra')>=0||description.indexOf('horas extra')>=0)return 'hextra';if(description.indexOf('aguinaldo')>=0)return 'aguinaldo';if(description.indexOf('bonificacion')>=0)return 'bonificacion';if(description.indexOf('adelanto')>=0)return 'adelanto';return 'gasto_empresa';}
 if(description.indexOf('haber ')===0)return 'sueldo';if(description.indexOf('hs extra')>=0||description.indexOf('horas extra')>=0)return 'hextra';if(description.indexOf('aguinaldo')>=0)return 'aguinaldo';if(description.indexOf('bonificacion')>=0)return 'bonificacion';if(description.indexOf('adelanto')>=0)return 'adelanto';const rawCategory=String(record.categoria||'').toLowerCase();return ['gasto_empresa','transporte','materiales','otro'].includes(rawCategory)?rawCategory:'gasto_empresa';
}
function project(raw,{employeeId}={}){
 if(raw==null)return{value:null,complete:true,issues:[]};
 try{
  entries(raw);const type=classify(raw);if(type==='unknown')return{value:null,complete:false,issues:['classification']};
  if(!own(raw,'monto')||!money(raw.monto)||['importe','montoPagado','saldoPagadoLegacy'].some(field=>own(raw,field)&&raw[field]!==null&&!money(raw[field])))return{value:null,complete:false,issues:['amount']};
  const owner=ownerOfExpense(raw);if(employeeId){const legacy=legacyOwner(raw);if(!key(employeeId)||legacy===null||legacy&&legacy!==employeeId||[...aliases,'empFbKey'].some(field=>own(raw,field)&&raw[field]!==null&&raw[field]!==''&&String(raw[field])!==employeeId))return{value:null,complete:false,issues:['owner']};}else if(!owner.complete)return{value:null,complete:false,issues:['owner']};
  const commission=type==='comision',fields=new Set(common);if(!commission)for(const field of ordinary)fields.add(field);if(['sueldo','haber','aguinaldo'].includes(type))fields.add('base');
  const value=recordFields(raw,fields,!commission,(field,next,result)=>{
   if(field==='bajaAdministrativa'){result[field]=next===null?null:recordFields(next,retirement,!commission);return true;}
   if(field==='pagos'){result[field]=collection(next,item=>projectPayment(item,commission));return true;}
   if(field==='comprobante'){result[field]=typeof next==='string'?(commission?null:next):projectReceipt(next,commission);return true;}
   if(!commission){
    if(field==='compensaciones'){result[field]=collection(next,scalar);return true;}
    if(field==='adelantosAplicados'){result[field]=collection(next,item=>recordFields(item,application,true));return true;}
    if(field==='bonificacionDestinatarios'||field==='grupoAprobacion'){result[field]=collection(next,scalar);return true;}
    if(field==='historialValorHora'){result[field]=collection(next,item=>recordFields(item,salaryHistory,true));return true;}
   }
   return false;
  });
  if(commission){const legacyOnly=![raw.tipoPagable,raw.tipo,raw.origen].some(field=>normalize(field)==='comision');value.descripcion=legacyOnly?caption(raw).replace(/^Comisión · Venta #/,'Comisión venta #'):caption(raw);if(own(raw,'desc'))value.desc=value.descripcion;if(own(raw,'detalle'))value.detalle=value.descripcion;
   if(legacyOnly&&(Calculations.esComision(raw)!==Calculations.esComision(value)||Calculations.normalizarEstadoGasto(raw)!==Calculations.normalizarEstadoGasto(value)||Calculations.totalPagadoGasto(raw)!==Calculations.totalPagadoGasto(value)||legacyCtaType(raw)!==legacyCtaType(value)))return{value:null,complete:false,issues:['legacy-parity']};}
  return{value,complete:true,issues:[]};
 }catch(_){return{value:null,complete:false,issues:['schema']};}
}
function projectMovement(raw,context={}){return project(raw,context);}
function projectExpense(raw,context={}){return project(raw,context);}
const batchFields=new Set(['fecha','ts','medio','monto','usuario','usuarioUid','rol','loteKey','lotePagoKey','estado','anulado','anuladoTs','anuladoPor']);
const lineFields=new Set(['gastoFbKey','gastoKey','monto','saldoPagado']);
const auditFields=new Set(['accion','gastoFbKey','gastoKey','pagoKey','usuario','usuarioUid','uid','rol','ts','fecha','empleadoAnterior','empleadoNuevo']);
function expenseRef(record){const ids=['gastoFbKey','gastoKey'].filter(field=>own(record,field)&&record[field]!==null&&record[field]!=='').map(field=>record[field]);if(ids.some(id=>!key(id))||new Set(ids).size>1)throw Error('reference');return ids[0]||'';}
function companionExpenseKeys(kind,raw){
 const keys=new Set();if(raw==null)return[];
 function visit(value,depth){if(depth>8)throw Error('shape');entries(value);const id=expenseRef(value);if(id)keys.add(id);if(keys.size>1024)throw Error('shape');if(kind==='batch'&&value.gastos!=null)for(const line of Object.values(value.gastos))if(line!==null)visit(line,depth+1);if(value.ajustes!=null)for(const adjustment of Object.values(value.ajustes))if(adjustment!==null)visit(adjustment,depth+1);}
 try{if(!['batch','audit'].includes(kind))return[];visit(raw,0);return [...keys];}catch(_){return[];}
}
function evidence(records){for(const record of records){if(record&&classify(record)==='comision')return{commission:true,record};}return null;}
function linkedEvidence(record,options,extra=[]){
 const id=expenseRef(record),linked=id&&typeof options.expenseForKey==='function'?options.expenseForKey(id):null;
 const commission=evidence([linked,...extra,record]);if(commission)return commission;
 if(linked&&projectExpense(linked).complete)return{commission:false,record:linked};
 for(const candidate of extra)if(candidate&&projectExpense(candidate).complete)return{commission:false,record:candidate};
 throw Error('reference');
}
function auditState(value,commission){
 if(value===null)return null;entries(value);if(['monto','importe'].some(field=>own(value,field)&&value[field]!==null&&!money(value[field])))throw Error('schema');const fields=new Set([...payment,'empleadoId','legacyKey']);if(!commission)for(const field of paymentText)fields.add(field);
 return recordFields(value,fields,!commission,(field,next,result)=>{if(field==='pagosMedios'){result[field]=collection(next,scalar);return true;}if(field==='comprobante'){result[field]=typeof next==='string'?(commission?null:next):projectReceipt(next,commission);return true;}return false;});
}
function movementAuditRef(ref){
 if(own(ref,'mov'))return recordFields(ref,new Set(['empKey','key']),true,(name,movement,out)=>{if(name!=='mov')return false;const value=projectMovement(movement,{employeeId:ref.empKey,key:ref.key});if(!key(ref.empKey)||!key(ref.key)||!value.complete)throw Error('schema');out.mov=value.value;return true;});
 if(!/^sisventas\/ctaemp\/[^/]+\/[^/]+$/.test(ref.ruta||'')||!money(ref.monto))throw Error('schema');
 return recordFields(ref,new Set(['ruta','monto','medio']),true,(field,next,result)=>{if(field!=='pagosMedios')return false;result[field]=collection(next,scalar);return true;});
}
function auditProjection(raw,options={}){
 entries(raw);const snapshots=[raw.gastoAnterior,raw.movimientoAnterior];
 if(raw.movimientosAnteriores!=null)for(const ref of Object.values(raw.movimientosAnteriores))if(ref&&ref.mov)snapshots.push(ref.mov);
 const context=linkedEvidence(raw,options,snapshots),label=context.commission?caption(context.record):'';
 return recordFields(raw,auditFields,true,(field,next,result)=>{
  if(field==='descripcion'||field==='motivo'){result[field]=context.commission?label:scalar(next);return true;}
  if(field==='gastoAnterior'){const value=projectExpense(next);if(!value.complete)throw Error('schema');result[field]=value.value;return true;}
  if(field==='movimientoAnterior'){const employeeId=key(raw.empleadoAnterior)?raw.empleadoAnterior:undefined,value=projectMovement(next,{employeeId});if(!value.complete)throw Error('schema');result[field]=value.value;return true;}
  if(field==='movimientosAnteriores'||field==='movimientosPosteriores'){result[field]=collection(next,movementAuditRef);return true;}
  if(field==='anterior'||field==='nuevo'||field==='posterior'){result[field]=auditState(next,context.commission);return true;}
  if(field==='comprobante'){result[field]=typeof next==='string'?(context.commission?null:next):projectReceipt(next,context.commission);return true;}
  return false;
 });
}
function projectPaymentAudit(raw,options={}){if(raw==null)return{value:null,complete:true,issues:[]};try{return{value:auditProjection(raw,options),complete:true,issues:[]};}catch(_){return{value:null,complete:false,issues:['companion-schema']};}}
function projectPaymentBatch(raw,options={}){
 if(raw==null)return{value:null,complete:true,issues:[]};
 try{entries(raw);if(!money(raw.monto)||raw.gastos==null||typeof raw.gastos!=='object')throw Error('shape');let commission=false;
  const lines=collection(raw.gastos,line=>{entries(line);if(!money(line.monto)||!money(line.saldoPagado))throw Error('shape');const context=linkedEvidence(line,options);if(context.commission)commission=true;return recordFields(line,lineFields,true,(field,next,result)=>{if(field!=='descripcion')return false;result[field]=context.commission?caption(context.record):scalar(next);return true;});});if(!Object.values(lines).some(Boolean))throw Error('reference');
  const result=recordFields(raw,batchFields,true,(field,next,out)=>{
   if(field==='gastos'){out[field]=lines;return true;}
   if(field==='comprobante'){out[field]=typeof next==='string'?(commission?null:next):projectReceipt(next,commission);return true;}
   if(field==='ajustes'){out[field]=collection(next,value=>auditProjection(value,options));return true;}return false;
  });return{value:result,complete:true,issues:[]};
 }catch(_){return{value:null,complete:false,issues:['companion-schema']};}
}
function projectDirectoryRow(raw,{key:id='record'}={},kind){if(raw==null)return{value:null,complete:true,issues:[]};try{entries(raw);if(!key(id))throw Error('key');const records={};Object.defineProperty(records,id,{value:raw,enumerable:true});const result=kind==='employee'?Directory.project(records,{},'',{staffDetails:true,rates:true}).empleados:Directory.project({},records,'',{staffDetails:true,rates:true}).cargos,value=result[id];if(!value||!Object.keys(value).length)throw Error('schema');return{value,complete:true,issues:[]};}catch(_){return{value:null,complete:false,issues:['directory-schema']};}}
const projectEmployee=(raw,options)=>projectDirectoryRow(raw,options,'employee'),projectCargo=(raw,options)=>projectDirectoryRow(raw,options,'cargo');
module.exports={VERSION,projectMovement,projectExpense,ownerOfExpense,classify,caption,companionExpenseKeys,projectPaymentBatch,projectPaymentAudit,projectEmployee,projectCargo};
