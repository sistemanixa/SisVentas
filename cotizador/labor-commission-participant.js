'use strict';
// Narrow legacy-compatible participant creation. No whole employee-account read.
const {digest}=require('./labor-guard'),Index=require('./labor-index'),Money=require('./commercial-models/commercial-money');
const {key:operationKey}=require('./commission-generation-model');
const {esComision,claveGrupo}=require('./commission-calculations');
const {pool}=require('./payment-snapshot');
const PURPOSE='commission-participant',MAX_MATCHES=1000;
const fail=(message,code='SV_CAS_CONFLICT',statusCode=409)=>Object.assign(Error(message),{statusCode,code});
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const key=v=>typeof v==='string'&&v.length>0&&Buffer.byteLength(v)<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const same=(a,b)=>digest(a)===digest(b);
function describe(body){
 if(body?.purpose!==PURPOSE||body.kind!=='atomic'||body.path!==''||!object(body.value)||!object(body.expectedHashes))throw fail('El participante requiere un único guardado protegido.');
 const entries=Object.entries(body.value),movements=entries.filter(([p])=>/^sisventas\/ctaemp\/[^/]+\/[^/]+$/.test(p));
 if(![4,5].includes(entries.length)||movements.length!==1)throw fail('El alta sólo puede registrar un participante.');
 const [movementPath,m]=movements[0],employee=movementPath.split('/')[2];if(!object(m)||!key(employee)||!key(m.ventaFbKey))throw fail('La referencia del participante requiere revisión.');
 const saleKey=m.ventaFbKey,movKey=operationKey('comision',[saleKey,employee]),expenseKey=operationKey('gasto_comision',[saleKey,employee]),salePath='sisventas/ventas/'+saleKey,expensePath='sisventas/gastos/'+expenseKey,controlPath='sisventas/comisiones_generacion/'+movKey,employeePath='sisventas/empleados/'+employee,maxPath='sisventas/config/maxComisionPct';
 const sources=[controlPath,movementPath,expensePath,salePath,employeePath,maxPath],targets=[controlPath,movementPath,expensePath,salePath+'/comisionesGeneradas'];
 const manual=m.cargadaManualmente===true&&m.origenCarga==='manual_empleados',approvedManual=manual&&m.estado==='aprobado',enablesCommission=Object.hasOwn(body.value,salePath+'/comisionHabilitada');
 if(enablesCommission){if(!manual||body.value[salePath+'/comisionHabilitada']!==true)throw fail('La habilitación sólo puede acompañar una comisión manual.');targets.push(salePath+'/comisionHabilitada');}
 if(movementPath!=='sisventas/ctaemp/'+employee+'/'+movKey||!same(Object.keys(body.expectedHashes).sort(),sources.sort())||!same(entries.map(([p])=>p).sort(),targets.sort())||Object.values(body.expectedHashes).some(h=>!/^[a-f0-9]{64}$/.test(h||''))||body.value[salePath+'/comisionesGeneradas']!==true)throw fail('El alta excede sus registros verificados.');
 const g=body.value[expensePath],c=body.value[controlPath],legacy='ctaemp/'+employee+'/'+movKey;
 const moveFields=new Set(['tipo','estado','aprobadoPor','aprobadoTs','aprobadoUid','monto','pct','pctOriginal','ajustadoAlTope','gananciaBase','ventaId','ventaFbKey','cliente','descripcion','fecha','ts','empleadoNombre','origenCarga','cargadaManualmente','usuarioCarga','fbKey','gastoFbKey','legacyKey']);
 const expenseFields=new Set(['fecha','tipo','tipoPagable','descripcion','categoria','monto','medio','estado','empleadoId','empleadoFbKey','empleadoNombre','mes','periodoTrabajo','fechaTrabajo','fechaImputacion','aprobadoTs','aprobadoPor','aprobadoUid','semestre','mejorSueldo','hsExtra','origenLegacy','legacyKey','migradoDesdeLegacy','ts','requiereAprobacion','ventaId','ventaFbKey','pct','pctOriginal','gananciaBase','cliente','origen','origenCarga','usuarioCarga']);
 if(!object(g)||!object(c)||Object.keys(m).some(k=>!moveFields.has(k))||Object.keys(g).some(k=>!expenseFields.has(k))||!same(Object.keys(c).sort(),['estado','ts','ventaId','ventaFbKey','empleadoFbKey'].sort()))throw fail('El alta contiene campos no permitidos.');
 const approvalValid=approvedManual?g.estado==='pendiente_pago'&&g.requiereAprobacion===false&&key(m.aprobadoUid)&&g.aprobadoUid===m.aprobadoUid&&typeof m.aprobadoPor==='string'&&!!m.aprobadoPor.trim()&&m.aprobadoPor.length<=256&&g.aprobadoPor===m.aprobadoPor&&m.aprobadoPor===m.usuarioCarga&&number(m.aprobadoTs)&&m.aprobadoTs===m.ts&&g.aprobadoTs===m.aprobadoTs:m.estado==='pendiente'&&!m.aprobadoPor&&!m.aprobadoTs&&!m.aprobadoUid&&g.estado==='pendiente_aprobacion'&&g.requiereAprobacion===true&&!g.aprobadoTs&&!g.aprobadoPor&&!g.aprobadoUid;
 if(!approvalValid||m.tipo!=='comision'||m.fbKey!==movKey||m.gastoFbKey!==expenseKey||m.legacyKey!==legacy||g.legacyKey!==legacy||g.tipoPagable!=='comision'||g.origen!=='comision'||g.tipo!=='Comisión'||g.categoria!=='Personal'||g.empleadoId!==employee||g.empleadoFbKey!==employee||c.estado!=='completada'||c.empleadoFbKey!==employee||c.ventaFbKey!==saleKey||!number(c.ts))throw fail('La comisión requiere una aprobación válida y no puede incluir pagos.');
 if(['cliente','descripcion','empleadoNombre','origenCarga'].some(k=>typeof m[k]!=='string'||m[k].length>4096)||!number(m.pctOriginal)||typeof m.ajustadoAlTope!=='boolean'||!number(m.monto)||!number(m.pct)||!number(m.gananciaBase)||m.pct>100||Money.percentage(m.gananciaBase,m.pct)!==m.monto||!number(m.ts)||typeof m.fecha!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha)||typeof m.ventaId!=='string'||!m.ventaId||['monto','pct','pctOriginal','gananciaBase','ventaId','ventaFbKey','cliente','descripcion','fecha','empleadoNombre','ts'].some(k=>!same(m[k],g[k]))||c.ventaId!==m.ventaId)throw fail('El movimiento y su gasto no coinciden.');
 return{employee,saleKey,movKey,expenseKey,movementPath,expensePath,controlPath,salePath,employeePath,maxPath,sources,movement:m,expense:g,manual,approvedManual,enablesCommission};
}
async function access(read,actor,operation={}){
 if(!key(actor?.uid)||actor.claims?.uid!==actor.uid||actor.claims.svPasswordChangeRequired===true)throw fail('Iniciá sesión nuevamente.','SV_LABOR_AUTH_CHANGED',403);
 if(operation.manual&&(actor.viewing||actor.realUid&&actor.realUid!==actor.uid))throw fail('Volvé a tu cuenta antes de registrar la comisión.','SV_LABOR_AUTH_CHANGED',403);
 const [profile,cfg,reset]=await pool(['sv_chat_roles/'+actor.uid,'sv_permisos/admin','sv_access_resets/'+actor.uid],read,3);
 const action=operation.manual?'crear':'distribuir',blocked=Object.values(cfg?.bloqueados||{});
 if(profile?.activo!==true||profile.rol!=='admin'||cfg?.indiceVersion!==2||cfg.indiceModulos?.comisiones!==true||blocked.includes('comisiones')||cfg.acciones?.comisiones?.[action]===false||reset?.required===true||reset?.version!=null&&reset.version!==actor.claims.svAccessVersion)throw fail('No tenés permiso para registrar esta comisión.','SV_LABOR_AUTH_CHANGED',403);
 if(operation.enablesCommission&&(cfg.indiceModulos?.venta!==true||blocked.includes('venta')||cfg.acciones?.ventas?.configurarComision===false))throw fail('No tenés permiso para habilitar la comisión de esta venta.','SV_LABOR_AUTH_CHANGED',403);
 if(operation.approvedManual&&(operation.movement.aprobadoUid!==actor.uid||cfg.acciones?.comisiones?.aprobar===false))throw fail('No tenés permiso para aprobar la comisión manual.','SV_LABOR_AUTH_CHANGED',403);
 return{profile,cfg,reset};
}
async function validate({scope,actor,body}){
 const d=describe(body),snapshots=new Map(),pending=new Map(),read=p=>{if(!pending.has(p))pending.set(p,Promise.resolve().then(()=>scope.get(p)).then(value=>{snapshots.set(p,value);return value;}));return pending.get(p);};
 const authority=await access(read,actor,d);await pool(d.sources,read);
 if([d.controlPath,d.movementPath,d.expensePath].some(p=>snapshots.get(p)!==null))throw fail('Ya existe una comisión para esa persona y venta. Se conservaron sus importes y pagos.');
 const sale=snapshots.get(d.salePath),employee=snapshots.get(d.employeePath),max=Number(snapshots.get(d.maxPath))||10;
 if(!object(sale)||sale.comisionHabilitada!==true&&!d.enablesCommission||!object(employee)||employee.activo===false||d.movement.empleadoNombre!==(employee.nombre||'')||!['id','numero','nro'].some(k=>sale[k]&&String(sale[k])===d.movement.ventaId)||d.movement.pct>max)throw fail('La venta, el empleado o el porcentaje cambió.');
 if(d.enablesCommission){
  if(employee.eliminado===true||['inactivo','eliminado'].includes(String(employee.estado||'').toLowerCase()))throw fail('El empleado ya no está activo.');
  if(Object.hasOwn(sale,'comisionHabilitada')&&typeof sale.comisionHabilitada!=='boolean'||sale.anulada||sale.anulado||['anulada','anulado','sin_cargo'].includes(String(sale.estado||sale.estadoPago||'').toLowerCase()))throw fail('La venta requiere revisión antes de habilitar su comisión.');
  const Model=require('./commission-generation-model'),economic=require('./commercial-models/sales-read-model').saleEconomic(sale),items=Array.isArray(sale.items)?sale.items:[];
  if(!economic.ready||!items.length)throw fail('Revisá los importes y costos originales de la venta.');
  let cost=0;for(const item of items){const unit=Model.originalCost(item),quantity=Number(item.qty??item.cantidad??1);if(unit===null||!Number.isFinite(quantity)||quantity<=0)throw fail('Faltan costos originales; no se habilitó la comisión.');cost+=unit*quantity;}
  const gain=Money.sum([economic.taxableBase,-cost]);if(!(gain>0)||Money.amount(d.movement.gananciaBase)!==gain||Money.percentage(gain,d.movement.pct)!==d.movement.monto)throw fail('La base o el importe de la comisión cambió.');
 }
 const querySpecs=[['ventaFbKey',d.saleKey],['ventaId',d.movement.ventaId]],queried=[];
 // Old writers persisted document identifiers as strings; numeric IDs are also
 // queried when String(number) is exactly the legacy client comparison target.
 const numeric=Number(d.movement.ventaId);if(Number.isFinite(numeric)&&String(numeric)===d.movement.ventaId)querySpecs.push(['ventaId',numeric]);
 await pool(querySpecs,async([field,value])=>{const found=await scope.query('sisventas/ctaemp/'+d.employee,field,value);if(!object(found)||Object.keys(found).length>MAX_MATCHES)throw fail('La cuenta requiere revisión antes de agregar participantes.');queried.push({field,value,hash:digest(found)});if(Object.values(found).some(m=>m?.tipo==='comision'&&(String(m.ventaFbKey||'')===d.saleKey||m.ventaId!=null&&String(m.ventaId)===d.movement.ventaId)))throw fail('Ya existe una comisión histórica para esa persona y venta.');},3);
 for(const group of new Set([d.saleKey,d.movement.ventaId])){const path=Index.bucketPath('gastos','commissionGroup',group),members=await read(path);if(members===null)continue;if(!object(members)||Object.keys(members).length>MAX_MATCHES||Object.entries(members).some(([k,v])=>!key(k)||v!==true))throw fail('El índice de comisiones requiere revisión.');for(const id of Object.keys(members)){const expense=await read('sisventas/gastos/'+id);if(!object(expense)||!esComision(expense)||claveGrupo({...expense,fbKey:id})!==group)throw fail('El índice de comisiones requiere revisión.');if(String(expense.empleadoFbKey||expense.empleadoId||'')===d.employee||String(expense.legacyKey||'').startsWith('ctaemp/'+d.employee+'/'))throw fail('Esa persona ya participa en la comisión.');}}
 scope.beforeCommit(async({readFresh,queryFresh})=>{if(!same(await access(readFresh,actor,d),authority))throw fail('Los permisos cambiaron.','SV_LABOR_AUTH_CHANGED');await pool([...snapshots],async([p,value])=>{if(!same(await readFresh(p),value))throw fail('La comisión cambió antes de confirmar.');});await pool(queried,async q=>{const found=await queryFresh('sisventas/ctaemp/'+d.employee,q.field,q.value);if(digest(found)!==q.hash)throw fail('Apareció otro movimiento de la misma venta.');},3);});
 return d;
}
module.exports={PURPOSE,MAX_MATCHES,describe,validate,access};
