(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.FeatureGates = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var modules = Object.freeze([
    'presupuestos',
    'ventasPagos',
    'ordenesTrabajo'
  ]);

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function FeatureGates(options) {
    options = options || {};
    this.mode = options.mode === 'active' ? 'active' : 'shadow';
    this.allowed = new Set(Array.isArray(options.allowed) ? options.allowed : []);
    this.report = null;
  }

  FeatureGates.prototype.update = function (report) {
    this.report = report || null;
    return this.snapshot();
  };

  FeatureGates.prototype.decision = function (name) {
    var moduleName = text(name);
    if (modules.indexOf(moduleName) < 0) {
      return Object.freeze({
        module: moduleName,
        active: false,
        eligible: false,
        reason: 'unknown-module'
      });
    }
    if (!this.report) {
      return Object.freeze({
        module: moduleName,
        active: false,
        eligible: false,
        reason: 'missing-shadow-report'
      });
    }
    var eligible = this.report.gates && this.report.gates[moduleName] === true;
    var explicitlyAllowed = this.allowed.has(moduleName);
    var active = this.mode === 'active' && eligible && explicitlyAllowed;
    return Object.freeze({
      module: moduleName,
      active: active,
      eligible: eligible,
      reason: !eligible
        ? 'shadow-blocked'
        : this.mode !== 'active'
          ? 'shadow-only'
          : !explicitlyAllowed
            ? 'not-allowed'
            : 'active'
    });
  };

  FeatureGates.prototype.snapshot = function () {
    var decisions = {};
    var self = this;
    modules.forEach(function (name) {
      decisions[name] = self.decision(name);
    });
    return Object.freeze({
      mode: this.mode,
      modules: Object.freeze(decisions)
    });
  };

  return {
    FeatureGates: FeatureGates,
    modules: modules
  };
});
