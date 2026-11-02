'use strict';
const Rows=require('./ot-material-rows-model');
const copy=v=>structuredClone(v),fail=m=>Object.assign(Error(m),{statusCode:409});
const normalized=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[ -]+/g,'_');
const closed=o=>['completada','completado','completo','finalizada','finalizado','cerrada','cerrado','terminada','terminado','con_observaciones'].includes(normalized(o?.estado));
const amount=v=>{const n=Number(v??0);if(!Number.isFinite(n)||n<0)throw fail('Hay cantidades inválidas en los materiales.');return n;};
const CHECK_COUNTS=Object.freeze({preparacion:5,instalacion:3,verificacion:6});
function checksComplete(checks){return Object.entries(CHECK_COUNTS).every(([phase,count])=>{const original=checks?.[phase],values=Array.isArray(original)?original:original&&typeof original==='object'?Array.from({length:count},(_,i)=>original[i]):[];return Array.from({length:count},(_,i)=>values[i]===true).every(Boolean);});}
function service(m,p={}){const txt=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();return m.esManoDeObra===true||p.esManoDeObra===true||['SERVICIO','MANO DE OBRA'].includes(txt(m.tipo||m.clase||p.tipo||p.clase))||/MANO DE OBRA|SERVICIO/.test(txt(m.categoria||p.categoria))||/INSTALACION|CONFIGURACION/.test(txt(p.categoria))||/^(?:\d+\s*-\s*)?(?:INSTALACION|CONFIGURACION|MANTENIMIENTO|VISITA TECNICA)\b/.test(txt(m.desc||m.descripcion||p.nombre||p.descripcion));}
function custody(ot,products={}){
 const rows=Rows.view(ot).filter(m=>Rows.quantity(m)>0&&!service(m,products[m.productoKey||m.cod||m.codigo]));let pending=false;
 for(const m of rows){if(m._recuperado||m.stockPendiente)throw fail('Hay materiales pendientes de confirmar o registrar.');const delivered=amount(m.entregada),classified=['instalada','devueltaPendiente','devuelta','enTecnico','danada','faltante'].reduce((n,k)=>n+amount(m[k]),0);
  if(m.custodiaActiva!==true||delivered<Rows.quantity(m)||classified>delivered+1e-6)throw fail('Revisá la entrega y la rendición de materiales.');
  if(classified<delivered-1e-6||['devueltaPendiente','enTecnico','danada','faltante'].some(k=>amount(m[k])>0))pending=true;
 }
 if(rows.length&&(!ot.custodiaIniciada||!ot.custodiaRendida))throw fail('Falta registrar la entrega o rendición de materiales.');
 return {pending,physical:rows.length};
}
const materialFields=new Set(['entregada','instalada','cantidadInstalada','devueltaPendiente','devuelta','enTecnico','danada','faltante','custodiaActiva','custodiaClasificada','estadoCustodia','recibidoEn','recibidoPor','stockRegistro','stockRevision','stockPendiente','stockBaseInstalada']);
function materialChanges(beforeOT,after,kind){
 const rows=Rows.view(beforeOT),before=Rows.persisted(rows),targets=Rows.persisted(Rows.view({materiales:after}));
 if(!Array.isArray(after)||before.length!==targets.length)throw fail('La lista de materiales cambió. Volvé a abrir la OT.');
 for(let i=0;i<before.length;i++){const a=before[i],b=targets[i];for(const k of new Set([...Object.keys(a),...Object.keys(b)]))if(!materialFields.has(k)&&JSON.stringify(a[k])!==JSON.stringify(b[k]))throw fail('La rendición no puede cambiar los productos de la OT.');
  for(const k of ['entregada','custodiaActiva'])if(!rows[i]._recuperado&&JSON.stringify(a[k])!==JSON.stringify(b[k]))throw fail('La rendición no puede cambiar la entrega.');
  if(rows[i]._recuperado&&(kind==='return'||amount(b.entregada)!==Rows.quantity(a)||b.custodiaActiva!==true))throw fail('El material histórico necesita entrega y consumo verificados.');
  if(kind!=='return'&&amount(a.devuelta)!==amount(b.devuelta))throw fail('Las devoluciones requieren recepción administrativa.');
  if(kind==='return')for(const k of materialFields)if(!['devueltaPendiente','devuelta','recibidoEn','recibidoPor','estadoCustodia'].includes(k)&&JSON.stringify(a[k])!==JSON.stringify(b[k]))throw fail('La recepción sólo puede registrar devoluciones.');
  if(kind==='return'&&(amount(b.devuelta)!==amount(a.devuelta)+amount(a.devueltaPendiente)||amount(b.devueltaPendiente)!==0))throw fail('La recepción no coincide con las unidades pendientes.');
 }
}
function validLink(ot,sale,otKey,primary,others){
 if(sale.otId===otKey)return true;
 const norm=v=>String(v||'').replace(/^#/,'').trim().toUpperCase();
 const row=others[otKey],main=others[sale.otId];
 return !!(primary&&row&&main&&primary.ventaFbKey===ot.ventaFbKey&&norm(primary.ventaId)===norm(sale.id)&&row.ventaFbKey===ot.ventaFbKey&&norm(row.ventaId)===norm(sale.id)&&main.ventaFbKey===ot.ventaFbKey&&norm(main.ventaId)===norm(sale.id)&&main._svListRevision===(primary._svListRevision||0));
}
function plan({before,changes,kind,sale,primary=null,others={},products={},actor,at,action,allowPending=false}){
 if(!before||!['close','custody','return'].includes(kind)||!changes||typeof changes!=='object'||Array.isArray(changes))throw fail('Solicitud de OT inválida.');
 const closeFields=['conformidadCliente','nombreConformidad','observacionesCierre'],custodyFields=['materiales','custodiaIniciada','custodiaRendida','custodiaRendidaEn','custodiaRendidaPor'];
 if(Object.keys(changes).some(k=>!(kind==='close'?closeFields:custodyFields).includes(k)))throw fail('El guardado contiene campos no autorizados.');
 if(kind==='close'&&closed(before))throw fail('La OT ya está cerrada.');
 const next={...copy(before),...copy(changes)};
 if(changes.materiales)materialChanges(before,changes.materiales,kind);
 if(kind==='close'){
  if(!checksComplete(next.checks))throw fail('Falta completar el checklist.');
  if(!['conforme','con_observaciones','no_conforme'].includes(normalized(next.conformidadCliente)))throw fail('Seleccioná la conformidad del cliente.');
  if(String(next.nombreConformidad||'').length>160||String(next.observacionesCierre||'').length>4000)throw fail('El texto del acta supera el espacio disponible.');
  const localDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
  next.progreso=100;next.fechaCierre=before.fechaCierre||localDate;next.fechaCompletada=before.fechaCompletada||localDate;
 }
 if(kind!=='close'&&changes.custodiaRendida===true){next.custodiaRendidaEn=Date.parse(at);next.custodiaRendidaPor=actor.name;}
 let observation=null;if(closed(before)||kind==='close'){try{observation=custody(next,products);}catch(error){if(!allowPending)throw error;observation={pending:true};}}
 if(observation){const badConformity=normalized(next.conformidadCliente)!=='conforme';next.cierreConObservaciones=observation.pending||badConformity;next.estado=next.cierreConObservaciones?'con_observaciones':'completada';}
 if(before.audit!=null&&!Array.isArray(before.audit))throw fail('El historial de la OT requiere revisión.');
 next.audit=[...(before.audit||[]),{fecha:at,usuario:actor.name,actorUid:actor.uid,accion:action||({close:'OT finalizada con estado de venta sincronizado',custody:'Rendición guardada con estado de venta sincronizado',return:'Devolución recibida con estado de venta sincronizado'}[kind]),tipo:'ot_lifecycle',kind}];
 let saleStatus=null,saleChanges={};
 if(sale){const saleKey=before.ventaFbKey,id=String(sale.id||sale.numero||'').replace(/^#/,'').trim().toUpperCase(),otId=String(before.ventaId||before.venta||'').replace(/^#/,'').trim().toUpperCase();
  if(!saleKey||!id||id!==otId||!validLink(before,sale,actor.otKey,primary,others)||sale.anulada||['anulada','anulado','cancelada','cancelado'].includes(normalized(sale.estado)))throw fail('El vínculo de la OT con la venta requiere revisión.');
  const linked=Object.entries(others).filter(([k,o])=>k!==actor.otKey&&(o.ventaFbKey===saleKey||String(o.ventaId||'').replace(/^#/,'').trim().toUpperCase()===id));
  const unresolved=linked.some(([,o])=>!closed(o)||normalized(o.estado)==='con_observaciones');
  const state=closed(next)&&!next.cierreConObservaciones&&!unresolved?'instalado':'en_instalacion';saleStatus={saleKey,estadoInst:state};
  if(sale.estadoInst!==state){if(sale.audit!=null&&!Array.isArray(sale.audit))throw fail('El historial de la venta requiere revisión.');saleChanges={estadoInst:state,audit:[...(sale.audit||[]),{fecha:at,usuario:actor.name,actorUid:actor.uid,accion:'Estado de instalación actualizado por el circuito de OT',otId:before.id,antes:sale.estadoInst,despues:state}]};}
 }
 return {ot:next,saleStatus,saleChanges};
}
module.exports={closed,custody,plan,service,CHECK_COUNTS,checksComplete};
