(function (root, factory) {
  var identity = typeof module === 'object' && module.exports
    ? require('./identity-index.js')
    : root.SisVentas.V3.Identity;
  var api = factory(identity);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.RecordRepository = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (identity) {
  'use strict';

  function requiredAdapter(adapter) {
    ['list', 'createKey', 'set', 'update', 'remove'].forEach(function (method) {
      if (!adapter || typeof adapter[method] !== 'function') {
        throw new TypeError('El adaptador del repositorio requiere ' + method + '()');
      }
    });
    return adapter;
  }

  function cleanKey(value) {
    var key = identity.text(value);
    if (!key) throw new Error('La operación requiere una clave técnica interna');
    if (/[.#$/[\]]/.test(key)) throw new Error('La clave técnica contiene caracteres inválidos');
    return key;
  }

  function freezeCopy(record) {
    return Object.freeze(Object.assign({}, record));
  }

  function RecordRepository(options) {
    options = options || {};
    this.collection = identity.text(options.collection);
    if (!this.collection) throw new Error('El repositorio requiere una colección');
    this.adapter = requiredAdapter(options.adapter);
    this.validate = typeof options.validate === 'function' ? options.validate : function () { return []; };
  }

  RecordRepository.prototype.list = function () {
    return Promise.resolve(this.adapter.list(this.collection)).then(function (records) {
      return (Array.isArray(records) ? records : []).map(freezeCopy);
    });
  };

  RecordRepository.prototype.create = function (data) {
    var self = this;
    var payload = Object.assign({}, data || {});
    delete payload.fbKey;
    var errors = this.validate(payload, { operation: 'create' }) || [];
    if (errors.length) return Promise.reject(new Error(errors.join('; ')));

    return Promise.resolve(this.adapter.createKey(this.collection)).then(function (generatedKey) {
      var fbKey = cleanKey(generatedKey);
      var stored = Object.assign({}, payload, { fbKey: fbKey });
      return Promise.resolve(self.adapter.set(self.collection, fbKey, stored)).then(function () {
        return freezeCopy(stored);
      });
    });
  };

  RecordRepository.prototype.update = function (recordOrKey, changes) {
    var key = cleanKey(typeof recordOrKey === 'object' && recordOrKey
      ? recordOrKey.fbKey
      : recordOrKey);
    var payload = Object.assign({}, changes || {});
    if (Object.prototype.hasOwnProperty.call(payload, 'fbKey') && cleanKey(payload.fbKey) !== key) {
      return Promise.reject(new Error('La clave técnica es inmutable'));
    }
    delete payload.fbKey;
    var errors = this.validate(payload, { operation: 'update', fbKey: key }) || [];
    if (errors.length) return Promise.reject(new Error(errors.join('; ')));
    return Promise.resolve(this.adapter.update(this.collection, key, payload)).then(function () {
      return Object.freeze({ fbKey: key, changes: freezeCopy(payload) });
    });
  };

  RecordRepository.prototype.remove = function (recordOrKey) {
    var key = cleanKey(typeof recordOrKey === 'object' && recordOrKey
      ? recordOrKey.fbKey
      : recordOrKey);
    return Promise.resolve(this.adapter.remove(this.collection, key)).then(function () {
      return Object.freeze({ fbKey: key, removed: true });
    });
  };

  return {
    RecordRepository: RecordRepository,
    cleanKey: cleanKey
  };
});
