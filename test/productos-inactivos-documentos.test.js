const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readActiveApp}=require('./helpers/active-app');

const source=readActiveApp().source;
function block(start,end){
 const from=source.indexOf(start),to=source.indexOf(end,from);
 assert.ok(from>=0&&to>from,`Falta ${start}`);
 return source.slice(from,to);
}

test('la validación rechaza maestros inactivos y admite renglones históricos sin maestro',()=>{
 const productos=[
  {fbKey:'activo',codigo:'P-1',nombre:'Activo',activo:true},
  {fbKey:'bobina',codigo:'P-50715',nombre:'Bobina',estado:'inactivo'}
 ];
 const avisos=[];
 const context=vm.createContext({
  obtenerProductoPorCodigoVenta:(codigo,item)=>productos.find(p=>p.fbKey===item.productoFbKey||p.codigo===codigo)||null,
  productoEstaActivo:p=>!!p&&p.activo!==false&&p.activo!==0&&String(p.activo).toLowerCase()!=='false'&&String(p.estado||'').trim().toLowerCase()!=='inactivo'&&!p.eliminado,
  notify:mensaje=>avisos.push(mensaje),String,Object
 });
 vm.runInContext(
  block('function productosInactivosDocumento(','function validarProductosActivosDocumento(')+
  block('function validarProductosActivosDocumento(','function referenciasProductoDesdeFilas('),context
 );
 assert.equal(context.validarProductosActivosDocumento([{productoFbKey:'activo'}],'guardar'),true);
 assert.equal(context.validarProductosActivosDocumento([{productoFbKey:'manual',cod:'LIBRE'}],'guardar'),true);
 assert.equal(context.validarProductosActivosDocumento([{productoFbKey:'bobina'}],'guardar'),false);
 assert.match(avisos.at(-1),/P-50715/);
 assert.match(avisos.at(-1),/inactivo/);
});

test('los dos buscadores excluyen inactivos y la selección vuelve a validar',()=>{
 const drop=block('function _renderDropGlobal(','function _selProdGlobal(');
 const select=block('function _selProdGlobal(','var _ventaMonedaActual');
 const avanzada=block('function abrirBusquedaAvanzada(','function cerrarBusquedaAvanzada(')+block('function renderBusqAvanz(','function seleccionarProdAvanz(');
 assert.match(drop,/Object\.values\(prodData\)\.filter\(productoEstaActivo\)/);
 assert.match(avanzada,/filter\(productoEstaActivo\)/);
 assert.match(avanzada,/if \(!productoEstaActivo\(p\)\) return false/);
 assert.match(select,/if \(prod && !productoEstaActivo\(prod\)\)/);
 assert.match(select,/productoSeleccionNueva = '1'/);
});

test('guardar una operación nueva y convertir un presupuesto vuelven a controlar el estado',()=>{
 const venta=block('async function confirmarVenta(','function cerrarConfirmacionVenta(');
 const presupuesto=block('async function guardarPresupuesto(','function abrirNuevoPresupuesto(');
 const transicion=block("if (accion === 'convertir_venta')", "if (accion === 'ver_venta')");
 assert.match(venta,/validarProductosActivosDocumento\(referenciasProductoDesdeFilas\(filasNuevasVenta\), 'guardar la venta'\)/);
 assert.match(presupuesto,/validarProductosActivosDocumento\(referenciasProductoDesdeFilas\(filasPptoDocumento\), 'guardar el presupuesto'\)/);
 assert.match(transicion,/validarProductosActivosDocumento\(p\.items \|\| p\.detalle \|\| p\.productos \|\| \[\], 'convertir el presupuesto en venta'\)/);
 assert.match(venta,/window\._ventaEditandoFbKey \? filas\.filter/);
 assert.match(presupuesto,/window\._pptoEditandoFbKey && tr\.dataset\.productoSeleccionNueva !== '1'/);
});

test('los documentos históricos conservan la creación de filas aunque el maestro esté inactivo',()=>{
 const fila=block('function crearFilaProducto(','function navegarAProductoDesdeFila(');
 assert.doesNotMatch(fila,/productoEstaActivo/);
 assert.match(fila,/obtenerProductoPorCodigoVenta/);
});
