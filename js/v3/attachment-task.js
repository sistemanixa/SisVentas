(function (root, factory) {
  var identity = typeof module === 'object' && module.exports
    ? require('./identity-index.js')
    : root.SisVentas.V3.Identity;
  var api = factory(identity);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.AttachmentTask = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (identity) {
  'use strict';

  var terminalStates = {
    completed: true,
    failed: true,
    cancelled: true
  };

  function requireFunction(adapter, name) {
    if (!adapter || typeof adapter[name] !== 'function') {
      throw new TypeError('El adaptador de archivos requiere ' + name + '()');
    }
  }

  function AttachmentTask(options) {
    options = options || {};
    requireFunction(options.adapter, 'upload');
    requireFunction(options.adapter, 'saveMetadata');
    this.adapter = options.adapter;
    this.ownerCollection = identity.text(options.ownerCollection);
    this.ownerKey = identity.text(options.ownerKey);
    this.kind = identity.text(options.kind);
    this.file = options.file;
    this.timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 60000;
    this.onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
    this.state = 'idle';
    this.progress = 0;
    this.error = null;
    this.result = null;
    this.controller = null;
    this.timeoutId = null;

    if (!this.ownerCollection) throw new Error('Falta la colección propietaria del archivo');
    if (!this.ownerKey) throw new Error('Falta la clave técnica propietaria del archivo');
    if (!this.kind) throw new Error('Falta el tipo de archivo');
    if (!this.file) throw new Error('Falta el archivo');
  }

  AttachmentTask.prototype.snapshot = function () {
    return Object.freeze({
      state: this.state,
      progress: this.progress,
      error: this.error,
      result: this.result
    });
  };

  AttachmentTask.prototype._emit = function () {
    this.onChange(this.snapshot());
  };

  AttachmentTask.prototype._transition = function (state, extra) {
    if (terminalStates[this.state]) return;
    this.state = state;
    if (extra && Object.prototype.hasOwnProperty.call(extra, 'progress')) {
      this.progress = Math.max(0, Math.min(100, Number(extra.progress) || 0));
    }
    if (extra && Object.prototype.hasOwnProperty.call(extra, 'error')) this.error = extra.error;
    if (extra && Object.prototype.hasOwnProperty.call(extra, 'result')) this.result = extra.result;
    this._emit();
  };

  AttachmentTask.prototype.start = function () {
    var self = this;
    if (this.state !== 'idle') return Promise.reject(new Error('La tarea de archivo ya fue iniciada'));
    this.controller = new AbortController();
    this._transition('uploading', { progress: 0 });
    this.timeoutId = setTimeout(function () {
      if (!terminalStates[self.state]) self.cancel('Tiempo límite de subida agotado');
    }, this.timeoutMs);

    var uploadRequest = {
      ownerCollection: this.ownerCollection,
      ownerKey: this.ownerKey,
      kind: this.kind,
      file: this.file,
      signal: this.controller.signal,
      onProgress: function (progress) {
        if (self.state === 'uploading') self._transition('uploading', { progress: progress });
      }
    };

    return Promise.resolve(this.adapter.upload(uploadRequest))
      .then(function (uploaded) {
        if (self.state === 'cancelled') throw new Error('Subida cancelada');
        if (!uploaded || !identity.text(uploaded.url || uploaded.path)) {
          throw new Error('El almacenamiento no devolvió una referencia del archivo');
        }
        self._transition('saving', { progress: 100 });
        return Promise.resolve(self.adapter.saveMetadata({
          ownerCollection: self.ownerCollection,
          ownerKey: self.ownerKey,
          kind: self.kind,
          uploaded: uploaded
        })).then(function (metadata) {
          var result = Object.freeze({ uploaded: uploaded, metadata: metadata || null });
          self._transition('completed', { progress: 100, result: result });
          return result;
        });
      })
      .catch(function (error) {
        if (self.state === 'cancelled') throw error;
        self._transition('failed', { error: error });
        throw error;
      })
      .finally(function () {
        if (self.timeoutId) clearTimeout(self.timeoutId);
        self.timeoutId = null;
      });
  };

  AttachmentTask.prototype.cancel = function (reason) {
    if (terminalStates[this.state]) return false;
    if (this.controller) this.controller.abort();
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = null;
    this._transition('cancelled', {
      error: new Error(identity.text(reason) || 'Subida cancelada por el usuario')
    });
    return true;
  };

  return {
    AttachmentTask: AttachmentTask,
    terminalStates: Object.freeze(terminalStates)
  };
});
