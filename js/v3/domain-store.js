(function (root, factory) {
  var identity = typeof module === 'object' && module.exports
    ? require('./identity-index.js')
    : root.SisVentas.V3.Identity;
  var api = factory(identity);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.DomainStore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (identity) {
  'use strict';

  var definitions = {
    clientes: {
      businessFields: ['id', 'idCliente', 'codigo', 'dni', 'cuit'],
      nameFields: ['nombre', 'razonSocial']
    },
    empleados: {
      businessFields: ['id', 'legajo', 'usuario', 'email'],
      nameFields: ['nombre', 'nombreCompleto']
    },
    productos: {
      businessFields: ['id', 'codigo', 'cod'],
      nameFields: ['nombre', 'descripcion']
    },
    presupuestos: {
      businessFields: ['id', 'numero', 'nro', 'codigo'],
      nameFields: []
    },
    ventas: {
      businessFields: ['id', 'numero', 'nro', 'codigo'],
      nameFields: []
    },
    ordenesTrabajo: {
      businessFields: ['id', 'numero', 'nro', 'codigo'],
      nameFields: []
    }
  };

  var relations = {
    cliente: {
      technicalFields: ['clienteFbKey', 'clienteKey'],
      businessFields: ['clienteId', 'idCliente'],
      nameFields: ['cliente', 'clienteNombre']
    },
    venta: {
      technicalFields: ['ventaFbKey', 'ventaKey'],
      businessFields: ['ventaId', 'idVenta', 'venta', 'nroVenta', 'numeroVenta'],
      nameFields: []
    },
    presupuesto: {
      technicalFields: ['presupuestoFbKey', 'presupuestoKey'],
      businessFields: ['presupuestoId', 'idPresupuesto', 'presupuesto', 'nroPresupuesto', 'numeroPresupuesto'],
      nameFields: []
    },
    producto: {
      technicalFields: ['productoFbKey', 'productoKey'],
      businessFields: ['productoId', 'idProducto', 'codigo', 'cod'],
      nameFields: ['producto', 'descripcion']
    },
    empleado: {
      technicalFields: ['empleadoFbKey', 'empleadoKey'],
      businessFields: ['empleadoId', 'idEmpleado', 'legajo', 'usuario', 'email'],
      nameFields: ['empleado', 'tecnico', 'vendedor']
    }
  };

  function DomainStore(data) {
    this.collections = {};
    this.indexes = {};
    this.versions = {};
    var self = this;
    Object.keys(definitions).forEach(function (name) {
      self.replace(name, data && data[name]);
    });
  }

  DomainStore.prototype.replace = function (name, records) {
    if (!definitions[name]) throw new Error('Colección v3 desconocida: ' + name);
    var list = Array.isArray(records) ? records.slice() : [];
    this.collections[name] = list;
    this.indexes[name] = new identity.IdentityIndex(list, definitions[name]);
    this.versions[name] = (this.versions[name] || 0) + 1;
    return this;
  };

  DomainStore.prototype.get = function (name) {
    return (this.collections[name] || []).slice();
  };

  DomainStore.prototype.resolve = function (collection, record, relationName) {
    if (!this.indexes[collection]) throw new Error('Colección v3 desconocida: ' + collection);
    if (!relations[relationName]) throw new Error('Relación v3 desconocida: ' + relationName);
    return this.indexes[collection].resolveRecord(record, relations[relationName]);
  };

  DomainStore.prototype.resolveClient = function (record) {
    return this.resolve('clientes', record, 'cliente');
  };

  DomainStore.prototype.resolveSale = function (record) {
    return this.resolve('ventas', record, 'venta');
  };

  DomainStore.prototype.resolveBudget = function (record) {
    return this.resolve('presupuestos', record, 'presupuesto');
  };

  DomainStore.prototype.resolveProduct = function (record) {
    return this.resolve('productos', record, 'producto');
  };

  DomainStore.prototype.resolveEmployee = function (record) {
    return this.resolve('empleados', record, 'empleado');
  };

  DomainStore.prototype.audit = function () {
    var out = {};
    var self = this;
    Object.keys(this.indexes).forEach(function (name) {
      out[name] = self.indexes[name].conflicts();
    });
    return out;
  };

  return {
    DomainStore: DomainStore,
    definitions: definitions,
    relations: relations
  };
});
