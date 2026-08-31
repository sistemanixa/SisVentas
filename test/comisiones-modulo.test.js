const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v3.1.4.js', 'utf8');
const moduleSource = fs.readFileSync('js/modules/commissions.js', 'utf8');

assert(html.includes("showPage('comisiones',this)"), 'Comisiones debe figurar debajo de Gastos en el menú.');
assert(html.includes('id="page-comisiones"'), 'Debe existir una página propia de Comisiones.');
assert(html.includes('id="comisiones-tbl"'), 'Comisiones debe utilizar una grilla administrable.');
assert(html.includes('id="modal-comision-gestion"'), 'Debe existir el detalle de distribución.');
assert(app.includes("comisiones:'Comisiones'"), 'La navegación debe tener título propio.');
assert(app.includes("comisiones: [fbCargarGastos, fbCargarEmpleados, fbCargarVentas]"), 'El módulo debe reutilizar gastos, empleados y ventas existentes.');
assert(app.includes("abrirComisionDesdeGasto(\\'"), 'Gastos debe navegar a la comisión exacta.');
assert(!app.includes("var btnRechazar = estadoNorm === 'pendiente_aprobacion' && esComision"), 'Gastos no debe decidir el rechazo de comisiones.');
assert(moduleSource.includes("suma > maxPct + 0.001"), 'La distribución no debe superar el tope global.');
assert(moduleSource.includes("estado:'pendiente_aprobacion',requiereAprobacion:true"), 'Una rechazada debe poder rehabilitarse como pendiente.');
assert(moduleSource.includes("updates['sisventas/gastos/"), 'La edición debe actualizar el gasto enlazado.');
assert(moduleSource.includes("updates[raiz+'/monto']"), 'La edición debe actualizar también el movimiento del empleado.');
assert(moduleSource.includes("var pagada = est === 'pagado' || est === 'pagado_parcial'"), 'Una comisión abonada no debe permitir editar el porcentaje.');
assert(moduleSource.includes("updates['sisventas/gastos/'+item.fbKey+'/estado']='pendiente_aprobacion'"), 'Cambiar un porcentaje aprobado debe requerir una nueva aprobación.');
assert(moduleSource.includes('window._generarComisionVentaAtomica'), 'Agregar participantes debe reutilizar la generación segura existente.');
assert(moduleSource.includes('actualizarResumenMargenComision'), 'El margen debe recalcularse mientras cambia la distribución.');
assert(moduleSource.includes('MARGEN DESPUÉS'), 'El detalle debe comparar el margen resultante de la venta.');
assert(moduleSource.includes('Aprobar esta participación'), 'La aprobación individual debe ser visible y explícita.');
assert(moduleSource.includes('Rechazar esta participación'), 'El rechazo individual debe ser visible y explícito.');
assert(html.includes('id="badge-nav-gastos"'), 'Gastos debe mostrar solicitudes pendientes en el menú.');
assert(html.includes('id="badge-nav-empleados"'), 'Empleados debe conservar su indicador de solicitudes pendientes.');

console.log('OK: módulo Comisiones separado, trazable y con reparto controlado.');
