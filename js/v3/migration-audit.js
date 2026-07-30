(function (root, factory) {
  var domain = typeof module === 'object' && module.exports
    ? require('./domain-store.js')
    : root.SisVentas.V3.DomainStore;
  var sales = typeof module === 'object' && module.exports
    ? require('./sales-read-model.js')
    : root.SisVentas.V3.SalesReadModel;
  var ot = typeof module === 'object' && module.exports
    ? require('./ot-read-model.js')
    : root.SisVentas.V3.OTReadModel;
  var journeys = typeof module === 'object' && module.exports
    ? require('./journey-audit.js')
    : root.SisVentas.V3.JourneyAudit;
  var productProviders = typeof module === 'object' && module.exports
    ? require('./product-provider-read-model.js')
    : root.SisVentas.V3.ProductProviderReadModel;
  var api = factory(domain, sales, ot, journeys, productProviders);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.MigrationAudit = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (domain, sales, ot, journeys, productProviders) {
  'use strict';

  function issue(kind, collection, record, resolution) {
    return Object.freeze({
      kind: kind,
      collection: collection,
      fbKey: String(record && record.fbKey || ''),
      businessId: String(record && (record.id || record.numero || record.nro || record.codigo) || ''),
      resolution: resolution || null
    });
  }

  function auditRelations(store, data) {
    var issues = [];
    function inspect(collection, records, resolver, relationName, optional) {
      (records || []).forEach(function (record) {
        var resolution = resolver.call(store, record);
        if (resolution.status === 'missing' && optional && !resolution.key) return;
        if (resolution.status !== 'found') {
          issues.push(issue(
            resolution.status === 'ambiguous' ? 'ambiguous-relation' : 'missing-relation',
            collection + '.' + relationName,
            record,
            resolution
          ));
        }
      });
    }

    inspect('presupuestos', data.presupuestos, store.resolveClient, 'cliente', false);
    inspect('ventas', data.ventas, store.resolveClient, 'cliente', false);
    inspect('ventas', data.ventas, store.resolveBudget, 'presupuesto', true);
    inspect('ordenesTrabajo', data.ordenesTrabajo, store.resolveSale, 'venta', true);
    inspect('ordenesTrabajo', data.ordenesTrabajo, store.resolveClient, 'cliente', false);
    return issues;
  }

  function summarizeIdentity(identityAudit) {
    var total = 0;
    Object.keys(identityAudit).forEach(function (collection) {
      var entry = identityAudit[collection];
      total += entry.technical.length;
      total += entry.business.length;
      total += entry.names.length;
      total += entry.missingTechnical.length;
    });
    return total;
  }

  function run(data, options) {
    data = data || {};
    var store = new domain.DomainStore(data);
    var identityAudit = store.audit();
    var relationIssues = auditRelations(store, data);
    var salesModel = new sales.SalesReadModel(data.ventas || [], data.pagos || []);
    var otModel = ot.createReadModel(data.ordenesTrabajo || [], options && options.today);
    var journeyAudit = journeys.run(data);
    var providerModel = new productProviders.ProductProviderReadModel(
      data.productos || [],
      data.proveedores || [],
      options
    );
    var productProviderAudit = providerModel.audit({
      selectedTypes: options && options.selectedProviderTypes
    });
    var salesAudit = salesModel.audit();
    var counts = {};
    Object.keys(store.collections).forEach(function (collection) {
      counts[collection] = store.collections[collection].length;
    });
    counts.pagos = Array.isArray(data.pagos) ? data.pagos.length : 0;
    counts.proveedores = Array.isArray(data.proveedores) ? data.proveedores.length : 0;

    return Object.freeze({
      generatedAt: new Date().toISOString(),
      counts: Object.freeze(counts),
      identity: identityAudit,
      relationIssues: Object.freeze(relationIssues),
      paymentIssues: Object.freeze(salesAudit.relations),
      otIssues: Object.freeze(otModel.conflicts),
      journeyIssues: journeyAudit.issues,
      journeys: journeyAudit,
      productProviders: productProviderAudit,
      productProviderIssues: productProviderAudit.issues,
      summary: Object.freeze({
        identityIssues: summarizeIdentity(identityAudit),
        relationIssues: relationIssues.length,
        paymentIssues: salesAudit.relations.length,
        otIssues: otModel.conflicts.length,
        journeyIssues: journeyAudit.issues.length,
        productProviderIssues: productProviderAudit.issues.length,
        productProviderBlockingIssues: productProviderAudit.blockingIssues.length,
        totalIssues: summarizeIdentity(identityAudit) +
          relationIssues.length +
          salesAudit.relations.length +
          otModel.conflicts.length +
          journeyAudit.issues.length +
          productProviderAudit.issues.length
      })
    });
  }

  return { run: run };
});
