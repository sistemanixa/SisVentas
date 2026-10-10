const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {source}=require('./helpers/active-app').readActiveApp();
test('circuitos retirados no vuelven a cargarse en la aplicación activa',()=>{
 for(const name of ['buscarPreciosProveedores','pfUsarPrecio','selectRole','renderTareasPendientes','toggleIvaDetalle','unificarClientesFiltradosLegacyInseguro','pptoAlertarVencimientosProximos','recalcularTotalesVenta','toggleAll','_pfValorVisualAARS'])assert.doesNotMatch(source,new RegExp('\\b'+name+'\\b'),name);
 const charts=fs.readFileSync('js/modules/executive-charts.js','utf8');assert.doesNotMatch(charts,/renderRent334|calcRent\(|sv334-rent-/);
 for(const file of ['dashboard-filters','sales-dashboard'])assert.doesNotMatch(fs.readFileSync('js/modules/'+file+'.js','utf8'),/dash-q-(hoy|semana|mes)-326/);
});
