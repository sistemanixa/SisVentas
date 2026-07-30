(function (root, factory) {
  var common = typeof module === 'object' && module.exports;
  var ot = common
    ? require('./ot-read-model.js')
    : root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.OTReadModel;
  var records = common
    ? require('./record-repository.js')
    : root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.RecordRepository;
  var firebase = common
    ? require('./firebase-record-adapter.js')
    : root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.FirebaseRecordAdapter;
  var attachments = common
    ? require('./attachment-task.js')
    : root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.AttachmentTask;
  var api = factory(ot, records, firebase, attachments);
  if (common) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3OT = api.create(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ot, records, firebase, attachments) {
  'use strict';

  function requireOT() {
    if (!ot || typeof ot.createReadModel !== 'function') throw new Error('OTReadModel V3 no disponible');
  }

  function model(rows, today) {
    requireOT();
    return ot.createReadModel(Array.isArray(rows) ? rows : [], today);
  }

  function validateOT(payload, context) {
    if (!context || context.operation !== 'create') return [];
    var errors = [];
    var clientKey = String(payload && (payload.clienteFbKey || payload.clienteKey) || '').trim();
    if (!clientKey) errors.push('La orden de trabajo requiere la clave técnica del cliente');
    return errors;
  }

  function create(root) {
    var firebaseAdapter = records && firebase && typeof firebase.create === 'function'
      ? firebase.create(root)
      : null;
    var repository = firebaseAdapter && typeof records.RecordRepository === 'function'
      ? new records.RecordRepository({ collection: 'ordenesTrabajo', adapter: firebaseAdapter, validate: validateOT })
      : null;
    var activeTasks = new Set();

    function requireRepository() {
      if (!repository) throw new Error('El repositorio V3 de órdenes de trabajo no está disponible');
      return repository;
    }

    function save(record) {
      var source = Object.assign({}, record || {});
      var key = String(source.fbKey || '').trim();
      if (!key) return requireRepository().create(source);
      delete source.fbKey;
      return requireRepository().update(key, source).then(function () {
        return Object.freeze(Object.assign({}, source, { fbKey: key }));
      });
    }

    function createAttachmentTask(options) {
      if (!attachments || typeof attachments.AttachmentTask !== 'function') {
        throw new Error('AttachmentTask V3 no disponible');
      }
      options = Object.assign({}, options || {}, { ownerCollection: 'ordenesTrabajo' });
      var userChange = options.onChange;
      var task;
      options.onChange = function (snapshot) {
        if (snapshot && ['completed', 'failed', 'cancelled'].indexOf(snapshot.state) >= 0) {
          activeTasks.delete(task);
        }
        if (typeof userChange === 'function') userChange(snapshot);
      };
      task = new attachments.AttachmentTask(options);
      activeTasks.add(task);
      return task;
    }

    function cancelAttachments(reason) {
      var cancelled = 0;
      Array.from(activeTasks).forEach(function (task) {
        if (task.cancel(reason || 'La sesión terminó')) cancelled += 1;
      });
      activeTasks.clear();
      return cancelled;
    }

    function refreshVisibleOT() {
      if (!root.document) return;
      if (typeof root.renderOTTabla === 'function') root.renderOTTabla();
      if (typeof root.agActualizarMetricas === 'function') root.agActualizarMetricas();
    }

    var adapter = Object.freeze({
      model: model,
      save: save,
      update: function (key, changes) { return requireRepository().update(key, changes); },
      remove: function (key) { return requireRepository().remove(key); },
      list: function () { return requireRepository().list(); },
      createAttachmentTask: createAttachmentTask,
      cancelAttachments: cancelAttachments,
      activeAttachmentCount: function () { return activeTasks.size; },
      onActivate: refreshVisibleOT,
      onDeactivate: function () { cancelAttachments('Se volvió al modo estable v2'); refreshVisibleOT(); }
    });
    var bridge = root.SisVentas && root.SisVentas.V3Bridge;
    if (bridge && typeof bridge.register === 'function' && !bridge.adapter('ordenesTrabajo')) {
      bridge.register('ordenesTrabajo', adapter);
    }
    if (root.document && typeof root.document.addEventListener === 'function') {
      root.document.addEventListener('sisventas:session-ended', function () {
        cancelAttachments('La sesión terminó');
      });
    }
    return adapter;
  }

  return { create: create, model: model, validateOT: validateOT };
});
