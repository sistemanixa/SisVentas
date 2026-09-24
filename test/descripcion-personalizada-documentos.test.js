const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.v3.7.3.js', 'utf8');
const permissions = fs.readFileSync('js/modules/action-permissions.js', 'utf8');
const budget = require('../js/v3/budget-read-model.js');
const budgetIntegration = require('../js/v3/budget-integration.js');

function functionSource(name, nextName) {
  const start = app.indexOf('function ' + name + '(');
  const end = app.indexOf('function ' + nextName + '(', start + 1);
  assert.ok(start >= 0 && end > start, 'No se encontró ' + name);
  return app.slice(start, end);
}

(async function () {
  assert.match(permissions, /'documentos\.modificarDescripcionProductos':\s*\{[^}]*roles:\['admin'\]/);
  assert.match(app, /item-desc-edit[^`]+editarDescripcionItemDocumento/);
  assert.match(app, /item\.descripcionPersonalizada\s*=\s*tr\.dataset\.descripcionPersonalizada/);
  assert.match(app, /descripcionPersonalizada:\s*tr\.dataset\.descripcionPersonalizada/);

  const notifications = [];
  let allowed = true;
  let prompted = false;
  const ctx = {
    window: { tienePermiso: permiso => allowed && permiso === 'documentos.modificarDescripcionProductos' },
    notify: message => notifications.push(message),
    svPrompt: async () => { prompted = true; return '  Nombre especial para el cliente  '; },
    String
  };
  vm.createContext(ctx);
  vm.runInContext(
    functionSource('descripcionVisibleItemDocumento', 'puedeModificarDescripcionItemDocumento') +
    functionSource('puedeModificarDescripcionItemDocumento', 'editarDescripcionItemDocumento') +
    functionSource('editarDescripcionItemDocumento', 'abrirEditorVenta'),
    ctx
  );

  const masterProduct = { nombre: 'Nombre maestro' };
  const target = { textContent: masterProduct.nombre, title: '' };
  const row = { dataset: {}, querySelector: () => target };
  const button = { closest: () => row };
  await ctx.editarDescripcionItemDocumento(button);
  assert.equal(target.textContent, 'Nombre especial para el cliente');
  assert.equal(row.dataset.descripcionPersonalizada, 'Nombre especial para el cliente');
  assert.equal(masterProduct.nombre, 'Nombre maestro', 'La edición del renglón no debe tocar el producto maestro');
  const savedSaleItem = { desc:target.textContent, descripcionPersonalizada:row.dataset.descripcionPersonalizada };
  assert.equal(ctx.descripcionVisibleItemDocumento(savedSaleItem), 'Nombre especial para el cliente');
  assert.equal(ctx.descripcionVisibleItemDocumento({ desc:'Venta histórica' }), 'Venta histórica');

  allowed = false;
  prompted = false;
  target.textContent = 'Descripción guardada';
  await ctx.editarDescripcionItemDocumento(button);
  assert.equal(prompted, false, 'Un usuario sin permiso no debe abrir el editor');
  assert.equal(target.textContent, 'Descripción guardada', 'Un usuario sin permiso sí conserva la visualización');

  const historical = budget.normalizeItem({ cod:'P-1', desc:'Descripción histórica', qty:1, punit:100 }, 0);
  assert.equal(historical.description, 'Descripción histórica');

  const customized = budget.normalizeItem({
    cod:'P-1', desc:'Nombre maestro', descripcionPersonalizada:'Descripción guardada', qty:2, punit:100
  }, 0);
  assert.equal(customized.description, 'Descripción guardada');

  const legacyItem = budgetIntegration.toLegacyItem(customized);
  assert.equal(legacyItem.desc, 'Descripción guardada');
  assert.equal(legacyItem.descripcionPersonalizada, 'Descripción guardada');
  assert.equal(budgetIntegration.printModel({ id:'PP-1', cliente:'Cliente', items:[legacyItem], conIva:false }).items[0].desc, 'Descripción guardada');

  console.log('OK: permiso de edición, persistencia por renglón, reapertura V3, histórico y producto maestro');
})();
