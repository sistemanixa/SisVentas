/* v1.36.23 — Aviso liviano entre módulos sin bloqueo visual */
(function(){
  'use strict';

  var HEAVY_PAGES = {
    dashboard: 420,
    detalle: 520,
    presupuesto: 520,
    ordentrabajo: 560,
    cobranzas: 560,
    cuentacorriente: 560,
    clientes: 480,
    productos: 520,
    gastos: 560,
    ctaemp: 560,
    informes: 500,
    equipos: 500,
    agenda: 620,
    notificaciones: 420,
    rentabilidad: 520,
    estadisticas: 560,
    tablero: 560,
    caja: 480,
    creditofiscal: 560,
    reportes: 520,
    garantias: 480,
    soporte: 480,
    remitos: 480,
    servicios: 480,
    empleados: 500,
    usuarios: 420,
    configuracion: 420
  };

  var timers = {};
  var hardTimers = {};
  var seq = 0;
  var MAX_VISIBLE_MS = 650;

  function pageId(id){
    return String(id || '').replace(/^page-/, '');
  }

  function pageEl(id){
    return document.getElementById('page-' + pageId(id));
  }

  function ensureLoader(page, id){
    if(!page) return null;
    var loader = page.querySelector(':scope > .sv-page-transition-loader');
    if(loader) return loader;
    loader = document.createElement('div');
    loader.className = 'sv-page-transition-loader';
    loader.innerHTML =
      '<div class="sv-page-transition-box">'+
        '<span class="sv-page-transition-spin"><i class="ti ti-loader-2"></i></span>'+
        '<div><div class="sv-page-transition-title">Cargando módulo…</div>'+
        '<div class="sv-page-transition-sub">Aplicando filtros y preparando la vista</div></div>'+
      '</div>';
    page.appendChild(loader);
    return loader;
  }

  function begin(id, ms){
    id = pageId(id);
    var page = pageEl(id);
    if(!page) return 0;
    var token = ++seq;
    cleanupAll(true);
    var safeMs = Math.min(Math.max(ms || HEAVY_PAGES[id] || 280, 180), MAX_VISIBLE_MS);
    page.dataset.svTransitionToken = String(token);
    page.dataset.svTransitionStarted = String(Date.now());
    page.classList.add('sv-page-transitioning');
    ensureLoader(page, id);
    clearTimeout(timers[id]);
    clearTimeout(hardTimers[id]);
    timers[id] = setTimeout(function(){ end(id, token); }, safeMs);
    hardTimers[id] = setTimeout(function(){ forceEnd(id); }, safeMs + 160);
    return token;
  }

  function end(id, token){
    id = pageId(id);
    var page = pageEl(id);
    if(!page) return;
    if(token && page.dataset.svTransitionToken !== String(token)) return;
    page.classList.remove('sv-page-transitioning');
    delete page.dataset.svTransitionToken;
    delete page.dataset.svTransitionStarted;
    clearTimeout(timers[id]);
    clearTimeout(hardTimers[id]);
  }

  function forceEnd(id){
    id = pageId(id);
    var page = pageEl(id);
    if(!page) return;
    page.classList.remove('sv-page-transitioning');
    delete page.dataset.svTransitionToken;
    delete page.dataset.svTransitionStarted;
    clearTimeout(timers[id]);
    clearTimeout(hardTimers[id]);
  }

  function cleanupAll(force){
    Array.prototype.forEach.call(document.querySelectorAll('.page.sv-page-transitioning'), function(page){
      var started = Number(page.dataset.svTransitionStarted || 0);
      if(force || !started || Date.now() - started > MAX_VISIBLE_MS + 120) forceEnd(page.id);
    });
  }

  function wrapShowPage(){
    if(typeof window.showPage !== 'function' || window.showPage._svPageTransition) return;
    var original = window.showPage;
    window.showPage = function(id, el){
      var clean = pageId(id);
      var ms = HEAVY_PAGES[clean] || 0;
      var token = 0;
      if(ms) token = begin(clean, ms);
      var result = original.apply(this, arguments);
      if(ms){
        requestAnimationFrame(function(){
          setTimeout(function(){ end(clean, token); }, Math.min(ms, MAX_VISIBLE_MS));
          setTimeout(function(){ forceEnd(clean); }, Math.min(ms, MAX_VISIBLE_MS) + 180);
        });
      }
      return result;
    };
    window.showPage._svPageTransition = true;
    window.showPage._svOriginal = original;
  }

  function endActiveSoon(){
    var active = document.querySelector('.page.active.sv-page-transitioning');
    if(!active) return;
    var id = pageId(active.id);
    var token = active.dataset.svTransitionToken;
    setTimeout(function(){ end(id, token); }, 90);
  }

  window.svPageTransition = {
    begin: begin,
    end: end,
    forceEnd: forceEnd,
    cleanupAll: cleanupAll,
    endActiveSoon: endActiveSoon
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrapShowPage);
  else wrapShowPage();

  document.addEventListener('sisventas:page-changed', function(event){
    var id = event.detail && event.detail.page;
    if(id && HEAVY_PAGES[id]) {
      var page = pageEl(id);
      if(page && !page.classList.contains('sv-page-transitioning')) begin(id, Math.min(HEAVY_PAGES[id], 360));
    }
    endActiveSoon();
  });

  document.addEventListener('visibilitychange', cleanupAll);
  window.addEventListener('pageshow', function(){ setTimeout(cleanupAll, 120); });
})();
