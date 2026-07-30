(function (root, factory) {
  var common = typeof module === 'object' && module.exports;
  var budget = common
    ? require('./budget-read-model.js')
    : root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.BudgetReadModel;
  var records = common
    ? require('./record-repository.js')
    : root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.RecordRepository;
  var firebase = common
    ? require('./firebase-record-adapter.js')
    : root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.FirebaseRecordAdapter;
  var api = factory(budget, records, firebase);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3Budget = api.create(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (budget, records, firebase) {
  'use strict';

  function assertBudget() {
    if (!budget || typeof budget.build !== 'function') throw new Error('BudgetReadModel V3 no disponible');
  }

  function toLegacyItem(item) {
    var source = item && item.source || {};
    return Object.assign({}, source, {
      cod: item.code,
      desc: item.description,
      qty: item.quantity,
      punit: item.unitNet,
      disc: item.discountPct,
      sub: item.net,
      pid: source.pid || source.productoFbKey || source.productoKey || '',
      productoFbKey: source.productoFbKey || source.pid || source.productoKey || ''
    });
  }

  function build(record, options) {
    assertBudget();
    return budget.build(record || {}, options);
  }

  function form(items, discountPct, includesIva, ivaRate) {
    return build({
      items: Array.isArray(items) ? items : [],
      descuentoGeneral: discountPct,
      conIva: includesIva !== false,
      ivaPct: ivaRate == null ? 21 : ivaRate
    });
  }

  function fields(record, options) {
    var model = build(record || {}, options);
    return Object.freeze(Object.assign({}, budget.legacyFields(model), {
      items: Object.freeze(model.items.map(toLegacyItem))
    }));
  }

  function tableTotal(record) {
    var model = build(record || {});
    if (model.mode === 'items') return model.total;
    return budget.parseNumber(record && (record.total || record.totalPresupuesto || record.importeTotal));
  }

  function printModel(record) {
    var model = build(record || {});
    return Object.freeze({
      ready: model.mode === 'items' && model.conflicts.length === 0,
      mode: model.mode,
      number: model.number,
      client: model.client,
      items: Object.freeze(model.items.map(toLegacyItem)),
      subtotal: model.subtotal,
      discount: model.generalDiscount,
      iva: model.iva,
      total: model.total,
      includesIva: model.includesIva,
      conflicts: model.conflicts
    });
  }

  function toSale(record) {
    var model = build(record || {});
    return Object.freeze({
      ready: model.mode === 'items' && model.conflicts.length === 0,
      items: Object.freeze(model.items.map(toLegacyItem)),
      discountPct: model.generalDiscountPct,
      discountAmount: budget.roundMoney(model.lineDiscount + model.generalDiscount),
      subtotalNet: model.taxableBase,
      iva: model.iva,
      includesIva: model.includesIva,
      total: model.total,
      conflicts: model.conflicts
    });
  }

  function validateBudget(payload, context) {
    var errors = [];
    var operation = context && context.operation || '';
    if (operation === 'create') {
      var clientKey = String(payload && (payload.clienteFbKey || payload.clienteKey) || '').trim();
      if (!clientKey) errors.push('El presupuesto requiere la clave técnica del cliente');
    }
    if (operation === 'create' || payload && Object.prototype.hasOwnProperty.call(payload, 'items')) {
      var model = build(payload || {});
      if (model.mode !== 'items') errors.push('El presupuesto requiere al menos un ítem');
      if (model.conflicts.length) errors.push('Los importes del presupuesto no coinciden con sus ítems');
    }
    return errors;
  }

  function create(root) {
    var repository = records && firebase && typeof records.RecordRepository === 'function' && typeof firebase.create === 'function'
      ? new records.RecordRepository({
          collection: 'presupuestos',
          adapter: firebase.create(root),
          validate: validateBudget
        })
      : null;

    function requireRepository() {
      if (!repository) throw new Error('El repositorio V3 de presupuestos no está disponible');
      return repository;
    }

    function save(record) {
      var source = Object.assign({}, record || {});
      var key = String(source.fbKey || '').trim();
      if (key) {
        delete source.fbKey;
        return requireRepository().update(key, source).then(function () {
          return Object.freeze(Object.assign({}, source, { fbKey: key }));
        });
      }
      return requireRepository().create(source);
    }

    function update(key, changes) {
      return requireRepository().update(key, changes);
    }

    function remove(key) {
      return requireRepository().remove(key);
    }

    function refreshVisibleBudget() {
      if (!root.document) return;
      var form = root.document.getElementById('ppto-form-view');
      var detail = root.document.getElementById('ppto-detalle-view');
      if (form && form.style.display !== 'none' && typeof root.calcPpTotales === 'function') {
        root.calcPpTotales();
      } else if (detail && detail.style.display !== 'none' && root.pptoActualId && typeof root.verPpto === 'function') {
        root.verPpto(root.pptoActualId);
      } else if (typeof root.renderPptoTabla === 'function') {
        root.renderPptoTabla();
      }
    }
    var adapter = Object.freeze({
      build: build,
      form: form,
      fields: fields,
      tableTotal: tableTotal,
      printModel: printModel,
      toSale: toSale,
      save: save,
      update: update,
      remove: remove,
      list: function () { return requireRepository().list(); },
      onActivate: function () {
        refreshVisibleBudget();
        if (root.document && typeof root.document.dispatchEvent === 'function' && root.CustomEvent) {
          root.document.dispatchEvent(new root.CustomEvent('sisventas:v3-budget-active'));
        }
      },
      onDeactivate: function () {
        refreshVisibleBudget();
        if (root.document && typeof root.document.dispatchEvent === 'function' && root.CustomEvent) {
          root.document.dispatchEvent(new root.CustomEvent('sisventas:v3-budget-inactive'));
        }
      }
    });
    var bridge = root.SisVentas && root.SisVentas.V3Bridge;
    if (bridge && typeof bridge.register === 'function' && !bridge.adapter('presupuestos')) {
      bridge.register('presupuestos', adapter);
    }
    return adapter;
  }

  return {
    create: create,
    build: build,
    form: form,
    fields: fields,
    tableTotal: tableTotal,
    printModel: printModel,
    toSale: toSale,
    toLegacyItem: toLegacyItem
  };
});
