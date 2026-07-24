(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.OTReadModel = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function dateISO(value) {
    var raw = text(value).slice(0, 10);
    var match;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) return match[3] + '-' + match[2] + '-' + match[1];
    return '';
  }

  function status(record) {
    return text(record && record.estado).toLocaleLowerCase('es-AR');
  }

  function closed(record) {
    var value = status(record);
    return value.indexOf('complet') >= 0 ||
      value.indexOf('finaliz') >= 0 ||
      value.indexOf('cerrad') >= 0 ||
      value.indexOf('terminad') >= 0;
  }

  function recordDate(record) {
    return dateISO(record && (record.fechaProgramada || record.fecha || record.programada));
  }

  function canonicalRows(records) {
    var rows = [];
    var byTechnical = new Map();
    var conflicts = [];
    (Array.isArray(records) ? records : []).forEach(function (record) {
      var key = text(record && record.fbKey);
      if (!key) {
        rows.push(record);
        conflicts.push({ kind: 'missing-technical-key', record: record });
        return;
      }
      if (byTechnical.has(key)) {
        conflicts.push({
          kind: 'duplicate-technical-key',
          key: key,
          records: [byTechnical.get(key), record]
        });
        return;
      }
      byTechnical.set(key, record);
      rows.push(record);
    });
    return { rows: rows, conflicts: conflicts };
  }

  function createReadModel(records, today) {
    var canonical = canonicalRows(records);
    var currentDate = dateISO(today) || new Date().toISOString().slice(0, 10);
    var openRows = canonical.rows.filter(function (record) { return !closed(record); });
    var completedRows = canonical.rows.filter(closed);
    var todayRows = openRows.filter(function (record) {
      return recordDate(record) === currentDate;
    });

    return Object.freeze({
      rows: canonical.rows.slice(),
      openRows: openRows,
      completedRows: completedRows,
      todayRows: todayRows,
      conflicts: canonical.conflicts.slice(),
      metrics: Object.freeze({
        open: openRows.length,
        today: todayRows.length,
        completed: completedRows.length
      }),
      filterPeriod: function (period) {
        if (period === 'today') return todayRows.slice();
        if (period === 'open') return openRows.slice();
        if (period === 'completed') return completedRows.slice();
        return canonical.rows.slice();
      }
    });
  }

  return {
    dateISO: dateISO,
    closed: closed,
    canonicalRows: canonicalRows,
    createReadModel: createReadModel
  };
});
