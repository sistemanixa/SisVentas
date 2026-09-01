/* Motor de punto de equilibrio de SisVentas.
   Preview encapsulado: ?break_even_preview=1 o sisventas.breakEven.preview=1. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SisVentasBreakEvenEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function number(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : (fallback || 0);
  }

  function calculate(input) {
    input = input || {};
    var fixedCosts = Math.max(0, number(input.fixedCosts));
    var targetProfit = Math.max(0, number(input.targetProfit));
    var visitPrice = Math.max(0, number(input.visitPrice));
    var visitVariableCost = Math.max(0, number(input.visitVariableCost));
    var plannedVisits = Math.max(0, Math.floor(number(input.plannedVisits)));
    var workingDays = Math.max(1, Math.floor(number(input.workingDays, 22)));
    var contributionMarginRate = Math.max(0, Math.min(1, number(input.contributionMarginRate)));
    var currentContribution = Math.max(0, number(input.currentContribution));
    var elapsedFraction = Math.max(0.01, Math.min(1, number(input.elapsedFraction, 1)));
    var requiredContribution = fixedCosts + targetProfit;
    var contributionPerVisit = Math.max(0, visitPrice - visitVariableCost);
    var contributionFromPlannedVisits = plannedVisits * contributionPerVisit;
    var remainingAfterVisits = Math.max(0, requiredContribution - contributionFromPlannedVisits);
    var remainingActual = Math.max(0, requiredContribution - currentContribution);
    var projectedContribution = currentContribution / elapsedFraction;
    var scenarioVisits = {
      conservative: Math.max(0, Math.floor(plannedVisits * 0.8)),
      probable: plannedVisits,
      ambitious: Math.ceil(plannedVisits * 1.2)
    };
    function scenario(visits) {
      var contribution = visits * contributionPerVisit;
      return {
        visits: visits,
        contribution: contribution,
        sales: contributionMarginRate > 0 ? Math.max(0, requiredContribution - contribution) / contributionMarginRate : null
      };
    }

    return {
      fixedCosts: fixedCosts,
      targetProfit: targetProfit,
      requiredContribution: requiredContribution,
      contributionPerVisit: contributionPerVisit,
      contributionMarginRate: contributionMarginRate,
      visitsOnly: contributionPerVisit > 0 ? Math.ceil(requiredContribution / contributionPerVisit) : null,
      visitsPerWorkingDay: contributionPerVisit > 0 ? Math.ceil(requiredContribution / contributionPerVisit) / workingDays : null,
      salesOnly: contributionMarginRate > 0 ? requiredContribution / contributionMarginRate : null,
      plannedVisits: plannedVisits,
      contributionFromPlannedVisits: contributionFromPlannedVisits,
      mixedSales: contributionMarginRate > 0 ? remainingAfterVisits / contributionMarginRate : null,
      currentContribution: currentContribution,
      remainingActual: remainingActual,
      additionalSalesActual: contributionMarginRate > 0 ? remainingActual / contributionMarginRate : null,
      additionalVisitsActual: contributionPerVisit > 0 ? Math.ceil(remainingActual / contributionPerVisit) : null,
      coverageRate: requiredContribution > 0 ? currentContribution / requiredContribution : 0,
      projectedContribution: projectedContribution,
      projectedResult: projectedContribution - fixedCosts,
      projectedCoverageRate: requiredContribution > 0 ? projectedContribution / requiredContribution : 0,
      scenarios: {
        conservative: scenario(scenarioVisits.conservative),
        probable: scenario(scenarioVisits.probable),
        ambitious: scenario(scenarioVisits.ambitious)
      },
      reachedBreakEven: currentContribution >= fixedCosts,
      reachedTarget: currentContribution >= requiredContribution
    };
  }

  return Object.freeze({ calculate: calculate });
});

(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.SisVentasBreakEvenEngine) return;
  var params = new URLSearchParams(location.search);
  var enabled = params.get('break_even_preview') === '1';
  try { enabled = enabled || localStorage.getItem('sisventas.breakEven.preview') === '1'; } catch (_) {}
  if (!enabled) return;

  var STORAGE_KEY = 'sisventas.breakEven.assumptions.v1';
  var executiveCache = null;
  var defaults = {
    fixedMode: 'auto', fixedCosts: 0, visitPrice: 80000, visitVariableCost: 20000,
    plannedVisits: 40, targetProfit: 0, workingDays: 22, marginMode: 'auto', marginPct: 35
  };

  function readConfig() {
    try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
    catch (_) { return Object.assign({}, defaults); }
  }

  function saveConfig(config) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch (_) {}
  }

  function money(value) {
    if (value === null || !Number.isFinite(value)) return 'No calculable';
    return '$' + Math.round(Math.max(0, value)).toLocaleString('es-AR');
  }

  function num(id, fallback) {
    var el = document.getElementById(id);
    var value = el ? Number(el.value) : NaN;
    return Number.isFinite(value) ? value : fallback;
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function monthsInRange(range) {
    return Math.max(1, ((range.hasta.getTime() - range.desde.getTime()) / 86400000 + 1) / 30.4375);
  }

  function previousComparableRange(range) {
    var days = Math.max(1, Math.round((range.hasta.getTime() - range.desde.getTime()) / 86400000) + 1);
    var previousEnd = new Date(range.desde.getFullYear(), range.desde.getMonth(), range.desde.getDate() - 1, 23, 59, 59, 999);
    var previousStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth(), previousEnd.getDate() - days + 1);
    previousStart.setHours(0, 0, 0, 0);
    return { desde: previousStart, hasta: previousEnd };
  }

  function comparisonText(current, previous) {
    current = Number(current) || 0;
    previous = Number(previous) || 0;
    if (Math.abs(previous) < 1) return current > 0 ? 'Pasó a ganancia' : current < 0 ? 'Pasó a pérdida' : 'Sin base comparable';
    if (previous < 0 && current >= 0) return 'Pasó a ganancia';
    if (previous >= 0 && current < 0) return 'Pasó a pérdida';
    if (previous < 0 && current < 0) {
      var improvement = ((Math.abs(previous) - Math.abs(current)) / Math.abs(previous)) * 100;
      return (improvement >= 0 ? 'Mejoró ' : 'Empeoró ') + Math.abs(improvement).toFixed(0) + '%';
    }
    var change = ((current - previous) / Math.abs(previous)) * 100;
    return (change >= 0 ? 'Subió ' : 'Bajó ') + Math.abs(change).toFixed(0) + '%';
  }

  function executiveContext(context) {
    if (!context || typeof window.calcularRentabilidadCanonica !== 'function') return null;
    var cacheKey = [context.period, context.range.desde.getTime(), context.range.hasta.getTime(), context.summary.ingresosNetos, context.summary.gananciaComercial, context.summary.resultadoNeto].join('|');
    if (executiveCache && executiveCache.key === cacheKey) return executiveCache.value;
    var previous = window.calcularRentabilidadCanonica(previousComparableRange(context.range));
    var today = new Date();
    var effectiveEnd = context.range.hasta < today ? context.range.hasta : today;
    var elapsedDays = Math.max(1, Math.floor((effectiveEnd.getTime() - context.range.desde.getTime()) / 86400000) + 1);
    var best = null;
    for (var cursor = new Date(context.range.desde); cursor <= effectiveEnd; cursor.setDate(cursor.getDate() + 1)) {
      var start = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      var end = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 23, 59, 59, 999);
      var dayResult = window.calcularRentabilidadCanonica({ desde:start, hasta:end }).resultadoNeto || 0;
      if (!best || dayResult > best.value) best = { date:new Date(start), value:dayResult };
    }
    var value = {
      previous: previous,
      elapsedDays: elapsedDays,
      dailyAverage: (context.summary.resultadoNeto || 0) / elapsedDays,
      best: best,
      comparison: comparisonText(context.summary.resultadoNeto, previous.resultadoNeto)
    };
    executiveCache = { key:cacheKey, value:value };
    return value;
  }

  function canonicalContext() {
    if (typeof window.calcularRentabilidadCanonica !== 'function' || typeof window._rangoFechasPeriodo !== 'function') return null;
    var periodEl = document.getElementById('rent-periodo');
    var period = periodEl ? periodEl.value : 'mes_actual';
    var range = window._rangoFechasPeriodo(period);
    var summary = window.calcularRentabilidadCanonica(range);
    var months = monthsInRange(range);
    var today = new Date();
    var elapsedFraction = 1;
    if (period === 'mes_actual') elapsedFraction = Math.min(1, Math.max(1 / range.hasta.getDate(), today.getDate() / range.hasta.getDate()));
    return { period: period, range: range, summary: summary, months: months, elapsedFraction: elapsedFraction };
  }

  function readForm(context) {
    var config = readConfig();
    var fixedMode = (document.getElementById('be-fixed-mode') || {}).value || config.fixedMode;
    var marginMode = (document.getElementById('be-margin-mode') || {}).value || config.marginMode;
    var autoFixed = context ? context.summary.otrosGastos / context.months : 0;
    var autoMargin = context ? Math.max(0, context.summary.margenComercial) : 0;
    var currentContribution = context ? Math.max(0, context.summary.gananciaComercial / context.months) : 0;
    config = {
      fixedMode: fixedMode,
      fixedCosts: num('be-fixed-costs', config.fixedCosts),
      visitPrice: num('be-visit-price', config.visitPrice),
      visitVariableCost: num('be-visit-variable', config.visitVariableCost),
      plannedVisits: num('be-planned-visits', config.plannedVisits),
      targetProfit: num('be-target-profit', config.targetProfit),
      workingDays: num('be-working-days', config.workingDays),
      marginMode: marginMode,
      marginPct: num('be-margin-pct', config.marginPct)
    };
    saveConfig(config);
    return {
      config: config,
      autoFixed: autoFixed,
      autoMargin: autoMargin,
      values: {
        fixedCosts: fixedMode === 'auto' ? autoFixed : config.fixedCosts,
        targetProfit: config.targetProfit,
        visitPrice: config.visitPrice,
        visitVariableCost: config.visitVariableCost,
        plannedVisits: config.plannedVisits,
        workingDays: config.workingDays,
        contributionMarginRate: (marginMode === 'auto' ? autoMargin : config.marginPct) / 100,
        currentContribution: currentContribution,
        elapsedFraction: context ? context.elapsedFraction : 1
      }
    };
  }

  function render() {
    var card = document.getElementById('rent-break-even');
    if (!card) return;
    card.style.display = '';
    var context = canonicalContext();
    var form = readForm(context);
    var result = window.SisVentasBreakEvenEngine.calculate(form.values);
    var executive = executiveContext(context);
    var cfg = form.config;
    var fixedInput = document.getElementById('be-fixed-costs');
    var marginInput = document.getElementById('be-margin-pct');
    if (fixedInput) { fixedInput.disabled = cfg.fixedMode === 'auto'; fixedInput.value = cfg.fixedMode === 'auto' ? Math.round(form.autoFixed) : cfg.fixedCosts; }
    if (marginInput) { marginInput.disabled = cfg.marginMode === 'auto'; marginInput.value = (cfg.marginMode === 'auto' ? form.autoMargin : cfg.marginPct).toFixed(1); }

    setText('be-kpi-fixed', money(result.fixedCosts));
    setText('be-kpi-visits', result.visitsOnly === null ? '—' : String(result.visitsOnly));
    setText('be-kpi-visits-sub', result.visitsPerWorkingDay === null ? 'Configurá una visita rentable' : result.visitsPerWorkingDay.toFixed(1) + ' por día hábil');
    setText('be-kpi-sales', money(result.salesOnly));
    setText('be-kpi-sales-sub', (result.contributionMarginRate * 100).toFixed(1) + '% de margen de contribución');
    setText('be-kpi-coverage', Math.round(result.coverageRate * 100) + '%');
    setText('be-kpi-coverage-sub', result.reachedTarget ? 'Meta alcanzada' : money(result.remainingActual) + ' de contribución pendiente');
    setText('be-contribution-visit', money(result.contributionPerVisit));
    setText('be-current-contribution', money(result.currentContribution));
    setText('be-projected-result', (result.projectedResult < 0 ? '-' : '') + money(Math.abs(result.projectedResult)));
    setText('be-projected-label', result.projectedResult >= 0 ? 'resultado proyectado positivo' : 'déficit proyectado');
    setText('be-mixed-visits', result.plannedVisits + ' visitas');
    setText('be-mixed-sales', money(result.mixedSales));
    setText('be-actual-visits', result.additionalVisitsActual === null ? '—' : result.additionalVisitsActual + ' visitas');
    setText('be-actual-sales', money(result.additionalSalesActual));
    if (context && executive) {
      setText('be-exec-comparison', executive.comparison);
      setText('be-exec-comparison-sub', 'contra el período inmediatamente anterior');
      setText('be-exec-daily', (executive.dailyAverage < 0 ? '-' : '') + money(Math.abs(executive.dailyAverage)));
      setText('be-exec-daily-sub', executive.elapsedDays + ' día' + (executive.elapsedDays === 1 ? '' : 's') + ' transcurrido' + (executive.elapsedDays === 1 ? '' : 's'));
      setText('be-exec-best-day', executive.best ? executive.best.date.toLocaleDateString('es-AR', { weekday:'short', day:'2-digit' }) + ' · ' + (executive.best.value < 0 ? '-' : '') + money(Math.abs(executive.best.value)) : '—');
      setText('be-exec-income', money(context.summary.ingresosNetos));
      setText('be-exec-commercial', (context.summary.gananciaComercial < 0 ? '-' : '') + money(Math.abs(context.summary.gananciaComercial)));
      setText('be-exec-net', (context.summary.resultadoNeto < 0 ? '-' : '') + money(Math.abs(context.summary.resultadoNeto)));
      setText('be-exec-net-sub', 'queda en la empresa · ' + (context.summary.margenNeto || 0).toFixed(1) + '%');
      var comparisonEl = document.getElementById('be-exec-comparison');
      var dailyEl = document.getElementById('be-exec-daily');
      var commercialEl = document.getElementById('be-exec-commercial');
      var netEl = document.getElementById('be-exec-net');
      if (comparisonEl) comparisonEl.style.color = context.summary.resultadoNeto >= executive.previous.resultadoNeto ? 'var(--green)' : 'var(--red)';
      if (dailyEl) dailyEl.style.color = executive.dailyAverage >= 0 ? 'var(--blue)' : 'var(--red)';
      if (commercialEl) commercialEl.style.color = context.summary.gananciaComercial >= 0 ? 'var(--blue)' : 'var(--red)';
      if (netEl) netEl.style.color = context.summary.resultadoNeto >= 0 ? 'var(--purple)' : 'var(--red)';
    }
    ['conservative', 'probable', 'ambitious'].forEach(function (name) {
      setText('be-scenario-' + name + '-visits', result.scenarios[name].visits + ' visitas');
      setText('be-scenario-' + name + '-sales', money(result.scenarios[name].sales));
    });

    var bar = document.getElementById('be-progress-bar');
    if (bar) {
      bar.style.width = Math.min(100, result.coverageRate * 100) + '%';
      bar.style.background = result.reachedTarget ? 'var(--green)' : (result.reachedBreakEven ? 'var(--blue)' : 'var(--amber)');
    }
    var status = document.getElementById('be-status');
    if (status) {
      status.textContent = result.reachedTarget ? 'Objetivo de rentabilidad alcanzado' : result.reachedBreakEven ? 'Gastos cubiertos; construyendo ganancia' : 'Todavía falta cubrir los gastos mensuales';
      status.style.color = result.reachedTarget ? 'var(--green)' : result.reachedBreakEven ? 'var(--blue)' : 'var(--amber)';
    }
    var health = document.getElementById('be-health-summary');
    var healthTitle = document.getElementById('be-health-title');
    var healthDetail = document.getElementById('be-health-detail');
    if (health && healthTitle && healthDetail) {
      var projectedShortfall = Math.max(0, result.requiredContribution - result.projectedContribution);
      if (result.projectedCoverageRate >= 1) {
        healthTitle.textContent = 'El negocio va bien al ritmo actual';
        healthDetail.textContent = 'La proyección cubre los gastos y la meta configurada. Resultado estimado: ' + (result.projectedResult < 0 ? '-' : '') + money(Math.abs(result.projectedResult)) + '.';
        healthTitle.style.color = 'var(--green)';
        health.style.borderColor = 'rgba(34,197,94,.35)';
      } else if (result.projectedContribution >= result.fixedCosts) {
        healthTitle.textContent = 'Los gastos se cubrirían, pero falta alcanzar la meta';
        healthDetail.textContent = 'Al ritmo actual la estructura queda cubierta. Faltan ' + money(projectedShortfall) + ' de contribución para la ganancia objetivo.';
        healthTitle.style.color = 'var(--blue)';
        health.style.borderColor = 'rgba(59,130,246,.35)';
      } else {
        healthTitle.textContent = 'Atención: el mes no alcanzaría a cubrir los gastos';
        healthDetail.textContent = 'Manteniendo el ritmo actual faltarían ' + money(projectedShortfall) + ' de contribución. Revisá la meta de ventas y visitas.';
        healthTitle.style.color = 'var(--red)';
        health.style.borderColor = 'rgba(239,68,68,.35)';
      }
    }
    var warning = document.getElementById('be-warning');
    if (warning) {
      var messages = [];
      if (result.contributionPerVisit <= 0) messages.push('El valor de la visita no supera su costo variable.');
      if (result.contributionMarginRate <= 0) messages.push('No existe margen comercial positivo para calcular ventas objetivo.');
      if (cfg.fixedMode === 'auto' && form.autoFixed <= 0) messages.push('Todavía no hay gastos operativos suficientes en el período; podés usar un valor manual.');
      warning.style.display = messages.length ? '' : 'none';
      warning.textContent = messages.join(' ');
    }
    var dashboard = document.getElementById('dash-rentabilidad-card');
    if (dashboard) {
      var dashboardSummary = document.getElementById('be-dashboard-summary');
      if (!dashboardSummary) {
        dashboardSummary = document.createElement('button');
        dashboardSummary.id = 'be-dashboard-summary';
        dashboardSummary.type = 'button';
        dashboardSummary.className = 'btn btn-sm';
        dashboardSummary.style.cssText = 'width:100%;margin-top:10px;justify-content:space-between;text-align:left';
        dashboardSummary.onclick = function () { if (typeof window.showPage === 'function') window.showPage('rentabilidad', document.querySelector('[onclick*=rentabilidad]')); };
        dashboard.appendChild(dashboardSummary);
      }
      dashboardSummary.innerHTML = '<span><i class="ti ti-target-arrow"></i> Punto de equilibrio</span><strong>' + Math.round(result.coverageRate * 100) + '% cubierto</strong>';
    }
  }

  function populate() {
    var config = readConfig();
    var values = {
      'be-fixed-mode': config.fixedMode, 'be-fixed-costs': config.fixedCosts,
      'be-visit-price': config.visitPrice, 'be-visit-variable': config.visitVariableCost,
      'be-planned-visits': config.plannedVisits, 'be-target-profit': config.targetProfit,
      'be-working-days': config.workingDays, 'be-margin-mode': config.marginMode,
      'be-margin-pct': config.marginPct
    };
    Object.keys(values).forEach(function (id) { var el = document.getElementById(id); if (el) el.value = values[id]; });
    var rentPage = document.getElementById('page-rentabilidad');
    var rentCard = document.getElementById('rent-break-even');
    if (rentPage && rentCard) {
      var periodToolbar = rentPage.firstElementChild;
      if (periodToolbar && periodToolbar.nextElementSibling !== rentCard) {
        rentPage.insertBefore(rentCard, periodToolbar.nextSibling);
      }
      var legacyMetrics = rentPage.querySelector('.rent-metrics');
      if (legacyMetrics) legacyMetrics.style.display = '';
      var executiveNumbers = document.getElementById('be-executive-numbers');
      if (legacyMetrics && executiveNumbers && legacyMetrics.nextElementSibling !== executiveNumbers) {
        rentPage.insertBefore(executiveNumbers, legacyMetrics.nextSibling);
      }
    }
    [rentCard, document.getElementById('be-config-panel')].forEach(function (panel) {
      if (!panel || panel.dataset.bound) return;
      panel.dataset.bound = '1';
      panel.addEventListener('input', render);
      panel.addEventListener('change', render);
    });
    if (!window.__sisventasBreakEvenCalcWrapped && typeof window.calcRentabilidad === 'function') {
      window.__sisventasBreakEvenCalcWrapped = true;
      var originalCalcRentabilidad = window.calcRentabilidad;
      window.calcRentabilidad = function () {
        var output = originalCalcRentabilidad.apply(this, arguments);
        setTimeout(render, 0);
        return output;
      };
    }
    render();
  }

  window.renderPuntoEquilibrio = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', populate);
  else populate();
  document.addEventListener('firebase-ready', function () { setTimeout(render, 300); });
})();
