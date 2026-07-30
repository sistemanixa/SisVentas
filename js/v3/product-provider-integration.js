(function (root, factory) {
  var common = typeof module === 'object' && module.exports;
  var products = common
    ? require('./product-provider-read-model.js')
    : root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.ProductProviderReadModel;
  var records = common
    ? require('./record-repository.js')
    : root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.RecordRepository;
  var firebase = common
    ? require('./firebase-record-adapter.js')
    : root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.FirebaseRecordAdapter;
  var api = factory(products, records, firebase);
  if (common) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3ProductProviders = api.create(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (products, records, firebase) {
  'use strict';

  function requireProducts() {
    if (!products || typeof products.ProductProviderReadModel !== 'function') {
      throw new Error('ProductProviderReadModel V3 no disponible');
    }
  }

  function model(productRows, providerRows, options) {
    requireProducts();
    return new products.ProductProviderReadModel(
      Array.isArray(productRows) ? productRows : [],
      Array.isArray(providerRows) ? providerRows : [],
      options || {}
    );
  }

  function sanitizeProduct(record) {
    requireProducts();
    var clean = Object.assign({}, record || {});
    if (!products.isLabor(clean)) return clean;
    clean.proveedores = [];
    ['proveedor', 'nom_prov', 'proveedorUrl', 'proveedorActualizado', 'urlProveedor', 'codWeb',
      'proveedorKey', 'proveedorFbKey'].forEach(function (field) { delete clean[field]; });
    return clean;
  }

  function legacyLinks(productRows, providerRows, options) {
    var links = model(productRows, providerRows, options).compatibleLinks(options || {});
    return Object.freeze(links.map(function (link) {
      return Object.freeze({
        producto: link.product,
        proveedor: link.provider,
        proveedorIdx: link.providerIndex,
        proveedorKey: link.providerFbKey,
        url: link.provider.url,
        tipo: link.type,
        vigente: link.current.current,
        vigencia: link.current
      });
    }));
  }

  function create(root) {
    var firebaseAdapter = records && firebase && typeof firebase.create === 'function'
      ? firebase.create(root)
      : null;
    var productRepository = firebaseAdapter && typeof records.RecordRepository === 'function'
      ? new records.RecordRepository({ collection: 'productos', adapter: firebaseAdapter })
      : null;
    var providerRepository = firebaseAdapter && typeof records.RecordRepository === 'function'
      ? new records.RecordRepository({ collection: 'proveedores', adapter: firebaseAdapter })
      : null;

    function requireRepository(repository, label) {
      if (!repository) throw new Error('El repositorio V3 de ' + label + ' no está disponible');
      return repository;
    }

    function save(repository, record, sanitizer) {
      var source = sanitizer ? sanitizer(record) : Object.assign({}, record || {});
      var key = String(source.fbKey || '').trim();
      if (!key) return repository.create(source);
      delete source.fbKey;
      return repository.update(key, source).then(function () {
        return Object.freeze(Object.assign({}, source, { fbKey: key }));
      });
    }

    function updateProduct(key, changes) {
      var current = Object.assign({}, changes || {});
      if (products.isLabor(current)) current = sanitizeProduct(current);
      return requireRepository(productRepository, 'productos').update(key, current);
    }

    function updateProducts(entries) {
      var normalized = (Array.isArray(entries) ? entries : []).map(function (entry) {
        var changes = Object.assign({}, entry && entry.changes || {});
        if (products.isLabor(changes)) changes = sanitizeProduct(changes);
        return { fbKey:entry && entry.fbKey, changes:changes };
      });
      if (firebaseAdapter && typeof firebaseAdapter.updateMany === 'function') {
        return firebaseAdapter.updateMany('productos', normalized);
      }
      return Promise.all(normalized.map(function (entry) {
        return updateProduct(entry.fbKey, entry.changes);
      }));
    }

    function updateProviders(entries) {
      var normalized = (Array.isArray(entries) ? entries : []).map(function (entry) {
        return { fbKey:entry && entry.fbKey, changes:Object.assign({}, entry && entry.changes || {}) };
      });
      if (firebaseAdapter && typeof firebaseAdapter.updateMany === 'function') {
        return firebaseAdapter.updateMany('proveedores', normalized);
      }
      return Promise.all(normalized.map(function (entry) {
        return requireRepository(providerRepository, 'proveedores').update(entry.fbKey, entry.changes);
      }));
    }

    function refreshVisibleProducts() {
      if (!root.document) return;
      [
        root.actualizarVigenciaPreciosDashboard,
        root.renderModuloActualizadorPrecios,
        root.renderTablaProductos
      ].forEach(function (renderer) {
        if (typeof renderer !== 'function') return;
        try { renderer.call(root); }
        catch (error) {
          if (root.console && typeof root.console.warn === 'function') {
            root.console.warn('[V3 productos] No se pudo refrescar una vista secundaria:', error);
          }
        }
      });
    }

    var adapter = Object.freeze({
      model: model,
      links: legacyLinks,
      summary: function (productRows, providerRows, options) { return model(productRows, providerRows, options).summary(options || {}); },
      audit: function (productRows, providerRows, options) { return model(productRows, providerRows, options).audit(options || {}); },
      isLabor: function (product) { requireProducts(); return products.isLabor(product); },
      freshness: function (product, provider, options) { requireProducts(); return products.freshness(product, provider, options); },
      normalizeUrl: function (value) { requireProducts(); return products.normalizeUrl(value); },
      saveProduct: function (record) { return save(requireRepository(productRepository, 'productos'), record, sanitizeProduct); },
      updateProduct: updateProduct,
      updateProducts: updateProducts,
      removeProduct: function (key) { return requireRepository(productRepository, 'productos').remove(key); },
      saveProvider: function (record) { return save(requireRepository(providerRepository, 'proveedores'), record); },
      updateProvider: function (key, changes) { return requireRepository(providerRepository, 'proveedores').update(key, changes); },
      updateProviders: updateProviders,
      removeProvider: function (key) { return requireRepository(providerRepository, 'proveedores').remove(key); },
      onActivate: refreshVisibleProducts,
      onDeactivate: refreshVisibleProducts
    });
    var bridge = root.SisVentas && root.SisVentas.V3Bridge;
    if (bridge && typeof bridge.register === 'function' && !bridge.adapter('productosProveedores')) {
      bridge.register('productosProveedores', adapter);
    }
    return adapter;
  }

  return { create: create, model: model, sanitizeProduct: sanitizeProduct, legacyLinks: legacyLinks };
});
