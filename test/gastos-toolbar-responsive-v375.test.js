const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

test('la cabecera de Gastos conserva todo el ancho tras agrupar acciones', () => {
  assert.match(css, /#page-gastos \.gas-card-head>\.sv-card-head-actions\{display:flex!important;align-items:center;gap:8px;width:100%!important;min-width:0\}/);
  assert.match(css, /@media\(max-width:900px\)[\s\S]*#page-gastos \.gas-card-head>\.sv-card-head-actions\{display:block!important;width:100%!important;min-width:0\}/);
});

test('tablet ordena filtros y acciones en dos columnas', () => {
  assert.match(css, /#page-gastos \.gas-toolbar-filters,#page-gastos \.gas-toolbar-buttons\{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(html, /class="btn btn-sm btn-primary gas-action-new"/);
  assert.match(html, /class="btn btn-sm gas-action-advance"/);
  assert.match(html, /class="btn btn-sm gas-action-multi"/);
  assert.match(html, /class="btn btn-sm admin-only gas-action-recurring"/);
  const app = fs.readFileSync('js/app.v3.7.5.js', 'utf8');
  assert.match(app, /btn\.className = _gastosPagoMultipleActivo \? 'btn btn-sm btn-primary gas-action-multi' : 'btn btn-sm gas-action-multi'/);
});

test('celular prioriza las dos acciones principales', () => {
  assert.match(css, /#page-gastos \.gas-action-new,#page-gastos \.gas-action-advance\{grid-column:1\/-1\}/);
});
