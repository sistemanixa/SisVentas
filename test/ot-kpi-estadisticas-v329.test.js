const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.v2.0.329.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const metricsCache = fs.readFileSync('js/core/metrics-cache.js', 'utf8');

test('el caché auxiliar no vuelve a pisar los KPI propios de Órdenes de trabajo', () => {
  assert.doesNotMatch(metricsCache, /\['renderDashboard','renderTesoreria','renderOTTabla'/);
  assert.doesNotMatch(metricsCache, /'tesoreria','ordentrabajo','cobranzas'/);
  const refresh = metricsCache.slice(metricsCache.indexOf('SV.Metrics.refresh = function'), metricsCache.indexOf('document.addEventListener', metricsCache.indexOf('SV.Metrics.refresh = function')));
  assert.doesNotMatch(refresh, /refrescarDashOT312\(\)/);
  assert.match(app, /var otParaHoy = otData\.filter\([\s\S]{0,180}otFechaEstadisticaISO\(o\.fecha\) === hoy/);
  assert.match(app, /ot-met-hoy'[\s\S]{0,180}textContent = otParaHoy\.length/);
});

test('el módulo de OT contiene el ranking y sus períodos', () => {
  assert.match(html, /id="ot-estadisticas-card"/);
  assert.match(html, /id="ot-stats-ranking"/);
  assert.match(html, /value="historico" selected/);
  assert.match(html, /value="mes"/);
  assert.match(html, /value="90"/);
  assert.match(app, /function renderOTEstadisticas\(/);
});

test('el ranking deduplica OT y calcula líder, completadas y abiertas', () => {
  const inicio = app.indexOf('function otFechaEstadisticaISO');
  const fin = app.indexOf('function renderOTTabla', inicio);
  assert.ok(inicio > 0 && fin > inicio);

  const elementos = {
    'ot-stats-ranking': { innerHTML: '' },
    'ot-stats-periodo': { value: 'historico' },
    'ot-stats-lider': { textContent: '' },
    'ot-stats-lider-sub': { textContent: '' },
    'ot-stats-completadas': { textContent: '' },
    'ot-stats-completadas-sub': { textContent: '' },
    'ot-stats-tecnicos': { textContent: '' }
  };
  const contexto = {
    document: { getElementById: (id) => elementos[id] || null },
    otData: [
      { fbKey:'a1', tecnico:'Marcos', estado:'completada', fechaCierre:'2026-08-11' },
      { fbKey:'a2', tecnico:'Marcos', estado:'finalizada', fecha:'10/08/2026' },
      { fbKey:'a3', tecnico:'Marcos', estado:'pendiente', fecha:'2026-08-11' },
      { fbKey:'b1', tecnico:'Osmar', estado:'completada', fecha:'2026-08-09' },
      { fbKey:'b1', tecnico:'Osmar', estado:'completada', fecha:'2026-08-09' },
      { fbKey:'x1', tecnico:'Sin asignar', estado:'completada', fecha:'2026-08-08' }
    ],
    otEstaCerrada: (ot) => ['completada','finalizada'].includes(String(ot.estado).toLowerCase()),
    svFechaLocalISO: (date) => date
      ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
      : '2026-08-11',
    escapeHTML: (value) => String(value),
    console
  };
  contexto.window = contexto;
  vm.runInNewContext(app.slice(inicio, fin), contexto);
  contexto.renderOTEstadisticas();

  assert.equal(elementos['ot-stats-lider'].textContent, 'Marcos');
  assert.equal(elementos['ot-stats-lider-sub'].textContent, '2 OT completadas');
  assert.equal(elementos['ot-stats-completadas'].textContent, '3');
  assert.equal(elementos['ot-stats-completadas-sub'].textContent, 'de 4 OT cerradas');
  assert.equal(elementos['ot-stats-tecnicos'].textContent, '2');
  assert.match(elementos['ot-stats-ranking'].innerHTML, /Marcos/);
  assert.match(elementos['ot-stats-ranking'].innerHTML, /2<\/strong> cerradas/);
  assert.match(elementos['ot-stats-ranking'].innerHTML, /1 abiertas/);
});
