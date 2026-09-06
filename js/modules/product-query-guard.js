(function () {
  'use strict';
  var activo = false;
  var urlProtegida = '';
  window.svBloquearSalidaCotizacion = function () {
    if (!activo) return false;
    window.notify('Esperá a que termine la verificación del producto.');
    return true;
  };
  ['cotizarPreciosProveedores', 'completarProductoDesdeUrl', 'confirmarIdentidadProveedorCotizacion'].forEach(function (nombre) {
    var original = window[nombre];
    if (typeof original !== 'function') return;
    window[nombre] = async function () {
      if (window.svBloquearSalidaCotizacion()) return;
      activo = true;
      urlProtegida = window.location.href;
      window._svConsultaProductoEnCurso = true;
      try { return await original.apply(this, arguments); }
      finally { activo = false; window._svConsultaProductoEnCurso = false; }
    };
  });
  function dialogo(target) {
    return target && target.closest && target.closest('[role="dialog"],.modal-overlay');
  }
  document.addEventListener('click', function (event) {
    if (!activo || dialogo(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.svBloquearSalidaCotizacion();
  }, true);
  document.addEventListener('beforeinput', function (event) {
    if (activo && !dialogo(event.target)) event.preventDefault();
  }, true);
  document.addEventListener('keydown', function (event) {
    if (!activo) return;
    var recarga = event.key === 'F5' || event.key === 'F8' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r');
    var salida = event.key === 'Escape' || (event.altKey && event.key === 'ArrowLeft');
    if (!recarga && !salida) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.svBloquearSalidaCotizacion();
  }, true);
  window.addEventListener('beforeunload', function (event) {
    var masivo = document.getElementById('modal-actualizador-precios');
    if (!activo && !(masivo && masivo.dataset.ejecutando === '1')) return;
    event.preventDefault();
    event.returnValue = '';
  });
  window.addEventListener('hashchange', function () {
    if (!activo) return;
    window.history.replaceState(window.history.state, '', urlProtegida);
    window.svBloquearSalidaCotizacion();
  });
})();
