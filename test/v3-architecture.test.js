const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const v3Files = fs.readdirSync(path.join(root, 'js', 'v3')).filter((name) => name.endsWith('.js'));

test('la integración conserva v2.0.236 como única aplicación activa', () => {
  const activeAppScripts = Array.from(
    indexSource.matchAll(/<script src="\.\/(js\/app[^"?]*\.js)(?:\?[^\"]*)?"><\/script>/g)
  );
  assert.equal(activeAppScripts.length, 1, 'debe existir una sola aplicación activa');
  assert.equal(activeAppScripts[0][1], 'js/app.v2.0.236.js');
  assert.doesNotMatch(indexSource, /js\/app\.js\?v=3/);
});

test('el núcleo v3 se carga después de la aplicación actual y en orden seguro', () => {
  const expectedOrder = [
    'identity-index.js',
    'data-lifecycle.js',
    'domain-store.js',
    'product-provider-read-model.js',
    'record-repository.js',
    'attachment-task.js',
    'budget-read-model.js',
    'sales-read-model.js',
    'ot-read-model.js',
    'journey-audit.js',
    'migration-audit.js',
    'legacy-snapshot.js',
    'shadow-comparison.js',
    'feature-gates.js'
  ];
  let previousIndex = indexSource.indexOf('js/app.v2.0.236.js');
  assert.ok(previousIndex >= 0, 'la aplicación estable debe cargarse antes del diagnóstico');
  for (const file of expectedOrder) {
    const scriptIndex = indexSource.indexOf(`js/v3/${file}`);
    assert.ok(scriptIndex > previousIndex, `${file} debe cargarse en el orden seguro`);
    previousIndex = scriptIndex;
  }
  assert.ok(indexSource.indexOf('js/v3-shadow-runtime.js') > previousIndex);
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
  assert.match(source, /enabled:\s*options\.enabled === true \|\| enabledByQuery\(root\)/);
});
