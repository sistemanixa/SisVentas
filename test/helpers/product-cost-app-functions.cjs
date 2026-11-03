'use strict';
const vm=require('node:vm');
const {load}=require('./app-functions.cjs');
const {source}=require('./active-app.js').readActiveApp();
// These provider-flow fixtures exercise the real canonical catalogue helper,
// including its historical-audit checks, rather than replacing cost resolution.
function loadProductCostContext(context,names){
 const c=load(context,[...names,'precioGremioARSDesdeProducto','obtenerDolarReferenciaProducto','detectarProductoArsDuplicadoPorDolar','detectarPrecioLegacyMonedaProducto','_primerNumeroPositivoProducto','_costoRaizProductoSinAuditar','_proveedorPrincipalProductoSinReconciliar','_costoProveedorProductoSinAuditar','_tiposCambioAuditoriaProducto','_relacionCercanaProducto','_migracionConfirmadaActualizador20260721','_migracionGeneralActualizador20260721','_precioVentaRazonableRespectoCosto']);
 const confirmed=source.match(/var _PRECIOS_CONTAMINADOS_CONFIRMADOS_20260721\s*=\s*\{[\s\S]*?\};/);
 if(!confirmed)throw Error('Falta la tabla de auditoría de costos de la aplicación activa');
 vm.runInContext(confirmed[0],c);
 return c;
}
module.exports={loadProductCostContext};
