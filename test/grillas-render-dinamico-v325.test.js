const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const grid = fs.readFileSync('js/modules/resizable-tables.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

test('agregar filas dentro de tbody reactiva la tabla general', () => {
  const start = grid.indexOf('function mutationTouchesActivePage(');
  const end = grid.indexOf('\n  }', start) + 4;
  const visible = {nodeType:1, closest:()=>({})};
  const hidden = {nodeType:1, closest:()=>({})};
  const c = {document:{querySelector:()=>({contains:node=>node===visible})}};
  require('node:vm').runInNewContext(grid.slice(start,end),c);
  assert.equal(c.mutationTouchesActivePage([{target:visible,addedNodes:[]}]),true);
  assert.equal(c.mutationTouchesActivePage([{target:hidden,addedNodes:[]}]),false);
  assert.match(grid, /if \(!mutationTouchesActivePage\(mutations\)\) return;[\s\S]*?scheduleScan\(\)/);
});

test('el cambio de página inicializa en el siguiente cuadro sin esperar resize', () => {
  assert.match(grid, /sisventas:page-changed'[\s\S]*?requestAnimationFrame[\s\S]*?scan\(\)/);
});

test('la aplicación carga la revisión general de render dinámico', () => {
  assert.match(html, /resizable-tables\.js\?v=[^"\s]+/);
});
