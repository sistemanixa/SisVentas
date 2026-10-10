const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('propuestas no recorre presupuestos ocultos y se reactiva al volver', () => {
  let tick, scans = 0, maps = 0, active = false;
  const events = {};
  const c = {
    window: {}, setInterval(fn) { tick = fn; },
    pptoData: [{id: 'PP-1'}],
    document: {
      hidden: false,
      addEventListener(name, fn) { events[name] = fn; },
      getElementById(id) { return id === 'page-presupuesto' ? {classList: {contains: () => active}} : null; },
      querySelectorAll() { scans++; return [{dataset: {pptoRef: 'PP-1'}, cells: [null]}]; }
    }
  };
  c.pptoData.map = function(fn) { maps++; return Array.prototype.map.call(this, fn); };
  vm.runInNewContext(fs.readFileSync('js/modules/budget-proposals.js', 'utf8'), c);
  tick(); assert.equal(scans, 0);
  active = true; c.document.hidden = true; tick(); assert.equal(scans, 0);
  c.document.hidden = false; events.visibilitychange(); assert.equal(scans, 1); assert.equal(maps, 1);
  active = false; events['sisventas:page-changed'](); assert.equal(scans, 1);
  active = true; events['sisventas:page-changed'](); assert.equal(maps, 2);
});

test('métricas agrupa refrescos y conserva retorno y datos más recientes', () => {
  const timers = new Map(), events = {}; let next = 0, refreshes = 0, value = 1, observed;
  const c = {
    window: {renderDashboard(arg) { return this.prefix + arg; }, prefix: 'ok:'},
    document: {addEventListener(name, fn) { events[name] = fn; }},
    setTimeout(fn) { timers.set(++next, fn); return next; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(fs.readFileSync('js/core/metrics-cache.js', 'utf8'), c);
  c.window.SisVentas.Metrics.refresh = () => { refreshes++; observed = value; };
  events.DOMContentLoaded();
  assert.equal(c.window.renderDashboard('a'), 'ok:a');
  c.window.renderDashboard('b');
  events['sisventas:page-changed']({detail: {page: 'tesoreria'}});
  assert.equal(timers.size, 1); assert.equal(refreshes, 0);
  value = 2; const fn = [...timers.values()][0]; timers.clear(); fn();
  assert.equal(refreshes, 1); assert.equal(observed, 2);
  events['sisventas:page-changed']({detail: {page: 'productos'}}); assert.equal(timers.size, 0);
  c.window.renderDashboard('c'); assert.equal(timers.size, 1);
});
