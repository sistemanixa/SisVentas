'use strict';
// Called by the commercial cost validator; authority is read only from Policy.
const Policy=require('./purchase-inventory-policy'),{digest}=require('./labor-guard');
const fail=()=>Object.assign(Error('La compra no puede alterar precios vendidos, cobros, comisiones ni historia.'),{statusCode:403,code:'SV_PURCHASE_SOURCE_COST_FIELDS'});
const same=(a,b)=>digest(a)===digest(b);
const profiles=Object.freeze({
 receive:{operations:['purchase-inventory-receive'],headers:['items','costoTotal','margenPct','recepcionesAplicadas','compraEstado','conciliacionCompraActualizadaEn','conciliacionCompraActualizadaPor'],items:['costoUnitarioAntesPreparacion','costoUnitarioPresupuestado','costoTotalPresupuestado','cantidadCompraReal','costoRealCompraAcumulado','costoTotalCompra','costoUnitarioCompra','ultimoCostoCompraReal','proveedorCompraReal','proveedorCompraRealKey']},
 prepare:{operations:['purchase-preparation-save','purchase-preparation-cancel','purchase-inventory-edit'],headers:['items','costoTotal','margenPct','aplicacionExteriorId','audit'],items:['costoUnitarioAntesPreparacion','costoUnitarioPresupuestado','costoTotalPresupuestado','preparacionCompra','costoTotalCompra','costoUnitarioCompra','costoUnitarioUSD','proveedorCompra','proveedorCompraKey','origenCompra','compraExteriorAplicada','precioAcordadoCompra','monedaCompra','cotizacionCompra']},
 reconcile:{operations:['purchase-order-reconcile'],headers:['items','costoTotal','margenPct','conciliacionCompraActualizadaEn','conciliacionCompraActualizadaPor'],items:['costoRealCompraAcumulado','costoTotalCompra','costoUnitarioCompra','ultimoCostoCompraReal','proveedorCompraReal','proveedorCompraRealKey']}
});
async function validate({actor,lease,patch,raw,get}){
 const source=lease&&Policy.getSourceAuthority(actor,lease,patch),profile=source&&profiles[source.purpose];
 if(!profile||!profile.operations.includes(actor.operation)||!source.saleWritten)return false;
 const paths=[...new Set(Object.keys(patch).filter(p=>/^sisventas\/ventas\//.test(p)).map(p=>p.split('/').slice(0,3).join('/')))],keys=source.saleKeys;
 if(!Array.isArray(keys)||!keys.length||new Set(keys).size!==keys.length||paths.length!==keys.length||!keys.every(key=>paths.includes('sisventas/ventas/'+key)))throw fail();
 for(const path of paths){const before=await raw(path),after=await get(path);if(!before||!after||!same(Object.keys(before.items||{}),Object.keys(after.items||{})))throw fail();
  for(const field of new Set([...Object.keys(before),...Object.keys(after)]))if(!profile.headers.includes(field)&&!same(before[field],after[field]))throw fail();
  for(const [index,item]of Object.entries(after.items||{})){const prior=before.items[index];if(!prior||!item)throw fail();for(const field of new Set([...Object.keys(prior),...Object.keys(item)]))if(!profile.items.includes(field)&&!same(prior[field],item[field]))throw fail();
   if(prior.costoUnitarioAntesPreparacion!=null&&!same(prior.costoUnitarioAntesPreparacion,item.costoUnitarioAntesPreparacion))throw fail();
  }
  if(!same(before.audit,after.audit)){const prior=before.audit||{},next=after.audit||{};if(typeof prior!=='object'||typeof next!=='object'||!prior||!next||Object.keys(prior).some(key=>!same(prior[key],next[key])))throw fail();}
 }
 return true;
}
module.exports={validate};
