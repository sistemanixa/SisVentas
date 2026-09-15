(function(root) {
  'use strict';
  var round = function(n) { return Math.round((n + Number.EPSILON) * 100) / 100; };
  function calcular(qty, compra, netoItem, descuentoGeneral) {
    var costo = round(qty * compra);
    var neto = round(netoItem - round(netoItem * descuentoGeneral / 100));
    var ganancia = round(neto - costo);
    return { compra:compra, costo:costo, neto:neto, ganancia:ganancia, margen:neto > 0 ? ganancia / neto * 100 : null };
  }
  function encabezados() {
    return ['P. compra','Compra total','Ganancia','Margen'].map(function(label) {
      return '<th class="tr sv-comparacion-celda">'+label+'</th>';
    }).join('');
  }
  function celdas(modelo) {
    var money = root.importeComprobanteVenta;
    return [money(modelo.compra),money(modelo.costo),money(modelo.ganancia),modelo.margen === null ? '—' : modelo.margen.toFixed(1)+'%'].map(function(value,index) {
      return '<td class="tr sv-comparacion-celda" style="white-space:nowrap;color:var(--'+(index < 2 ? 'amber' : modelo.ganancia < 0 ? 'red' : 'green')+')">'+value+'</td>';
    }).join('');
  }
  root.ComparacionComercial = { calcular:calcular, encabezados:encabezados, celdas:celdas };
  if (typeof module !== 'undefined') module.exports = root.ComparacionComercial;
})(typeof window !== 'undefined' ? window : globalThis);
