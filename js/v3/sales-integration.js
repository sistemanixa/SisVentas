(function (root, factory) {
  var common = typeof module === 'object' && module.exports;
  var sales = common
    ? require('./sales-read-model.js')
    : root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.SalesReadModel;
  var records = common
    ? require('./record-repository.js')
    : root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.RecordRepository;
  var firebase = common
    ? require('./firebase-record-adapter.js')
    : root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.FirebaseRecordAdapter;
  var api = factory(sales, records, firebase);
  if (common) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3Sales = api.create(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (sales, records, firebase) {
  'use strict';

  function requireSales() {
    if (!sales || typeof sales.SalesReadModel !== 'function') {
      throw new Error('SalesReadModel V3 no disponible');
    }
  }

  function model(saleRecords, payments) {
    requireSales();
    return new sales.SalesReadModel(
      Array.isArray(saleRecords) ? saleRecords : [],
      Array.isArray(payments) ? payments : []
    );
  }

  function summary(saleRecords, payments, reference) {
    return model(saleRecords, payments).summaryFor(reference);
  }

  function validateSale(payload, context) {
    var errors = [];
    var operation = context && context.operation || '';
    if (operation === 'create') {
      var clientKey = String(payload && (payload.clienteFbKey || payload.clienteKey) || '').trim();
      if (!clientKey) errors.push('La venta requiere la clave técnica del cliente');
    }
    if (operation === 'create' || payload && Object.prototype.hasOwnProperty.call(payload, 'items')) {
      var economic = sales.saleEconomic(payload || {});
      if (economic.mode !== 'items') errors.push('La venta requiere al menos un ítem');
      if (economic.conflicts.length) errors.push('Los importes de la venta no coinciden con sus ítems');
    }
    return errors;
  }

  function validatePayment(payload, context) {
    if (!context || context.operation !== 'create') return [];
    var errors = [];
    var saleKey = String(payload && (payload.ventaFbKey || payload.ventaKey) || '').trim();
    if (!saleKey) errors.push('El pago requiere la clave técnica de la venta');
    if (!(sales.paymentAmount(payload || {}) > 0)) errors.push('El pago requiere un monto mayor a cero');
    return errors;
  }

  function save(repository, record) {
    var source = Object.assign({}, record || {});
    var key = String(source.fbKey || '').trim();
    if (!key) return repository.create(source);
    delete source.fbKey;
    return repository.update(key, source).then(function () {
      return Object.freeze(Object.assign({}, source, { fbKey: key }));
    });
  }

  function create(root) {
    var firebaseAdapter = records && firebase && typeof firebase.create === 'function'
      ? firebase.create(root)
      : null;
    var saleRepository = firebaseAdapter && typeof records.RecordRepository === 'function'
      ? new records.RecordRepository({ collection: 'ventas', adapter: firebaseAdapter, validate: validateSale })
      : null;
    var paymentRepository = firebaseAdapter && typeof records.RecordRepository === 'function'
      ? new records.RecordRepository({ collection: 'pagos', adapter: firebaseAdapter, validate: validatePayment })
      : null;

    function requireRepository(repository, label) {
      if (!repository) throw new Error('El repositorio V3 de ' + label + ' no está disponible');
      return repository;
    }

    function refreshVisibleSales() {
      if (!root.document) return;
      if (typeof root.renderVentas === 'function') root.renderVentas();
      if (typeof root.renderCob === 'function') root.renderCob();
      if (typeof root.renderKPIsDashboard === 'function') root.renderKPIsDashboard();
    }

    var adapter = Object.freeze({
      model: model,
      summary: summary,
      total: function (sale) { requireSales(); return sales.saleTotal(sale || {}); },
      economic: function (sale) { requireSales(); return sales.saleEconomic(sale || {}); },
      paymentAmount: function (payment) { requireSales(); return sales.paymentAmount(payment || {}); },
      saveSale: function (record) { return save(requireRepository(saleRepository, 'ventas'), record); },
      updateSale: function (key, changes) { return requireRepository(saleRepository, 'ventas').update(key, changes); },
      removeSale: function (key) { return requireRepository(saleRepository, 'ventas').remove(key); },
      listSales: function () { return requireRepository(saleRepository, 'ventas').list(); },
      savePayment: function (record) { return save(requireRepository(paymentRepository, 'pagos'), record); },
      updatePayment: function (key, changes) { return requireRepository(paymentRepository, 'pagos').update(key, changes); },
      removePayment: function (key) { return requireRepository(paymentRepository, 'pagos').remove(key); },
      listPayments: function () { return requireRepository(paymentRepository, 'pagos').list(); },
      onActivate: refreshVisibleSales,
      onDeactivate: refreshVisibleSales
    });
    var bridge = root.SisVentas && root.SisVentas.V3Bridge;
    if (bridge && typeof bridge.register === 'function' && !bridge.adapter('ventasPagos')) {
      bridge.register('ventasPagos', adapter);
    }
    return adapter;
  }

  return {
    create: create,
    model: model,
    summary: summary,
    validateSale: validateSale,
    validatePayment: validatePayment
  };
});
