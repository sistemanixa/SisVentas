(function (root, factory) {
  var identity = typeof module === 'object' && module.exports
    ? require('./identity-index.js')
    : root.SisVentas.V3.Identity;
  var api = factory(identity);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.SalesReadModel = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (identity) {
  'use strict';

  var saleDefinition = {
    technicalField: 'fbKey',
    businessFields: ['id', 'numero', 'nro', 'codigo'],
    nameFields: []
  };

  var paymentRelation = {
    technicalFields: ['ventaFbKey', 'ventaKey'],
    businessFields: ['ventaId', 'idVenta', 'venta', 'nroVenta', 'numeroVenta'],
    nameFields: []
  };

  function number(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return 0;
    if (raw.indexOf(',') >= 0) raw = raw.replace(/\./g, '').replace(',', '.');
    else raw = raw.replace(/[^0-9.-]/g, '');
    var parsed = Number(raw.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function saleTotal(sale) {
    return number(sale && (sale.total != null ? sale.total
      : sale.totalVenta != null ? sale.totalVenta
        : sale.importe != null ? sale.importe
          : sale.monto));
  }

  function paymentAmount(payment) {
    return number(payment && (payment.monto != null ? payment.monto
      : payment.importe != null ? payment.importe
        : payment.total != null ? payment.total
          : payment.pagado));
  }

  function isCancelled(record) {
    var value = identity.normalized(record && record.estado);
    return value === 'ANULADO' || value === 'ANULADA' || value === 'CANCELADO';
  }

  function paymentIdentity(payment) {
    var technical = identity.text(payment && (payment.fbKey || payment.key));
    if (technical) return 'KEY|' + technical;
    return [
      'LEGACY',
      identity.text(payment && (payment.fecha || payment.fechaPago || payment.createdAt)),
      paymentAmount(payment),
      identity.normalized(payment && (payment.medio || payment.medioPago || payment.formaPago)),
      identity.text(payment && (payment.ventaFbKey || payment.ventaKey || payment.ventaId || payment.idVenta || payment.venta))
    ].join('|');
  }

  function SalesReadModel(sales, payments) {
    this.sales = Array.isArray(sales) ? sales.slice() : [];
    this.payments = Array.isArray(payments) ? payments.slice() : [];
    this.salesIndex = new identity.IdentityIndex(this.sales, saleDefinition);
    this.paymentsBySaleKey = new Map();
    this.conflicts = [];
    this._buildPayments();
  }

  SalesReadModel.prototype._buildPayments = function () {
    var self = this;
    var seenPayments = new Map();

    this.payments.forEach(function (payment) {
      if (!payment || isCancelled(payment)) return;
      var paymentKey = paymentIdentity(payment);
      if (seenPayments.has(paymentKey)) {
        self.conflicts.push({
          kind: 'duplicate-payment',
          key: paymentKey,
          records: [seenPayments.get(paymentKey), payment]
        });
        return;
      }
      seenPayments.set(paymentKey, payment);

      var resolved = self.salesIndex.resolveRecord(payment, paymentRelation);
      if (resolved.status !== 'found') {
        self.conflicts.push({
          kind: resolved.status === 'ambiguous' ? 'ambiguous-payment-sale' : 'orphan-payment',
          payment: payment,
          resolution: resolved
        });
        return;
      }

      var saleKey = identity.text(resolved.value && resolved.value.fbKey);
      if (!saleKey) {
        self.conflicts.push({
          kind: 'sale-without-technical-key',
          payment: payment,
          sale: resolved.value
        });
        return;
      }

      var bucket = self.paymentsBySaleKey.get(saleKey);
      if (!bucket) {
        bucket = [];
        self.paymentsBySaleKey.set(saleKey, bucket);
      }
      bucket.push(payment);
    });
  };

  SalesReadModel.prototype.resolveSale = function (reference) {
    if (typeof reference === 'string' || typeof reference === 'number') {
      var technical = this.salesIndex.resolveTechnical(reference);
      if (technical.status !== 'missing') return technical;
      return this.salesIndex.resolveBusiness(reference);
    }
    return this.salesIndex.resolveRecord(reference || {}, paymentRelation);
  };

  SalesReadModel.prototype.paymentsFor = function (saleOrReference) {
    var resolved = saleOrReference && saleOrReference.fbKey
      ? this.salesIndex.resolveTechnical(saleOrReference.fbKey)
      : this.resolveSale(saleOrReference);
    if (resolved.status !== 'found') return [];
    return (this.paymentsBySaleKey.get(identity.text(resolved.value.fbKey)) || []).slice();
  };

  SalesReadModel.prototype.paidFor = function (saleOrReference) {
    return this.paymentsFor(saleOrReference).reduce(function (sum, payment) {
      return sum + paymentAmount(payment);
    }, 0);
  };

  SalesReadModel.prototype.summaryFor = function (saleOrReference) {
    var resolved = saleOrReference && saleOrReference.fbKey
      ? this.salesIndex.resolveTechnical(saleOrReference.fbKey)
      : this.resolveSale(saleOrReference);
    if (resolved.status !== 'found') {
      return Object.freeze({
        status: resolved.status,
        sale: null,
        total: 0,
        paid: 0,
        balance: 0,
        payments: Object.freeze([])
      });
    }
    var total = saleTotal(resolved.value);
    var payments = this.paymentsFor(resolved.value);
    var paid = payments.reduce(function (sum, payment) {
      return sum + paymentAmount(payment);
    }, 0);
    return Object.freeze({
      status: 'found',
      sale: resolved.value,
      total: total,
      paid: paid,
      balance: Math.max(0, total - Math.min(total, paid)),
      payments: Object.freeze(payments)
    });
  };

  SalesReadModel.prototype.audit = function () {
    return {
      sales: this.salesIndex.conflicts(),
      relations: this.conflicts.slice()
    };
  };

  return {
    SalesReadModel: SalesReadModel,
    saleTotal: saleTotal,
    paymentAmount: paymentAmount,
    paymentIdentity: paymentIdentity
  };
});
