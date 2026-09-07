const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html','utf8');
const app = fs.readFileSync(html.match(/src="\.\/(js\/app\.v[0-9.]+\.js)"/)[1], 'utf8');
test('restaurar limpia acciones incluso si Firebase desconectó la tarjeta', () => {
  const start = app.indexOf('function restaurarProveedoresEnFicha()');
  const end = app.indexOf('\nfunction precioVigenciaMs', start);
  for (let cycle=0; cycle<5; cycle++) {
    let removed=0, restored=false;
    const card={querySelectorAll:()=>[{remove:()=>removed++}],classList:{remove:()=>{}}};
    const ctx={document:{querySelectorAll:()=>[]},_proveedoresEnFicha:{id:'producto',card,marker:{replaceWith:n=>{restored=n===card;}}}};
    vm.runInNewContext(app.slice(start,end),ctx);
    assert.equal(ctx.restaurarProveedoresEnFicha(),'producto');
    assert.equal(removed,1);
    assert.equal(restored,true);
    assert.equal(ctx._proveedoresEnFicha,null);
  }
});
test('los diálogos no dependen de la tarjeta de proveedores',()=>{
  const dialog=app.slice(app.indexOf('function _svCrearDialogoSistema'),app.indexOf('function _svCrearDialogoSistema')+4000);
  assert(!dialog.includes('card.querySelectorAll'));
});
