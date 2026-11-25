const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('js/modules/purchase-orders.js', 'utf8');

assert(source.includes("window.SisVentas.prepareResizablePage(modal)"),
  'La grilla dinámica de la OC debe inicializar la regla general de columnas.');
assert(source.includes('ocGuardarConciliacionActual()'),
  'Una conciliación recibida debe poder corregirse y guardarse.');
assert(source.includes('window.ocGuardarConciliacionActual = function()') && source.includes('then(saveActiveReconciliation)'),
  'La acción de guardar conciliación debe estar expuesta a la interfaz.');
assert(source.includes("'<button class=\"btn\" style=\"color:var(--red)\" onclick=\"ocEliminarOrdenActual()\""),
  'El borrador elegible debe ofrecer la acción de eliminar.');
assert(!source.includes('No se puede eliminar una orden con materiales recibidos'),
  'La eliminación no debe quedar bloqueada por recepciones.');
assert(source.includes('width:794px;min-height:1123px'),
  'El comprobante debe usar un ancho fijo equivalente a A4.');
assert(source.includes('Descargar PDF') && source.includes('Compartir PDF') && source.includes('window.print()'),
  'El comprobante debe ofrecer imprimir, descargar y compartir.');

const vm=require('node:vm'),context={};vm.createContext(context);const from=source.indexOf('  function orderDeleteAction('),to=source.indexOf('  async function deleteActiveOrder(',from);assert(from>=0&&to>from);vm.runInContext(source.slice(from,to),context);
assert.equal(context.orderDeleteAction({origen:'manual',estado:'borrador',items:[{cantidadRecibida:0}]}).action,'delete');
assert.equal(context.orderDeleteAction({origen:'manual',estado:'recibida',items:[{cantidadRecibida:1}]}).action,'review');
assert.equal(context.orderDeleteAction({ventaFbKey:'original',origen:'venta',items:[]}).action,'cancel');
assert.equal(context.orderDeleteAction({items:[]}).action,'review');
console.log('OK: borrador independiente eliminable y compras vinculadas/históricas protegidas, grilla general y comprobante A4 con acciones estándar.');
