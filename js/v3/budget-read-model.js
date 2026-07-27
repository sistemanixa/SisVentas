(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.BudgetReadModel = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEFAULT_IVA_RATE = 21;
  var MONEY_TOLERANCE = 0.011;

  function firstDefined(record, fields, fallback) {
    var source = record || {};
    for (var index = 0; index < fields.length; index += 1) {
      var value = source[fields[index]];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
  }

  function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    var raw = String(value == null ? '' : value).trim().replace(/\s/g, '');
    if (!raw) return 0;
    var negative = /^-/.test(raw) || /^\(.*\)$/.test(raw);
    raw = raw.replace(/[^0-9,.-]/g, '').replace(/-/g, '');
    if (!raw) return 0;

    var comma = raw.lastIndexOf(',');
    var dot = raw.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) {
      if (comma > dot) raw = raw.replace(/\./g, '').replace(',', '.');
      else raw = raw.replace(/,/g, '');
    } else if (comma >= 0) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      var dotCount = (raw.match(/\./g) || []).length;
      if (dotCount > 1) raw = raw.replace(/\./g, '');
      else if (dotCount === 1) {
        var sides = raw.split('.');
        if (sides[1].length === 3 && sides[0].length <= 3) raw = sides[0] + sides[1];
      }
    }
    var parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 0;
    return negative ? -parsed : parsed;
  }

  function roundMoney(value) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round((parsed + Number.EPSILON) * 100) / 100;
  }

  function percent(value) {
    return Math.min(100, Math.max(0, parseNumber(value)));
  }

  function values(record, fields) {
    var source = record || {};
    return fields.reduce(function (result, field) {
      if (source[field] !== undefined && source[field] !== null && source[field] !== '') {
        result.push({ field: field, value: parseNumber(source[field]) });
      }
      return result;
    }, []);
  }

  function conflict(kind, path, stored, computed) {
    return Object.freeze({
      kind: kind,
      path: path,
      stored: roundMoney(stored),
      computed: roundMoney(computed),
      delta: roundMoney(computed - stored)
    });
  }

  function addMoneyConflicts(target, record, fields, computed, path, kind) {
    values(record, fields).forEach(function (entry) {
      if (Math.abs(entry.value - computed) >= MONEY_TOLERANCE) {
        target.push(conflict(kind, path + '.' + entry.field, entry.value, computed));
      }
    });
  }

  function sourceItems(record) {
    var source = firstDefined(record, ['items', 'productos', 'detalle', 'renglones'], []);
    if (Array.isArray(source)) return source.slice();
    if (source && typeof source === 'object') return Object.values(source);
    return [];
  }

  function normalizeItem(item, index) {
    var source = item || {};
    var quantityValue = firstDefined(source, ['qty', 'cantidad', 'cant', 'unidades'], 1);
    var quantity = Math.max(0, parseNumber(quantityValue));
    var discountPct = percent(firstDefined(source, ['disc', 'descuentoPct', 'porcentajeDescuento', 'descuento'], 0));
    var unitNet = Math.max(0, parseNumber(firstDefined(source, [
      'punit', 'precio', 'precioUnitario', 'precio_unitario', 'precioVenta', 'unitario', 'valorUnitario'
    ], 0)));
    var storedLineValues = values(source, ['sub', 'subtotal', 'totalItem', 'importe']);

    if (!(unitNet > 0) && storedLineValues.length && quantity > 0) {
      var factor = 1 - discountPct / 100;
      unitNet = factor > 0
        ? storedLineValues[0].value / quantity / factor
        : storedLineValues[0].value / quantity;
    }

    var gross = roundMoney(quantity * unitNet);
    var discount = roundMoney(gross * discountPct / 100);
    var net = roundMoney(Math.max(0, gross - discount));
    var conflicts = [];
    addMoneyConflicts(conflicts, source, ['sub', 'subtotal', 'totalItem', 'importe'], net,
      'items[' + index + ']', 'line-total-mismatch');
    if (!(quantity > 0)) {
      conflicts.push(Object.freeze({ kind: 'invalid-quantity', path: 'items[' + index + '].quantity' }));
    }
    if (!(unitNet > 0)) {
      conflicts.push(Object.freeze({ kind: 'missing-unit-price', path: 'items[' + index + '].unitNet' }));
    }

    return Object.freeze({
      index: index,
      source: source,
      code: String(firstDefined(source, ['cod', 'codigo', 'sku'], '') || '').trim(),
      description: String(firstDefined(source, ['desc', 'descripcion', 'nombre', 'producto'], '') || '').trim(),
      quantity: quantity,
      unitNet: roundMoney(unitNet),
      discountPct: discountPct,
      gross: gross,
      discount: discount,
      net: net,
      conflicts: Object.freeze(conflicts)
    });
  }

  function explicitIvaState(record, options) {
    var source = record || {};
    if (source.conIva !== undefined) return source.conIva !== false;
    if (source.incluyeIva !== undefined) return source.incluyeIva === true;
    if (source.sinIva !== undefined) return source.sinIva !== true;
    if (options && options.defaultIncludesIva !== undefined) return options.defaultIncludesIva === true;
    return true;
  }

  function build(record, options) {
    var source = record || {};
    var items = sourceItems(source).map(normalizeItem);
    var conflicts = [];
    items.forEach(function (item) {
      Array.prototype.push.apply(conflicts, item.conflicts);
    });

    var grossSubtotal = roundMoney(items.reduce(function (sum, item) { return sum + item.gross; }, 0));
    var lineDiscount = roundMoney(items.reduce(function (sum, item) { return sum + item.discount; }, 0));
    var subtotal = roundMoney(items.reduce(function (sum, item) { return sum + item.net; }, 0));
    var generalDiscountPct = percent(firstDefined(source, [
      'descuentoGeneral', 'descuentoPct', 'porcentajeDescuento', 'descuento'
    ], 0));
    var hasGeneralPercent = ['descuentoGeneral', 'descuentoPct', 'porcentajeDescuento', 'descuento'].some(function (field) {
      return source[field] !== undefined && source[field] !== null && source[field] !== '';
    });
    var storedGeneralDiscount = Math.max(0, parseNumber(source.descuentoAmt));
    var generalDiscount = hasGeneralPercent
      ? roundMoney(subtotal * generalDiscountPct / 100)
      : roundMoney(Math.min(subtotal, storedGeneralDiscount));
    var taxableBase = roundMoney(Math.max(0, subtotal - generalDiscount));
    var includesIva = explicitIvaState(source, options || {});
    var ivaRate = includesIva ? percent(firstDefined(source, ['ivaPct', 'tasaIva', 'porcentajeIva'], DEFAULT_IVA_RATE)) : 0;
    var iva = includesIva ? roundMoney(taxableBase * ivaRate / 100) : 0;
    var total = roundMoney(taxableBase + iva);

    addMoneyConflicts(conflicts, source, ['subtotal'], subtotal, 'budget', 'subtotal-mismatch');
    if (source.descuentoAmt !== undefined && source.descuentoAmt !== null && source.descuentoAmt !== '') {
      if (Math.abs(storedGeneralDiscount - generalDiscount) >= MONEY_TOLERANCE) {
        conflicts.push(conflict('general-discount-mismatch', 'budget.descuentoAmt', storedGeneralDiscount, generalDiscount));
      }
    }
    addMoneyConflicts(conflicts, source, ['iva'], iva, 'budget', 'iva-mismatch');
    addMoneyConflicts(conflicts, source, ['total', 'totalPresupuesto', 'importeTotal'], total, 'budget', 'total-mismatch');

    var mode = items.length ? 'items' : 'empty';
    if (!items.length && values(source, ['total', 'totalPresupuesto', 'importeTotal']).some(function (entry) { return entry.value > 0; })) {
      mode = 'legacy-total-only';
      conflicts.push(Object.freeze({ kind: 'total-without-items', path: 'budget.items' }));
    }

    return Object.freeze({
      source: source,
      mode: mode,
      number: String(firstDefined(source, ['id', 'numero', 'nro'], '') || '').trim(),
      client: String(firstDefined(source, ['cliente', 'clienteNombre'], '') || '').trim(),
      items: Object.freeze(items),
      grossSubtotal: grossSubtotal,
      lineDiscount: lineDiscount,
      subtotal: subtotal,
      generalDiscountPct: generalDiscountPct,
      generalDiscount: generalDiscount,
      taxableBase: taxableBase,
      includesIva: includesIva,
      ivaRate: ivaRate,
      iva: iva,
      total: total,
      conflicts: Object.freeze(conflicts),
      ready: mode === 'items' && conflicts.length === 0
    });
  }

  function legacyFields(model) {
    var result = model && model.items ? model : build(model || {});
    return Object.freeze({
      subtotal: result.subtotal,
      descuentoAmt: result.generalDiscount,
      iva: result.iva,
      total: result.total,
      conIva: result.includesIva
    });
  }

  return {
    DEFAULT_IVA_RATE: DEFAULT_IVA_RATE,
    parseNumber: parseNumber,
    roundMoney: roundMoney,
    normalizeItem: normalizeItem,
    build: build,
    legacyFields: legacyFields
  };
});
