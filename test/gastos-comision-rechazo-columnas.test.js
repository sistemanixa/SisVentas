const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v3.2.1.js'), 'utf8');
const grids = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'resizable-tables.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const commissions = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'commissions.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(!app.includes("btnRechazar = estadoNorm === 'pendiente_aprobacion' && esComision"), 'Gastos no debe decidir el rechazo de comisiones.');
assert(app.includes("abrirComisionDesdeGasto(\\'"), 'Gastos debe abrir la comisión exacta.');
assert(commissions.includes('rechazarComisionGestion'), 'El rechazo debe quedar en el módulo Comisiones.');
assert(commissions.includes('rehabilitarComision'), 'Las comisiones rechazadas deben poder rehabilitarse.');
assert(index.includes('resizable-tables.js?v=3.2.1'), 'La app debe cargar la copia publicada del controlador de grillas.');
assert(grids.includes('dragUsesPercent = false'), 'El controlador validado debe conservar el arrastre en píxeles estilo Windows.');
assert(grids.includes("handle.addEventListener('dblclick'"), 'El controlador validado debe conservar el autoajuste por doble clic.');
assert(grids.includes('persistPixelLayout(table, index, autoWidthForColumn(table, index));'), 'El autoajuste validado debe persistir únicamente la columna elegida.');

console.log('OK Gastos: comisión enlazada al módulo propio y controlador validado cargado.');
