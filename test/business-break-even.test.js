const assert = require('assert');
const fs = require('fs');
const engine = require('../js/modules/business-break-even.js');

const base = engine.calculate({
  fixedCosts: 5000000,
  targetProfit: 0,
  visitPrice: 80000,
  visitVariableCost: 20000,
  contributionMarginRate: 0.30,
  plannedVisits: 40,
  workingDays: 22,
  currentContribution: 2500000,
  elapsedFraction: 0.5
});

assert.strictEqual(base.contributionPerVisit, 60000);
assert.strictEqual(base.visitsOnly, 84);
assert(Math.abs(base.visitsPerWorkingDay - 84 / 22) < 1e-9);
assert(Math.abs(base.salesOnly - 16666666.666666668) < 0.01);
assert.strictEqual(base.contributionFromPlannedVisits, 2400000);
assert(Math.abs(base.mixedSales - 8666666.666666668) < 0.01);
assert.strictEqual(base.additionalVisitsActual, 42);
assert(Math.abs(base.coverageRate - 0.5) < 1e-9);
assert.strictEqual(base.projectedResult, 0);
assert.strictEqual(base.scenarios.conservative.visits, 32);
assert.strictEqual(base.scenarios.probable.visits, 40);
assert.strictEqual(base.scenarios.ambitious.visits, 48);
assert(base.scenarios.conservative.sales > base.scenarios.probable.sales);
assert(base.scenarios.probable.sales > base.scenarios.ambitious.sales);

const target = engine.calculate({ fixedCosts: 100, targetProfit: 50, visitPrice: 30, visitVariableCost: 10, contributionMarginRate: 0.5, currentContribution: 150 });
assert.strictEqual(target.requiredContribution, 150);
assert.strictEqual(target.reachedBreakEven, true);
assert.strictEqual(target.reachedTarget, true);
assert.strictEqual(target.remainingActual, 0);

const unsafe = engine.calculate({ fixedCosts: 100, visitPrice: 10, visitVariableCost: 20, contributionMarginRate: -1 });
assert.strictEqual(unsafe.contributionPerVisit, 0);
assert.strictEqual(unsafe.visitsOnly, null);
assert.strictEqual(unsafe.salesOnly, null);

const source = fs.readFileSync('js/modules/business-break-even.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const charts = fs.readFileSync('js/modules/executive-charts.js', 'utf8');
assert(source.includes("params.get('break_even_preview') === '1'"), 'El módulo debe permanecer encapsulado');
assert(html.includes('id="rent-break-even"'), 'Falta la interfaz dentro de Rentabilidad');
assert(html.includes('id="cfg-rentabilidad"'), 'Los supuestos deben configurarse en una solapa separada');
assert(html.includes('id="be-health-title"'), 'Rentabilidad debe responder si el negocio va bien o mal');
assert(html.includes('id="be-executive-numbers"'), 'Falta el resumen numérico ejecutivo sin gráficos');
assert(html.includes('business-break-even.js'), 'Falta cargar el motor independiente');
assert(source.includes('calcularRentabilidadCanonica'), 'Debe reutilizar la fuente contable canónica');
assert(source.includes('be-dashboard-summary'), 'Falta el resumen ejecutivo del Dashboard');
assert(source.includes("rentPage.insertBefore(rentCard, periodToolbar.nextSibling)"), 'Salud del negocio debe ubicarse antes que los indicadores contables');
assert(source.includes("rentPage.insertBefore(executiveNumbers, legacyMetrics.nextSibling)"), 'El resumen numérico debe conservar el lugar del bloque analítico anterior');
assert(source.includes("legacyMetrics.style.display = ''"), 'Las métricas originales de Rentabilidad deben permanecer visibles');
assert(source.includes('previousComparableRange') && source.includes('executiveContext'), 'Las cifras comparativas deben usar períodos canónicos equivalentes');
assert(charts.includes("function ensureRent(){ var card=document.getElementById('sv334-rent-card'); if(card) card.remove(); }"), 'Rentabilidad debe mantenerse sin gráficos');

console.log('OK: motor de punto de equilibrio y escenarios determinísticos.');
