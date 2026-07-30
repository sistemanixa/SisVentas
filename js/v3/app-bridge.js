(function (root, factory) {
  var dependencies = typeof module === 'object' && module.exports
    ? {
        BudgetReadModel: require('./budget-read-model.js'),
        SalesReadModel: require('./sales-read-model.js'),
        OTReadModel: require('./ot-read-model.js'),
        ProductProviderReadModel: require('./product-provider-read-model.js')
      }
    : {
        BudgetReadModel: root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.BudgetReadModel,
        SalesReadModel: root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.SalesReadModel,
        OTReadModel: root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.OTReadModel,
        ProductProviderReadModel: root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.ProductProviderReadModel
      };
  var api = factory(dependencies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3Bridge = api.create(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dependencies) {
  'use strict';

  var MODULES = Object.freeze([
    'presupuestos',
    'ventasPagos',
    'ordenesTrabajo',
    'productosProveedores'
  ]);

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function assertModule(name) {
    var moduleName = text(name);
    if (MODULES.indexOf(moduleName) < 0) throw new Error('Módulo V3 desconocido: ' + moduleName);
    return moduleName;
  }

  function create(root, options) {
    options = options || {};
    var adapters = new Map();
    var active = new Set();

    function runtime() {
      return options.runtime || root.SisVentas && root.SisVentas.V3Shadow || null;
    }

    function emit(name, detail) {
      if (!root.document || typeof root.document.dispatchEvent !== 'function') return;
      var EventType = root.CustomEvent || (typeof CustomEvent === 'function' ? CustomEvent : null);
      if (!EventType) return;
      root.document.dispatchEvent(new EventType(name, { detail: detail }));
    }

    function emitLifecycleError(moduleName, phase, error) {
      emit('sisventas:v3-bridge-error', {
        module: moduleName,
        phase: phase,
        message: error && error.message || String(error)
      });
    }

    function gateDecision(moduleName) {
      var service = runtime();
      var activation = service && typeof service.activationStatus === 'function'
        ? service.activationStatus()
        : null;
      var decision = activation && activation.modules && activation.modules[moduleName];
      return decision || { module: moduleName, active: false, eligible: false, reason: 'missing-shadow-report' };
    }

    function status(name) {
      var moduleName = assertModule(name);
      var decision = gateDecision(moduleName);
      return Object.freeze({
        module: moduleName,
        wired: adapters.has(moduleName),
        eligible: decision.eligible === true,
        active: active.has(moduleName) && decision.active === true && adapters.has(moduleName),
        reason: !adapters.has(moduleName) ? 'not-wired' : decision.reason
      });
    }

    function snapshot() {
      var modules = {};
      MODULES.forEach(function (name) { modules[name] = status(name); });
      return Object.freeze({ modules: Object.freeze(modules) });
    }

    function register(name, adapter) {
      var moduleName = assertModule(name);
      if (!adapter || typeof adapter !== 'object') throw new Error('El adaptador V3 debe ser un objeto');
      if (adapters.has(moduleName)) throw new Error('El módulo V3 ya está conectado: ' + moduleName);
      adapters.set(moduleName, adapter);
      emit('sisventas:v3-bridge-change', snapshot());
      return status(moduleName);
    }

    function activate(name) {
      var moduleName = assertModule(name);
      var adapter = adapters.get(moduleName);
      if (!adapter) return status(moduleName);
      var service = runtime();
      if (!service || typeof service.activate !== 'function') return status(moduleName);
      var decision = service.activate(moduleName);
      if (!decision || decision.active !== true) return status(moduleName);
      active.add(moduleName);
      if (typeof adapter.onActivate === 'function') {
        try { adapter.onActivate(); }
        catch (error) {
          active.delete(moduleName);
          if (service && typeof service.deactivate === 'function') service.deactivate(moduleName);
          emitLifecycleError(moduleName, 'activate', error);
        }
      }
      var next = status(moduleName);
      emit('sisventas:v3-bridge-change', snapshot());
      return next;
    }

    function deactivate(name) {
      var moduleName = assertModule(name);
      var adapter = adapters.get(moduleName);
      var wasActive = active.has(moduleName);
      active.delete(moduleName);
      var service = runtime();
      if (service && typeof service.deactivate === 'function') service.deactivate(moduleName);
      if (adapter && wasActive && typeof adapter.onDeactivate === 'function') {
        try { adapter.onDeactivate(); }
        catch (error) { emitLifecycleError(moduleName, 'deactivate', error); }
      }
      emit('sisventas:v3-bridge-change', snapshot());
      return status(moduleName);
    }

    function rollback() {
      var previouslyActive = Array.from(active);
      active.clear();
      var service = runtime();
      if (service && typeof service.rollback === 'function') service.rollback();
      previouslyActive.forEach(function (moduleName) {
        var adapter = adapters.get(moduleName);
        if (adapter && typeof adapter.onDeactivate === 'function') {
          try { adapter.onDeactivate(); }
          catch (error) { emitLifecycleError(moduleName, 'rollback', error); }
        }
      });
      var next = snapshot();
      emit('sisventas:v3-bridge-change', next);
      return next;
    }

    function adapter(name) {
      return adapters.get(assertModule(name)) || null;
    }

    function invoke(name, method, args, fallback) {
      var moduleName = assertModule(name);
      var service = adapters.get(moduleName);
      if (status(moduleName).active && service && typeof service[method] === 'function') {
        return service[method].apply(service, Array.isArray(args) ? args : []);
      }
      if (typeof fallback === 'function') return fallback();
      return fallback;
    }

    function canonicalBudget(record, options) {
      if (!dependencies.BudgetReadModel || typeof dependencies.BudgetReadModel.build !== 'function') {
        throw new Error('BudgetReadModel V3 no disponible');
      }
      return dependencies.BudgetReadModel.build(record || {}, options);
    }

    function canonicalSales(records, payments) {
      if (!dependencies.SalesReadModel || typeof dependencies.SalesReadModel.SalesReadModel !== 'function') {
        throw new Error('SalesReadModel V3 no disponible');
      }
      return new dependencies.SalesReadModel.SalesReadModel(records || [], payments || []);
    }

    function canonicalOT(records, today) {
      if (!dependencies.OTReadModel || typeof dependencies.OTReadModel.createReadModel !== 'function') {
        throw new Error('OTReadModel V3 no disponible');
      }
      return dependencies.OTReadModel.createReadModel(records || [], today);
    }

    function canonicalProductProviders(products, providers, modelOptions) {
      var Constructor = dependencies.ProductProviderReadModel &&
        dependencies.ProductProviderReadModel.ProductProviderReadModel;
      if (typeof Constructor !== 'function') throw new Error('ProductProviderReadModel V3 no disponible');
      return new Constructor(products || [], providers || [], modelOptions);
    }

    if (root.document && typeof root.document.addEventListener === 'function') {
      root.document.addEventListener('sisventas:session-ended', function () {
        rollback();
      });
    }

    return Object.freeze({
      register: register,
      adapter: adapter,
      activate: activate,
      deactivate: deactivate,
      rollback: rollback,
      status: status,
      snapshot: snapshot,
      invoke: invoke,
      canonical: Object.freeze({
        budget: canonicalBudget,
        sales: canonicalSales,
        ot: canonicalOT,
        productProviders: canonicalProductProviders
      })
    });
  }

  return {
    create: create,
    modules: MODULES
  };
});
