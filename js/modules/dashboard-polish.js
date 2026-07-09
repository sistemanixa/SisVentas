/* v1.35.7 — Orden y límites visuales del dashboard */
(function(){
  'use strict';

  function pageDashboard(){
    return document.getElementById('page-dashboard');
  }

  function moveBefore(parent, node, before){
    if(!parent || !node || !before || node === before) return;
    if(node.nextElementSibling === before) return;
    parent.insertBefore(node, before);
  }

  function ordenarDashboard(){
    var page = pageDashboard();
    if(!page) return;
    var rent = document.getElementById('dash-rentabilidad-card');
    var actividad = document.getElementById('dash-actividad-card');
    var ultimas = document.getElementById('dash-ultimas-ventas-card');

    // Pedido operativo: rentabilidad arriba de últimos movimientos.
    moveBefore(page, rent, actividad);

    // Mantener últimas ventas después de movimientos para lectura natural:
    // resumen financiero -> movimientos -> ventas recientes.
    if(actividad && ultimas && actividad.nextElementSibling !== ultimas){
      page.insertBefore(ultimas, actividad.nextElementSibling);
    }
  }

  function marcarLimites(){
    var act = document.getElementById('dash-actividad-lista');
    if(act) act.dataset.limit = '5';
    var ventas = document.getElementById('dash-ultimas-ventas');
    if(ventas) ventas.dataset.limit = '5';
    var ventasMob = document.getElementById('dash-ventas-mobile-lista');
    if(ventasMob) ventasMob.dataset.limit = '5';
  }

  function aplicar(){
    ordenarDashboard();
    marcarLimites();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
  document.addEventListener('sisventas:page-changed', function(event){
    if(!event.detail || event.detail.page === 'dashboard') setTimeout(aplicar, 60);
  });
  document.addEventListener('firebase-ready', function(){ setTimeout(aplicar, 250); });
  window.SisVentas = window.SisVentas || {};
  window.SisVentas.aplicarDashboardPolish = aplicar;
})();
