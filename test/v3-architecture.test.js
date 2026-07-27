const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const v3Files = fs.readdirSync(path.join(root, 'js', 'v3')).filter((name) => name.endsWith('.js'));

test('el núcleo v3 se carga en modo sombra sin activarse por defecto', () => {
  const expectedOrder = [
    'identity-index.js',
    'data-lifecycle.js',
    'domain-store.js',
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
