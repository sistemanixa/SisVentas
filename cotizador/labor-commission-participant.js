'use strict';
// Narrow legacy-compatible participant creation. No whole employee-account read.
const {digest}=require('./labor-guard'),Index=require('./labor-index'),Money=require('./commercial-models/commercial-money');
const {key:operationKey}=require('./commission-generation-model');
const {esComision,claveGrupo}=require('./commission-calculations');
const PURPOSE='commission-participant',MAX_MATCHES=1000;
const fail=(message,code='SV_CAS_CONFLICT',statusCode=409)=>Object.assign(Error(message),{statusCode,code});
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const key=v=>typeof v==='string'&&v.length>0&&Buffer.byteLength(v)<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const same=(a,b)=>digest(a)===digest(b);
function describe(body){
 if(body?.purpose!==PURPOSE||body.kind!=='atomic'||body.path!==''||!object(body.value)||!object(body.expectedHashes))throw fail('El participante requiere un único guardado protegido.');
 const entries=Object.entries(body.value),movements=entries.filter(([p])=>/^sisventas\/ctaemp\/[^/]+\/[^/]+$/.test(p));
 if(entries.length!==4||movements.length!==1)throw fail('El alta sólo puede registrar un participante.');
 const [movementPath,m]=movements[0],employee=movementPath.split('/')[2];if(!object(m)||!key(employee)||!key(m.ventaFbKey))throw fail('La referencia del participante requiere revisión.');
 const saleKey=m.ventaFbKey,movKey=operationKey('comision',[saleKey,employee]),expenseKey=operationKey('gasto_comision',[saleKey,employee]),salePath='sisventas/ventas/'+saleKey,expensePath='sisventas/gastos/'+expenseKey,controlPath='sisventas/comisiones_generacion/'+movKey,employeePath='sisventas/empleados/'+employee,maxPath='sisventas/config/maxComisionPct';
 const sources=[controlPath,movementPath,expensePath,salePath,employeePath,maxPath],targets=[controlPath,movementPath,expensePath,salePath+'/comisionesGeneradas'];
 if(movementPath!=='sisventas/ctaemp/'+employee+'/'+movKey||!same(Object.keys(body.expectedHashes).sort(),sources.sort())||!same(entries.map(([p])=>p).sort(),targets.sort())||Object.values(body.expectedHashes).some(h=>!/^[a-f0-9]{64}$/.test(h||''))||body.value[salePath+'/comisionesGeneradas']!==true)throw fail('El alta excede sus registros verificados.');
 const g=body.value[expensePath],c=body.value[controlPath],legacy='ctaemp/'+employee+'/'+movKey;
 const moveFields=new Set(['tipo','estado','aprobadoPor','aprobadoTs','monto','pct','pctOriginal','ajustadoAlTope','gananciaBase','ventaId','ventaFbKey','cliente','descripcion','fecha','ts','empleadoNombre','origenCarga','cargadaManualmente','usuarioCarga','fbKey','gastoFbKey','legacyKey']);
 const expenseFields=new Set(['fecha','tipo','tipoPagable','descripcion','categoria','monto','medio','estado','empleadoId','empleadoFbKey','empleadoNombre','mes','periodoTrabajo','fechaTrabajo','fechaImputacion','aprobadoTs','semestre','mejorSueldo','hsExtra','origenLegacy','legacyKey','migradoDesdeLegacy','ts','requiereAprobacion','ventaId','ventaFbKey','pct','pctOriginal','gananciaBase','cliente','origen','origenCarga','usuarioCarga']);
 if(!object(g)||!object(c)||Object.keys(m).some(k=>!moveFields.has(k))||Object.keys(g).some(k=>!expenseFields.has(k))||!same(Object.keys(c).sort(),['estado','ts','ventaId','ventaFbKey','empleadoFbKey'].sort()))throw fail('El alta contiene campos no permitidos.');
 if(m.tipo!=='comision'||m.estado!=='pendiente'||m.aprobadoPor||m.aprobadoTs||m.fbKey!==movKey||m.gastoFbKey!==expenseKey||m.legacyKey!==legacy||g.legacyKey!==legacy||g.estado!=='pendiente_aprobacion'||g.requiereAprobacion!==true||g.aprobadoTs||g.tipoPagable!=='comision'||g.origen!=='comision'||g.tipo!=='Comisión'||g.categoria!=='Personal'||g.empleadoId!==employee||g.empleadoFbKey!==employee||c.estado!=='completada'||c.empleadoFbKey!==employee||c.ventaFbKey!==saleKey||!number(c.ts))throw fail('La comisión debe quedar pendiente de aprobación y sin pagos.');
 if(['cliente','descripcion','empleadoNombre','origenCarga'].some(k=>typeof m[k]!=='string'||m[k].length>4096)||!number(m.pctOriginal)||typeof m.ajustadoAlTope!=='boolean'||!number(m.monto)||!number(m.pct)||!number(m.gananciaBase)||m.pct>100||Money.percentage(m.gananciaBase,m.pct)!==m.monto||!number(m.ts)||typeof m.fecha!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha)||typeof m.ventaId!=='string'||!m.ventaId||['monto','pct','pctOriginal','gananciaBase','ventaId','ventaFbKey','cliente','descripcion','fecha','empleadoNombre','ts'].some(k=>!same(m[k],g[k]))||c.ventaId!==m.ventaId)throw fail('El movimiento y su gasto no coinciden.');
 return{employee,saleKey,movKey,expenseKey,movementPath,expensePath,controlPath,salePath,employeePath,maxPath,sources,movement:m,expense:g};
}
async function access(read,actor){
 if(!key(actor?.uid)||actor.claims?.uid!==actor.uid||actor.claims.svPasswordChangeRequired===true)throw fail('Iniciá sesión nuevamente.','SV_LABOR_AUTH_CHANGED',403);
 const profile=await read('sv_chat_roles/'+actor.uid),cfg=await read('sv_permisos/admin'),reset=await read('sv_access_resets/'+actor.uid);
 if(profile?.activo!==true||profile.rol!=='admin'||cfg?.indiceVersion!==2||cfg.indiceModulos?.comisiones!==true||Object.values(cfg.bloqueados||{}).includes('comisiones')||cfg.acciones?.comisiones?.distribuir===false||reset?.required===true||reset?.version!=null&&reset.version!==actor.claims.svAccessVersion)throw fail('No tenés permiso para agregar participantes.','SV_LABOR_AUTH_CHANGED',403);
 return{profile,cfg,reset};
}
async function validate({scope,actor,body}){
 const d=describe(body),snapshots=new Map(),read=async p=>{if(!snapshots.has(p))snapshots.set(p,await scope.get(p));return snapshots.get(p);};
 const authority=await access(read,actor);for(const p of d.sources)await read(p);
 if([d.controlPath,d.movementPath,d.expensePath].some(p=>snapshots.get(p)!==null))throw fail('Ya existe una comisión para esa persona y venta. Se conservaron sus importes y pagos.');
 const sale=snapshots.get(d.salePath),employee=snapshots.get(d.employeePath),max=Number(snapshots.get(d.maxPath))||10;
 if(!object(sale)||sale.comisionHabilitada!==true||!object(employee)||employee.activo===false||d.movement.empleadoNombre!==(employee.nombre||'')||!['id','numero','nro'].some(k=>sale[k]&&String(sale[k])===d.movement.ventaId)||d.movement.pct>max)throw fail('La venta, el empleado o el porcentaje cambió.');
 const querySpecs=[['ventaFbKey',d.saleKey],['ventaId',d.movement.ventaId]],queried=[];
 // Old writers persisted document identifiers as strings; numeric IDs are also
 // queried when String(number) is exactly the legacy client comparison target.
 const numeric=Number(d.movement.ventaId);if(Number.isFinite(numeric)&&String(numeric)===d.movement.ventaId)querySpecs.push(['ventaId',numeric]);
 for(const [field,value]of querySpecs){const found=await scope.query('sisventas/ctaemp/'+d.employee,field,value);if(!object(found)||Object.keys(found).length>MAX_MATCHES)throw fail('La cuenta requiere revisión antes de agregar participantes.');queried.push({field,value,hash:digest(found)});if(Object.values(found).some(m=>m?.tipo==='comision'&&(String(m.ventaFbKey||'')===d.saleKey||m.ventaId!=null&&String(m.ventaId)===d.movement.ventaId)))throw fail('Ya existe una comisión histórica para esa persona y venta.');}
 for(const group of new Set([d.saleKey,d.movement.ventaId])){const path=Index.bucketPath('gastos','commissionGroup',group),members=await read(path);if(members===null)continue;if(!object(members)||Object.keys(members).length>MAX_MATCHES||Object.entries(members).some(([k,v])=>!key(k)||v!==true))throw fail('El índice de comisiones requiere revisión.');for(const id of Object.keys(members)){const expense=await read('sisventas/gastos/'+id);if(!object(expense)||!esComision(expense)||claveGrupo({...expense,fbKey:id})!==group)throw fail('El índice de comisiones requiere revisión.');if(String(expense.empleadoFbKey||expense.empleadoId||'')===d.employee||String(expense.legacyKey||'').startsWith('ctaemp/'+d.employee+'/'))throw fail('Esa persona ya participa en la comisión.');}}
 scope.beforeCommit(async({readFresh,queryFresh})=>{if(!same(await access(readFresh,actor),authority))throw fail('Los permisos cambiaron.','SV_LABOR_AUTH_CHANGED');for(const[p,value]of snapshots)if(!same(await readFresh(p),value))throw fail('La comisión cambió antes de confirmar.');for(const q of queried){const found=await queryFresh('sisventas/ctaemp/'+d.employee,q.field,q.value);if(digest(found)!==q.hash)throw fail('Apareció otro movimiento de la misma venta.');}});
 return d;
}
module.exports={PURPOSE,MAX_MATCHES,describe,validate,access};
