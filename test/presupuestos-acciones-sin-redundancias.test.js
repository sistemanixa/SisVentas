const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const inicio = app.indexOf('function renderPptoAccionesTabla');
const fin = app.indexOf('function ejecutarAccionPptoTabla', inicio);
if (inicio < 0 || fin <= inicio) throw new Error('No se encontró el render de acciones de presupuestos');
const bloque = app.slice(inicio, fin);

if (bloque.includes("boton('Ver detalle'")) throw new Error('Ver detalle no debe repetirse: la fila ya abre el presupuesto');
if (bloque.includes("boton('Editar'")) throw new Error('Editar no debe repetirse: está dentro del detalle');
['Imprimir', 'Duplicar', 'Anular', 'Eliminar'].forEach((accion) => {
  if (!bloque.includes(`boton('${accion}'`)) throw new Error(`Falta conservar la acción ${accion}`);
});

console.log('OK presupuestos conserva sólo acciones no redundantes');
