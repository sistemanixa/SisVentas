(function (root, factory) {
  var dependencies = typeof module === 'object' && module.exports
    ? {
        LegacySnapshot: require('./v3/legacy-snapshot.js'),
        MigrationAudit: require('./v3/migration-audit.js'),
        ShadowComparison: require('./v3/shadow-comparison.js')
      }
    : {
        LegacySnapshot: root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.LegacySnapshot,
        MigrationAudit: root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.MigrationAudit,
        ShadowComparison: root.SisVentas && root.SisVentas.V3 && root.SisVentas.V3.ShadowComparison
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
      presupuestos: firstDefined(root, ['pptoData', 'pptosData', 'presupuestosData']),
      ventas: firstDefined(root, ['ventasList', 'ventasData']),
      pagos: firstDefined(root, ['_historialPagosCompleto', '_pagosListaActual', 'pagosData', 'pagosList']),
      ordenesTrabajo: firstDefined(root, ['otData', 'ordenesTrabajoData'])
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
        total: Number(sale && sale.total) || 0,
        paid: Number(root._svMontoPagadoVenta(sale)) || 0,
        balance: Number(root._svSaldoPendienteVenta(sale)) || 0
      };
    }).filter(function (summary) {
      return !!summary.fbKey;
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

  function compactReport(audit, otComparison, salesComparison) {
    var budgetIdentityIssues = identityIssueCount(audit.identity && audit.identity.presupuestos);
    var salesIdentityIssues = identityIssueCount(audit.identity && audit.identity.ventas);
    var otIdentityIssues = identityIssueCount(audit.identity && audit.identity.ordenesTrabajo);
    var budgetRelations = relationsFor(audit, 'presupuestos.');
    var salesRelations = relationsFor(audit, 'ventas.');
    var otRelations = relationsFor(audit, 'ordenesTrabajo.');
    var gates = {
      presupuestos: budgetIdentityIssues === 0 && budgetRelations.length === 0,
      ventasPagos: salesIdentityIssues === 0 &&
        salesRelations.length === 0 &&
        audit.summary.paymentIssues === 0 &&
        salesComparison.ready,
      ordenesTrabajo: otIdentityIssues === 0 &&
        otRelations.length === 0 &&
        audit.summary.otIssues === 0 &&
        otComparison.ready
    };
    return Object.freeze({
      generatedAt: audit.generatedAt,
      ready: gates.presupuestos && gates.ventasPagos && gates.ordenesTrabajo,
      gates: Object.freeze(gates),
      counts: audit.counts,
      summary: audit.summary,
      comparisons: Object.freeze({
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
        salesRelations: Object.freeze(salesRelations.slice(0, 50).map(compactConflict)),
        otRelations: Object.freeze(otRelations.slice(0, 50).map(compactConflict)),
        payments: Object.freeze(array(audit.paymentIssues).slice(0, 50).map(compactConflict)),
        ot: Object.freeze(array(audit.otIssues).slice(0, 50).map(compactConflict))
      })
    });
  }

  function assertDependencies() {
    if (!dependencies.LegacySnapshot ||
        !dependencies.MigrationAudit ||
        !dependencies.ShadowComparison) {
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
        var audit = dependencies.MigrationAudit.run(data, { today: todayISO(root) });
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
        state.lastReport = compactReport(audit, otComparison, salesComparison);
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
      snapshot: function () { return snapshot(root); }
    });
  }

  return {
    create: create,
    collectionSource: collectionSource,
    selectSalesSample: selectSalesSample
  };
});
