(function (root, factory) {
  var identity = typeof module === 'object' && module.exports
    ? require('./identity-index.js')
    : root.SisVentas.V3.Identity;
  var economics = typeof module === 'object' && module.exports
    ? require('./budget-read-model.js')
    : root.SisVentas.V3.BudgetReadModel;
  var money = typeof module === 'object' && module.exports ? require('./commercial-money.js') : root.SVCommercialMoney;
  var api = factory(identity, economics, money);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.SalesReadModel = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (identity, economics, money) {
  'use strict';

  var saleDefinition = {
    technicalField: 'fbKey',
    businessFields: ['id', 'numero', 'nro', 'codigo', 'idOriginal', 'numeroOriginal', 'ventaIdOriginal'],
    nameFields: []
  };

  var paymentRelation = {
    technicalFields: ['ventaFbKey', 'ventaKey', 'ventaGeneradaFbKey', 'ventaOrigenFbKey'],
    businessFields: ['ventaId', 'idVenta', 'venta', 'nroVenta', 'numeroVenta', 'ventaNumero', 'ventaGeneradaId', 'ventaOrigenId'],
    nameFields: []
  };

  function number(value) {
    return economics.parseNumber(value);
  }

  function storedSaleTotal(sale) {
    return number(sale && (sale.total != null ? sale.total
      : sale.totalVenta != null ? sale.totalVenta
        : sale.importe != null ? sale.importe
          : sale.monto));
  }

  function saleEconomic(sale) {
    var source = sale || {};
    var prepared = Object.assign({}, source);
    var hasGeneralPercent = ['descuentoGeneral', 'descuentoPct', 'porcentajeDescuento'].some(function (field) {
      return source[field] !== undefined && source[field] !== null && source[field] !== '';
    });
    if (!hasGeneralPercent && source.descuento !== undefined && source.descuento !== null && source.descuento !== '') {
      var itemSources = Array.isArray(source.items) ? source.items : Object.values(source.items || {});
      var lineDiscount = itemSources.map(economics.normalizeItem).reduce(function (sum, item) {
        return sum + item.discount;
      }, 0);
      prepared.descuentoAmt = Math.max(0, number(source.descuento) - lineDiscount);
      delete prepared.descuento;
    }
    // Sales store the taxable subtotal, while the quotation reader exposes the
    // subtotal before the general discount. Validate the sale against its own
    // field contract instead of treating a legitimate discount as a mismatch.
    delete prepared.subtotal;
    var model = economics.build(prepared);
    // Older sale writers rounded the discount amount before subtracting it.
    // Recognize that exact stored chain; never accept an unexplained cent gap.
    var exactDecimal = function (a, b) {
      try { var x=money.decimal(a), y=money.decimal(b); return x.n*y.d === y.n*x.d; } catch (_) { return false; }
    };
    var exactAmount = function (a, b) { return money.isAmount(a) && money.isAmount(b) && Number(a)>=0 && Number(b)>=0 && exactDecimal(a,b); };
    var present = function (object, field) { return Object.prototype.hasOwnProperty.call(object,field); };
    var historicalLinesExact = function () { return model.items.every(function (item) {
      var raw=item.source, fields=['sub','subtotal','totalItem','importe','total'];
      if (item.conflicts.length || !present(raw,'qty') || !present(raw,'punit') || !fields.some(function (field) { return present(raw,field); })) return false;
      if (!['qty','cantidad','cant','unidades'].every(function (field) { return !present(raw,field) || exactDecimal(raw[field],item.quantity); }) ||
          !['punit','precio','precioUnitario','precio_unitario','precioVenta','unitario','valorUnitario'].every(function (field) { return !present(raw,field) || exactDecimal(raw[field],item.unitNet); }) ||
          !['disc','descuentoPct','porcentajeDescuento','descuento'].every(function (field) { return !present(raw,field) || exactDecimal(raw[field],item.discountPct); })) return false;
      try { if (money.line(raw.qty,raw.punit,raw.disc==null?0:raw.disc)/100 !== item.net) return false; } catch (_) { return false; }
      return fields.every(function (field) { return !present(raw,field) || exactAmount(raw[field],item.net); });
    }); };
    if (!model.ready && model.mode === 'items' && typeof source.conIva === 'boolean' &&
        ['descuento','subtotal','iva','total'].every(function (field) { return money.isAmount(source[field]) && Number(source[field])>=0; }) &&
        source.descuentoGeneral != null && source.descuentoGeneral !== '' && exactDecimal(source.descuentoGeneral,Number(source.descuentoGeneral)) &&
        Number(source.descuentoGeneral) >= 0 && Number(source.descuentoGeneral) <= 100 &&
        ['descuentoPct','porcentajeDescuento'].every(function (field) { return !present(source,field) || exactDecimal(source[field],source.descuentoGeneral); }) &&
        ['ivaPct','tasaIva','porcentajeIva'].every(function (field) { return !present(source,field) || (exactDecimal(source[field],Number(source[field])) && Number(source[field])>=0 && Number(source[field])<=100 && (!source.conIva || exactDecimal(source[field],model.ivaRate))); }) &&
        historicalLinesExact()) {
      var historicalDiscount = money.percentage(model.subtotal, Number(source.descuentoGeneral));
      var historicalBase = money.sum([model.subtotal, -historicalDiscount]);
      if (exactAmount(source.descuento, money.sum([model.lineDiscount, historicalDiscount])) &&
          exactAmount(source.subtotal, historicalBase) &&
          (!present(source,'descuentoAmt') || exactAmount(source.descuentoAmt,historicalDiscount))) {
        var amountBased = Object.assign({}, prepared, { descuentoAmt:historicalDiscount });
        ['descuentoGeneral', 'descuentoPct', 'porcentajeDescuento', 'descuento'].forEach(function (field) { delete amountBased[field]; });
        var historicalModel = economics.build(amountBased);
        if (historicalModel.ready && ['total','totalPresupuesto','importeTotal'].every(function (field) { return !present(source,field) || exactAmount(source[field],historicalModel.total); }) &&
            exactAmount(source.iva, historicalModel.iva)) {
          model = Object.freeze(Object.assign({}, historicalModel, { source:model.source, generalDiscountPct:Number(source.descuentoGeneral) }));
        }
      }
    }
    if (source.subtotal != null && !economics.moneyValuesEqual(number(source.subtotal), model.taxableBase) &&
        !economics.moneyValuesEqual(number(source.subtotal), model.subtotal)) {
      var conflicts = model.conflicts.concat([{kind:'subtotal-mismatch',path:'sale.subtotal',stored:number(source.subtotal),computed:model.taxableBase}]);
      return Object.freeze(Object.assign({},model,{conflicts:Object.freeze(conflicts),ready:false}));
    }
    return model;
  }

  function saleTotalFromEconomic(sale, economic) {
    // The writer rounds each discounted line once. Older readers rounded the
    // discount first, which can subtract an extra cent. Accept only the exact
    // stored line/subtotal/tax chain, never a blanket balance tolerance.
    if (economic.mode === 'items' && sale && Array.isArray(sale.items) && sale.items.length && typeof sale.conIva === 'boolean') {
      var cents = function (v) { return money.cents(money.decimal(v)); };
      var valid = true, sum = 0;
      sale.items.forEach(function (item) {
        var qty = Number(item.qty), price = Number(item.punit), discount = Number(item.disc == null ? 0 : item.disc);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(discount) || discount < 0 || discount > 100 || item.sub == null) { valid = false; return; }
        var line = money.line(item.qty, item.punit, item.disc == null ? 0 : item.disc);
        if (cents(Number(item.sub)) !== line) valid = false;
        sum += line;
      });
      var general = Number(sale.descuentoGeneral == null ? 0 : sale.descuentoGeneral);
      var subtotal = money.discount(sum, general);
      var tax = sale.conIva ? money.vat(subtotal) : 0;
      var stored = storedSaleTotal(sale);
      if (valid && Number.isFinite(general) && general >= 0 && general <= 100 && sale.subtotal != null && sale.iva != null &&
          cents(Number(sale.subtotal)) === subtotal && cents(Number(sale.iva)) === tax && cents(stored) === subtotal + tax &&
          Math.abs(cents(stored) - cents(economic.total)) <= Math.min(5, sale.items.length + 1)) return stored;
    }
    return economic.mode === 'items' ? economic.total : storedSaleTotal(sale);
  }

  function saleTotal(sale) {
    return saleTotalFromEconomic(sale, saleEconomic(sale));
  }

  function paymentAmount(payment) {
    return number(payment && (payment.monto != null ? payment.monto
      : payment.importe != null ? payment.importe
        : payment.total != null ? payment.total
          : payment.pagado));
  }

  function isCancelled(record) {
    var value = identity.normalized(record && record.estado);
    return !!(record && record.anulado === true) || value === 'ANULADO' || value === 'ANULADA' || value === 'CANCELADO';
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
    // Reuse within this call only: records and payments can change between reads.
    var economic = saleEconomic(resolved.value);
    var total = saleTotalFromEconomic(resolved.value, economic);
    var payments = this.paymentsFor(resolved.value);
    var paid = payments.reduce(function (sum, payment) {
      return sum + paymentAmount(payment);
    }, 0);
    return Object.freeze({
      status: 'found',
      sale: resolved.value,
      economic: economic,
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
    saleEconomic: saleEconomic,
    saleTotal: saleTotal,
    storedSaleTotal: storedSaleTotal,
    paymentAmount: paymentAmount,
    paymentIdentity: paymentIdentity
  };
});
