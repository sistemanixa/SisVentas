(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3Diagnostics = api.create(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MODULES = Object.freeze([
    { id: 'presupuestos', label: 'Presupuestos' },
    { id: 'ventasPagos', label: 'Ventas y cobros' },
    { id: 'ordenesTrabajo', label: 'Órdenes de trabajo' },
    { id: 'productosProveedores', label: 'Productos y proveedores' }
  ]);

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function array(value) {
    return Array.isArray(value) ? value : [];
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function identityCount(entry) {
    entry = entry || {};
    return ['technical', 'business', 'names', 'missingTechnical'].reduce(function (total, field) {
      var value = entry[field];
      return total + (Array.isArray(value) ? value.length : (Number(value) || 0));
    }, 0);
  }

  function comparisonDifferences(comparison) {
    comparison = comparison || {};
    if (Array.isArray(comparison.differences)) {
      return comparison.differences.filter(function (entry) {
        return entry && entry.equal === false || entry && Number(entry.delta) !== 0;
      }).length;
    }
    return 0;
  }

  function moduleIssueCount(report, moduleName) {
    var issues = report && report.issues || {};
    var identity = issues.identity || {};
    if (moduleName === 'presupuestos') {
      return identityCount(identity.presupuestos) +
        array(issues.budgetRelations).length + array(issues.budgetCalculations).length;
    }
    if (moduleName === 'ventasPagos') {
      return identityCount(identity.ventas) +
        array(issues.salesRelations).length + array(issues.payments).length +
        array(issues.journeys).filter(function (entry) { return entry.module === 'ventasPagos'; }).length;
    }
    if (moduleName === 'ordenesTrabajo') {
      return identityCount(identity.ordenesTrabajo) +
        array(issues.otRelations).length + array(issues.ot).length +
        array(issues.journeys).filter(function (entry) { return entry.module === 'ordenesTrabajo'; }).length;
    }
    if (moduleName === 'productosProveedores') return array(issues.productsProviders).length;
    return 0;
  }

  function summarize(report) {
    report = report || {};
    var gates = report.gates || {};
    var comparisons = report.comparisons || {};
    var modules = MODULES.map(function (definition) {
      var comparison = comparisons[definition.id] || {};
      return Object.freeze({
        id: definition.id,
        label: definition.label,
        eligible: gates[definition.id] === true,
        comparisonReady: comparison.ready === true,
        differences: comparisonDifferences(comparison),
        issues: moduleIssueCount(report, definition.id)
      });
    });
    return Object.freeze({
      ready: report.ready === true,
      generatedAt: text(report.generatedAt),
      totalIssues: Number(report.summary && report.summary.totalIssues) ||
        modules.reduce(function (total, module) { return total + module.issues; }, 0),
      modules: Object.freeze(modules)
    });
  }

  function groupedIssues(report) {
    var groups = new Map();
    var issues = report && report.issues || {};
    var collections = [
      'budgetRelations', 'budgetCalculations', 'salesRelations',
      'otRelations', 'payments', 'ot', 'journeys', 'productsProviders'
    ];
    collections.forEach(function (collection) {
      array(issues[collection]).forEach(function (entry) {
        var kind = text(entry && entry.kind) || collection;
        var key = collection + '|' + kind;
        var current = groups.get(key) || { collection: collection, kind: kind, count: 0, examples: [] };
        current.count += 1;
        var example = text(entry && (entry.fbKey || entry.productFbKey || entry.sourceFbKey || entry.businessId));
        if (example && current.examples.length < 4 && current.examples.indexOf(example) < 0) current.examples.push(example);
        groups.set(key, current);
      });
    });
    return Object.freeze(Array.from(groups.values()).map(function (entry) {
      return Object.freeze({
        collection: entry.collection,
        kind: entry.kind,
        count: entry.count,
        examples: Object.freeze(entry.examples.slice())
      });
    }));
  }

  var ISSUE_LABELS = Object.freeze({
    'total-mismatch':'El total guardado no coincide con el cálculo actual',
    'subtotal-mismatch':'Un subtotal no coincide con sus productos',
    'line-total-mismatch':'El subtotal de un producto no coincide',
    'missing-unit-price':'Falta el precio unitario original',
    'iva-mismatch':'El IVA calculado no coincide con el guardado',
    'missing-relation':'Falta vincular el registro con su origen',
    'ambiguous-relation':'Hay más de un origen posible y se necesita confirmación',
    'crossed-client':'El recorrido incluye clientes diferentes',
    'missing-provider':'El producto no tiene proveedor reconocido',
    'provider-name-url-mismatch':'El nombre del proveedor no coincide con la URL',
    'unsupported-provider-url':'La URL pertenece a un proveedor todavía no configurado'
  });
  var COLLECTION_LABELS = Object.freeze({
    budgetRelations:'Vínculos de presupuestos', budgetCalculations:'Cálculos de presupuestos',
    salesRelations:'Vínculos de ventas', payments:'Cobros', otRelations:'Vínculos de órdenes de trabajo',
    ot:'Órdenes de trabajo', journeys:'Recorrido de la operación', productsProviders:'Productos y proveedores'
  });

  function create(root) {
    var lastReport = null;
    var running = null;

    function element(id) {
      return root.document && root.document.getElementById(id);
    }

    function setText(id, value) {
      var node = element(id);
      if (node) node.textContent = text(value);
    }

    function notify(message) {
      if (typeof root.notify === 'function') root.notify(message);
    }

    function isAdmin() {
      return text(root.currentRole).toLocaleLowerCase('es-AR') === 'admin';
    }

    function injectStyles() {
      if (!root.document || element('sv-v3-diagnostics-css')) return;
      var style = root.document.createElement('style');
      style.id = 'sv-v3-diagnostics-css';
      style.textContent =
        '#mnt-v3-card .sv-v3-gates{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}' +
        '#mnt-v3-card .sv-v3-gate{padding:11px;border:.5px solid var(--border);border-radius:var(--radius);background:var(--bg3);min-width:0}' +
        '#mnt-v3-card .sv-v3-gate strong{display:block;font-size:12px;overflow-wrap:anywhere}' +
        '#mnt-v3-card .sv-v3-gate span{display:block;font-size:11px;color:var(--text3);margin-top:5px}' +
        '#mnt-v3-issues{max-height:300px;overflow:auto;border:.5px solid var(--border);border-radius:var(--radius);background:var(--bg3)}' +
        '@media(max-width:900px){#mnt-v3-card .sv-v3-gates{grid-template-columns:1fr 1fr}}' +
        '@media(max-width:520px){#mnt-v3-card .sv-v3-gates{grid-template-columns:1fr}#mnt-v3-actions .btn{width:100%}}';
      (root.document.head || root.document.documentElement).appendChild(style);
    }

    function mount() {
      if (!root.document || element('mnt-v3-card')) return !!element('mnt-v3-card');
      var grid = root.document.querySelector('#cfg-mantenimiento .mnt-main-grid');
      if (!grid) return false;
      injectStyles();
      var card = root.document.createElement('div');
      card.className = 'card mnt-primary-card admin-only';
      card.id = 'mnt-v3-card';
      card.innerHTML =
        '<div class="card-head"><span class="card-title"><i class="ti ti-shield-check"></i> Auditoría de migración V3</span>' +
          '<span id="mnt-v3-status" class="badge b-amber">Sin ejecutar</span></div>' +
        '<div style="font-size:13px;color:var(--text2);line-height:1.45">Compara el núcleo V3 con los datos y resultados actuales. Es de solo lectura: no guarda, elimina ni corrige registros.</div>' +
        '<div class="sv-v3-gates" id="mnt-v3-gates">' + MODULES.map(function (module) {
          return '<div class="sv-v3-gate" data-v3-module="' + module.id + '"><strong>' + escapeHtml(module.label) + '</strong><span>Sin comparar</span></div>';
        }).join('') + '</div>' +
        '<div id="mnt-v3-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
          '<button type="button" class="btn btn-sm btn-primary" id="mnt-v3-run"><i class="ti ti-scan"></i> Ejecutar auditoría V3</button>' +
          '<button type="button" class="btn btn-sm" id="mnt-v3-activate" disabled><i class="ti ti-player-play"></i> Activar módulos aptos</button>' +
          '<button type="button" class="btn btn-sm" id="mnt-v3-rollback" disabled><i class="ti ti-arrow-back-up"></i> Volver a v2</button>' +
          '<button type="button" class="btn btn-sm" id="mnt-v3-export" disabled><i class="ti ti-download"></i> Exportar diagnóstico</button>' +
        '</div>' +
        '<div id="mnt-v3-summary" style="font-size:12px;color:var(--text3);margin-bottom:8px">Todavía no se ejecutó la comparación.</div>' +
        '<div id="mnt-v3-issues"><div style="font-size:13px;color:var(--text3);padding:12px;text-align:center">Los bloqueos y diferencias aparecerán aquí.</div></div>';
      grid.appendChild(card);
      element('mnt-v3-run').addEventListener('click', function () { run(); });
      element('mnt-v3-activate').addEventListener('click', activateEligible);
      element('mnt-v3-rollback').addEventListener('click', rollback);
      element('mnt-v3-export').addEventListener('click', exportReport);
      return true;
    }

    function renderGates(summary) {
      var bridge = root.SisVentas && root.SisVentas.V3Bridge;
      summary.modules.forEach(function (module) {
        var card = root.document.querySelector('[data-v3-module="' + module.id + '"]');
        if (!card) return;
        var detail = card.querySelector('span');
        var bridgeStatus = bridge && typeof bridge.status === 'function' ? bridge.status(module.id) : null;
        var isActive = bridgeStatus && bridgeStatus.active === true;
        card.style.borderColor = isActive || module.eligible ? 'var(--green)' : 'var(--amber)';
        if (detail) {
          detail.textContent = isActive
            ? 'Activo en V3 · rollback disponible'
            : module.eligible && bridgeStatus && bridgeStatus.wired
              ? 'Coincide · listo para activar'
              : module.eligible
                ? 'Coincide · integración pendiente'
            : module.issues + ' incidencia(s) · ' + module.differences + ' diferencia(s)';
          detail.style.color = isActive || module.eligible ? 'var(--green)' : 'var(--amber)';
        }
      });
    }

    function renderIssues(report) {
      var box = element('mnt-v3-issues');
      if (!box) return;
      var groups = groupedIssues(report);
      if (!groups.length) {
        box.innerHTML = '<div style="font-size:13px;color:var(--green);padding:12px;text-align:center"><i class="ti ti-circle-check"></i> No se detectaron conflictos estructurales.</div>';
        return;
      }
      box.innerHTML = groups.map(function (group) {
        return '<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:.5px solid var(--border)">' +
          '<div style="min-width:0"><strong style="display:block;font-size:12px;color:var(--text)">' + escapeHtml(ISSUE_LABELS[group.kind] || group.kind) + '</strong>' +
          '<span style="display:block;font-size:11px;color:var(--text3);margin-top:3px">' + escapeHtml(COLLECTION_LABELS[group.collection] || group.collection) +
          (group.examples.length ? ' · ' + escapeHtml(group.examples.join(', ')) : '') + '</span></div>' +
          '<span class="badge b-amber" style="flex:0 0 auto">' + group.count + '</span></div>';
      }).join('');
    }

    function render(report) {
      lastReport = report || null;
      if (!mount() || !lastReport) return;
      var summary = summarize(lastReport);
      var badge = element('mnt-v3-status');
      if (badge) {
        badge.className = 'badge ' + (summary.ready ? 'b-green' : 'b-amber');
        badge.textContent = summary.ready ? 'Paridad aprobada' : 'Requiere revisión';
      }
      renderGates(summary);
      renderIssues(lastReport);
      setText('mnt-v3-summary', summary.totalIssues + ' incidencia(s) registradas · ' +
        summary.modules.filter(function (module) { return module.eligible; }).length + '/4 módulos aptos · ' +
        (summary.generatedAt ? new Date(summary.generatedAt).toLocaleString('es-AR') : 'sin fecha'));
      var exportButton = element('mnt-v3-export');
      if (exportButton) exportButton.disabled = false;
      var bridge = root.SisVentas && root.SisVentas.V3Bridge;
      var activatable = summary.modules.some(function (module) {
        if (!module.eligible || !bridge || typeof bridge.status !== 'function') return false;
        var moduleStatus = bridge.status(module.id);
        return moduleStatus.wired && !moduleStatus.active;
      });
      var anyActive = summary.modules.some(function (module) {
        return bridge && typeof bridge.status === 'function' && bridge.status(module.id).active;
      });
      var activateButton = element('mnt-v3-activate');
      var rollbackButton = element('mnt-v3-rollback');
      if (activateButton) activateButton.disabled = !activatable;
      if (rollbackButton) rollbackButton.disabled = !anyActive;
    }

    function renderError(error) {
      mount();
      var badge = element('mnt-v3-status');
      if (badge) { badge.className = 'badge b-red'; badge.textContent = 'Error'; }
      setText('mnt-v3-summary', error && error.message || String(error));
    }

    function run(options) {
      options = options || {};
      if (running) return running;
      if (!isAdmin()) {
        var denied = Promise.reject(new Error('La auditoría V3 requiere rol administrador'));
        denied.catch(function () {});
        if (!options.silent) notify('Solo el administrador puede ejecutar la auditoría V3');
        return denied;
      }
      var runtime = root.SisVentas && root.SisVentas.V3Shadow;
      if (!runtime || typeof runtime.run !== 'function') {
        var unavailable = Promise.reject(new Error('El núcleo V3 no está disponible'));
        unavailable.catch(function () {});
        return unavailable;
      }
      mount();
      var button = element('mnt-v3-run');
      if (button) { button.disabled = true; button.innerHTML = '<i class="ti ti-loader-2" style="animation:spin .9s linear infinite"></i> Comparando…'; }
      var badge = element('mnt-v3-status');
      if (badge) { badge.className = 'badge b-amber'; badge.textContent = 'Comparando'; }
      running = Promise.resolve(runtime.run()).then(function (report) {
        render(report);
        if (!options.silent) notify('Auditoría V3 finalizada');
        return report;
      }).catch(function (error) {
        renderError(error);
        if (!options.silent) notify('No se pudo completar la auditoría V3');
        throw error;
      }).finally(function () {
        running = null;
        if (button) { button.disabled = false; button.innerHTML = '<i class="ti ti-scan"></i> Ejecutar auditoría V3'; }
      });
      return running;
    }

    function activateEligible() {
      if (!lastReport) { notify('Primero ejecutá la auditoría V3'); return; }
      var bridge = root.SisVentas && root.SisVentas.V3Bridge;
      if (!bridge || typeof bridge.activate !== 'function') return;
      var activated = [];
      MODULES.forEach(function (module) {
        if (!lastReport.gates || lastReport.gates[module.id] !== true) return;
        var before = bridge.status(module.id);
        if (!before.wired || before.active) return;
        var after = bridge.activate(module.id);
        if (after.active) activated.push(module.label);
      });
      render(lastReport);
      notify(activated.length ? ('V3 activa: ' + activated.join(', ')) : 'No hay módulos V3 listos para activar');
    }

    function rollback() {
      var bridge = root.SisVentas && root.SisVentas.V3Bridge;
      if (!bridge || typeof bridge.rollback !== 'function') return;
      try {
        bridge.rollback();
        notify('Se restauró el comportamiento estable v2.0.279');
      } catch (error) {
        notify('V3 se desactivó, pero una vista no pudo refrescarse');
      } finally {
        if (lastReport) render(lastReport);
      }
    }

    function exportReport() {
      if (!lastReport || !root.Blob || !root.URL || typeof root.URL.createObjectURL !== 'function') return;
      var blob = new root.Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
      var url = root.URL.createObjectURL(blob);
      var anchor = root.document.createElement('a');
      anchor.href = url;
      anchor.download = 'sisventas-v3-diagnostico-' + new Date().toISOString().slice(0, 10) + '.json';
      root.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      root.URL.revokeObjectURL(url);
    }

    function initialize() {
      mount();
      if (!root.document || typeof root.document.addEventListener !== 'function') return;
      root.document.addEventListener('sisventas:v3-shadow-complete', function (event) { render(event.detail); });
      root.document.addEventListener('sisventas:v3-shadow-error', function (event) {
        renderError(new Error(event && event.detail && event.detail.message || 'Error V3'));
      });
      root.document.addEventListener('sisventas:page-changed', function () { mount(); });
    }

    if (root.document) {
      if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', initialize);
      else initialize();
    }

    return Object.freeze({
      mount: mount,
      run: run,
      render: render,
      activateEligible: activateEligible,
      rollback: rollback,
      exportReport: exportReport,
      lastReport: function () { return lastReport; }
    });
  }

  return {
    create: create,
    summarize: summarize,
    groupedIssues: groupedIssues,
    modules: MODULES
  };
});
