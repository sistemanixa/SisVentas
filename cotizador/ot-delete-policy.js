'use strict';
const Lifecycle=require('./ot-lifecycle-model');
const fail=(code,message)=>Object.assign(Error(message),{code});
const domains=['reclamos','ventas','pagos','equipos','tickets','remitos'];
const keys=['otKey','otFbKey','ordenTrabajoKey','ordenTrabajoFbKey'];
const numbers=['otId','otNumero','ordenTrabajoId','ot'];
const populated=value=>value!=null&&value!==''&&value!==false&&(!(typeof value==='object')||Object.keys(value).length>0);
const recorded=value=>typeof value==='string'?value.trim()!=='':value!==0&&populated(value);
function plan(key,original,sources){
 if(typeof key!=='string'||!key||/[.#$\[\]\/]/.test(key))throw fail('SV_OT_DELETE_KEY','La referencia de la OT no es válida.');
 if(!original)throw fail('SV_OT_DELETE_MISSING','La OT no existe en la fuente autoritativa.');
 if(original._svListSummary||original._svPagedSummary)throw fail('SV_OT_DELETE_SOURCE','Hace falta el original completo de la OT.');
 for(const domain of domains)if(!Object.hasOwn(sources||{},domain)||!sources[domain]||typeof sources[domain]!=='object'||Array.isArray(sources[domain]))throw fail('SV_OT_DELETE_COVERAGE','No se verificaron todas las fuentes vinculadas.');
 const reference=value=>typeof value==='string'?value.trim():typeof value==='number'&&Number.isFinite(value)?String(value):'';
 const identities=new Set([key,original.id,original.numero,original.otId].map(reference).filter(Boolean));
 const matches=record=>record&&typeof record==='object'&&(keys.some(field=>reference(record[field])===key)||numbers.some(field=>identities.has(reference(record[field]))));
 function linked(value){if(!value||typeof value!=='object')return false;if(matches(value))return true;return Object.values(value).some(child=>child&&typeof child==='object'&&linked(child));}
 for(const domain of domains)if(linked(sources[domain]))throw fail('SV_OT_DELETE_LINKED','La OT tiene registros vinculados. Conservá su historial.');
 if(keys.concat(numbers).concat(['reclamoKey','reclamoFbKey','reclamoId','ventaFbKey','ventaKey','ventaId','presupuestoFbKey']).some(field=>populated(original[field])))throw fail('SV_OT_DELETE_ORIGIN','La OT conserva un vínculo de origen.');
 assertNoActivity(original);
 return Object.freeze({key,remove:true});
}
// Shared by standalone OT deletion and the existing sale cascade. Origin and
// relation checks remain specific to each operation; recorded work never does.
function assertNoActivity(original){
 if(!original||typeof original!=='object'||Array.isArray(original)||original._svListSummary||original._svPagedSummary)throw fail('SV_OT_DELETE_SOURCE','Hace falta la OT original completa.');
 const activity=['remitosEntrega','notasTecnico','intervenciones','firma','firmaTecnico','fechaCierre','cerradaEn','finalizadaEn','fotos','fotosTecnico','fotosVisita','evidenciasFotos','evidencias','imagenes','adjuntos','archivos','movimientosStock'];
 const custody=['custodiaIniciada','custodiaRendida','custodiaEntregadaEn','custodiaRendidaEn','custodiaRendidaPor','custodiaTecnico','fechaCompletada','firmaClienteUrl','firmada','fechaFirma'];
 const documentary=['conformidadCliente','conformidad','nombreConformidad','observacionesCierre','actaObservaciones','obsTecnico','firmaUrl','firmaURL','firmaBase64','firmaCliente','firmaNombreCliente','nombreClienteFirma'];
 if(original.cerrada===true||original.finalizada===true||original.cierreConObservaciones===true||Lifecycle.closed(original)||/cerrad|finaliz|complet/i.test(String(original.estado||''))||activity.some(field=>populated(original[field]))||custody.concat(documentary).some(field=>recorded(original[field])))throw fail('SV_OT_DELETE_ACTIVITY','La OT tiene actividad registrada. Conservá su historial.');
 if(original.progreso!=null&&(!Number.isFinite(Number(original.progreso))||Number(original.progreso)!==0))throw fail('SV_OT_DELETE_ACTIVITY','La OT tiene progreso registrado. Conservá su historial.');
 if(original.checks!=null){
  if(typeof original.checks!=='object')throw fail('SV_OT_DELETE_SOURCE','El checklist requiere revisión.');
  for(const phase of Object.values(original.checks))if(phase&&typeof phase==='object'?Object.values(phase).some(recorded):recorded(phase))throw fail('SV_OT_DELETE_ACTIVITY','La OT tiene controles registrados. Conservá su historial.');
 }
 // Inspect both persisted sources. Rows.view can merge or deduplicate historical
 // items; deletion must not discard activity hidden by that presentation merge.
 for(const source of ['materiales','items']){
 const materials=original[source]??[];
 if(typeof materials!=='object')throw fail('SV_OT_DELETE_SOURCE','Los materiales requieren revisión.');
 for(const material of Object.values(materials)){
  if(!material||typeof material!=='object')throw fail('SV_OT_DELETE_SOURCE','Los materiales requieren revisión.');
  for(const field of ['entregada','instalada'])if(material[field]!=null&&(!Number.isFinite(Number(material[field]))||Number(material[field])!==0))throw fail('SV_OT_DELETE_ACTIVITY','La OT tiene entregas o instalaciones registradas.');
  for(const field of ['cantidadInstalada','devuelta','devueltaPendiente','enTecnico','danada','faltante','stockRevision','stockBaseInstalada'])if(material[field]!=null&&(!Number.isFinite(Number(material[field]))||Number(material[field])!==0))throw fail('SV_OT_DELETE_ACTIVITY','La OT conserva cantidades o registros de stock con actividad.');
  if(recorded(material.stockRegistro))throw fail('SV_OT_DELETE_ACTIVITY','La OT conserva un registro de stock.');
  if(['entregadoEn','entregadoPor','entregadoA','recibidoEn','recibidoPor','estadoCustodia'].some(field=>recorded(material[field]))||material.custodiaActiva||material.custodiaClasificada||material.stockPendiente||material.adicionalOT)throw fail('SV_OT_DELETE_ACTIVITY','La OT conserva materiales con actividad.');
 }
 }
}
async function execute(store,actor,key){
 if(typeof store?.atomic!=='function')throw fail('SV_OT_DELETE_AUTHORITY','No está disponible la eliminación protegida.');
 return store.atomic(async transaction=>{
  await transaction.authorize(actor,'ot.eliminar');
  const original=await transaction.readOriginal('ordenes_trabajo',key),sources={};
  for(const domain of domains)sources[domain]=await transaction.readComplete(domain);
  const result=plan(key,original,sources);
  await transaction.authorize(actor,'ot.eliminar');
  await transaction.removeWithProjections('ordenes_trabajo',key,original);
  return result;
 });
}
module.exports={plan,execute,domains,assertNoActivity};
