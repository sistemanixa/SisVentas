const {test}=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm');
const source=require('./helpers/active-app').readActiveApp().source;
function fn(name){const a=source.indexOf('function '+name+'(');return source.slice(a,source.indexOf('\nfunction ',a+10));}
function setup(){
 const data=Array.from({length:123},(_,i)=>({fbKey:String(i),descripcion:'Gasto '+i,monto:100,fecha:'2026-10-10',categoria:'Otro'}));
 const elements={'gastos-tbody':{dataset:{},innerHTML:'',scrollIntoView(){}},'gastos-paginacion':{innerHTML:''},'gas-buscar':{value:''}};
 const c={window:{},document:{getElementById:id=>elements[id]},gastosData:data,_gastosDataReady:true,_gastosPagoMultipleActivo:false,_gastosSeleccionadosPago:{},gastosFiltradosActuales:()=>data.filter(g=>g.descripcion.includes(elements['gas-buscar'].value)),gastoVisibleEnModuloGastos:()=>true,actualizarResumenPagoMultiple(){},normalizarEstadoGasto:()=> 'pendiente_pago',normalizarTipoGasto:()=> 'Variable',fechaImputacionGasto:g=>g.fecha,_gastoDesgloseHaberHTML:()=>'',restoGasto:()=>100,totalPagadoGasto:()=>0,gastoSeleccionableParaPago:()=>true,_gastoPagosArray:()=>[],escapeHTML:String,_claveGastoKpi:g=>g.fbKey};
 vm.createContext(c);['renderTablaGastos','cambiarPaginaGastos','seleccionarTodosGastosVisibles'].forEach(n=>vm.runInContext(fn(n),c));
 return {c,e:elements,data,count:()=>(elements['gastos-tbody'].innerHTML.match(/class="gas-row"/g)||[]).length};
}
test('páginas 50/50/23 mantienen total filtrado y búsqueda sobre todos los gastos',()=>{
 const r=setup();r.c.renderTablaGastos();assert.equal(r.count(),50);assert.equal(r.e['gastos-tbody'].dataset.cantidadFiltrada,'123');r.c.cambiarPaginaGastos(1);assert.equal(r.count(),50);r.c.cambiarPaginaGastos(2);assert.equal(r.count(),23);
 r.e['gas-buscar'].value='Gasto 12';r.c.renderTablaGastos();assert.equal(r.count(),4);assert.equal(r.c.window._gastosPagina,0);
 r.e['gas-buscar'].value='nada';r.c.renderTablaGastos();assert.equal(r.count(),0);assert.equal(r.e['gastos-paginacion'].innerHTML,'');
});
test('seleccionar visibles no incluye gastos de otras páginas y conserva selección anterior',()=>{
 const r=setup();r.c.renderTablaGastos();r.c.seleccionarTodosGastosVisibles();assert.equal(Object.keys(r.c._gastosSeleccionadosPago).length,50);assert.equal(r.c._gastosSeleccionadosPago['50'],undefined);r.c.cambiarPaginaGastos(2);r.c.seleccionarTodosGastosVisibles();assert.equal(Object.keys(r.c._gastosSeleccionadosPago).length,73);
});
test('KPI conserva lista completa y una reducción de datos ajusta página',()=>{
 const r=setup();r.c.window._filtroGastosKpiActivo='pendiente';r.c.window._gastosKpiDetalleKeys={pendiente:new Set(r.data.map(g=>g.fbKey))};r.c.renderTablaGastos();r.c.cambiarPaginaGastos(2);assert.equal(r.count(),23);r.data.splice(1);r.c.renderTablaGastos();assert.equal(r.count(),1);assert.equal(r.c.window._gastosPagina,0);
});
test('Excel exporta los 123 registros filtrados con columnas correctas aunque solo se dibujen 50',()=>{
 const r=setup();let exported;
 r.c.cargarSheetJS=cb=>cb();r.c.notify=()=>{};r.c.window.XLSX={utils:{book_new:()=>({}),aoa_to_sheet:rows=>{exported=rows;return {}},book_append_sheet(){}},writeFile(){}};
 vm.runInContext(fn('exportarExcel'),r.c);r.c.renderTablaGastos();r.c.exportarExcel('Gastos del período');assert.equal(exported.length,124);assert.deepEqual(Array.from(exported[1]),['10/10/2026','Gasto 0','Otro','Variable',100,'pendiente_pago']);assert.equal(r.count(),50);
});
