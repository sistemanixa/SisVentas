const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'resizable-tables.js'), 'utf8');

test('el control de ancho consume los clicks antes de llegar al ordenamiento', () => {
  assert.match(source, /handle\.addEventListener\('click',[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);/);
  assert.match(source, /handle\.addEventListener\('dblclick',[\s\S]*?persistPixelLayout/);
});
