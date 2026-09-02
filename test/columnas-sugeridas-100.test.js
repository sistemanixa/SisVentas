const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/modules/resizable-tables.js', 'utf8');

assert.match(source, /function normalizeSuggestedPercentages\(source, count\)/,
  'debe existir una normalización común para las sugerencias');
assert.match(source, /var remaining = 1000 - tenths\.reduce/,
  'la distribución debe cerrar en mil décimas, es decir 100%');
assert.doesNotMatch(source, /if \(preset\)|table\.id === '(?:gas-tbl|prod-tbl|ppto-tabla|ventas-tbl|venta-items-tbl)'/,
  'no deben existir presets particulares por pantalla');
assert.match(source, /return normalizeSuggestedPercentages\(data, headers\.length\)/,
  'las sugerencias calculadas también deben cerrar exactamente en 100%');
assert.match(source, /openPercentEditor\(visibleTable \|\| btn\._svFallbackTable \|\| table\)/,
  'el editor debe abrir usando la referencia real de la tabla');
assert.doesNotMatch(source, /if \(table\.id\) \{\s*btn\.setAttribute\('onclick'/,
  'ninguna grilla debe depender de tener id para abrir el editor');
assert.match(source, /function suggestedPixelWidths\(table, headers\)/,
  'las grillas en píxeles deben tener una base sugerida adaptada al espacio real');
assert.match(source, /var flexibleTarget = Math\.max\(MIN_WIDTH \* flexible\.length, target - fixedTotal\)/,
  'la sugerencia en píxeles debe descontar columnas fijas y respetar mínimos');
assert.match(source, /suggestedWidths = suggestedPixelWidths\(table, headers\);[\s\S]*?input\.value = suggestedWidths\[index\]/,
  'Restablecer anchos debe aplicar la propuesta que ocupa el ancho disponible');

const suggestedStart = source.lastIndexOf("if (ev.target.closest('[data-sv-default]'))");
const suggestedEnd = source.indexOf('\n      if (ev.target.closest', suggestedStart + 1);
const suggestedHandler = source.slice(suggestedStart, suggestedEnd);
assert.match(suggestedHandler, /input\.value = defs\[input\.dataset\.colIndex\]/,
  'Usar base sugerida debe modificar los tamaños');
assert.doesNotMatch(suggestedHandler, /defaultAlignments|select\.value|data-align-index/,
  'Usar base sugerida no debe modificar la alineación elegida');

const start = source.indexOf('function normalizeSuggestedPercentages');
const end = source.indexOf('\n  function defaultPercentages', start);
const helper = source.slice(start, end);
const normalizePercent = value => {
  const n = parseFloat(String(value || '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 10) / 10;
};
const normalizeSuggestedPercentages = Function('normalizePercent', helper + '\nreturn normalizeSuggestedPercentages;')(normalizePercent);

[
  { 0:5, 1:4, 2:30, 3:50, 4:3, 5:8, 6:8, 7:6, 8:3 },
  { 0:110, 1:170, 2:96, 3:58, 4:74 },
  { 0:1, 1:1, 2:1 },
  {}
].forEach((input, caseIndex) => {
  const count = caseIndex === 0 ? 9 : (caseIndex === 1 ? 5 : 3);
  const result = normalizeSuggestedPercentages(input, count);
  const total = Object.values(result).reduce((sum, value) => sum + value, 0);
  assert.equal(Math.round(total * 10), 1000, `el caso ${caseIndex + 1} debe sumar 100% exacto`);
});

console.log('columnas-sugeridas-100.test.js OK');
