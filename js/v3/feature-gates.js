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
    'ordenesTrabajo',
    'productosProveedores'
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
    var self = this;
    Array.from(this.allowed).forEach(function (name) {
      if (!self.report || !self.report.gates || self.report.gates[name] !== true) {
        self.allowed.delete(name);
      }
    });
    if (this.allowed.size === 0) this.mode = 'shadow';
    return this.snapshot();
  };

  FeatureGates.prototype.activate = function (name) {
    var moduleName = text(name);
    if (modules.indexOf(moduleName) < 0) return this.decision(moduleName);
    if (!this.report || !this.report.gates || this.report.gates[moduleName] !== true) {
      return this.decision(moduleName);
    }
    this.mode = 'active';
    this.allowed.add(moduleName);
    return this.decision(moduleName);
  };

  FeatureGates.prototype.deactivate = function (name) {
    this.allowed.delete(text(name));
    if (this.allowed.size === 0) this.mode = 'shadow';
    return this.snapshot();
  };

  FeatureGates.prototype.rollback = function () {
    this.allowed.clear();
    this.mode = 'shadow';
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
      allowed: Object.freeze(Array.from(this.allowed)),
      modules: Object.freeze(decisions)
    });
  };

  return {
    FeatureGates: FeatureGates,
    modules: modules
  };
});
