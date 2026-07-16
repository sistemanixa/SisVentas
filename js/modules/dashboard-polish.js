/* v1.35.8 — Orden, límites y visibilidad fina del dashboard */
(function(){
  'use strict';

  function norm(v){
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  }

  function rolActual(){
    var r = norm(window.currentRole || window.currentUserRole || '');
    var badge = document.getElementById('role-badge-el');
    var side = document.getElementById('s-urole-el');
    var txt = norm([r, badge ? badge.textContent : '', side ? side.textContent : ''].join(' '));
    // "administrativo" contiene la palabra "admin": comprobarlo primero.
    if(txt.indexOf('administrativo') >= 0) return 'administrativo';
    if(txt.indexOf('admin') >= 0 || txt.indexOf('administrador') >= 0) return 'admin';
    if(txt.indexOf('vendedor') >= 0) return 'vendedor';
    if(txt.indexOf('tecnico') >= 0) return 'tecnico';
    return r;
  }

  function esAdmin(){
    return rolActual() === 'admin';
  }

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

  function aplicarVisibilidad(){
    var miActividad = document.getElementById('dash-administrativo-card');
    if(miActividad){
      var ocultar = esAdmin();
      miActividad.style.display = ocultar ? 'none' : '';
      if(ocultar) miActividad.dataset.adminHidden = 'true';
      else delete miActividad.dataset.adminHidden;
    }
    var actividadGlobal = document.getElementById('dash-actividad-card');
    if(actividadGlobal){
      actividadGlobal.dataset.dashboardKind = 'global-activity';
      actividadGlobal.dataset.limit = '5';
    }
    var rent = document.getElementById('dash-rentabilidad-card');
    if(rent) rent.dataset.dashboardKind = 'monthly-profit';
    var ventas = document.getElementById('dash-ultimas-ventas-card');
    if(ventas) ventas.dataset.dashboardKind = 'latest-sales';
  }

  function aplicar(){
    ordenarDashboard();
    marcarLimites();
    aplicarVisibilidad();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
  document.addEventListener('sisventas:page-changed', function(event){
    if(!event.detail || event.detail.page === 'dashboard') setTimeout(aplicar, 60);
  });
  document.addEventListener('sisventas:role-changed', function(){ setTimeout(aplicar, 60); });
  document.addEventListener('firebase-ready', function(){ setTimeout(aplicar, 250); });
  window.SisVentas = window.SisVentas || {};
  window.SisVentas.aplicarDashboardPolish = aplicar;
})();
