(function (root, factory) {
  var dependencies = typeof module === 'object' && module.exports
    ? {
        LegacySnapshot: require('./v3/legacy-snapshot.js'),
        MigrationAudit: require('./v3/migration-audit.js'),
        ShadowComparison: require('./v3/shadow-comparison.js'),
        FeatureGates: require('./v3/feature-gates.js')
      }
    : {
        LegacySnapshot: root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.LegacySnapshot,
        MigrationAudit: root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.MigrationAudit,
        ShadowComparison: root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.ShadowComparison,
        FeatureGates: root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.FeatureGates
      };
  var api = factory(dependencies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3Shadow = api.create(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dependencies) {
  'use strict';

  var MAX_SALES_SAMPLE = 24;
  var MAX_BUDGET_SAMPLE = 40;
  var DEFAULT_READY_TIMEOUT_MS = 15000;

  function array(value) {
    return Array.isArray(value) ? value.slice() : Object.values(value || {});
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function firstDefined(root, names) {
    var index;
    for (index = 0; index < names.length; index += 1) {
      if (root[names[index]] != null) return root[names[index]];
    }
    return [];
  }

  function todayISO(root) {
    var date = new (root.Date || Date)();
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function enabledByQuery(root) {
    var search = root.location && root.location.search || '';
    try {
      return new URLSearchParams(search).get('v3_shadow') === '1';
    } catch (error) {
      return /(?:\?|&)v3_shadow=1(?:&|$)/.test(search);
    }
  }

  function collectionSource(root) {
    return {
      clientes: firstDefined(root, ['clientesData', 'clientesList', 'cliData']),
      empleados: firstDefined(root, ['empData', 'empleadosData', 'empleadosList']),
      productos: firstDefined(root, ['prodData', 'productosData']),
      proveedores: firstDefined(root, ['proveedoresData', 'providersData']),
      presupuestos: firstDefined(root, ['pptoData', 'pptosData', 'presupuestosData']),
      ventas: firstDefined(root, ['ventasList', 'ventasData']),
      pagos: firstDefined(root, ['_historialPagosCompleto', '_pagosListaActual', 'pagosData', 'pagosList']),
      ordenesTrabajo: firstDefined(root, ['otData', 'ordenesTrabajoData'])
    };
  }

  function selectedProviderTypes(root) {
    if (typeof root.proveedoresSeleccionadosActualizador === 'function') {
      try {
        var selected = root.proveedoresSeleccionadosActualizador();
        if (Array.isArray(selected)) return selected.slice();
      } catch (error) {}
    }
    return ['biosegur', 'free_electron', 'tecnoprices'];
  }

  function legacyIsLabor(root, product) {
    if (typeof root.esProductoManoDeObra === 'function') {
      try { return root.esProductoManoDeObra(product) === true; }
      catch (error) {}
    }
    product = product || {};
    var explicit = product.esManoDeObra === true ||
      product.esManoDeObra === 1 ||
      text(product.esManoDeObra).toLocaleLowerCase('es-AR') === 'true';
    var category = text(product.categoria || product.catId || product.tipoProducto)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR');
    var name = text(product.nombre || product.descripcion)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR');
    return explicit || category.indexOf('mano de obra') >= 0 || /^mano de obra\b/.test(name);
  }

  function emptyProductProviderSummary() {
    return {
      catalogProducts: 0,
      laborExcluded: 0,
      reviewProducts: 0,
      reviewCurrentProducts: 0,
      automatableProducts: 0,
      pendingProducts: 0,
      currentProducts: 0,
      manualProducts: 0,
      compatibleLinks: 0,
      pendingLinks: 0
    };
  }

  function legacyProductProviderSummary(root, selectedTypes) {
    var products = array(firstDefined(root, ['prodData', 'productosData'])).filter(function (product) {
      return product && product.activo !== false && text(product.estado).toLocaleLowerCase('es-AR') !== 'inactivo';
    });
    if (!products.length) return emptyProductProviderSummary();
    if (typeof root.productosBiosegurActualizables !== 'function' ||
        typeof root.estadoVigenciaPrecioProveedor !== 'function') return emptyProductProviderSummary();
    var allLinks;
    try { allLinks = array(root.productosBiosegurActualizables()); }
    catch (error) { return emptyProductProviderSummary(); }
    var selected = new Set(selectedTypes || []);
    var links = allLinks.filter(function (link) { return selected.has(text(link && link.tipo)); });
    var laborExcluded = products.filter(function (product) { return legacyIsLabor(root, product); }).length;
    var catalogProducts = products.length - laborExcluded;
    var reviewProducts = products.filter(function (product) {
      if (legacyIsLabor(root, product)) return false;
      if (typeof root.estadoVigenciaPrecioProducto === 'function') {
        try { return root.estadoVigenciaPrecioProducto(product).vigente !== true; }
        catch (error) {}
      }
      var providers = Array.isArray(product && product.proveedores)
        ? product.proveedores.filter(Boolean)
        : [];
      if (!providers.length) return true;
      return providers.some(function (provider) {
        try { return root.estadoVigenciaPrecioProveedor(product, provider).vigente !== true; }
        catch (error) { return true; }
      });
    }).length;
    var automatable = new Set();
    var pending = new Set();
    var pendingLinks = 0;
    links.forEach(function (link) {
      var key = text(link && link.producto && link.producto.fbKey);
      if (!key) return;
      automatable.add(key);
      var current = false;
      try { current = root.estadoVigenciaPrecioProveedor(link.producto, link.proveedor).vigente === true; }
      catch (error) {}
      if (!current) {
        pending.add(key);
        pendingLinks += 1;
      }
    });
    return {
      catalogProducts: catalogProducts,
      laborExcluded: laborExcluded,
      reviewProducts: reviewProducts,
      reviewCurrentProducts: Math.max(0, catalogProducts - reviewProducts),
      automatableProducts: automatable.size,
      pendingProducts: pending.size,
      currentProducts: Math.max(0, automatable.size - pending.size),
      manualProducts: Math.max(0, catalogProducts - automatable.size),
      compatibleLinks: links.length,
      pendingLinks: pendingLinks
    };
  }

  function snapshot(root) {
    return dependencies.LegacySnapshot.create(collectionSource(root));
  }

  function primaryDataReady(root) {
    if (typeof root.svEstadoCargaInicial !== 'function') return true;
    try {
      return root.svEstadoCargaInicial().completo === true;
    } catch (error) {
      return false;
    }
  }

  function identityIssueCount(entry) {
    if (!entry) return 0;
    return ['technical', 'business', 'names', 'missingTechnical'].reduce(function (total, field) {
      return total + array(entry[field]).length;
    }, 0);
  }

  function compactIdentity(entry) {
    entry = entry || {};
    return Object.freeze({
      technical: array(entry.technical).length,
      business: array(entry.business).length,
      names: array(entry.names).length,
      missingTechnical: array(entry.missingTechnical).length
    });
  }

  function relationsFor(report, prefix) {
    return array(report && report.relationIssues).filter(function (issue) {
      return text(issue && issue.collection).indexOf(prefix) === 0;
    });
  }

  function selectSalesSample(sales) {
    var byBusiness = {};
    var duplicateKeys = {};
    array(sales).forEach(function (sale) {
      var key = text(sale && (sale.id || sale.numero || sale.nro || sale.codigo)).toLocaleUpperCase('es-AR');
      if (!key) return;
      byBusiness[key] = (byBusiness[key] || 0) + 1;
      if (byBusiness[key] > 1) duplicateKeys[key] = true;
    });
    var prioritized = [];
    var remaining = [];
    array(sales).forEach(function (sale) {
      var key = text(sale && (sale.id || sale.numero || sale.nro || sale.codigo)).toLocaleUpperCase('es-AR');
      (duplicateKeys[key] ? prioritized : remaining).push(sale);
    });
    return prioritized.concat(remaining).slice(0, MAX_SALES_SAMPLE);
  }

  function legacySalesSummaries(root, sales) {
    if (typeof root._svMontoPagadoVenta !== 'function' ||
        typeof root._svSaldoPendienteVenta !== 'function') return [];
    return selectSalesSample(sales).map(function (sale) {
      return {
        fbKey: text(sale && sale.fbKey),
        total: typeof root._svTotalVentaCanonico === 'function'
          ? Number(root._svTotalVentaCanonico(sale)) || 0
          : Number(sale && sale.total) || 0,
        paid: Number(root._svMontoPagadoVenta(sale)) || 0,
        balance: Number(root._svSaldoPendienteVenta(sale)) || 0
      };
    }).filter(function (summary) {
      return !!summary.fbKey;
    });
  }

  function selectBudgetSample(budgets) {
    var byBusiness = {};
    var duplicateKeys = {};
    array(budgets).forEach(function (budget) {
      var key = text(budget && (budget.id || budget.numero || budget.nro)).toLocaleUpperCase('es-AR');
      if (!key) return;
      byBusiness[key] = (byBusiness[key] || 0) + 1;
      if (byBusiness[key] > 1) duplicateKeys[key] = true;
    });
    var prioritized = [];
    var remaining = [];
    array(budgets).forEach(function (budget) {
      var key = text(budget && (budget.id || budget.numero || budget.nro)).toLocaleUpperCase('es-AR');
      (duplicateKeys[key] ? prioritized : remaining).push(budget);
    });
    return prioritized.concat(remaining).slice(0, MAX_BUDGET_SAMPLE);
  }

  function legacyBudgetSummaries(budgets) {
    return array(budgets).map(function (budget) {
      return {
        fbKey: text(budget && budget.fbKey),
        subtotal: Number(budget && budget.subtotal) || 0,
        descuentoAmt: Number(budget && budget.descuentoAmt) || 0,
        iva: Number(budget && budget.iva) || 0,
        total: Number(budget && budget.total) || 0
      };
    });
  }

  function legacyOTMetrics(root) {
    var current = root.SisVentas && root.SisVentas.Metrics &&
      typeof root.SisVentas.Metrics.ot === 'function'
      ? root.SisVentas.Metrics.ot()
      : {};
    return {
      open: Number(current.open != null ? current.open : current.abiertas) || 0,
      today: Number(current.today != null ? current.today : current.hoy) || 0,
      completed: Number(current.completed != null ? current.completed : current.completadasTotal) || 0
    };
  }

  function compactConflict(conflict) {
    return {
      kind: text(conflict && conflict.kind),
      key: text(conflict && conflict.key),
      fbKey: text(conflict && (conflict.fbKey ||
        conflict.record && conflict.record.fbKey ||
        conflict.payment && conflict.payment.fbKey)),
      businessId: text(conflict && conflict.businessId),
      collection: text(conflict && conflict.collection)
    };
  }

  function compactReport(audit, budgetComparison, otComparison, salesComparison, productProviderComparison) {
    var budgetIdentityIssues = identityIssueCount(audit.identity && audit.identity.presupuestos);
    var salesIdentityIssues = identityIssueCount(audit.identity && audit.identity.ventas);
    var otIdentityIssues = identityIssueCount(audit.identity && audit.identity.ordenesTrabajo);
    var budgetRelations = relationsFor(audit, 'presupuestos.');
    var salesRelations = relationsFor(audit, 'ventas.');
    var otRelations = relationsFor(audit, 'ordenesTrabajo.');
    var journeyGates = audit.journeys && audit.journeys.gates || {};
    var gates = {
      presupuestos: budgetIdentityIssues === 0 &&
        budgetRelations.length === 0 &&
        journeyGates.presupuestos === true &&
        budgetComparison.ready,
      ventasPagos: salesIdentityIssues === 0 &&
        salesRelations.length === 0 &&
        audit.summary.paymentIssues === 0 &&
        journeyGates.ventasPagos === true &&
        salesComparison.ready,
      ordenesTrabajo: otIdentityIssues === 0 &&
        otRelations.length === 0 &&
        audit.summary.otIssues === 0 &&
        journeyGates.ordenesTrabajo === true &&
        otComparison.ready,
      productosProveedores: audit.productProviders && audit.productProviders.ready === true &&
        productProviderComparison.ready
    };
    return Object.freeze({
      generatedAt: audit.generatedAt,
      ready: gates.presupuestos && gates.ventasPagos && gates.ordenesTrabajo && gates.productosProveedores,
      gates: Object.freeze(gates),
      counts: audit.counts,
      summary: audit.summary,
      comparisons: Object.freeze({
        presupuestos: Object.freeze({
          ready: budgetComparison.ready,
          sampleSize: budgetComparison.comparisons.length,
          differences: budgetComparison.comparisons.filter(function (item) {
            return item.mode !== 'items' ||
              !item.subtotal.equal ||
              !item.discount.equal ||
              !item.iva.equal ||
              !item.total.equal ||
              item.conflicts.length > 0;
          }).slice(0, 50).map(function (item) {
            return {
              fbKey: item.fbKey,
              mode: item.mode,
              subtotal: item.subtotal,
              discount: item.discount,
              iva: item.iva,
              total: item.total,
              conflictCount: item.conflicts.length
            };
          })
        }),
        ordenesTrabajo: Object.freeze({
          ready: otComparison.ready,
          differences: otComparison.differences
        }),
        ventasPagos: Object.freeze({
          ready: salesComparison.ready,
          sampleSize: salesComparison.comparisons.length,
          differences: salesComparison.comparisons.filter(function (item) {
            return item.status !== 'found' ||
              !item.total.equal ||
              !item.paid.equal ||
              !item.balance.equal;
          }).slice(0, 50)
        }),
        productosProveedores: Object.freeze({
          ready: productProviderComparison.ready,
          differences: productProviderComparison.differences
        })
      }),
      issues: Object.freeze({
        identity: Object.freeze({
          clientes: compactIdentity(audit.identity && audit.identity.clientes),
          empleados: compactIdentity(audit.identity && audit.identity.empleados),
          productos: compactIdentity(audit.identity && audit.identity.productos),
          presupuestos: compactIdentity(audit.identity && audit.identity.presupuestos),
          ventas: compactIdentity(audit.identity && audit.identity.ventas),
          ordenesTrabajo: compactIdentity(audit.identity && audit.identity.ordenesTrabajo)
        }),
        budgetRelations: Object.freeze(budgetRelations.slice(0, 50).map(compactConflict)),
        budgetCalculations: Object.freeze(array(budgetComparison.conflicts).slice(0, 50).map(compactConflict)),
        salesRelations: Object.freeze(salesRelations.slice(0, 50).map(compactConflict)),
        otRelations: Object.freeze(otRelations.slice(0, 50).map(compactConflict)),
        payments: Object.freeze(array(audit.paymentIssues).slice(0, 50).map(compactConflict)),
        ot: Object.freeze(array(audit.otIssues).slice(0, 50).map(compactConflict)),
        productsProviders: Object.freeze(array(audit.productProviderIssues).slice(0, 100).map(function (entry) {
          return Object.freeze({
            kind: text(entry && entry.kind),
            productFbKey: text(entry && entry.productFbKey),
            productBusinessId: text(entry && entry.productBusinessId),
            providerIndex: entry && entry.providerIndex == null ? null : Number(entry.providerIndex)
          });
        })),
        journeys: Object.freeze(array(audit.journeyIssues).slice(0, 50).map(function (entry) {
          return Object.freeze({
            kind: text(entry && entry.kind),
            module: text(entry && entry.module),
            stage: text(entry && entry.stage),
            sourceFbKey: text(entry && entry.sourceFbKey),
            sourceBusinessId: text(entry && entry.sourceBusinessId),
            matchedBy: text(entry && entry.matchedBy),
            reference: text(entry && entry.reference),
            expectedKey: text(entry && entry.expectedKey),
            actualKey: text(entry && entry.actualKey)
          });
        }))
      })
    });
  }

  function assertDependencies() {
    if (!dependencies.LegacySnapshot ||
        !dependencies.MigrationAudit ||
        !dependencies.ShadowComparison ||
        !dependencies.FeatureGates) {
      throw new Error('El núcleo v3 no está cargado en el orden requerido');
    }
  }

  function create(root, options) {
    options = options || {};
    assertDependencies();
    var state = {
      enabled: options.enabled === true || enabledByQuery(root),
      phase: 'idle',
      lastReport: null,
      lastError: null,
      runCount: 0
    };
    var running = null;
    var retryTimer = null;
    var readyDeadline = 0;
    var readyTimeoutMs = Number(options.readyTimeoutMs) > 0
      ? Number(options.readyTimeoutMs)
      : DEFAULT_READY_TIMEOUT_MS;
    var retryDelayMs = Number(options.retryDelayMs) >= 0
      ? Number(options.retryDelayMs)
      : 500;
    var featureGates = new dependencies.FeatureGates.FeatureGates();

    function emit(name, detail) {
      if (!root.document || typeof root.document.dispatchEvent !== 'function') return;
      var EventType = root.CustomEvent || (typeof CustomEvent === 'function' ? CustomEvent : null);
      if (!EventType) return;
      root.document.dispatchEvent(new EventType(name, { detail: detail }));
    }

    function run() {
      if (running) return running;
      state.phase = 'running';
      state.lastError = null;
      running = Promise.resolve().then(function () {
        if (!primaryDataReady(root)) throw new Error('Los datos principales todavía no terminaron de cargar');
        var data = snapshot(root);
        var selectedTypes = selectedProviderTypes(root);
        var audit = dependencies.MigrationAudit.run(data, {
          today: todayISO(root),
          now: new (root.Date || Date)().getTime(),
          selectedProviderTypes: selectedTypes
        });
        var budgetSample = selectBudgetSample(data.presupuestos);
        var budgetComparison = dependencies.ShadowComparison.compareBudgets(
          budgetSample,
          legacyBudgetSummaries(budgetSample)
        );
        var otComparison = dependencies.ShadowComparison.compareOT(
          data.ordenesTrabajo,
          todayISO(root),
          legacyOTMetrics(root)
        );
        var salesComparison = dependencies.ShadowComparison.compareSales(
          data.ventas,
          data.pagos,
          legacySalesSummaries(root, data.ventas)
        );
        var productProviderComparison = dependencies.ShadowComparison.compareProductProviders(
          audit.productProviders && audit.productProviders.summary,
          legacyProductProviderSummary(root, selectedTypes)
        );
        state.lastReport = compactReport(
          audit,
          budgetComparison,
          otComparison,
          salesComparison,
          productProviderComparison
        );
        featureGates.update(state.lastReport);
        state.phase = state.lastReport.ready ? 'ready' : 'blocked';
        state.runCount += 1;
        emit('sisventas:v3-shadow-complete', state.lastReport);
        return state.lastReport;
      }).catch(function (error) {
        state.phase = 'error';
        state.lastError = error;
        emit('sisventas:v3-shadow-error', { message: error && error.message || String(error) });
        throw error;
      }).finally(function () {
        running = null;
      });
      return running;
    }

    function schedule(delay) {
      if (!state.enabled || retryTimer) return;
      if (!readyDeadline) readyDeadline = Date.now() + readyTimeoutMs;
      retryTimer = (root.setTimeout || setTimeout)(function attempt() {
        retryTimer = null;
        if (!primaryDataReady(root)) {
          if (Date.now() >= readyDeadline) {
            var error = new Error('La carga inicial no termino dentro del tiempo esperado');
            state.phase = 'error';
            state.lastError = error;
            emit('sisventas:v3-shadow-error', { message: error.message });
            return;
          }
          schedule(retryDelayMs);
          return;
        }
        readyDeadline = 0;
        run().catch(function () {});
      }, delay == null ? 1200 : delay);
    }

    function status() {
      return Object.freeze({
        enabled: state.enabled,
        phase: state.phase,
        runCount: state.runCount,
        lastReport: state.lastReport,
        lastError: state.lastError ? state.lastError.message : null
      });
    }

    function enable() {
      state.enabled = true;
      readyDeadline = 0;
      schedule(0);
      return status();
    }

    function disable() {
      state.enabled = false;
      if (retryTimer) {
        (root.clearTimeout || clearTimeout)(retryTimer);
        retryTimer = null;
      }
      readyDeadline = 0;
      return status();
    }

    function emitActivation(snapshot) {
      emit('sisventas:v3-activation-change', snapshot);
      return snapshot;
    }

    function activate(moduleName) {
      var decision = featureGates.activate(moduleName);
      emitActivation(featureGates.snapshot());
      return decision;
    }

    function deactivate(moduleName) {
      return emitActivation(featureGates.deactivate(moduleName));
    }

    function rollback() {
      return emitActivation(featureGates.rollback());
    }

    if (options.autoStart !== false && root.document &&
        typeof root.document.addEventListener === 'function') {
      root.document.addEventListener('sisventas:session-ready', function () {
        schedule(1200);
      });
      if (state.enabled && root.document.readyState !== 'loading') schedule(1200);
    }

    return Object.freeze({
      enable: enable,
      disable: disable,
      run: run,
      status: status,
      activate: activate,
      deactivate: deactivate,
      rollback: rollback,
      activationStatus: function () { return featureGates.snapshot(); },
      snapshot: function () { return snapshot(root); }
    });
  }

  return {
    create: create,
    collectionSource: collectionSource,
    selectSalesSample: selectSalesSample
  };
});
