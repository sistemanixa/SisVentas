'use strict';
const fail=(code,message)=>Object.assign(Error(message),{code});
const domains=['reclamos','ventas','pagos','equipos','tickets','remitos'];
const keys=['otKey','otFbKey','ordenTrabajoKey','ordenTrabajoFbKey'];
const numbers=['otId','otNumero','ordenTrabajoId'];
const populated=value=>value!=null&&value!==''&&value!==false&&(!(typeof value==='object')||Object.keys(value).length>0);
function plan(key,original,sources){
 if(typeof key!=='string'||!key||/[.#$\[\]\/]/.test(key))throw fail('SV_OT_DELETE_KEY','La referencia de la OT no es válida.');
 if(!original)throw fail('SV_OT_DELETE_MISSING','La OT no existe en la fuente autoritativa.');
 if(original._svListSummary||original._svPagedSummary)throw fail('SV_OT_DELETE_SOURCE','Hace falta el original completo de la OT.');
 for(const domain of domains)if(!Object.hasOwn(sources||{},domain)||!sources[domain]||typeof sources[domain]!=='object'||Array.isArray(sources[domain]))throw fail('SV_OT_DELETE_COVERAGE','No se verificaron todas las fuentes vinculadas.');
 const matches=record=>record&&typeof record==='object'&&(keys.some(field=>String(record[field]||'')===key)||numbers.some(field=>original.id&&String(record[field]||'')===String(original.id)));
 function linked(value){if(!value||typeof value!=='object')return false;if(matches(value))return true;return Object.values(value).some(child=>child&&typeof child==='object'&&linked(child));}
 for(const domain of domains)if(linked(sources[domain]))throw fail('SV_OT_DELETE_LINKED','La OT tiene registros vinculados. Conservá su historial.');
 if(keys.concat(numbers).concat(['reclamoKey','reclamoFbKey','reclamoId','ventaFbKey','ventaKey','ventaId','presupuestoFbKey']).some(field=>populated(original[field])))throw fail('SV_OT_DELETE_ORIGIN','La OT conserva un vínculo de origen.');
 const activity=['remitosEntrega','notasTecnico','intervenciones','firma','firmaTecnico','fechaCierre','cerradaEn','finalizadaEn','fotosTecnico','evidencias','movimientosStock'];
 if(original.cerrada===true||original.finalizada===true||/cerrad|finaliz|complet/i.test(String(original.estado||''))||activity.some(field=>populated(original[field])))throw fail('SV_OT_DELETE_ACTIVITY','La OT tiene actividad registrada. Conservá su historial.');
 const materials=original.materiales||[];
 if(typeof materials!=='object')throw fail('SV_OT_DELETE_SOURCE','Los materiales requieren revisión.');
 for(const material of Object.values(materials)){
  if(!material||typeof material!=='object')throw fail('SV_OT_DELETE_SOURCE','Los materiales requieren revisión.');
  for(const field of ['entregada','instalada'])if(material[field]!=null&&(!Number.isFinite(Number(material[field]))||Number(material[field])!==0))throw fail('SV_OT_DELETE_ACTIVITY','La OT tiene entregas o instalaciones registradas.');
  if(material.custodiaActiva||material.stockPendiente||material.adicionalOT)throw fail('SV_OT_DELETE_ACTIVITY','La OT conserva materiales con actividad.');
 }
 return Object.freeze({key,remove:true});
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
module.exports={plan,execute,domains};
