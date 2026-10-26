'use strict';
// Explicit edit policy over protected originals. Payment membership is read from
// the already prepared index; it never broadens a browser read or polls a root.
const Index=require('./payment-membership-index'),Sales=require('./commercial-models/sales-read-model'),View=require('./commercial-view-protocol');
const fail=(code,message)=>Object.assign(Error(message),{statusCode:409,code}),eq=(a,b)=>View.canonical(a)===View.canonical(b),round=n=>Math.round((n+Number.EPSILON)*100)/100;
const valid=p=>!!p&&!p.anulado&&String(p.estado||'').toLowerCase()!=='anulado',number=v=>View.numeric(v)??0;
function discount(record,type){const general=number(record.descuentoGeneral??record.descuentoPct??record.porcentajeDescuento??(type==='presupuesto'?record.descuento:0)),items=Array.isArray(record.items)?record.items:Object.values(record.items||{}),item=i=>number(i.disc??i.descuentoPct??i.descuento??0);return {general,invalid:general<0||general>100||items.some(i=>item(i)<0||item(i)>100),maximum:items.reduce((n,i)=>Math.max(n,100*(1-(1-general/100)*(1-item(i)/100))),general)};}
function signature(record,type){const d=discount(record,type);return JSON.stringify({general:d.general,items:(Array.isArray(record.items)?record.items:Object.values(record.items||{})).map(i=>[String(i.cod??i.codigo??i.pid??''),number(i.qty??i.cantidad??1),number(i.punit??i.precioUnitario??i.precio??0),number(i.disc??i.descuentoPct??i.descuento??0)]),total:round(number(record.total)),iva:round(number(record.iva)),conIva:record.conIva!==false});}
function granted(cfg,domain,action,role,defaults){const grant=cfg?.acciones?.[domain]?.[action];return typeof grant==='boolean'?grant:defaults.includes(role);}
async function paymentsForSale(read,sale){
 Index.validateCoverage(await read(Index.COVERAGE_PATH));const paths=Index.queryPaths(sale),observed=new Map();
 for(const path of paths){const bucket=await read(path);if(bucket===null)continue;if(!bucket||typeof bucket!=='object')throw fail('SV_PAYMENT_INDEX_INVALID','El índice de cobros requiere revisión.');for(const [id,value]of Object.entries(bucket)){if(value===null&&Array.isArray(bucket))continue;Index.recordKey(id);if(value!==true)throw fail('SV_PAYMENT_INDEX_INVALID','El índice de cobros requiere revisión.');if(!observed.has(id))observed.set(id,new Set());observed.get(id).add(path);if(observed.size>10000)throw fail('SV_PAYMENT_SCOPE_SIZE','El historial de esta venta necesita una revisión específica.');}}
 const related=[];for(const [id,seen]of observed){const p=await read('sisventas/pagos/'+id);if(!p)throw fail('SV_PAYMENT_INDEX_INVALID','El índice contiene un cobro ausente.');const expected=Index.indexEntries(id,p),queried=paths.filter(path=>Object.hasOwn(expected,path+'/'+id));if(queried.length!==seen.size||queried.some(path=>!seen.has(path)))throw fail('SV_PAYMENT_INDEX_INVALID','La relación del cobro requiere revisión.');if(Index.belongsToSale(p,sale))related.push({...p,fbKey:id});}
 return related;
}
function operationalEdit({raw,next,changes,domain,actor,cfg}){
 if(domain!=='ventas')return false;const names=Object.keys(changes).filter(name=>!eq(raw[name],next[name]));
 const allowed=['estadoInst','otId','otNumero','otGenerada','actualizado','actualizadoEn','vinculoOTReparadoEn','audit'];
 if(!names.length||names.some(name=>!allowed.includes(name))||!names.some(name=>['estadoInst','otId','otNumero','otGenerada'].includes(name)))return false;
 const permission=(group,name,module,defaults)=>{if(cfg&&(cfg.indiceVersion!==2||cfg.indiceModulos?.[module]!==true||Object.values(cfg.bloqueados||{}).includes(module)))return false;return granted(cfg,group,name,actor.role,defaults);};
 const canEdit=permission('ventas','editar','detalle',['admin','administrativo']),canOT=permission('ot','editar','ordentrabajo',['admin','administrativo','tecnico_vendedor','tecnico']),canCreate=names.includes('otId')&&permission('ot','crear','ordentrabajo',['admin','administrativo']);
 if(!(canEdit||canOT||canCreate))throw Object.assign(fail('SV_COMMERCIAL_OPERATION_PERMISSION','No tenés permiso para modificar el vínculo de instalación.'),{statusCode:403});
 if(names.includes('estadoInst')&&!['pendiente_inst','en_instalacion','instalado','con_garantia'].includes(next.estadoInst)||names.includes('otGenerada')&&typeof next.otGenerada!=='boolean'||names.some(name=>['otId','otNumero','actualizado'].includes(name)&&(typeof next[name]!=='string'||next[name].length>768))||names.some(name=>['actualizadoEn','vinculoOTReparadoEn'].includes(name)&&(!Number.isSafeInteger(next[name])||next[name]<0)))throw fail('SV_COMMERCIAL_OPERATION_SHAPE','El vínculo de instalación contiene datos inválidos.');
 return true;
}
async function validateEdit({raw,next,domain,actor,cfg,read,now=Date.now,creating=false,operational=false}){
 const type=domain==='ventas'?'venta':'presupuesto',beforeSignature=signature(raw,type),afterSignature=signature(next,type),economicsChanged=beforeSignature!==afterSignature,changed=name=>!eq(raw[name],next[name]);
 if(!creating&&['comisionHabilitada','comisionadoPrincipal','comisionadoPrincipalFbKey','comisionado2','comisionado2FbKey','empleado','empleadoFbKey'].some(changed)&&!(domain==='ventas'&&granted(cfg,'ventas','configurarComision',actor.role,['admin'])&&(!cfg||cfg.indiceVersion===2&&cfg.indiceModulos?.venta===true&&!Object.values(cfg.bloqueados||{}).includes('venta'))))throw Object.assign(fail('SV_COMMERCIAL_COMMISSION_PERMISSION','No tenés permiso para cambiar los participantes de la comisión.'),{statusCode:403});

 if(!creating&&domain==='presupuestos'&&(raw.estado==='convertido'||raw.ventaId))throw fail('SV_COMMERCIAL_CONVERTED','El presupuesto convertido conserva sus valores originales.');
 if(!creating&&domain==='ventas'){
  if(raw.anulada===true||raw.anulado===true||['anulada','anulado','cancelada','cancelado'].includes(String(raw.estado||'').toLowerCase()))throw fail('SV_COMMERCIAL_CANCELLED','La venta anulada no admite edición.');
  if(operational&&!economicsChanged)return next;
  const related=await paymentsForSale(read,raw),global=related.filter(valid),embedded=Array.isArray(raw.pagos)?raw.pagos.filter(valid):[],selected=global.length?global:embedded,paid=selected.length?selected.reduce((n,p)=>n+(parseFloat(p.monto)||0),0):parseFloat(raw.totalPagado||raw.pagado||raw.montoPagado)||0,total=Sales.saleTotal(raw);
  const gross=(Array.isArray(raw.items)?raw.items:[]).reduce((n,i)=>n+number(i.qty??i.cantidad??1)*number(i.punit??i.precioUnitario??0),0),free=gross>0&&Math.abs(number(raw.total))<=.01&&100*(1-number(raw.total)/gross)>=99.99;
  if(free||total>0&&paid>=total-1||total<=0&&!selected.length&&['pago_total','pagado','cancelada'].includes(String(raw.estadoPago||'').toLowerCase()))throw fail('SV_COMMERCIAL_FULLY_PAID','La venta totalmente pagada conserva sus valores.');
  if(economicsChanged&&raw.comisionesGeneradas===true)throw fail('SV_COMMERCIAL_COMMISSION_FIXED','La venta ya generó comisiones. Se conservan sus valores originales.');
  if(number(next.total)+.009<paid)throw fail('SV_COMMERCIAL_PAID_BALANCE','El nuevo total no puede ser menor que los cobros registrados.');
 }
 const d=discount(next,type);if(d.invalid)throw fail('SV_COMMERCIAL_DISCOUNT','El descuento debe estar entre 0% y 100%.');
 const prefs=await read('sisventas/config/preferencias')||{},limit=number(prefs.descuentoLimite??10),maximum=number(prefs.montoLimite??200000),exceeds=d.maximum>limit+.000001||domain==='presupuestos'&&number(next.total)>maximum;
 const approval=domain==='ventas'?'autorizarDescuento':'aprobar',canApprove=granted(cfg,domain,approval,actor.role,['admin']),within=domain==='presupuestos'&&granted(cfg,domain,'aprobarDentroLimite',actor.role,['admin','administrativo']);
 const proof=raw.autorizacionDescuento,legacyApproval=!economicsChanged&&domain==='presupuestos'&&raw.requiereAprobacion!==true&&['aprobado_int','enviado','visto','aceptado'].includes(raw.estado)&&!!raw.aprobadoPor&&!!raw.aprobadoEn,existingProof=proof?.version===1&&proof.firma===afterSignature&&!!proof.usuario&&!!proof.fecha||legacyApproval;
 const changedApproval=['aprobadoPor','aprobadoUid','aprobadoEn','aprobadoTs','autorizacionDescuento'].some(changed),approvedStates=['aprobado_int','enviado','visto','aceptado','convertido'],promotes=domain==='presupuestos'&&approvedStates.includes(next.estado)&&(raw.estado!==next.estado||economicsChanged)||changedApproval;
 if(changedApproval&&!canApprove)throw fail('SV_COMMERCIAL_APPROVAL','No tenés permiso para registrar esta aprobación.');
 if(domain==='presupuestos'&&promotes&&!(canApprove||!exceeds&&within||existingProof))throw fail('SV_COMMERCIAL_APPROVAL','El presupuesto necesita la aprobación correspondiente.');
 if(exceeds&&!existingProof){if(canApprove){if(domain==='ventas')next.autorizacionDescuento={version:1,firma:afterSignature,usuario:actor.name||actor.claims?.name||actor.uid,uid:actor.uid,fecha:new Date(now()).toISOString(),limite:limit};if(domain==='presupuestos'&&approvedStates.includes(next.estado)){next.aprobadoPor=actor.name||actor.claims?.name||actor.uid;next.aprobadoUid=actor.uid;next.aprobadoEn=new Date(now()).toISOString();next.requiereAprobacion=false;}}else if(domain==='ventas')throw fail('SV_COMMERCIAL_APPROVAL','El descuento necesita autorización antes de guardar.');else if(approvedStates.includes(next.estado)||next.requiereAprobacion===false)throw fail('SV_COMMERCIAL_APPROVAL','El presupuesto debe quedar pendiente de revisión.');}
 if(!canApprove&&raw.requiereAprobacion===true&&next.requiereAprobacion===false&&!(!exceeds&&within))throw fail('SV_COMMERCIAL_APPROVAL','No tenés permiso para quitar la revisión.');
 if(changed('anulada')||changed('anulado')||changed('estado')&&['anulado','anulada','rechazado','convertido'].includes(next.estado))throw fail('SV_COMMERCIAL_STATE','Ese cambio de estado requiere su acción específica.');
 return next;
}
module.exports={discount,signature,paymentsForSale,operationalEdit,validateEdit};