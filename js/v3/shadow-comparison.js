(function (root, factory) {
  var sales = typeof module === 'object' && module.exports
    ? require('./sales-read-model.js')
    : root.SisVentas.V3.SalesReadModel;
  var ot = typeof module === 'object' && module.exports
    ? require('./ot-read-model.js')
    : root.SisVentas.V3.OTReadModel;
  var api = factory(sales, ot);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.ShadowComparison = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (sales, ot) {
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

  return {
    difference: difference,
    compareOT: compareOT,
    compareSales: compareSales
  };
});
