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
    permissions = permissions || global.PERMISOS_ROLES;
    defaults = defaults || global.PERMISOS_DEFAULT;
    var config = (permissions && permissions[role]) ||
      (defaults && defaults[role]) || { bloqueados: [] };
    return (config.bloqueados || []).indexOf(moduleId) === -1;
  }

  var technicianDenied = Object.freeze({
    gastos: true,
    caja: true,
    tesoreria: true,
    rentabilidad: true,
    proveedores: true,
    ordenes: true,
    creditofiscal: true,
    usuarios: true,
    configuracion: true,
    detalle: true,
    cobranzas: true,
    cuentacorriente: true,
    reportes: true,
    estadisticas: true,
    presupuesto: true,
    venta: true
  });

  function resolvePage(page) {
    if (!canAccess(page)) {
      return { page: 'dashboard', redirected: true };
    }
    if (current() === 'tecnico' && technicianDenied[page]) {
      return { page: 'ctaemp', redirected: true };
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
