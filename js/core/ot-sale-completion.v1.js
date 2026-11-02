(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVOTSaleCompletion=api;})(typeof window==='object'?window:null,function(){
'use strict';
const INDEX='sisventas/listados_resumen/ordenes_trabajo';
const clone=v=>JSON.parse(JSON.stringify(v));
const key=v=>typeof v==='string'&&v.length>0&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const status=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[ -]+/g,'_');
const closed=o=>['completada','completado','completo','finalizada','finalizado','cerrada','cerrado','terminada','terminado','con_observaciones'].includes(status(o?.estado));
const finished=o=>closed(o)&&status(o.estado)!=='con_observaciones';
const business=v=>String(v||'').trim().replace(/^#/,'').toUpperCase();
function audit(value,event){if(value!=null&&!Array.isArray(value))throw Error('El historial requiere revisión antes de corregir.');return [...(value||[]),event];}
function plan({ot,sale,others,custody,summary,actor,at}={}){
 if(actor?.role!=='admin'||actor.impersonating||!actor.uid)throw Error('Sólo el administrador en su cuenta puede corregir este estado.');
 if(!key(ot?.fbKey)||!key(sale?.fbKey)||!closed(ot)||ot._svListSummary||sale._svPagedSummary)throw Error('Abrí los registros completos de la OT cerrada y su venta.');
 if(!others||typeof others!=='object'||Array.isArray(others))throw Error('Falta comprobar las otras OT vinculadas.');
 if(ot.ventaFbKey!==sale.fbKey||sale.otId!==ot.fbKey||!business(ot.ventaId)||business(ot.ventaId)!==business(sale.id||sale.numero))throw Error('El vínculo entre la OT y la venta requiere revisión.');
 if(sale.anulada||['anulada','anulado','cancelada','cancelado','borrador','revision'].includes(status(sale.estado)))throw Error('La venta no admite esta corrección.');
 if(status(ot.conformidadCliente)!=='conforme'||ot.firmada!==true||typeof ot.firmaClienteUrl!=='string'||!ot.firmaClienteUrl.trim())throw Error('La OT necesita conformidad y firma ya guardadas.');
 if(Number(ot.progreso)!==100||!ot.fechaCierre)throw Error('Falta verificar el cierre original de la OT.');
 if(!custody?.ok||custody.conObservaciones||!summary||summary.sinClasificar||summary.conObservaciones||['devolucionPendiente','enTecnico','danados','faltantes'].some(k=>Number(summary[k])>0))throw Error('Todavía hay materiales pendientes de resolver.');
 if(summary.controlados<1||!Number.isFinite(summary.entregados)||!Number.isFinite(summary.instalados)||!Number.isFinite(summary.devueltos)||Math.abs(summary.entregados-summary.instalados-summary.devueltos)>0.000001)throw Error('La rendición de cantidades requiere revisión.');
 if(Object.values(ot.materiales||{}).some(m=>m.stockPendiente===true||m._recuperado===true))throw Error('Hay un material pendiente de confirmar o registrar.');
 for(const [id,o]of Object.entries(others)){
  if(id===ot.fbKey||id.startsWith('_sv')||!o||typeof o!=='object')continue;
  const linked=o.ventaFbKey===sale.fbKey||(business(o.ventaId)&&business(o.ventaId)===business(sale.id||sale.numero));
  if(linked&&!finished(o)&&!['anulada','anulado','cancelada','cancelado'].includes(status(o.estado)))throw Error('Otra OT de esta venta todavía requiere revisión.');
 }
 const otChanged=status(ot.estado)!=='completada'||ot.cierreConObservaciones===true,saleChanged=sale.estadoInst!=='instalado';
 if(!otChanged&&!saleChanged)return {changed:false,ot:clone(ot),sale:clone(sale),otChanges:{},saleChanges:{}};
 if(!at||!Number.isFinite(Date.parse(at)))throw Error('Falta la fecha de auditoría.');
 const event={fecha:at,usuario:actor.name||'Administrador',actorUid:actor.uid,accion:'Estado de instalación conciliado tras comprobar rendición resuelta',otId:ot.id,ventaId:sale.id||sale.numero,antes:{ot:ot.estado,cierreConObservaciones:ot.cierreConObservaciones===true,venta:sale.estadoInst},despues:{ot:'completada',venta:'instalado'}};
 const otChanges=otChanged?{estado:'completada',cierreConObservaciones:false,audit:audit(ot.audit,event)}:{};
 const saleChanges=saleChanged?{estadoInst:'instalado',audit:audit(sale.audit,event)}:{};
 return {changed:true,ot:{...clone(ot),...otChanges},sale:{...clone(sale),...saleChanges},otChanges,saleChanges};
}
async function save(root,{ot,sale}={}){
 if(!root.SVLaborWrites?.atomic||!root.SVGuardedWrites?.equal||!root.otCustodiaValidarCierre||!root.otCustodiaResumen||!root.SVRecordListModel?.parseIndex)throw Error('No está listo el guardado protegido de esta corrección.');
 const uid=root.currentUserUid,user=root.fbAuth?.currentUser,role=root.currentRole;
 const actor=()=>({uid:root.currentUserUid,role:root.currentRole,name:root.currentUser,impersonating:!!root._impersonacionOriginal});
 const check=()=>{if(!uid||user?.uid!==uid||uid!==root.currentUserUid||role!==root.currentRole||user!==root.fbAuth?.currentUser)throw Error('La sesión cambió.');};check();
 if(!key(ot?.fbKey)||!key(sale?.fbKey))throw Error('Falta identificar los registros.');
 const otPath='sisventas/ordenes_trabajo/'+ot.fbKey,salePath='sisventas/ventas/'+sale.fbKey;
 const clean=r=>{const out=clone(r);delete out.fbKey;return out;};
 const baselineOT=clean(ot),baselineSale=clean(sale);let prepared;
 const result=await root.SVLaborWrites.atomic({paths:[otPath,salePath,INDEX],build:values=>{
  check();const currentOT=values[otPath],currentSale=values[salePath];
  if(currentOT?.fbKey&&currentOT.fbKey!==ot.fbKey||currentSale?.fbKey&&currentSale.fbKey!==sale.fbKey)throw Error('La identidad del registro requiere revisión.');
  if(!root.SVGuardedWrites.equal(clean(currentOT),baselineOT)||!root.SVGuardedWrites.equal(clean(currentSale),baselineSale))throw Error('La OT o la venta cambió. Volvé a abrirlas antes de corregir.');
  const fullOT={...currentOT,fbKey:ot.fbKey},fullSale={...currentSale,fbKey:sale.fbKey};
  const others=root.SVRecordListModel.parseIndex('ordenes_trabajo',values[INDEX]);
  if(!others[ot.fbKey]||others[ot.fbKey]._svListRevision!==(currentOT._svListRevision||0))throw Error('El resumen de OT está desactualizado. Volvé a abrirlo.');
  prepared=plan({ot:fullOT,sale:fullSale,others,custody:root.otCustodiaValidarCierre(fullOT),summary:root.otCustodiaResumen(fullOT),actor:actor(),at:new Date().toISOString()});
  if(!prepared.changed)return undefined;
  const patch={};for(const [k,v]of Object.entries(prepared.otChanges))patch[otPath+'/'+k]=v;for(const [k,v]of Object.entries(prepared.saleChanges))patch[salePath+'/'+k]=v;return patch;
 }});check();if(!prepared||prepared.changed&&!result?.committed)throw Error('No se confirmó la corrección.');
 return {...prepared,committed:!!result?.committed};
}
return Object.freeze({INDEX,plan,save});
});
