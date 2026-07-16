(function(){
  'use strict';

  function normalizarRol(v){
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  }

  function rolActual(){
    try {
      if(window.SisVentas && window.SisVentas.Access) return normalizarRol(window.SisVentas.Access.current());
      return normalizarRol(window.currentRole || (window.currentUserData && (window.currentUserData.rol || window.currentUserData.role)) || '');
    } catch(e){ return ''; }
  }

  function esAdmin(){
    var r = rolActual();
    return r === 'admin' || r === 'administrador';
  }

  function esTecnico(){
    return rolActual() === 'tecnico';
  }

  function esOperativoPersonal(){
    var r = rolActual();
    return r === 'administrativo' || r === 'vendedor';
  }

  function q(id){ return document.getElementById(id); }
  function hide(id){ var el = q(id); if(el) el.style.display = 'none'; }
  function show(id, display){ var el = q(id); if(el) el.style.display = display || ''; }
  function navByPage(page){
    return Array.prototype.slice.call(document.querySelectorAll('.nav-item')).filter(function(el){
      var oc = el.getAttribute('onclick') || '';
      return oc.indexOf(page) >= 0;
    });
  }
  function setNav(page, visible){ navByPage(page).forEach(function(el){ el.style.display = visible ? '' : 'none'; }); }

  window.sv361ApplyRoleGuard = function(){
    var admin = esAdmin();
    var tec = esTecnico();
    ['dash-metricas-globales','dash-row2-admin','dash-actividad-card','dash-rentabilidad-card','dash-ultimas-ventas-card','ventas-list-stats-global'].forEach(function(id){
      if(admin) show(id);
      else hide(id);
    });

    // "Mi actividad" no aporta valor al admin; queda para roles operativos.
    if(admin || tec) hide('dash-administrativo-card');
    else if(esOperativoPersonal()) show('dash-administrativo-card');
    else hide('dash-administrativo-card');

    if(!admin){
      var pageDash = q('page-dashboard');
      if(pageDash){
        Array.prototype.forEach.call(pageDash.querySelectorAll('.metrics.no-tecnico,.row2.admin-only,.card.admin-only'), function(el){
          el.style.display = 'none';
        });
      }
    }

    var restrictedTech = ['gastos','caja','tesoreria','rentabilidad','proveedores','ordenes','creditofiscal','usuarios','configuracion','detalle','cobranzas','cuentacorriente','reportes','estadisticas','presupuesto','venta'];
    restrictedTech.forEach(function(p){ if(tec) setNav(p, false); });
    if(tec){
      restrictedTech.forEach(function(p){
        var pg = q('page-' + p);
        if(pg && pg.classList.contains('active') && typeof window.showPage === 'function') {
          window.showPage('ctaemp', document.querySelector('[onclick*=ctaemp]'));
        }
      });
    }
  };

  document.addEventListener('sisventas:page-changed', function(){ setTimeout(window.sv361ApplyRoleGuard, 60); });
  document.addEventListener('sisventas:role-changed', function(){ setTimeout(window.sv361ApplyRoleGuard, 60); });
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(window.sv361ApplyRoleGuard, 250); });
  document.addEventListener('firebase-ready', function(){ setTimeout(window.sv361ApplyRoleGuard, 500); });
})();
