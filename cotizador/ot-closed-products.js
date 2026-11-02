'use strict';
const Rows=require('./ot-material-rows-model'),{closed}=require('./ot-lifecycle-model');
const fields=['qty','vendida','cantidad','cant','productoKey','productoFbKey','productKey','punit','precio','precioUnitario','sub','subtotal','disc','descuento','costoUnitarioCompra','costoUnitario','costo','destinoVenta','ventaDestinoFbKey','ventaDestinoId','origen','adicionalOT'];
function signature(ot,canonical){return Rows.view(ot).map(row=>{const out={code:String(row.cod||row.codigo||row.sku||'').trim().toUpperCase(),description:String(row.desc||row.descripcion||row.nombre||''),quantity:Rows.quantity(row)};for(const k of fields)if(row[k]!=null)out[k]=row[k];return canonical(out);}).sort();}
async function validate({actor,lease,patch,raw,get,canonical,beforeCommit}){
 // Only the server-issued capability may delegate its stricter material validation.
 if(require('./ot-lifecycle-policy').token(actor,lease).svOTLifecycleVersion===1)return;
 const roots=['sisventas/ordenes_trabajo','sisventas/ordenesTrabajo'],records=new Set();
 for(const path of Object.keys(patch))for(const root of roots){if(path===root||root.startsWith(path+'/'))throw Object.assign(Error('Los cambios de OT requieren una clave individual.'),{statusCode:400,code:'SV_OT_RECORD_REQUIRED'});else if(path.startsWith(root+'/'))records.add(root+'/'+path.slice(root.length+1).split('/')[0]);}
 for(const path of records){const before=await raw(path);if(!closed(before))continue;const after=await get(path);if(canonical(signature(before,canonical))!==canonical(signature(after,canonical)))throw Object.assign(Error('La OT está cerrada. Creá una nueva OT para agregar o cambiar productos.'),{statusCode:409,code:'SV_OT_CLOSED_PRODUCTS'});beforeCommit(async({readFresh})=>{if(canonical(await readFresh(path))!==canonical(before))throw Object.assign(Error('La OT cambió. Volvé a abrirla.'),{statusCode:409,code:'SV_CAS_CONFLICT'});});}
}
module.exports={validate,signature};
