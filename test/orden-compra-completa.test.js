const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('js/modules/purchase-orders.js', 'utf8');

assert(source.includes("window.SisVentas.prepareResizablePage(modal)"),
  'La grilla dinámica de la OC debe inicializar la regla general de columnas.');
assert(source.includes('ocGuardarConciliacionActual()'),
  'Una conciliación recibida debe poder corregirse y guardarse.');
assert(source.includes("window.ocGuardarConciliacionActual = saveActiveReconciliation"),
  'La acción de guardar conciliación debe estar expuesta a la interfaz.');
assert(source.includes("'<button class=\"btn\" style=\"color:var(--red)\" onclick=\"ocEliminarOrdenActual()\""),
  'Toda OC debe ofrecer la acción de eliminar.');
assert(!source.includes('No se puede eliminar una orden con materiales recibidos'),
  'La eliminación no debe quedar bloqueada por recepciones.');
assert(source.includes('width:794px;min-height:1123px'),
  'El comprobante debe usar un ancho fijo equivalente a A4.');
assert(source.includes('Descargar PDF') && source.includes('Compartir PDF') && source.includes('window.print()'),
  'El comprobante debe ofrecer imprimir, descargar y compartir.');

console.log('OK: OC editable/eliminable, grilla general y comprobante A4 con acciones estándar.');
