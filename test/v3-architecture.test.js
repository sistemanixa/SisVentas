const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const v3Files = fs.readdirSync(path.join(root, 'js', 'v3')).filter((name) => name.endsWith('.js'));

test('el núcleo v3 permanece desconectado de producción hasta completar la migración', () => {
  for (const file of v3Files) {
    assert.doesNotMatch(indexSource, new RegExp(`js/v3/${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }
});

test('los módulos v3 no leen colecciones globales legacy ni escriben Firebase', () => {
  for (const file of v3Files) {
    const source = fs.readFileSync(path.join(root, 'js', 'v3', file), 'utf8');
    assert.doesNotMatch(source, /\b(ventasList|pptoData|otData|prodData|clientesList)\b/);
    assert.doesNotMatch(source, /\b(fbSet|fbUpdate|fbRemove|fbPush|fbDB)\b/);
  }
});
