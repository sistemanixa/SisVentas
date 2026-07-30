(function (root, factory) {
  var identity = typeof module === 'object' && module.exports
    ? require('./identity-index.js')
    : root.SisVentas.V3.Identity;
  var api = factory(identity);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.ProductProviderReadModel = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (identity) {
  'use strict';

  var DAY_MS = 24 * 60 * 60 * 1000;
  var SUPPORTED_TYPES = Object.freeze([
    'biosegur',
    'free_electron',
    'tecnoprices',
    'mercado_libre'
  ]);
  var DEFAULT_SELECTED_TYPES = Object.freeze([
    'biosegur',
    'free_electron',
    'tecnoprices'
  ]);

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalized(value) {
    return text(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es-AR');
  }

  function number(value) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function active(record) {
    return !!record && record.activo !== false && normalized(record.estado) !== 'inactivo';
  }

  function isLabor(product) {
    product = product || {};
    var explicit = product.esManoDeObra === true ||
      product.esManoDeObra === 1 ||
      normalized(product.esManoDeObra) === 'true' ||
      product.esManoObra === true ||
      product.esManoObra === 1 ||
      normalized(product.esManoObra) === 'true';
    if (explicit) return true;
    var category = normalized(product.categoria || product.catId || product.tipoProducto);
    var name = normalized(product.nombre || product.descripcion);
    return category.indexOf('mano de obra') >= 0 || /^mano de obra\b/.test(name);
  }

  function normalizeUrl(value) {
    var raw = text(value);
    if (!raw) return '';
    if (/^\d+$/.test(raw)) return 'https://www.tecnoprices.com/' + raw;
    if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw.replace(/^\/+/, '');
    try {
      var parsed = new URL(raw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch (error) {
      return '';
    }
  }

  function providerType(value) {
    var url = normalizeUrl(value);
    if (!url) return '';
    var host;
    try { host = new URL(url).hostname.toLocaleLowerCase('es-AR'); }
    catch (error) { return ''; }
    if (/(^|\.)biosegur\.com\.ar$/.test(host)) return 'biosegur';
    if (/(^|\.)free-electron\.com\.ar$/.test(host)) return 'free_electron';
    if (/(^|\.)tecnoprices\.com$/.test(host)) return 'tecnoprices';
    if (/(^|\.)mercadolibre\.com\.ar$/.test(host) || host === 'meli.la') return 'mercado_libre';
    return '';
  }

  function nameMatchesType(value, type) {
    var name = normalized(value);
    if (type === 'biosegur') return /\bbiosegur\b/.test(name);
    if (type === 'free_electron') return /\bfree[\s-]*electron\b/.test(name);
    if (type === 'tecnoprices') return /\btecnoprices\b/.test(name);
    if (type === 'mercado_libre') return /\bmercado\s*libre\b|\bmercadolibre\b/.test(name);
    return false;
  }

  function legacyLink(product) {
    var name = text(product && (product.proveedor || product.nom_prov));
    var url = normalizeUrl(product && (product.codWeb || product.proveedorUrl || product.urlProveedor || product.url));
    if (!name && !url) return null;
    return {
      nombre: name,
      proveedorKey: text(product && (product.proveedorKey || product.proveedorFbKey)),
      precio: number(product && (product.precioArsPublicado || product.precioGremio || product.compraARS || product.compra)),
      url: url,
      actualizado: product && (product.fechaActualizacionPrecio || product.proveedorActualizado || product.actualizado),
      actualizadoEn: number(product && (product.precioActualizadoEn || product.actualizadoEn)),
      origen: 'legacy'
    };
  }

  function rawLinks(product) {
    if (Array.isArray(product && product.proveedores) && product.proveedores.length) {
      return product.proveedores.filter(Boolean).map(function (provider) {
        return Object.assign({}, provider);
      });
    }
    var legacy = legacyLink(product || {});
    return legacy ? [legacy] : [];
  }

  function dateTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    var raw = text(value);
    if (!raw) return 0;
    var local = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    var iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    var result = local
      ? new Date(+local[3], +local[2] - 1, +local[1], 23, 59, 59, 999).getTime()
      : iso
        ? new Date(+iso[1], +iso[2] - 1, +iso[3], 23, 59, 59, 999).getTime()
        : Date.parse(raw);
    return Number.isFinite(result) ? result : 0;
  }

  function providerTimestamp(product, provider, linkCount) {
    provider = provider || {};
    var timestamps = [
      number(provider.actualizadoEn),
      number(provider.precioActualizadoEn),
      dateTimestamp(provider.actualizado || provider.fechaActualizacionPrecio || provider.fechaActualizacion)
    ];
    // La fecha de la raíz pertenecía al único proveedor de los productos legacy.
    // En productos con varios proveedores no puede validar a todos a la vez.
    if (linkCount <= 1) {
      timestamps.push(
        number(product && product.precioActualizadoEn),
        number(product && product.actualizadoEn),
        dateTimestamp(product && (product.fechaActualizacionPrecio || product.proveedorActualizado || product.actualizado))
      );
    }
    return timestamps.reduce(function (max, value) { return Math.max(max, value || 0); }, 0);
  }

  function freshness(product, provider, options) {
    options = options || {};
    var now = number(options.now) || Date.now();
    var maxAgeMs = number(options.maxAgeMs) > 0 ? number(options.maxAgeMs) : DAY_MS;
    var timestamp = providerTimestamp(product, provider, number(options.linkCount) || 1);
    if (!timestamp) return Object.freeze({ status: 'unverified', current: false, timestamp: 0, ageMs: null });
    var ageMs = Math.max(0, now - timestamp);
    return Object.freeze({
      status: ageMs <= maxAgeMs ? 'current' : 'expired',
      current: ageMs <= maxAgeMs,
      timestamp: timestamp,
      ageMs: ageMs
    });
  }

  function issue(kind, product, providerIndex, extra) {
    return Object.freeze(Object.assign({
      kind: kind,
      productFbKey: text(product && product.fbKey),
      productBusinessId: text(product && (product.codigo || product.cod || product.id)),
      providerIndex: providerIndex == null ? null : providerIndex
    }, extra || {}));
  }

  function ProductProviderReadModel(products, providers, options) {
    options = options || {};
    this.products = Array.isArray(products) ? products.slice() : [];
    this.providers = Array.isArray(providers) ? providers.slice() : [];
    this.now = number(options.now) || Date.now();
    this.maxAgeMs = number(options.maxAgeMs) > 0 ? number(options.maxAgeMs) : DAY_MS;
    this.providerIndex = new identity.IdentityIndex(this.providers, {
      businessFields: ['id', 'codigo', 'cuit'],
      nameFields: ['nombre', 'razonSocial']
    });
  }

  ProductProviderReadModel.prototype._resolveProvider = function (link) {
    return this.providerIndex.resolveRecord(link || {}, {
      technicalFields: ['proveedorFbKey', 'proveedorKey'],
      businessFields: ['proveedorId', 'idProveedor'],
      nameFields: ['nombre', 'proveedor']
    });
  };

  ProductProviderReadModel.prototype._link = function (product, provider, providerIndex, linkCount) {
    var url = normalizeUrl(provider && (provider.url || provider.proveedorUrl));
    var type = providerType(url);
    var name = text(provider && (provider.nombre || provider.proveedor));
    var resolution = this._resolveProvider(provider);
    var master = resolution.status === 'found' ? resolution.value : null;
    var masterActive = !!master && active(master);
    var compatible = !!type && nameMatchesType(name || master && master.nombre, type) && masterActive;
    return Object.freeze({
      product: product,
      productFbKey: text(product && product.fbKey),
      provider: Object.freeze(Object.assign({}, provider || {}, { url: url })),
      providerIndex: providerIndex,
      providerFbKey: text(master && master.fbKey),
      providerResolution: resolution.status,
      providerMatchedBy: resolution.matchedBy,
      type: type,
      compatible: compatible,
      current: freshness(product, provider, {
        now: this.now,
        maxAgeMs: this.maxAgeMs,
        linkCount: linkCount
      })
    });
  };

  ProductProviderReadModel.prototype.linksFor = function (product) {
    if (!product || isLabor(product)) return Object.freeze([]);
    var providers = rawLinks(product);
    var self = this;
    return Object.freeze(providers.map(function (provider, providerIndex) {
      return self._link(product, provider, providerIndex, providers.length);
    }));
  };

  ProductProviderReadModel.prototype.compatibleLinks = function (options) {
    options = options || {};
    var selected = new Set(Array.isArray(options.selectedTypes)
      ? options.selectedTypes
      : DEFAULT_SELECTED_TYPES);
    var pendingOnly = options.pendingOnly === true;
    var output = [];
    this.products.filter(active).forEach(function (product) {
      this.linksFor(product).forEach(function (link) {
        if (!link.productFbKey || !link.compatible || !selected.has(link.type)) return;
        if (pendingOnly && link.current.current) return;
        output.push(link);
      });
    }, this);
    return Object.freeze(output);
  };

  ProductProviderReadModel.prototype.summary = function (options) {
    options = options || {};
    var catalog = this.products.filter(active);
    var labor = catalog.filter(isLabor);
    var reviewable = catalog.filter(function (product) { return !isLabor(product); });
    var links = this.compatibleLinks({ selectedTypes: options.selectedTypes });
    var automatable = new Set();
    var pending = new Set();
    links.forEach(function (link) {
      if (!link.productFbKey) return;
      automatable.add(link.productFbKey);
      if (!link.current.current) pending.add(link.productFbKey);
    });
    return Object.freeze({
      catalogProducts: reviewable.length,
      laborExcluded: labor.length,
      automatableProducts: automatable.size,
      pendingProducts: pending.size,
      currentProducts: Math.max(0, automatable.size - pending.size),
      manualProducts: Math.max(0, reviewable.length - automatable.size),
      compatibleLinks: links.length,
      pendingLinks: links.filter(function (link) { return !link.current.current; }).length
    });
  };

  ProductProviderReadModel.prototype.audit = function (options) {
    var issues = [];
    var self = this;
    this.products.filter(active).forEach(function (product) {
      var providers = rawLinks(product);
      if (!text(product.fbKey)) issues.push(issue('missing-product-technical-key', product));
      if (isLabor(product)) {
        if (providers.length) issues.push(issue('labor-has-provider', product, null, { providerCount: providers.length }));
        return;
      }
      if (!providers.length) {
        issues.push(issue('missing-provider-link', product));
        return;
      }
      var seen = new Set();
      providers.forEach(function (provider, providerIndex) {
        var link = self._link(product, provider, providerIndex, providers.length);
        if (link.providerResolution !== 'found') {
          issues.push(issue(
            link.providerResolution === 'ambiguous' ? 'ambiguous-provider' : 'missing-provider',
            product,
            providerIndex
          ));
        }
        if (!link.provider.url) issues.push(issue('missing-provider-url', product, providerIndex));
        else if (!link.type) issues.push(issue('unsupported-provider-url', product, providerIndex));
        else if (!nameMatchesType(provider.nombre || provider.proveedor, link.type)) {
          issues.push(issue('provider-name-url-mismatch', product, providerIndex, { type: link.type }));
        }
        var duplicateKey = link.providerFbKey || normalized(provider.nombre || provider.proveedor) + '|' + link.provider.url;
        if (duplicateKey && seen.has(duplicateKey)) issues.push(issue('duplicate-provider-link', product, providerIndex));
        if (duplicateKey) seen.add(duplicateKey);
      });
    });
    var blockingKinds = new Set([
      'missing-product-technical-key',
      'duplicate-provider-link',
      'labor-has-provider'
    ]);
    var blockingIssues = issues.filter(function (entry) { return blockingKinds.has(entry.kind); });
    return Object.freeze({
      issues: Object.freeze(issues),
      blockingIssues: Object.freeze(blockingIssues),
      summary: this.summary(options),
      ready: blockingIssues.length === 0
    });
  };

  return {
    ProductProviderReadModel: ProductProviderReadModel,
    SUPPORTED_TYPES: SUPPORTED_TYPES,
    DEFAULT_SELECTED_TYPES: DEFAULT_SELECTED_TYPES,
    isLabor: isLabor,
    normalizeUrl: normalizeUrl,
    providerType: providerType,
    nameMatchesType: nameMatchesType,
    rawLinks: rawLinks,
    providerTimestamp: providerTimestamp,
    freshness: freshness
  };
});
