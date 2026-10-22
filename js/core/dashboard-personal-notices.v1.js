(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SVPersonalNotices = api;
})(typeof window === 'object' ? window : null, function() {
  'use strict';

  const DAY = 86400000;
  const TYPES = new Set(['bonificacion', 'comision']);
  const STATES = new Set(['aprobado', 'pagado_parcial', 'pagado', 'pendiente', 'rechazado', 'anulado']);
  const TERMINAL = new Set(['rechazado', 'anulado']);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' ? value : '';
  const key = value => typeof value === 'string' && value.length > 0 && value.length <= 768 && !/[.#$\[\]\/\x00-\x1f\x7f]/.test(value);

  function calendar(value) {
    if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const stamp = Date.UTC(year, month - 1, day);
    const date = new Date(stamp);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
    return {date:value, day:stamp / DAY};
  }

  function timestamp(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const local = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    const result = calendar(local);
    return result && {...result, stamp:value};
  }

  function today(value) {
    if (value instanceof Date) return timestamp(value.getTime());
    return typeof value === 'string' ? calendar(value) : timestamp(value);
  }

  function cents(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    const scaled = value * 100, result = Math.round(scaled);
    // Canonical payment histories may add decimal cents as IEEE doubles.
    // Accept only their rounding noise, never a real fractional cent.
    const tolerance = Math.min(0.000001, Math.max(1, Math.abs(scaled)) * Number.EPSILON * 4);
    return Number.isSafeInteger(result) && Math.abs(scaled - result) <= tolerance ? result : null;
  }

  function period(value) {
    if (value === undefined || value === null || value === '') return null;
    return typeof value === 'string' && /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value) ? value : false;
  }

  function optionalNumber(value, places) {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return false;
    const scale = 10 ** places;
    const scaled = Math.round(value * scale);
    return Number.isSafeInteger(scaled) && scaled / scale === value ? value : false;
  }

  function build(input = {}) {
    const items = [], issues = [];
    const addIssue = (code, records, message) => issues.push({code, recordIds:records.map(record => text(record.id)), message});
    if (!key(input.employeeId)) {
      addIssue('INVALID_EMPLOYEE', [], 'No se pudo identificar la cuenta propia.');
      return {status:'incomplete', items, issues};
    }
    if (input.complete !== true) addIssue('SOURCE_INCOMPLETE', [], 'La cuenta todavía no está completa.');
    const current = today(input.now);
    if (!current) addIssue('INVALID_NOW', [], 'No se pudo establecer la fecha actual.');
    if (!Array.isArray(input.records)) {
      addIssue('INVALID_RECORDS', [], 'No se pudo comprobar el detalle de la cuenta.');
      return {status:'incomplete', items, issues};
    }

    // These are technical references from the captured own-account snapshot.
    // Amount, description, month and bonus group never establish identity.
    const nodes = [];
    for (const record of input.records) {
      if (!object(record) || record.employeeId !== input.employeeId || !TYPES.has(record.type)) continue;
      const refs = object(record.sourceRefs) ? record.sourceRefs : {};
      const rawCtaKey = refs.ctaKey == null || refs.ctaKey === '' ? null : refs.ctaKey;
      const rawGastoKey = refs.gastoKey == null || refs.gastoKey === '' ? null : refs.gastoKey;
      const ctaKey = key(rawCtaKey) ? rawCtaKey : null;
      const gastoKey = key(rawGastoKey) ? rawGastoKey : null;
      const invalidIdentity = !text(record.id) || rawCtaKey !== null && !ctaKey || rawGastoKey !== null && !gastoKey || !ctaKey && !gastoKey;
      if (!ctaKey && !gastoKey) {
        if (record.visible === true && !TERMINAL.has(record.status)) addIssue('INVALID_IDENTITY', [record], 'Falta una referencia verificable del movimiento.');
        continue;
      }
      // Keep each valid reference even when its secondary link is malformed.
      // Otherwise a malformed terminal/hidden mirror could disappear and leave
      // an older linked approval looking verified.
      nodes.push({record, ctaKey, gastoKey, invalidIdentity, parent:nodes.length});
    }

    const find = index => {
      while (nodes[index].parent !== index) {
        nodes[index].parent = nodes[nodes[index].parent].parent;
        index = nodes[index].parent;
      }
      return index;
    };
    const references = new Map();
    nodes.forEach((node, index) => {
      for (const ref of [node.ctaKey && 'cta:' + node.ctaKey, node.gastoKey && 'gasto:' + node.gastoKey].filter(Boolean)) {
        if (references.has(ref)) nodes[find(index)].parent = find(references.get(ref));
        else references.set(ref, index);
      }
    });
    const groups = new Map();
    nodes.forEach((node, index) => {
      const group = find(index);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(node);
    });

    for (const group of groups.values()) {
      const records = group.map(node => node.record);
      if (!records.some(record => record.visible === true)) continue;
      if (group.some(node => node.invalidIdentity)) {
        addIssue('INVALID_IDENTITY', records, 'Los vínculos del movimiento requieren revisión.');
        continue;
      }
      const ctaKeys = new Set(group.map(node => node.ctaKey).filter(Boolean));
      const gastoKeys = new Set(group.map(node => node.gastoKey).filter(Boolean));
      if (ctaKeys.size > 1 || gastoKeys.size > 1) {
        addIssue('CONFLICTING_LINKS', records, 'Los vínculos de la cuenta requieren revisión.');
        continue;
      }
      if (records.some(record => record.visible !== true)) {
        addIssue('CONFLICTING_VISIBILITY', records, 'La visibilidad del movimiento todavía no está confirmada.');
        continue;
      }
      if (records.some(record => !STATES.has(record.status))) {
        addIssue('INVALID_STATE', records, 'No se pudo comprobar el estado del movimiento.');
        continue;
      }
      const unique = field => new Set(records.map(record => record[field]));
      if (unique('type').size !== 1 || unique('status').size !== 1) {
        addIssue('CONFLICTING_STATE', records, 'La cuenta y el gasto muestran estados distintos.');
        continue;
      }
      if (TERMINAL.has(records[0].status)) continue;

      const amounts = records.map(record => cents(record.amount));
      const unknown = records.map(record => record.paidAmountUnknown === true);
      const payments = records.map((record, index) => unknown[index] && record.paidAmount == null ? 0 : cents(record.paidAmount));
      const periods = records.map(record => period(record.periodoComputo));
      const quantities = records.map(record => optionalNumber(record.quantity, 3));
      const units = records.map(record => record.unitAmount == null ? null : cents(record.unitAmount) ?? false);
      if (amounts.includes(null) || payments.includes(null) || periods.includes(false) || quantities.includes(false) || units.includes(false)) {
        addIssue('INVALID_DETAIL', records, 'El detalle del movimiento está incompleto.');
        continue;
      }
      // A missing optional field can be completed by its exact linked mirror.
      // Financial or approval contradictions cannot be resolved by MAX or sum.
      const distinct = values => [...new Set(values.filter(value => value !== null))];
      const metadata = [periods, quantities, units].map(distinct);
      if (new Set(amounts).size !== 1 || new Set(unknown).size !== 1 || !unknown[0] && new Set(payments).size !== 1 || metadata.some(values => values.length > 1)) {
        addIssue('CONFLICTING_DETAIL', records, 'La cuenta y el gasto muestran detalles distintos.');
        continue;
      }
      if (unknown[0] && records[0].status !== 'pagado') {
        addIssue('UNKNOWN_PAYMENT', records, 'No se pudo comprobar el detalle del pago.');
        continue;
      }
      if (!unknown[0]) {
        const state = records[0].status, paid = payments[0];
        const fullyPaid = amounts[0] > 0 && paid >= amounts[0] - 1;
        const inconsistent = state === 'pagado' && (paid <= 0 || !fullyPaid)
          || state === 'pagado_parcial' && (paid <= 0 || fullyPaid)
          || (state === 'aprobado' || state === 'pendiente') && paid > 0;
        if (inconsistent) {
          addIssue('CONFLICTING_PAYMENT_STATE', records, 'El estado y el detalle del pago requieren revisión.');
          continue;
        }
      }

      const approved = distinct(records.map(record => timestamp(record.approvedTs)?.stamp ?? null));
      const created = distinct(records.map(record => timestamp(record.createdTs)?.stamp ?? null));
      const dates = distinct(records.map(record => calendar(record.grantDate)?.date ?? null));
      if (approved.length > 1 || !approved.length && created.length > 1 || !approved.length && !created.length && dates.length > 1) {
        addIssue('CONFLICTING_DATE', records, 'Las fechas del movimiento requieren revisión.');
        continue;
      }
      const event = approved.length ? timestamp(approved[0]) : created.length ? timestamp(created[0]) : dates.length ? calendar(dates[0]) : null;
      if (!event) {
        addIssue('MISSING_DATE', records, 'El movimiento no tiene una fecha verificable de novedad.');
        continue;
      }
      if (!current || event.day > current.day || event.day < current.day - 29) continue;

      const ctaKey = [...ctaKeys][0] || null, gastoKey = [...gastoKeys][0] || null;
      const id = (gastoKey ? 'gasto:' : 'cta:') + encodeURIComponent(input.employeeId) + ':' + encodeURIComponent(gastoKey || ctaKey);
      const descriptions = [...new Set(records.map(record => text(record.description)).filter(Boolean))].sort();
      items.push({
        id, type:records[0].type, employeeId:input.employeeId,
        sourceRefs:{ctaKey, gastoKey}, amount:amounts[0] / 100,
        paidAmount:unknown[0] ? null : payments[0] / 100,
        remaining:unknown[0] ? null : Math.max(0, amounts[0] - payments[0]) / 100,
        paidAmountUnknown:unknown[0], status:records[0].status,
        period:metadata[0][0] || null, date:event.date,
        description:descriptions[0] || '', quantity:metadata[1][0] ?? null,
        unitAmount:metadata[2].length ? metadata[2][0] / 100 : null,
        _order:event.stamp ?? event.day * DAY
      });
    }
    items.sort((a, b) => b._order - a._order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    items.forEach(item => { delete item._order; });
    return {status:issues.length ? 'incomplete' : 'ready', items, issues};
  }

  return Object.freeze({build});
});
