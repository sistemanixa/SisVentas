(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SVOTUnitConfirmation = api;
})(typeof window === 'object' ? window : null, function() {
  'use strict';

  const MAX_UNITS = 200;
  const DISCRETE = new Set(['', 'unidad', 'unidades', 'u', 'un', 'ud', 'uds']);
  const MEASURED = new Set(['m', 'mt', 'mts', 'metro', 'metros', 'metre', 'metres', 'rollo', 'rollos', 'l', 'lt', 'litro', 'litros', 'kg', 'kgs', 'kilo', 'kilos', 'm2', 'm²']);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function clone(value, seen) {
    if (value === null || ['undefined', 'string', 'number', 'boolean'].includes(typeof value)) return value;
    if (typeof value !== 'object' || (!Array.isArray(value) && Object.prototype.toString.call(value) !== '[object Object]')) throw new TypeError('Invalid snapshot');
    seen = seen || new Set();
    if (seen.has(value)) throw new TypeError('Circular snapshot');
    seen.add(value);
    const copy = Array.isArray(value) ? [] : {};
    Object.entries(value).forEach(([name, child]) => {
      Object.defineProperty(copy, name, {value:clone(child, seen), enumerable:true, configurable:true, writable:true});
    });
    seen.delete(value);
    return copy;
  }

  function key(value) {
    if (typeof value !== 'string' || !value.length || /[.#$\[\]\/\x00-\x1f\x7f]/.test(value)) return false;
    let bytes = 0;
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code <= 0x7f) bytes++;
      else if (code <= 0x7ff) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(i + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
        bytes += 4;
        i++;
      } else if (code >= 0xdc00 && code <= 0xdfff) return false;
      else bytes += 3;
      if (bytes > 768) return false;
    }
    return bytes <= 768;
  }

  function leap(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function days(year, month) {
    return [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  }

  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > days(year, month)) return null;
    return value;
  }

  function expiry(value, months) {
    if (!date(value) || !Number.isInteger(months) || months < 1 || months > 120) return null;
    const [year, month, day] = value.split('-').map(Number);
    const index = year * 12 + month - 1 + months;
    const nextYear = Math.floor(index / 12);
    const nextMonth = index % 12 + 1;
    if (nextYear > 9999) return null;
    return String(nextYear).padStart(4, '0') + '-' + String(nextMonth).padStart(2, '0') + '-' + String(Math.min(day, days(nextYear, nextMonth))).padStart(2, '0');
  }

  function configReason(config) {
    if (!object(config)) return 'missing-snapshot';
    if (config.estado === 'sin_definir') return 'undefined-terms';
    if (config.estado !== 'si' && config.estado !== 'no') return 'invalid-terms';
    if (config.serie !== undefined && typeof config.serie !== 'boolean') return 'invalid-series-rule';
    if (config.equipo !== undefined && typeof config.equipo !== 'boolean') return 'invalid-equipment-rule';
    if (config.estado === 'si' && (!Number.isInteger(config.meses) || config.meses < 1 || config.meses > 120)) return 'invalid-months';
    if (config.estado === 'si' && config.inicio !== 'instalacion' && config.inicio !== 'entrega') return 'invalid-start';
    return '';
  }

  function quantity(item) {
    const raw = item.qty ?? item.cantidad ?? 1;
    if ((typeof raw !== 'number' && typeof raw !== 'string') || (typeof raw === 'string' && !/^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim()))) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function build(venta, options) {
    options = options || {};
    const units = [], issues = [], summaries = [], entries = [];
    const isLabor = typeof options.isLabor === 'function' ? options.isLabor : () => false;
    const unitOf = typeof options.unitOf === 'function' ? options.unitOf : item => item.unidad ?? item.unidadMedida ?? item.unit ?? '';
    if (!object(venta) || (venta.items !== undefined && !object(venta.items) && !Array.isArray(venta.items))) {
      return {units, issues:[{reason:'invalid-sale', itemKey:'', blocking:true}], summaries, canCreate:false};
    }
    const duplicates = new Map();
    Object.entries(venta.items || {}).forEach(([itemKey, original]) => {
      if (!object(original)) {
        issues.push({reason:'invalid-item', itemKey, blocking:true});
        return;
      }
      let item;
      try { item = clone(original); }
      catch (_) { issues.push({reason:'invalid-item', itemKey, blocking:true}); return; }
      if (isLabor(item)) {
        summaries.push({itemKey, item, quantity:quantity(item), reason:'labor'});
        return;
      }
      const linea = item.garantiaLinea;
      if (key(linea)) duplicates.set(linea, (duplicates.get(linea) || 0) + 1);
      entries.push({itemKey, item, linea});
    });
    let count = 0;
    for (const entry of entries) {
      const {itemKey, item, linea} = entry;
      const config = object(item.garantiaConfig) ? clone(item.garantiaConfig) : null;
      const amount = quantity(item);
      const rawUnit = unitOf(item);
      const unit = typeof rawUnit === 'string' ? rawUnit.trim().toLowerCase() : null;
      const knownDiscrete = unit !== null && DISCRETE.has(unit);
      const measured = unit !== null && MEASURED.has(unit);
      const inferredDiscrete = !measured && !!(config && (config.serie === true || config.equipo === true));
      if (amount === null) {
        issues.push({reason:'invalid-quantity', itemKey, blocking:true});
        summaries.push({itemKey, item, quantity:null, reason:'invalid-quantity'});
        continue;
      }
      if (!Number.isInteger(amount) || measured) {
        summaries.push({itemKey, item, quantity:amount, reason:measured ? 'measured' : 'fractional'});
        continue;
      }
      if (!knownDiscrete && !inferredDiscrete) {
        issues.push({reason:'unknown-unit', itemKey, blocking:false});
        summaries.push({itemKey, item, quantity:amount, reason:'unknown-unit'});
        continue;
      }
      const snapshotIssue = configReason(config);
      let reason = snapshotIssue;
      if (!reason && (!key(venta.fbKey) || !key(itemKey) || !key(linea))) reason = 'invalid-identity';
      if (!reason && duplicates.get(linea) > 1) reason = 'duplicate-line';
      if (!reason && !knownDiscrete) reason = 'unknown-unit';
      if (reason) issues.push({reason, itemKey, blocking:reason !== 'unknown-unit'});
      const remaining = Math.max(0, MAX_UNITS - count);
      const expansion = Math.min(amount, remaining);
      for (let n = 0; n < expansion; n++) {
        const identity = 'unidad_' + venta.fbKey + '_' + linea + '_' + n;
        const stable = !snapshotIssue && key(venta.fbKey) && key(itemKey) && key(linea) && duplicates.get(linea) === 1 && key(identity);
        const unitReason = reason || (!stable ? 'invalid-identity' : '');
        if (!stable && !reason && n === 0) issues.push({reason:'invalid-identity', itemKey, blocking:true});
        const result = {itemKey, n, linea, item:clone(item), config:config ? clone(config) : null, key:stable ? identity : null, needsReview:!!unitReason, reason:unitReason, creationBlocked:false};
        // A missing snapshot can precede a duplicated-line issue. Preserve the
        // identity conflict independently so manual review cannot hide it.
        if (duplicates.get(linea) > 1) result.duplicateLine = true;
        units.push(result);
      }
      count += expansion;
      if (amount > expansion) issues.push({reason:'too-many-units', itemKey, omitted:amount - expansion, blocking:true});
    }
    const overflow = issues.some(issue => issue.reason === 'too-many-units');
    if (overflow) units.forEach(unit => { unit.creationBlocked = true; });
    return {units, issues, summaries, canCreate:!issues.some(issue => issue.blocking)};
  }

  function fail(reason, message) {
    const error = new Error(message);
    error.reason = reason;
    throw error;
  }

  function canReviewManually(unit) {
    if (!object(unit) || unit.needsReview !== true || unit.summary || unit.creationBlocked || unit.duplicateLine || !object(unit.item) || !Number.isInteger(unit.n) || unit.n < 0) return false;
    const reasons = ['missing-snapshot','undefined-terms','invalid-terms','invalid-series-rule','invalid-equipment-rule','invalid-months','invalid-start','invalid-identity'];
    if (!reasons.includes(unit.reason)) return false;
    const item = unit.item, rawUnit = item.unidad ?? item.unidadMedida ?? item.unit ?? '';
    if (typeof rawUnit !== 'string' || !DISCRETE.has(rawUnit.trim().toLowerCase()) || item.esManoDeObra === true || item.esManoObra === true) return false;
    const amount = quantity(item);
    return Number.isInteger(amount) && unit.n < amount && key(unit.itemKey);
  }

  function manualUnit(unit, manual, today) {
    if (!canReviewManually(unit)) fail('manual-ineligible', 'Este renglón no permite confirmar condiciones manuales.');
    if (!key(unit.manualKey)) fail('manual-identity', 'Volvé a preparar la unidad antes de revisar sus condiciones.');
    const names = ['confirmado','estado','meses','inicio','serie','fecha'];
    if (!object(manual) || Object.keys(manual).length !== names.length || !names.every(name => Object.hasOwn(manual,name)) || Reflect.ownKeys(manual).length !== names.length || manual.confirmado !== true) fail('manual-confirmation', 'Confirmá expresamente las condiciones y la fecha de esta unidad.');
    if (manual.estado !== 'si' && manual.estado !== 'no') fail('manual-terms', 'Elegí si esta unidad tiene garantía.');
    if (typeof manual.serie !== 'boolean') fail('manual-series-rule', 'Indicá si la serie es obligatoria.');
    if (typeof manual.meses !== 'number' || !Number.isInteger(manual.meses) || (manual.estado === 'si' ? manual.meses < 1 || manual.meses > 120 : manual.meses !== 0)) fail('manual-months', 'Ingresá los meses de garantía válidos; sin garantía corresponde cero.');
    if (manual.estado === 'si' ? !['instalacion','entrega'].includes(manual.inicio) : manual.inicio !== '') fail('manual-start', 'Elegí desde cuándo comienza la garantía; sin garantía dejá el inicio vacío.');
    if (!date(manual.fecha) || !date(today) || manual.fecha > today) fail('manual-date', 'Ingresá una fecha efectiva válida, no futura, para esta unidad.');
    // Complete missing facts only. Known historical terms are immutable here.
    const original = object(unit.config) ? unit.config : {};
    const fixed = {};
    if (['si','no'].includes(original.estado)) fixed.estado = original.estado;
    if (Number.isInteger(original.meses) && original.meses >= 1 && original.meses <= 120 && original.estado === 'si') fixed.meses = original.meses;
    if (['instalacion','entrega'].includes(original.inicio) && original.estado === 'si') fixed.inicio = original.inicio;
    if (typeof original.serie === 'boolean') fixed.serie = original.serie;
    if (Object.entries(fixed).some(([field,value]) => manual[field] !== value)) fail('manual-preserve-terms', 'Las condiciones históricas conocidas se conservan. Completá únicamente los datos faltantes.');
    const normalized = {confirmado:true,estado:manual.estado,meses:manual.meses,inicio:manual.inicio,serie:manual.serie,fecha:manual.fecha};
    return {...clone(unit),key:unit.manualKey,config:{estado:normalized.estado,meses:normalized.meses,inicio:normalized.inicio,serie:normalized.serie,...(typeof original.equipo === 'boolean' ? {equipo:original.equipo} : {})},needsReview:false,reason:'',manualReview:normalized};
  }

  function decision(unit, value, effectiveDate, today) {
    if (!object(unit) || !object(value)) fail('invalid-unit', 'La unidad no es válida.');
    const action = value.decision;
    if (!['instalado', 'entregado', 'pendiente'].includes(action)) fail('missing-decision', 'Elegí si la unidad fue instalada, entregada o quedó pendiente.');
    if (value.serie !== undefined && typeof value.serie !== 'string') fail('invalid-series', 'La serie no es válida.');
    if (value.ubicacion !== undefined && typeof value.ubicacion !== 'string') fail('invalid-location', 'La ubicación no es válida.');
    const serie = (value.serie || '').trim();
    const ubicacion = (value.ubicacion || '').trim();
    const config = object(unit.config) ? unit.config : null;
    const review = !!unit.needsReview || !!unit.creationBlocked || !!configReason(config) || !key(unit.key);
    if (action !== 'pendiente') {
      if (!date(effectiveDate) || !date(today) || effectiveDate > today) fail('invalid-date', 'Ingresá una fecha efectiva válida, no futura.');
      if (config && config.serie === true && !serie) fail('required-series', 'Completá la serie obligatoria.');
      if (action === 'instalado' && !ubicacion) fail('required-location', 'Completá la ubicación instalada.');
    }
    const cobertura = action !== 'pendiente' && !review && config.estado === 'si' && (action === 'instalado' || config.inicio === 'entrega');
    const fechaVenc = cobertura ? expiry(effectiveDate, config.meses) : '';
    if (cobertura && !fechaVenc) fail('invalid-expiry', 'El vencimiento queda fuera del rango de fechas permitido.');
    return {
      decision:action,
      serie,
      ubicacion,
      fecha:action === 'pendiente' ? '' : effectiveDate,
      fechaInstalacion:action === 'instalado' ? effectiveDate : '',
      fechaEntrega:action === 'entregado' ? effectiveDate : '',
      cobertura,
      fechaInicioGarantia:cobertura ? effectiveDate : '',
      fechaVenc,
      meses:cobertura ? config.meses : 0,
      needsReview:review,
      reason:unit.reason || (unit.creationBlocked ? 'too-many-units' : configReason(config)) || (!key(unit.key) ? 'invalid-identity' : '')
    };
  }

  return Object.freeze({build, date, expiry, decision, key, MAX_UNITS, canReviewManually, manualUnit});
});
