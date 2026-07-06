(function initAccessControl(global) {
  'use strict';

  var SisVentas = global.SisVentas = global.SisVentas || {};

  function normalize(role) {
    var value = String(role || '').toLowerCase().trim();
    if (value === 'administrador') return 'admin';
    if (value === 'técnico') return 'tecnico';
    return value;
  }

  function current() {
    return normalize(global.currentRole || global.currentUserRole || '');
  }

  function is(role) {
    return current() === normalize(role);
  }

  function canAccess(moduleId, permissions, defaults) {
    if (!moduleId) return false;
    var role = current();
    if (role === 'admin') return true;
    var config = (permissions && permissions[role]) ||
      (defaults && defaults[role]) || { bloqueados: [] };
    return (config.bloqueados || []).indexOf(moduleId) === -1;
  }

  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent('sisventas:' + name, { detail: detail || {} }));
  }

  SisVentas.Access = Object.freeze({
    normalize: normalize,
    current: current,
    is: is,
    canAccess: canAccess,
    emit: emit
  });
})(window);
