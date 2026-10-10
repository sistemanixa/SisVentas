/* Código opcional: descargar después de verificar acceso, antes de abrir la sesión. */
(function () {
  'use strict';
  var assets = {
    usageMetrics: {src:'./js/modules/usage-metrics.js?v=3.10.0', ready:function(){return !!window.SVUsageMetrics;}},
    excel: {src:'./js/modules/excel-export.js?v=3.10.0', ready:function(){return !!window.SVExcelExport;}},
    diagnostics: {src:'./js/v3/admin-diagnostics.js?v=3.3.17', ready:function(){return !!(window.SisVentas && window.SisVentas.V3Diagnostics);}},
    distribuidora: {src:'./js/modules/distribuidora-access.js?v=3.9.14-savefix', ready:function(){return !!window.SVDistribuidora;}},
    paraguay: {src:'./js/modules/paraguay-shopping-access.js?v=3.9.24-reference-status2', ready:function(){return !!window.SVParaguayPortal;}},
    compras: {src:'./js/modules/purchase-orders.js?v=3.10.0', ready:function(){return !!window.SisVentasCompras;}},
    planner: {src:'./js/modules/paraguay-planner.js?v=3.8.1', ready:function(){return !!window.SVParaguayPlanner;}},
    preparation: {src:'./js/modules/exterior-preparation.js?v=3.9.12', ready:function(){return !!window.SVExteriorPreparation;}},
    purchasePDF: {src:'./js/modules/purchase-pdf-import.js?v=3.7.18', ready:function(){return !!window.SVPurchasePDF;}}
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
      function finish(error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) {script.remove();reject(error);}
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
  async function maintenance() {
    var panel = document.getElementById('cfg-mantenimiento');
    if (!panel || panel.style.display === 'none') return;
    var status = document.getElementById('mnt-diagnostics-loading');
    if (!status) {
      status = document.createElement('div');
      status.id = 'mnt-diagnostics-loading';
      status.setAttribute('role', 'status');
      panel.appendChild(status);
    }
    status.textContent = 'Cargando auditoría de mantenimiento…';
    try {
      await load('diagnostics');
      window.SisVentas.V3Diagnostics.mount();
      status.remove();
    } catch (error) {
      status.textContent = error.message + ' ';
      var retry = document.createElement('button');
      retry.className = 'btn btn-sm';
      retry.textContent = 'Reintentar';
      retry.onclick = maintenance;
      status.appendChild(retry);
    }
  }
  window.SVSessionAssets = {load:load, forRole:forRole, maintenance:maintenance};
})();
