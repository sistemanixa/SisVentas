/* v2.0.222 — Estado real de preparación entre módulos */
(function(){
  'use strict';

  var HEAVY_PAGES = {
    clientes: 'Preparando clientes',
    productos: 'Preparando catálogo',
    detalle: 'Preparando ventas',
    presupuesto: 'Preparando presupuestos',
    ordentrabajo: 'Preparando órdenes de trabajo',
    gastos: 'Preparando gastos'
  };

  var timers = {};
  var hardTimers = {};
  var showTimers = {};
  var seq = 0;
  var MAX_VISIBLE_MS = 8000;
  var DISPLAY_DELAY_MS = 0;

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
        '<div><div class="sv-page-transition-title">'+(HEAVY_PAGES[id] || 'Preparando módulo')+'</div>'+
        '<div class="sv-page-transition-sub">Organizando la información de la vista</div></div>'+
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
    var safeMs = MAX_VISIBLE_MS;
    page.dataset.svTransitionToken = String(token);
    page.dataset.svTransitionStarted = String(Date.now());
    clearTimeout(showTimers[id]);
    page.classList.add('sv-page-transitioning');
    ensureLoader(page, id);
    clearTimeout(timers[id]);
    clearTimeout(hardTimers[id]);
    hardTimers[id] = setTimeout(function(){ forceEnd(id); }, safeMs);
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
    clearTimeout(showTimers[id]);
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
    clearTimeout(showTimers[id]);
    clearTimeout(timers[id]);
    clearTimeout(hardTimers[id]);
  }

  function cleanupAll(force){
    if(force){
      Object.keys(showTimers).forEach(function(id){ clearTimeout(showTimers[id]); });
      Object.keys(timers).forEach(function(id){ clearTimeout(timers[id]); });
      Object.keys(hardTimers).forEach(function(id){ clearTimeout(hardTimers[id]); });
    }
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
      var ms = HEAVY_PAGES[clean] ? MAX_VISIBLE_MS : 0;
      var token = 0;
      if(ms) token = begin(clean, ms);
      var result = original.apply(this, arguments);
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

  document.addEventListener('sisventas:module-ready', function(event){
    var id = pageId(event.detail && event.detail.page);
    var page = pageEl(id);
    if(page) end(id, page.dataset.svTransitionToken);
  });
  document.addEventListener('sisventas:page-changed', function(event){
    var activeId = pageId(event.detail && event.detail.page);
    Array.prototype.forEach.call(document.querySelectorAll('.page.sv-page-transitioning'), function(page){
      if(pageId(page.id) !== activeId) forceEnd(page.id);
    });
  });

  document.addEventListener('visibilitychange', cleanupAll);
  window.addEventListener('pageshow', function(){ setTimeout(cleanupAll, 120); });
})();
