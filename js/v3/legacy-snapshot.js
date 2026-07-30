(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.LegacySnapshot = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var defaultMapping = {
    clientes: ['clientes', 'clientesList', 'cliData', 'clientesData'],
    empleados: ['empleados', 'empData', 'empleadosData', 'empleadosList'],
    productos: ['productos', 'prodData', 'productosData'],
    proveedores: ['proveedores', 'proveedoresData', 'providersData'],
    presupuestos: ['presupuestos', 'pptoData', 'presupuestosData'],
    ventas: ['ventas', 'ventasList', 'ventasData'],
    pagos: ['pagos', 'pagosData', 'pagosList'],
    ordenesTrabajo: ['ordenesTrabajo', 'otData', 'ordenesTrabajoData']
  };

  function toRecords(value) {
    if (Array.isArray(value)) return value.slice();
    if (!value || typeof value !== 'object') return [];
    return Object.keys(value).map(function (key) {
      var record = value[key];
      if (!record || typeof record !== 'object') return { fbKey: key, value: record };
      return Object.assign({ fbKey: key }, record);
    });
  }

  function firstAvailable(source, aliases) {
    var i;
    for (i = 0; i < aliases.length; i += 1) {
      if (source && source[aliases[i]] != null) return source[aliases[i]];
    }
    return [];
  }

  function create(source, mapping) {
    var snapshot = {};
    var resolvedMapping = mapping || defaultMapping;
    Object.keys(resolvedMapping).forEach(function (collection) {
      snapshot[collection] = toRecords(firstAvailable(source, resolvedMapping[collection]));
    });
    return Object.freeze(snapshot);
  }

  return {
    create: create,
    toRecords: toRecords,
    defaultMapping: defaultMapping
  };
});
