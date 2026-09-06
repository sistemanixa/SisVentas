(function initAccessControl(global) {
  'use strict';

  var SisVentas = global.SisVentas = global.SisVentas || {};

  function normalize(role) {
    var value = String(role || '').toLowerCase().trim();
    if (value === 'administrador') return 'admin';
    if (value === 'técnico') return 'tecnico';
    if (value === 'técnico-vendedor' || value === 'tecnico-vendedor') return 'tecnico_vendedor';
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

    permissions = permissions || global.PERMISOS_ROLES;
    defaults = defaults || global.PERMISOS_DEFAULT;
    var config = (permissions && permissions[role]) ||
      (defaults && defaults[role]) || { bloqueados: [] };
    return (config.bloqueados || []).indexOf(moduleId) === -1;
  }


  function resolvePage(page) {
    if (!canAccess(page)) {
      return { page: 'dashboard', redirected: true };
    }
    return { page: page, redirected: false };
  }

  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent('sisventas:' + name, { detail: detail || {} }));
  }

  SisVentas.Access = Object.freeze({
    normalize: normalize,
    current: current,
    is: is,
    canAccess: canAccess,
    resolvePage: resolvePage,
    emit: emit
  });
})(window);
