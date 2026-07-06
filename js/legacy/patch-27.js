(function(){
  function rolActual(){
    try {
      if(window.SisVentas && window.SisVentas.Access) return window.SisVentas.Access.current();
      return String(window.currentRole || (window.currentUserData && (window.currentUserData.rol || window.currentUserData.role)) || '').toLowerCase();
    } catch(e){ return ''; }
  }
  function esAdmin(){ var r=rolActual(); return r==='admin' || r==='administrador'; }
  function esTecnico(){ var r=rolActual(); return r==='tecnico' || r==='técnico'; }
  function q(id){ return document.getElementById(id); }
  function hide(id){ var el=q(id); if(el) el.style.display='none'; }
  function show(id,display){ var el=q(id); if(el) el.style.display=display||''; }
  function navByPage(page){ return Array.prototype.slice.call(document.querySelectorAll('.nav-item')).filter(function(el){ var oc=el.getAttribute('onclick')||''; return oc.indexOf(page)>=0; }); }
  function setNav(page, visible){ navByPage(page).forEach(function(el){ el.style.display=visible?'':'none'; }); }
  window.sv361ApplyRoleGuard=function(){
    var admin=esAdmin(), tec=esTecnico();
    ['dash-metricas-globales','dash-row2-admin','dash-actividad-card','dash-rentabilidad-card','dash-ultimas-ventas-card','dash-administrativo-card','ventas-stats-global','ventas-list-stats-global'].forEach(function(id){ if(admin) show(id); else hide(id); });
    if(!admin){ var pageDash=q('page-dashboard'); if(pageDash){ Array.prototype.forEach.call(pageDash.querySelectorAll('.metrics.no-tecnico,.row2.admin-only,.card.admin-only'),function(el){el.style.display='none';}); } }
    var restrictedTech=['gastos','caja','tesoreria','rentabilidad','proveedores','ordenes','creditofiscal','usuarios','configuracion','detalle','cobranzas','cuentacorriente','reportes','estadisticas','presupuesto','venta'];
    restrictedTech.forEach(function(p){ if(tec) setNav(p,false); });
    if(tec){ restrictedTech.forEach(function(p){ var pg=q('page-'+p); if(pg&&pg.classList.contains('active')&&typeof window.showPage==='function') window.showPage('ctaemp',document.querySelector('[onclick*=ctaemp]')); }); }
  };
  document.addEventListener('sisventas:page-changed',function(){ setTimeout(window.sv361ApplyRoleGuard,60); });
  function notifPermitidaTecnico(n){
    var txt=''; try{ txt=[n.tipo,n.titulo,n.title,n.descripcion,n.mensaje,n.body,n.modulo,n.categoria].join(' ').toLowerCase(); }catch(e){}
    var bloqueadas=['stock','presupuesto','iva','deuda','caja','tesorer','factur','proveedor','orden de compra','compra','cliente con saldo','vencimiento presupuesto'];
    for(var i=0;i<bloqueadas.length;i++){ if(txt.indexOf(bloqueadas[i])>=0) return false; }
    var permitidas=['ot','orden de trabajo','reclamo','soporte','garant','pago','pagado','hora extra','hs extra','comision','comisión','asignad','tecnico','técnico'];
    for(var j=0;j<permitidas.length;j++){ if(txt.indexOf(permitidas[j])>=0) return true; }
    return false;
  }
  function wrapNotif(){
    if(typeof window.renderNotificaciones==='function'&&!window.renderNotificaciones._sv361Guarded){
      var oldRender=window.renderNotificaciones;
      window.renderNotificaciones=function(filtro){
        if(esTecnico()&&Array.isArray(window.todasNotifs)){ var original=window.todasNotifs; window.todasNotifs=original.filter(notifPermitidaTecnico); try{return oldRender.call(this,filtro);} finally{window.todasNotifs=original;} }
        return oldRender.call(this,filtro);
      };
      window.renderNotificaciones._sv361Guarded=true;
    }
    if(typeof window.actualizarBadgeNotif==='function'&&!window.actualizarBadgeNotif._sv361Guarded){
      var oldBadge=window.actualizarBadgeNotif;
      window.actualizarBadgeNotif=function(){
        if(esTecnico()&&Array.isArray(window.todasNotifs)){ var original=window.todasNotifs; window.todasNotifs=original.filter(notifPermitidaTecnico); try{return oldBadge.call(this);} finally{window.todasNotifs=original;} }
        return oldBadge.call(this);
      };
      window.actualizarBadgeNotif._sv361Guarded=true;
    }
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){wrapNotif();window.sv361ApplyRoleGuard();},250);});
  document.addEventListener('firebase-ready',function(){setTimeout(function(){wrapNotif();window.sv361ApplyRoleGuard();},500);});
  // Sin polling: applyRole y showPage ya vuelven a aplicar el guard cuando
  // cambia el usuario o la pantalla. El intervalo anterior ocultaba el
  // dashboard porque leía un rol desincronizado.
})();
