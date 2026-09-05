(function(){
  window.sv361ApplyRoleGuard = function(){
    if (!window.tienePermiso) return;
    var widgets = {'dash-metricas-globales':'dashboard.metricasGlobales','dash-actividad-card':'dashboard.actividad','dash-rentabilidad-card':'dashboard.rentabilidad','dash-ultimas-ventas-card':'ventas.verDashboard','ventas-list-stats-global':'ventas.verDashboard','dash-administrativo-card':'dashboard.miActividad','dash-tecnico-card':'dashboard.misOT','dash-micuenta-card':'dashboard.miCuenta','dash-historial-mes-card':'dashboard.miCuenta'};
    Object.keys(widgets).forEach(function(id){var el=document.getElementById(id);if(el)el.style.display=window.tienePermiso(widgets[id])?'':'none';});
    if(typeof window.applyDashWidgets==='function')window.applyDashWidgets();
    document.querySelectorAll('.nav-item[onclick]').forEach(function(el){var m=String(el.getAttribute('onclick')).match(/showPage\('([^']+)'/);if(m && typeof window.permisoModulo==='function')el.style.display=window.permisoModulo(m[1])?'':'none';});
  };
  document.addEventListener('sisventas:page-changed',window.sv361ApplyRoleGuard);
  document.addEventListener('sisventas:role-changed',window.sv361ApplyRoleGuard);
})();
