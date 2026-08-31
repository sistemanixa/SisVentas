const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.v3.1.3.js', 'utf8');

assert(app.includes('function spEmpleadoEsTecnico(empleado)'), 'Debe existir una única regla para reconocer técnicos');
assert(app.includes("return categoria.includes('TECNICO')"), 'La asignación debe respetar la categoría/cargo técnico');
assert.strictEqual((app.match(/filter\(spEmpleadoEsTecnico\)/g) || []).length, 2, 'Los dos caminos de reclamos deben filtrar sólo técnicos');
assert(app.includes("spMostrarProcesoCreacionOT('Preparando la venta vinculada…')"), 'Debe mostrar progreso inmediatamente después de elegir técnico');
assert(app.includes("procesoCreacionOT.actualizar('Creando la orden de trabajo…')"), 'Debe informar la creación real de la OT');
assert(app.includes("procesoCreacionOT.actualizar('Vinculando la OT con el reclamo…')"), 'Debe informar la vinculación final');
assert(app.includes('requestAnimationFrame(function(){ requestAnimationFrame(resolve); })'), 'Debe permitir que el indicador se pinte antes de procesar');
assert(app.includes('finally {\n    procesoCreacionOT.finalizar();'), 'El indicador debe cerrarse también ante errores');

console.log('OK: Reclamos asigna sólo técnicos y muestra el progreso completo de creación de OT.');
