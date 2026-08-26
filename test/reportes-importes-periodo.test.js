const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/app.js', 'utf8');

test('Reportes conserva dos decimales en KPIs y filas', () => {
  assert.match(source, /function\(valor\)[\s\S]*minimumFractionDigits:2, maximumFractionDigits:2/);
  assert.match(source, /rep-total'\)\) _e\('rep-total'\)\.textContent=montoReporte\(totalMes\)/);
  assert.match(source, /rep-ticket'\)\) _e\('rep-ticket'\)\.textContent=montoReporte\(ticketProm\)/);
  assert.match(source, /montoReporte\(x\.monto\)/);
});

test('IVA informa el período sin inventar una fecha de vencimiento', () => {
  assert.match(source, /textContent='período '\+mesActual\.split\('-'\)\.reverse\(\)\.join\('-'\)/);
  assert.doesNotMatch(source, /rep-iva-sub'\)\.textContent='vence 20\//);
});
