(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.DataLifecycle = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var states = Object.freeze({
    idle: true,
    loading: true,
    ready: true,
    error: true
  });

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function entry(name) {
    return {
      name: name,
      state: 'idle',
      generation: 0,
      error: null
    };
  }

  function DataLifecycle(collections) {
    this.sessionGeneration = 0;
    this.sessionState = 'signed-out';
    this.entries = new Map();
    var self = this;
    (collections || []).forEach(function (name) {
      self.register(name);
    });
  }

  DataLifecycle.prototype.register = function (name) {
    var key = text(name);
    if (!key) throw new Error('La coleccion requiere un nombre');
    if (!this.entries.has(key)) this.entries.set(key, entry(key));
    return this;
  };

  DataLifecycle.prototype.beginSession = function () {
    this.sessionGeneration += 1;
    this.sessionState = 'loading';
    this.entries.forEach(function (current) {
      current.state = 'idle';
      current.generation = 0;
      current.error = null;
    });
    return this.sessionGeneration;
  };

  DataLifecycle.prototype.endSession = function () {
    this.sessionGeneration += 1;
    this.sessionState = 'signed-out';
    this.entries.forEach(function (current) {
      current.state = 'idle';
      current.generation = 0;
      current.error = null;
    });
    return this.sessionGeneration;
  };

  DataLifecycle.prototype._transition = function (name, state, generation, error) {
    var key = text(name);
    var current = this.entries.get(key);
    if (!current) throw new Error('Coleccion no registrada: ' + key);
    if (!states[state]) throw new Error('Estado de carga invalido: ' + state);
    if (generation !== this.sessionGeneration || this.sessionState === 'signed-out') {
      return false;
    }
    current.state = state;
    current.generation = generation;
    current.error = error || null;
    return true;
  };

  DataLifecycle.prototype.loading = function (name, generation) {
    return this._transition(name, 'loading', generation, null);
  };

  DataLifecycle.prototype.ready = function (name, generation) {
    var accepted = this._transition(name, 'ready', generation, null);
    if (accepted && this.allReady()) this.sessionState = 'ready';
    return accepted;
  };

  DataLifecycle.prototype.failed = function (name, generation, error) {
    var failure = error instanceof Error ? error : new Error(text(error) || 'Error de carga');
    var accepted = this._transition(name, 'error', generation, failure);
    if (accepted) this.sessionState = 'error';
    return accepted;
  };

  DataLifecycle.prototype.allReady = function () {
    if (this.sessionState === 'signed-out' || this.entries.size === 0) return false;
    var ready = true;
    this.entries.forEach(function (current) {
      if (current.state !== 'ready') ready = false;
    });
    return ready;
  };

  DataLifecycle.prototype.canRenderPrivateUI = function () {
    return this.sessionState === 'ready' && this.allReady();
  };

  DataLifecycle.prototype.snapshot = function () {
    var collections = {};
    this.entries.forEach(function (current, name) {
      collections[name] = Object.freeze({
        state: current.state,
        generation: current.generation,
        error: current.error ? current.error.message : null
      });
    });
    return Object.freeze({
      generation: this.sessionGeneration,
      sessionState: this.sessionState,
      ready: this.allReady(),
      canRenderPrivateUI: this.canRenderPrivateUI(),
      collections: Object.freeze(collections)
    });
  };

  return {
    DataLifecycle: DataLifecycle,
    states: states
  };
});
