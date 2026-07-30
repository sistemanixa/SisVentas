(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.FirebaseRecordAdapter = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PATHS = Object.freeze({
    presupuestos: 'sisventas/presupuestos',
    ventas: 'sisventas/ventas',
    pagos: 'sisventas/pagos',
    ordenesTrabajo: 'sisventas/ordenes_trabajo',
    productos: 'sisventas/productos',
    proveedores: 'sisventas/proveedores'
  });

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function cleanKey(value) {
    var key = text(value);
    if (!key) throw new Error('La operación requiere una clave técnica interna');
    if (/[.#$/[\]]/.test(key)) throw new Error('La clave técnica contiene caracteres inválidos');
    return key;
  }

  function collectionPath(name) {
    var collection = text(name);
    if (!Object.prototype.hasOwnProperty.call(PATHS, collection)) {
      throw new Error('Colección V3 no autorizada: ' + collection);
    }
    return PATHS[collection];
  }

  function relativePath(value) {
    var path = text(value);
    if (!path) throw new Error('La actualización requiere un campo');
    return path.split('/').map(cleanKey).join('/');
  }

  function create(root) {
    function requireFirebase(methods) {
      if (!root.fbDB || typeof root.fbRef !== 'function') throw new Error('Firebase no está disponible');
      (methods || []).forEach(function (method) {
        if (typeof root[method] !== 'function') throw new Error(method + ' no está disponible');
      });
    }

    function reference(collection, key) {
      var path = collectionPath(collection);
      if (key != null) path += '/' + cleanKey(key);
      return root.fbRef(root.fbDB, path);
    }

    function list(collection) {
      requireFirebase(['fbGet']);
      return Promise.resolve(root.fbGet(reference(collection))).then(function (snapshot) {
        var data = snapshot && typeof snapshot.val === 'function' ? snapshot.val() : null;
        return Object.keys(data || {}).map(function (key) {
          var record = data[key];
          return Object.assign({}, record && typeof record === 'object' ? record : { value: record }, { fbKey: key });
        });
      });
    }

    function createKey(collection) {
      requireFirebase(['fbPush']);
      var generated = root.fbPush(reference(collection));
      return cleanKey(generated && generated.key);
    }

    function set(collection, key, value) {
      requireFirebase(['fbSet']);
      return root.fbSet(reference(collection, key), Object.assign({}, value || {}, { fbKey: cleanKey(key) }));
    }

    function update(collection, key, changes) {
      requireFirebase(['fbUpdate']);
      var payload = Object.assign({}, changes || {});
      delete payload.fbKey;
      return root.fbUpdate(reference(collection, key), payload);
    }

    function updateMany(collection, entries) {
      requireFirebase(['fbUpdate']);
      var payload = {};
      var normalized = (Array.isArray(entries) ? entries : []).map(function (entry) {
        var key = cleanKey(entry && entry.fbKey);
        var changes = Object.assign({}, entry && entry.changes || {});
        if (Object.prototype.hasOwnProperty.call(changes, 'fbKey') && cleanKey(changes.fbKey) !== key) {
          throw new Error('La clave técnica es inmutable');
        }
        delete changes.fbKey;
        Object.keys(changes).forEach(function (field) {
          payload[key + '/' + relativePath(field)] = changes[field];
        });
        return Object.freeze({ fbKey:key, changes:Object.freeze(changes) });
      });
      if (!Object.keys(payload).length) return Promise.resolve(Object.freeze(normalized));
      return Promise.resolve(root.fbUpdate(reference(collection), payload)).then(function () {
        return Object.freeze(normalized);
      });
    }

    function remove(collection, key) {
      requireFirebase(['fbRemove']);
      return root.fbRemove(reference(collection, key));
    }

    return Object.freeze({
      list: list,
      createKey: createKey,
      set: set,
      update: update,
      updateMany: updateMany,
      remove: remove
    });
  }

  return {
    create: create,
    cleanKey: cleanKey,
    relativePath: relativePath,
    collectionPath: collectionPath,
    paths: PATHS
  };
});
