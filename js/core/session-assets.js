/* Código opcional: descargar después de verificar acceso, antes de abrir la sesión. */
(function () {
  'use strict';
  var assets = {
    sheetjs: {src:'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', ready:function(){return !!window.XLSX;}},
    usageMetrics: {src:'./js/modules/usage-metrics.js?v=3.10.0', ready:function(){return !!window.SVUsageMetrics;}},
    excel: {src:'./js/modules/excel-export.js?v=3.14.20', ready:function(){return !!window.SVExcelExport;}},
    diagnostics: {src:'./js/v3/admin-diagnostics.js?v=3.3.17', ready:function(){return !!(window.SisVentas && window.SisVentas.V3Diagnostics);}},
    distribuidora: {src:'./js/modules/distribuidora-access.js?v=3.10.17-category', ready:function(){return !!window.SVDistribuidora;}},
    paraguay: {src:'./js/modules/paraguay-shopping-access.js?v=3.15.8-order-format', ready:function(){return !!window.SVParaguayPortal;}},
    compras: {src:'./js/modules/purchase-orders.js?v=3.14.16-print', ready:function(){return !!window.SisVentasCompras;}},
    planner: {src:'./js/modules/paraguay-planner.js?v=3.8.1', ready:function(){return !!window.SVParaguayPlanner;}},
    preparation: {src:'./js/modules/exterior-preparation.js?v=3.15.8-order-format', ready:function(){return !!window.SVExteriorPreparation;}},
    purchasePDF: {src:'./js/modules/purchase-pdf-import.js?v=3.12.3', ready:function(){return !!window.SVPurchasePDF;}}
  };
  var pending = Object.create(null);
  function load(name) {
    var asset = assets[name];
    if (!asset) return Promise.reject(new Error('Módulo desconocido'));
    if (asset.ready()) return Promise.resolve();
    if (pending[name]) return pending[name];
    var script = document.createElement('script');
    // Los grupos se cargan en orden; no dependen del evento DOMContentLoaded.
    script.async = false;
    script.src = asset.src;
    pending[name] = new Promise(function(resolve, reject) {
      var settled = false;
      var timer = setTimeout(function(){finish(new Error('La carga del módulo demoró demasiado. Reintentá.'));},10000);
      async function finish(error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) {error.code='SV_ASSET_LOAD';error.message+=' ['+name+']';script.remove();try{if(window.SVSessionRecovery?.diagnoseLocalServer)await window.SVSessionRecovery.diagnoseLocalServer(error);}catch(_){}window.SVSessionAssets.lastFailure={module:name,src:asset.src,time:new Date().toISOString(),message:error.message};console.warn('[SisVentas] fallo de módulo',window.SVSessionAssets.lastFailure);reject(error);}
        else resolve();
      }
      script.onload = function(){finish(asset.ready() ? null : new Error('No se pudo inicializar el módulo. Reintentá.'));};
      script.onerror = function(){finish(new Error('No se pudo descargar el módulo. Revisá la conexión e intentá nuevamente.'));};
      document.head.appendChild(script);
    }).finally(function(){delete pending[name];});
    return pending[name];
  }
  async function forRole(role, isCurrent) {
    var modules = ['distribuidora','paraguay'];
    if (!['compras_paraguay','distribuidora'].includes(role)) modules.push('compras');
    if (isCurrent && !isCurrent()) return false;
    // async=false conserva el orden de ejecución al insertar los scripts;
    // iniciar las descargas juntas evita sumar tres esperas de red.
    await Promise.all(modules.map(load));
    return !isCurrent || isCurrent();
  }
  var maintenanceCurrent = null, maintenanceRevision = 0, maintenanceSessionActive = true, maintenanceObserver = null;
  function maintenanceAuthenticated() { return typeof isAuthenticated === 'undefined' ? undefined : isAuthenticated; }
  function maintenanceVisible(panel) {
    if (!panel || panel.isConnected === false) return false;
    for (var node = panel; node; node = node.parentElement || node.parentNode) {
      if (node.hidden || node.style?.display === 'none' || (node.classList?.contains('page') && !node.classList.contains('active'))) return false;
    }
    var page = document.getElementById('page-configuracion');
    return !page || !page.classList || page.classList.contains('active');
  }
  function maintenanceContext() {
    return {uid:window.currentUserUid, role:window.currentRole, auth:window.fbAuth?.currentUser,
      authenticated:maintenanceAuthenticated(), view:window._impersonacionOriginal};
  }
  function maintenanceContextCurrent(context) {
    return maintenanceSessionActive && context.authenticated !== false &&
      context.uid === window.currentUserUid && context.role === window.currentRole &&
      context.auth === window.fbAuth?.currentUser && context.authenticated === maintenanceAuthenticated() &&
      context.view === window._impersonacionOriginal && (!context.uid || !context.auth || context.auth.uid === context.uid);
  }
  function maintenanceCurrentRequest(state) {
    return maintenanceCurrent === state && state.revision === maintenanceRevision && maintenanceContextCurrent(state.context) &&
      state.status.isConnected !== false && document.getElementById('cfg-mantenimiento') === state.panel && maintenanceVisible(state.panel);
  }
  function clearMaintenance() {
    maintenanceRevision++;
    var previous = maintenanceCurrent; maintenanceCurrent = null;
    if (maintenanceObserver) { maintenanceObserver.disconnect(); maintenanceObserver = null; }
    if (previous) { previous.status.remove(); if (previous.layer) previous.layer.remove(); }
  }
  function discardMaintenance(state) { if (maintenanceCurrent === state) clearMaintenance(); }
  function watchMaintenance() {
    if (!window.MutationObserver || !document.body) return;
    maintenanceObserver = new window.MutationObserver(function() {
      if (maintenanceCurrent && !maintenanceCurrentRequest(maintenanceCurrent)) clearMaintenance();
    });
    maintenanceObserver.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['hidden','class','style']});
  }
  function renderMaintenanceStatus(state, error) {
    var status = state.status, message = error ? String(error.message || 'No se pudo completar la carga. Reintentá.').replace(/\s+\[diagnostics\]$/, '') : 'Cargando auditoría de mantenimiento…';
    status.className = 'sv-data-status' + (error ? ' sv-data-error' : '');
    status.setAttribute('role', error ? 'alert' : 'status');
    status.setAttribute('aria-live', error ? 'assertive' : 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.textContent = message;
    if (document.body) {
      status.textContent = '';
      var title = document.createElement('strong');
      title.textContent = error ? 'No se pudo cargar la auditoría de mantenimiento' : message;
      status.appendChild(title);
      if (error) { var detail = document.createElement('span'); detail.textContent = message; status.appendChild(detail); }
    }
    if (error) {
      var retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn btn-sm'; retry.textContent = 'Reintentar';
      retry.onclick = function() {
        if (!maintenanceCurrentRequest(state) || state.phase !== 'error') return Promise.resolve(false);
        clearMaintenance(); return maintenance();
      };
      status.appendChild(retry);
    }
  }
  function maintenance() {
    var panel = document.getElementById('cfg-mantenimiento'), context = maintenanceContext();
    if (!maintenanceVisible(panel) || !maintenanceContextCurrent(context)) { clearMaintenance(); return Promise.resolve(false); }
    if (maintenanceCurrent && maintenanceCurrent.phase === 'loading' && maintenanceCurrentRequest(maintenanceCurrent)) return maintenanceCurrent.task;
    clearMaintenance();
    var status = document.createElement('div'), layer = null;
    status.id = 'mnt-diagnostics-loading';
    // Un índice/core anterior no conoce el portal ni su hoja de estilos.
    // Conserva el aviso dentro de la solapa hasta recibir el core nuevo.
    if (document.body && typeof window.SVScreenLoading?.start === 'function') {
      layer = document.createElement('div'); layer.id = 'mnt-diagnostics-loading-layer'; layer.className = 'sv-load-status-layer';
      layer.appendChild(status); document.body.appendChild(layer);
    } else panel.appendChild(status);
    var state = {panel:panel, context:context, revision:maintenanceRevision, status:status, layer:layer, phase:'loading', task:null};
    maintenanceCurrent = state; renderMaintenanceStatus(state); watchMaintenance();
    state.task = (async function() {
      try {
        await load('diagnostics');
        if (!maintenanceCurrentRequest(state)) { discardMaintenance(state); return false; }
        window.SisVentas.V3Diagnostics.mount();
        discardMaintenance(state); return true;
      } catch (error) {
        if (!maintenanceCurrentRequest(state)) { discardMaintenance(state); return false; }
        state.phase = 'error'; renderMaintenanceStatus(state, error); return false;
      }
    })();
    return state.task;
  }
  document.addEventListener?.('sisventas:page-changed', function(event) {
    if (event.detail?.page !== 'configuracion' || (maintenanceCurrent && !maintenanceCurrentRequest(maintenanceCurrent))) clearMaintenance();
  });
  document.addEventListener?.('sisventas:configuration-tab-changed', function(event) {
    if (event.detail?.tab !== 'mantenimiento' || (maintenanceCurrent && !maintenanceCurrentRequest(maintenanceCurrent))) clearMaintenance();
  });
  document.addEventListener?.('sisventas:session-ended', function() { maintenanceSessionActive = false; clearMaintenance(); });
  document.addEventListener?.('sisventas:session-ready', function() { maintenanceSessionActive = true; clearMaintenance(); });
  document.addEventListener?.('sisventas:role-changed', clearMaintenance);
  window.SVSessionAssets = {load:load, forRole:forRole, maintenance:maintenance};
})();
