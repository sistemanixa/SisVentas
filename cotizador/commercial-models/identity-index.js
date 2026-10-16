(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.Identity = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalized(value) {
    return text(value).toLocaleUpperCase('es-AR');
  }

  function valuesFrom(record, fields) {
    var seen = new Set();
    return (fields || []).map(function (field) {
      return text(record && record[field]);
    }).filter(function (value) {
      var key = normalized(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function addToMultiMap(map, key, value) {
    var normalizedKey = normalized(key);
    if (!normalizedKey) return;
    var entries = map.get(normalizedKey);
    if (!entries) {
      entries = [];
      map.set(normalizedKey, entries);
    }
    if (entries.indexOf(value) < 0) entries.push(value);
  }

  function resolution(status, value, matchedBy, key, candidates) {
    return Object.freeze({
      status: status,
      value: value || null,
      matchedBy: matchedBy || null,
      key: key || '',
      candidates: Object.freeze((candidates || []).slice())
    });
  }

  function IdentityIndex(records, options) {
    options = options || {};
    this.technicalField = options.technicalField || 'fbKey';
    this.businessFields = options.businessFields || [];
    this.nameFields = options.nameFields || [];
    this.records = Array.isArray(records) ? records.slice() : [];
    this.byTechnical = new Map();
    this.byBusiness = new Map();
    this.byName = new Map();
    this.missingTechnical = [];
    this._build();
  }

  IdentityIndex.prototype._build = function () {
    var self = this;
    this.records.forEach(function (record) {
      var technicalKey = text(record && record[self.technicalField]);
      if (technicalKey) addToMultiMap(self.byTechnical, technicalKey, record);
      else self.missingTechnical.push(record);
      valuesFrom(record, self.businessFields).forEach(function (key) {
        addToMultiMap(self.byBusiness, key, record);
      });
      valuesFrom(record, self.nameFields).forEach(function (key) {
        addToMultiMap(self.byName, key, record);
      });
    });
  };

  IdentityIndex.prototype._resolveMap = function (map, key, matchedBy) {
    var lookup = normalized(key);
    var candidates = lookup ? (map.get(lookup) || []) : [];
    if (candidates.length === 1) return resolution('found', candidates[0], matchedBy, text(key), candidates);
    if (candidates.length > 1) return resolution('ambiguous', null, matchedBy, text(key), candidates);
    return resolution('missing', null, matchedBy, text(key), []);
  };

  IdentityIndex.prototype.resolveTechnical = function (key) {
    return this._resolveMap(this.byTechnical, key, 'technical');
  };

  IdentityIndex.prototype.resolveBusiness = function (key) {
    return this._resolveMap(this.byBusiness, key, 'business');
  };

  IdentityIndex.prototype.resolveName = function (key) {
    return this._resolveMap(this.byName, key, 'name');
  };

  IdentityIndex.prototype.resolveRecord = function (record, relation) {
    relation = relation || {};
    var technical = valuesFrom(record, relation.technicalFields || []);
    var business = valuesFrom(record, relation.businessFields || []);
    var names = valuesFrom(record, relation.nameFields || []);
    var i;
    var resolved;

    // Una referencia técnica almacenada es autoritativa. Si quedó inválida,
    // jamás se reemplaza silenciosamente por un número comercial visible.
    if (technical.length) {
      for (i = 0; i < technical.length; i += 1) {
        resolved = this.resolveTechnical(technical[i]);
        if (resolved.status !== 'missing') return resolved;
      }
      return resolution('missing', null, 'technical', technical[0], []);
    }

    for (i = 0; i < business.length; i += 1) {
      resolved = this.resolveBusiness(business[i]);
      if (resolved.status !== 'missing') return resolved;
    }
    for (i = 0; i < names.length; i += 1) {
      resolved = this.resolveName(names[i]);
      if (resolved.status !== 'missing') return resolved;
    }
    return resolution('missing', null, null, '', []);
  };

  IdentityIndex.prototype.conflicts = function () {
    function duplicates(map, kind) {
      var out = [];
      map.forEach(function (records, key) {
        if (records.length > 1) out.push({ kind: kind, key: key, records: records.slice() });
      });
      return out;
    }
    return {
      technical: duplicates(this.byTechnical, 'technical'),
      business: duplicates(this.byBusiness, 'business'),
      names: duplicates(this.byName, 'name'),
      missingTechnical: this.missingTechnical.slice()
    };
  };

  return {
    IdentityIndex: IdentityIndex,
    normalized: normalized,
    text: text,
    valuesFrom: valuesFrom
  };
});
