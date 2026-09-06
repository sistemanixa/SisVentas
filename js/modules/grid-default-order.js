/* Regla general de grillas: la fecha más nueva se muestra primero. */
(function () {
  'use strict';

  var firmas = new WeakMap();
  var programado = false;

  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }

  function indiceFecha(tabla) {
    var encabezados = Array.from(tabla.querySelectorAll('thead tr:first-child th'));
    for (var i = 0; i < encabezados.length; i++) {
      var clave = normalizar(encabezados[i].dataset.sort || encabezados[i].dataset.svColumnLabel || encabezados[i].textContent);
      if (clave === 'fecha' || clave.indexOf('fecha ') === 0) return i;
    }
    return -1;
  }

  function marcaFecha(texto) {
    var valor = String(texto || '').trim();
    var iso = valor.match(/(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)/);
    if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
    var local = valor.match(/([0-3]?\d)[-\/]([01]?\d)[-\/](\d{4})/);
    if (local) return Date.UTC(+local[3], +local[2] - 1, +local[1]);
    return NaN;
  }

  function tieneOrdenElegido(tabla) {
    return !!(tabla.id && window._sortState && window._sortState[tabla.id]);
  }

  function ordenar(tabla) {
    if (!tabla || tieneOrdenElegido(tabla)) return;
    var columna = indiceFecha(tabla);
    if (columna < 0) return;
    Array.from(tabla.tBodies || []).forEach(function (tbody) {
      var filas = Array.from(tbody.rows || []);
      if (filas.length < 2) return;
      var datos = filas.map(function (fila, posicion) {
        var celda = fila.cells && fila.cells[columna];
        return { fila:fila, posicion:posicion, fecha:marcaFecha(celda ? celda.textContent : '') };
      });
      if (datos.filter(function (dato) { return Number.isFinite(dato.fecha); }).length < 2) return;
      var firmaAntes = datos.map(function (dato) { return Number.isFinite(dato.fecha) ? dato.fecha : 'x'; }).join('|');
      if (firmas.get(tbody) === firmaAntes) return;
      datos.sort(function (a, b) {
        if (!Number.isFinite(a.fecha)) return Number.isFinite(b.fecha) ? 1 : a.posicion - b.posicion;
        if (!Number.isFinite(b.fecha)) return -1;
        return b.fecha - a.fecha || a.posicion - b.posicion;
      });
      datos.forEach(function (dato) { tbody.appendChild(dato.fila); });
      firmas.set(tbody, datos.map(function (dato) { return Number.isFinite(dato.fecha) ? dato.fecha : 'x'; }).join('|'));
      tabla.dataset.svDefaultOrder = 'fecha-desc';
      var th = tabla.querySelectorAll('thead tr:first-child th')[columna];
      if (th && !th.hasAttribute('aria-sort')) th.setAttribute('aria-sort', 'descending');
    });
  }

  function aplicar() {
    programado = false;
    document.querySelectorAll('table').forEach(ordenar);
  }

  function programar() {
    if (programado) return;
    programado = true;
    requestAnimationFrame(aplicar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', programar);
  else programar();
  new MutationObserver(programar).observe(document.documentElement, { childList:true, subtree:true });
  window.svAplicarOrdenGeneralGrillas = aplicar;
})();
