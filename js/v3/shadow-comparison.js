(function (root, factory) {
  var budgets = typeof module === 'object' && module.exports
    ? require('./budget-read-model.js')
    : root.SisVentas.V3.BudgetReadModel;
  var sales = typeof module === 'object' && module.exports
    ? require('./sales-read-model.js')
    : root.SisVentas.V3.SalesReadModel;
  var ot = typeof module === 'object' && module.exports
    ? require('./ot-read-model.js')
    : root.SisVentas.V3.OTReadModel;
  var api = factory(budgets, sales, ot);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.ShadowComparison = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (budgets, sales, ot) {
  'use strict';

  function number(value) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function difference(name, legacy, next) {
    var before = number(legacy);
    var after = number(next);
    return Object.freeze({
      name: name,
      legacy: before,
      next: after,
      delta: after - before,
      equal: Math.abs(after - before) < 0.005
    });
  }

  function compareOT(records, today, legacyMetrics) {
    var model = ot.createReadModel(records, today);
    var expected = legacyMetrics || {};
    var differences = [
      difference('open', expected.open, model.metrics.open),
      difference('today', expected.today, model.metrics.today),
      difference('completed', expected.completed, model.metrics.completed)
    ];
    return Object.freeze({
      ready: model.conflicts.length === 0 && differences.every(function (entry) { return entry.equal; }),
      differences: Object.freeze(differences),
      conflicts: Object.freeze(model.conflicts.slice()),
      next: model
    });
  }

  function compareSales(saleRecords, payments, legacySummaries) {
    var model = new sales.SalesReadModel(saleRecords, payments);
    var comparisons = [];
    (Array.isArray(legacySummaries) ? legacySummaries : []).forEach(function (legacy) {
      var summary = model.summaryFor(legacy.fbKey || legacy.reference || '');
      comparisons.push(Object.freeze({
        fbKey: String(legacy.fbKey || ''),
        status: summary.status,
        total: difference('total', legacy.total, summary.total),
        paid: difference('paid', legacy.paid, summary.paid),
        balance: difference('balance', legacy.balance, summary.balance)
      }));
    });
    var allEqual = comparisons.every(function (entry) {
      return entry.status === 'found' && entry.total.equal && entry.paid.equal && entry.balance.equal;
    });
    return Object.freeze({
      ready: model.conflicts.length === 0 && allEqual,
      comparisons: Object.freeze(comparisons),
      conflicts: Object.freeze(model.conflicts.slice()),
      next: model
    });
  }

  function compareBudgets(records, legacySummaries) {
    var summaries = new Map();
    (Array.isArray(legacySummaries) ? legacySummaries : []).forEach(function (summary) {
      summaries.set(String(summary && summary.fbKey || ''), summary || {});
    });
    var comparisons = [];
    var conflicts = [];
    (Array.isArray(records) ? records : []).forEach(function (record) {
      var model = budgets.build(record || {});
      var fbKey = String(record && record.fbKey || '');
      var legacy = summaries.get(fbKey) || record || {};
      var entry = Object.freeze({
        fbKey: fbKey,
        mode: model.mode,
        subtotal: difference('subtotal', legacy.subtotal, model.subtotal),
        discount: difference('discount', legacy.descuentoAmt, model.generalDiscount),
        iva: difference('iva', legacy.iva, model.iva),
        total: difference('total', legacy.total, model.total),
        conflicts: model.conflicts
      });
      comparisons.push(entry);
      if (!fbKey) conflicts.push(Object.freeze({ kind: 'budget-without-technical-key', record: record }));
      Array.prototype.push.apply(conflicts, model.conflicts);
    });
    var allEqual = comparisons.every(function (entry) {
      return entry.mode === 'items' &&
        entry.subtotal.equal && entry.discount.equal && entry.iva.equal && entry.total.equal &&
        entry.conflicts.length === 0;
    });
    return Object.freeze({
      ready: comparisons.length > 0 && conflicts.length === 0 && allEqual,
      comparisons: Object.freeze(comparisons),
      conflicts: Object.freeze(conflicts)
    });
  }

  return {
    difference: difference,
    compareBudgets: compareBudgets,
    compareOT: compareOT,
    compareSales: compareSales
  };
});
