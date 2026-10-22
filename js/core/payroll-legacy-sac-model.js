(function(root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SVPayrollLegacySACModel = api;
})(typeof window === 'object' ? window : null, function() {
  'use strict';
  var PURPOSE = 'employee-sac-migration';
  var ACTION = 'mantenimiento.migrar';
  var CODE = 'SV_LEGACY_SAC_REVIEW';
  var object = function(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); };
  var clone = function(value) { return value == null ? null : JSON.parse(JSON.stringify(value)); };
  var own = function(value, key) { return Object.hasOwn(value || {}, key); };
  function fail(message) { throw Object.assign(new Error(message + ' Revisá el registro histórico antes de migrarlo.'), { code: CODE, svLaborAttempted: false }); }
  function key(value, maximum) {
    if (typeof value !== 'string' || !value || value.length > (maximum || 256) || /[.#$\[\]\/\x00-\x1f\x7f]/.test(value) ||
        ['__proto__', 'prototype', 'constructor', 'hasOwnProperty'].includes(value)) fail('La referencia de origen no es válida.');
    return value;
  }
  function describe(sourcePath) {
    if (typeof sourcePath !== 'string') fail('No se identificó el origen del SAC.');
    var parts = sourcePath.split('/');
    if (parts.length !== 4 || parts[0] !== 'sisventas' || !['aguinaldos', 'ctaemp'].includes(parts[1])) fail('El origen no pertenece a una migración de SAC.');
    var employeeId = key(parts[2]), sourceId = key(parts[3]);
    if (parts[1] === 'aguinaldos' && !/^\d{4}_S[12]$/.test(sourceId)) fail('El semestre histórico no es válido.');
    var legacyKey = parts.slice(1).join('/'), expenseKey = 'sac_legacy_' + encodeURIComponent(legacyKey);
    if (expenseKey.length > 700) fail('La referencia histórica es demasiado larga.');
    return Object.freeze({ sourcePath: sourcePath, origin: parts[1], employeeId: employeeId, sourceId: sourceId,
      legacyKey: legacyKey, expenseKey: expenseKey });
  }
  // These normalizations intentionally match the existing payable migration.
  function money(value) { return Math.round((parseFloat(value) || 0) * 100) / 100; }
  function date(value) {
    if (!value) return '';
    value = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value.slice(6) + '-' + value.slice(3, 5) + '-' + value.slice(0, 2);
    return value.slice(0, 10);
  }
  function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00Z')) &&
      new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
  }
  function checkedDate(value, fallback) {
    var normalized = date(value) || fallback;
    if (!validDate(normalized)) fail('La fecha del SAC está incompleta o no es válida.');
    return normalized;
  }
  function metadata(options) {
    if (typeof options.employeeName !== 'string' || options.employeeName.length > 500 || !validDate(options.fallbackDate) ||
        !Number.isSafeInteger(options.stamp) || options.stamp <= 0) fail('No se pudo fijar el contexto de la migración.');
  }
  function verifyIdentity(source, descriptor) {
    if (!object(source)) fail('No se pudo comprobar la marca de SAC en su origen.');
    if (source.anulado === true || String(source.estado || '').trim().toLowerCase() === 'anulado') fail('El SAC histórico está anulado y no se convertirá en una nueva deuda.');
    if (descriptor.origin === 'ctaemp' && String(source.tipo || '').toLowerCase() !== 'aguinaldo') fail('El movimiento de origen no es un aguinaldo.');
    ['empleadoFbKey', 'empleadoId', 'empFbKey'].forEach(function(field) {
      if (source[field] !== undefined && source[field] !== null && source[field] !== '' && String(source[field]) !== descriptor.employeeId) fail('La identidad del SAC contradice su ubicación.');
    });
    if (descriptor.origin === 'aguinaldos' && source.semestre && source.semestre !== descriptor.sourceId) fail('El semestre del SAC contradice su ubicación.');
    if (source.semestre && !/^\d{4}_S[12]$/.test(String(source.semestre))) fail('El semestre histórico está incompleto.');
    if (descriptor.origin === 'aguinaldos' && source.aguinaldo && source.monto && money(source.aguinaldo) !== money(source.monto)) fail('Los importes de la marca de SAC se contradicen.');
    if (source.pagos !== undefined && source.pagos !== null && typeof source.pagos !== 'object') fail('El historial de pagos no es válido.');
    if (source.pagos) Object.values(source.pagos).forEach(function(payment) {
      if (!object(payment) || !Number.isFinite(parseFloat(payment.monto))) fail('Un pago histórico está incompleto.');
      if (payment.fecha && !validDate(date(payment.fecha))) fail('Un pago histórico tiene una fecha no válida.');
    });
    if (source.montoPagado && !Number.isFinite(parseFloat(source.montoPagado))) fail('El importe pagado histórico no es válido.');
  }
  function applyPayments(expense, record, stamp) {
    var state = String(record.estado || '').toLowerCase();
    var total = money(expense.monto);
    var paid = money(record.montoPagado || (state === 'pagado' ? total : 0));
    var payments = record.pagos && typeof record.pagos === 'object' ? record.pagos : null;
    var paymentDate = date(record.fechaPago || '');
    if (!paid && payments) paid = money(Object.keys(payments).reduce(function(sum, key) { return sum + (parseFloat((payments[key] || {}).monto) || 0); }, 0));
    if (paid <= 0) return expense;
    if (!paymentDate && payments) paymentDate = Object.keys(payments).map(function(key) { return date((payments[key] || {}).fecha); }).filter(Boolean).sort().pop() || '';
    paymentDate = checkedDate(paymentDate, expense.fecha);
    expense.fecha = paymentDate;
    expense.fechaImputacion = paymentDate;
    expense.mes = paymentDate.slice(0, 7);
    expense.montoPagado = Math.min(total, paid);
    expense.estado = expense.montoPagado >= total ? 'pagado' : 'pagado_parcial';
    expense.medio = record.medioPago || record.medio || expense.medio;
    expense.pagos = clone(payments) || { pago_legacy: { fecha: paymentDate, monto: expense.montoPagado,
      medio: expense.medio || '', concepto: expense.tipoPagable || 'pagable', ts: record.pagadoTs || record.ts || stamp } };
    return expense;
  }
  function build(options) {
    metadata(options);
    var descriptor = describe(options.sourcePath), source = options.source;
    verifyIdentity(source, descriptor);
    var amount = money(descriptor.origin === 'aguinaldos' ? (source.aguinaldo || source.monto || 0) : (source.monto || 0));
    if (!Number.isFinite(amount) || amount <= 0) fail('El SAC histórico no tiene un importe positivo comprobable.');
    var name = options.employeeName || source.empleadoNombre || '';
    var period = descriptor.origin === 'aguinaldos' ? descriptor.sourceId : source.semestre || '';
    var initialDate = descriptor.origin === 'aguinaldos' ? checkedDate(source.fecha, options.fallbackDate)
      : checkedDate(date(source.fechaPago || source.fechaImputacion) || date(source.fechaTrabajo || source.fecha), options.fallbackDate);
    var periodLabel = descriptor.sourceId.replace('_S1', ' — 1er semestre').replace('_S2', ' — 2do semestre');
    var description = descriptor.origin === 'aguinaldos' ? 'Aguinaldo ' + (name || descriptor.employeeId) + ' — ' + periodLabel
      : (source.descripcion || 'Aguinaldo') + ' — ' + name;
    var expense = { fecha: initialDate, tipo: 'Fijo', tipoPagable: 'aguinaldo', descripcion: description, categoria: 'Personal',
      monto: amount, medio: 'Transferencia', estado: 'Pendiente', empleadoId: descriptor.employeeId, empleadoFbKey: descriptor.employeeId,
      empleadoNombre: name, mes: initialDate.slice(0, 7), periodoTrabajo: '', fechaTrabajo: '', fechaImputacion: initialDate,
      aprobadoTs: null, semestre: period, mejorSueldo: source.mejorSueldo || null, hsExtra: descriptor.origin === 'ctaemp' ? source.hsExtra || null : null,
      origenLegacy: descriptor.origin, legacyKey: descriptor.legacyKey, migradoDesdeLegacy: true, ts: source.ts || options.stamp };
    // CTA keeps its canonical payment conversion. Applying the same conversion
    // to historical AGU rows prevents an already paid SAC becoming a new debt.
    return applyPayments(expense, source, options.stamp);
  }
  function validateExisting(expense, expected, descriptor) {
    if (!object(expense) || String(expense.tipoPagable || '').toLowerCase() !== 'aguinaldo' ||
        String(expense.empleadoFbKey || expense.empleadoId || '') !== descriptor.employeeId ||
        expense.empleadoFbKey && expense.empleadoId && expense.empleadoFbKey !== expense.empleadoId ||
        money(expense.monto) !== expected.monto || String(expense.semestre || '') !== String(expected.semestre || '') ||
        expense.legacyKey && expense.legacyKey !== descriptor.legacyKey) fail('El gasto vinculado contradice el origen del SAC.');
  }
  function plan(options) {
    var descriptor = describe(options.sourcePath), expense = build(options), source = options.source, expenses = options.gastos === null ? {} : options.gastos;
    if (!object(expenses)) fail('No se pudo comprobar el listado de Gastos para evitar duplicados.');
    var linked = source.gastoFbKey ? key(String(source.gastoFbKey), 700) : '';
    if (linked && !own(expenses, linked)) fail('El SAC tiene un vínculo a un gasto que ya no está disponible.');
    var matches = Object.keys(expenses).filter(function(id) { return id === descriptor.expenseKey || id === linked || expenses[id]?.legacyKey === descriptor.legacyKey; });
    if (matches.length > 1) fail('Hay más de un gasto vinculado al mismo SAC histórico.');
    var existingKey = matches[0];
    if (existingKey) {
      validateExisting(expenses[existingKey], expense, descriptor);
      if (linked && linked !== existingKey) fail('El vínculo histórico del SAC cambió.');
      if (linked === existingKey && source.migradoAGastos === true) return { created: false, unchanged: true, expenseKey: existingKey, expense: clone(expenses[existingKey]), source: clone(source), patch: {} };
    } else {
      if (source.migradoAGastos === true) fail('La marca de migración no tiene un gasto comprobable.');
      var duplicates = Object.values(expenses).some(function(row) {
        return row && String(row.tipoPagable || '').toLowerCase() === 'aguinaldo' &&
          String(row.empleadoFbKey || row.empleadoId || '') === descriptor.employeeId &&
          String(row.semestre || '') === String(expense.semestre || '') && money(row.monto) === expense.monto;
      });
      if (duplicates) fail('Ya existe un SAC del mismo empleado, período e importe sin un vínculo inequívoco.');
    }
    var expenseKey = existingKey || descriptor.expenseKey;
    var nextSource = Object.assign({}, clone(source), { gastoFbKey: expenseKey, migradoAGastos: true, migradoTs: options.stamp });
    var patch = {};
    if (!existingKey) patch['sisventas/gastos/' + expenseKey] = expense;
    patch[descriptor.sourcePath] = nextSource;
    return { created: !existingKey, unchanged: false, expenseKey: expenseKey, expense: existingKey ? clone(expenses[existingKey]) : expense, source: nextSource, patch: patch };
  }
  function pathsFor(sourcePaths) {
    if (!Array.isArray(sourcePaths) || !sourcePaths.length || new Set(sourcePaths).size !== sourcePaths.length) fail('La selección de SAC no es válida o está repetida.');
    var sources = sourcePaths.map(describe);
    return ['sisventas/gastos'].concat(sources.length <= 127 ? sources.map(function(source) { return source.sourcePath; })
      : Array.from(new Set(sources.map(function(source) { return 'sisventas/' + source.origin; }))));
  }
  function readSource(values, sourcePath) {
    describe(sourcePath);
    if (own(values, sourcePath)) return values[sourcePath];
    var base = sourcePath.split('/').slice(0, 2).join('/');
    if (!own(values, base)) fail('Falta comprobar una fuente histórica seleccionada.');
    return sourcePath.split('/').slice(2).reduce(function(value, part) { return own(value, part) ? value[part] : null; }, values[base]);
  }
  function planBatch(options) {
    if (!Array.isArray(options.entries) || !options.entries.length) fail('No hay SAC históricos seleccionados.');
    pathsFor(options.entries.map(function(entry) { return entry.sourcePath; }));
    if (options.gastos !== null && !object(options.gastos)) fail('No se pudo comprobar el listado de Gastos para evitar duplicados.');
    var expenses = clone(options.gastos) || {}, patch = {}, plans = [], createdCount = 0;
    options.entries.forEach(function(entry) {
      var next = plan({ sourcePath: entry.sourcePath, source: entry.source, employeeName: entry.employeeName,
        gastos: expenses, fallbackDate: entry.fallbackDate ?? options.fallbackDate, stamp: entry.stamp ?? options.stamp });
      plans.push(next);
      if (next.created) { expenses[next.expenseKey] = clone(next.expense); createdCount++; }
      Object.assign(patch, next.patch);
    });
    return { createdCount: createdCount, unchanged: Object.keys(patch).length === 0, patch: patch, plans: plans };
  }
  return Object.freeze({ PURPOSE: PURPOSE, ACTION: ACTION, CODE: CODE, describe: describe, build: build, plan: plan,
    pathsFor: pathsFor, readSource: readSource, planBatch: planBatch });
});
