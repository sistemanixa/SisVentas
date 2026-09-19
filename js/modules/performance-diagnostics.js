/* Diagnóstico local optativo: no mide ni agrega trabajo en el uso normal. */
(function() {
  'use strict';
  if (!['127.0.0.1','localhost'].includes(location.hostname) || !new URLSearchParams(location.search).has('svperf')) return;
  var muestras = [];
  ['showPage','_svConstruirCuentaCorriente','renderModuloComisiones','renderTablaGastos','actualizarMetricasGastos','renderTablaProductos','renderMetricasVentas','calcRentabilidad','_renderTablaRolesUI'].forEach(function(nombre) {
    var original = window[nombre];
    if (typeof original !== 'function') return;
    window[nombre] = function() {
      var inicio = performance.now();
      try { return original.apply(this, arguments); }
      finally {
        muestras.push({funcion:nombre,ms:Math.round((performance.now()-inicio)*100)/100});
        if (muestras.length > 100) muestras.shift();
        document.body.dataset.svPerf = JSON.stringify(muestras);
      }
    };
  });
})();
