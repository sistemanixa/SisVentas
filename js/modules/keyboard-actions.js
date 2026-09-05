(function () {
  'use strict';
  function visible(n) { return n && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden'; }
  function texto(n) { return (n.textContent || n.value || '').replace(/[\uE000-\uF8FF]/g, '').trim(); }
  function ambito() {
    var modales = Array.from(document.querySelectorAll('[role="dialog"],.modal-overlay.open,[id^="modal-"],[id$="-modal"]')).filter(visible);
    modales.sort(function(a,b) { return (parseInt(getComputedStyle(b).zIndex) || 0) - (parseInt(getComputedStyle(a).zIndex) || 0); });
    return modales[0] || document.querySelector('.page.active');
  }
  function botones(root, patron) {
    return Array.from(root.querySelectorAll('button,input[type="submit"]')).filter(function(b) { return visible(b) && patron.test(texto(b)); });
  }
  function guardar(root) {
    var lista = botones(root, /^Guardar(?:\s|$)/i);
    if (lista.length !== 1) { notify(lista.length ? 'Seleccioná el botón Guardar de la sección que querés guardar' : 'Esta ventana no tiene un botón Guardar'); return; }
    if (!lista[0].disabled) lista[0].click();
  }
  function refrescar(root) {
    // Nunca reconstruir un formulario abierto: sus valores son un borrador.
    if (botones(root, /^Guardar(?:\s|$)/i).length) {
      window.dispatchEvent(new Event('resize'));
      notify('El formulario conserva tus cambios. Los datos se sincronizan en segundo plano');
      return;
    }
    if (root.id === 'page-productos' && visible(document.getElementById('prod-detail-view'))) { verProducto(editingProdId, _prodDetalleOrigen); return; }
    if (root.id === 'page-detalle' && visible(document.getElementById('venta-detalle-view'))) { verDetalleVenta(window._ventaDetActualId); return; }
    var actualizar = botones(root, /^(?:Refrescar|Actualizar vista|Actualizar listado|Actualizar resumen)(?:\s|$)/i);
    if (actualizar.length === 1 && !actualizar[0].disabled) { actualizar[0].click(); return; }
    var acciones = {
      dashboard:['solicitarRenderDashboard'], productos:['renderTablaProductos'], detalle:['_aplicarFiltrosVentas','renderMetricasVentas'],
      presupuesto:['renderPptoTabla'], ordentrabajo:['renderOTTabla'], catalogo:['renderCatalogo'],
      gastos:['renderTablaGastos','actualizarMetricasGastos'], informes:['renderTablaInformes'], equipos:['renderEquiposCards','actualizarMetricasEquipos'],
      ordenes:['renderDashOrdenes'], vacaciones:['renderModuloVacaciones'], tablero:['renderTablero'], reportes:['renderReportes'],
      estadisticas:['renderEstadisticas'], empleados:['renderTablaEmpleados'], usuarios:['renderTablaUsuarios'], garantias:['renderGarantiasUnificadas'],
      actualizadorprecios:['renderModuloActualizadorPrecios'], notificaciones:['renderHistorialComunicados']
    };
    var pagina = root.id.replace(/^page-/, '');
    var hechas = 0;
    (acciones[pagina] || []).forEach(function(nombre) { if (typeof window[nombre] === 'function') { window[nombre](pagina === 'dashboard' ? true : undefined); hechas++; } });
    window.dispatchEvent(new Event('resize'));
    notify(hechas ? 'Vista actualizada' : 'Los datos de esta ventana se mantienen sincronizados en tiempo real');
  }
  document.addEventListener('keydown', function(event) {
    if (event.key !== 'F5' && event.key !== 'F8') return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    var root = ambito();
    if (!root) return;
    if (event.key === 'F5') guardar(root); else refrescar(root);
  }, true);
})();
