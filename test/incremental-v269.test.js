const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.269.js', 'utf8');
const notifications = fs.readFileSync('js/modules/notifications.js', 'utf8');
const otWorkflow = fs.readFileSync('js/modules/ot-workflow.js', 'utf8');
const dashboardPermissions = fs.readFileSync('js/modules/dashboard-permissions.js', 'utf8');

assert(index.includes('app.v2.0.269.js'));
assert(index.includes('version.v2.0.269.js'));
assert(index.includes('notifications.js?v=2.0.269'));
assert(app.includes('function svNavegarDirecto(id, abrir, el)'));
assert(app.includes('var aperturaDirecta = window._svProximaVistaDirecta === id'));
assert(app.includes('if(aperturaDirecta || window._ventaDesdeHistorialOrigen) return'));
assert(app.includes('if(aperturaDirecta) return; if(typeof volverListaOT'));
assert(app.includes("id === 'venta' && !preservarFormularioVenta && !aperturaDirecta"));
assert(!app.includes("setTimeout(function(){ if(typeof abrirNuevoPresupuesto==='function') abrirNuevoPresupuesto(); }, 150)"));
assert(!app.includes("setTimeout(function(){ if(typeof abrirModalNuevo==='function') abrirModalNuevo('gasto'); }, 150)"));
assert(notifications.includes("global.svNavegarDirecto('ordentrabajo'"));
assert(notifications.includes("global.svNavegarDirecto('presupuesto'"));
assert(otWorkflow.includes("window.svNavegarDirecto('ordentrabajo'"));
assert(dashboardPermissions.includes("window.svNavegarDirecto('detalle'"));
assert(app.includes("VERSION: 'v2.0.269-firebase'"));

console.log('v2.0.269: navegación directa sin flash de listas');
