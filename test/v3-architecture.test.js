const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const v3Files = fs.readdirSync(path.join(root, 'js', 'v3')).filter((name) => name.endsWith('.js'));

test('la rama de reconstrucciÃ³n ejecuta una sola fuente editable de la aplicaciÃ³n', () => {
  assert.match(indexSource, /js\/app\.js\?v=3\.0\.0-reconstruction/);
  assert.doesNotMatch(indexSource, /js\/app\.v2\.0\.194\.js/);
});

test('detalle, impresiÃ³n, guardado y conversiÃ³n de presupuestos usan el modelo canÃ³nico', () => {
  const uses = appSource.match(/pptoModeloEconomicoCanonico\s*\(/g) || [];
  assert.ok(uses.length >= 7, 'todos los recorridos econÃ³micos deben compartir el modelo canÃ³nico');
  const printModel = appSource.slice(
    appSource.indexOf('function _pptoModeloImpresion'),
    appSource.indexOf('function imprimirPresupuestoActual')
  );
  assert.doesNotMatch(printModel, /registro\.total\s*\|\|/);
});

test('el núcleo v3 se carga en modo sombra sin activarse por defecto', () => {
  const expectedOrder = [
    'identity-index.js',
    'data-lifecycle.js',
    'domain-store.js',
    'budget-read-model.js',
    'sales-read-model.js',
    'ot-read-model.js',
    'migration-audit.js',
    'legacy-snapshot.js',
    'shadow-comparison.js',
    'feature-gates.js'
  ];
  let previousIndex = -1;
  for (const file of expectedOrder) {
    const scriptIndex = indexSource.indexOf(`js/v3/${file}`);
    assert.ok(scriptIndex > previousIndex, `${file} debe cargarse en el orden seguro`);
    previousIndex = scriptIndex;
  }
  assert.match(indexSource, /js\/v3-shadow-runtime\.js/);
  assert.doesNotMatch(indexSource, /SisVentas\.V3Shadow\.enable\s*\(/);
});

test('los módulos v3 no leen colecciones globales legacy ni escriben Firebase', () => {
  for (const file of v3Files) {
    const source = fs.readFileSync(path.join(root, 'js', 'v3', file), 'utf8');
    assert.doesNotMatch(source, /\bwindow\.(ventasList|pptoData|otData|prodData|clientesList)\b/);
    assert.doesNotMatch(source, /\b(fbSet|fbUpdate|fbRemove|fbPush|fbDB)\b/);
  }
});

test('la integración sombra no escribe Firebase ni inicia sin una señal explícita', () => {
  const source = fs.readFileSync(path.join(root, 'js', 'v3-shadow-runtime.js'), 'utf8');
  assert.doesNotMatch(source, /\b(fbSet|fbUpdate|fbRemove|fbPush|fbDB)\b/);
  assert.match(source, /v3_shadow=1/);
  assert.doesNotMatch(source, /localStorage/);
});
