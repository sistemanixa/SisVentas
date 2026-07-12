/* v1.36.24 — Monitor anclado al centro de la barra superior en PC */
(function(){
  'use strict';

  var started = false;
  var timer = null;
  var lastTick = performance.now();
  var loadPct = 0;
  var lastDownload = 0;
  var uploadBytes = 0;
  var MONITOR_INTERVAL_MS = 5000;
  var lastRenderPage = '';

  function rol(){
    try {
      if(window.SisVentas && window.SisVentas.Access && typeof window.SisVentas.Access.current === 'function') {
        return norm(window.SisVentas.Access.current());
      }
      return norm(window.currentRole || (window.currentUserData && (window.currentUserData.rol || window.currentUserData.role)) || '');
    } catch(e){ return ''; }
  }

  function norm(v){
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  }

  function esAdmin(){
    var r = rol();
    return r === 'admin' || r === 'administrador';
  }

  function esPantallaChica(){
    try {
      return !!(window.matchMedia && window.matchMedia('(max-width: 1100px)').matches);
    } catch(e){ return false; }
  }

  function puedeMonitorear(){
    return esAdmin() && !esPantallaChica();
  }

  function pausarMonitor(){
    if(timer){
      clearInterval(timer);
      timer = null;
    }
    var card = document.getElementById('sv-resource-monitor-card');
    if(card) card.style.display = 'none';
  }

  function bytes(v){
    v = Number(v || 0);
    if(v >= 1073741824) return (v / 1073741824).toFixed(1) + ' GB';
    if(v >= 1048576) return (v / 1048576).toFixed(1) + ' MB';
    if(v >= 1024) return Math.round(v / 1024) + ' KB';
    return Math.round(v) + ' B';
  }

  function bodySize(body){
    try {
      if(!body) return 0;
      if(typeof body === 'string') return new Blob([body]).size;
      if(body instanceof Blob) return body.size || 0;
      if(body instanceof FormData) {
        var total = 0;
        body.forEach(function(value, key){
          total += String(key || '').length;
          if(value instanceof Blob) total += value.size || 0;
          else total += String(value || '').length;
        });
        return total;
      }
      if(body instanceof URLSearchParams) return String(body).length;
    } catch(e){}
    return 0;
  }

  function patchNetwork(){
    if(window.fetch && !window.fetch._svResourceMonitor){
      var originalFetch = window.fetch;
      window.fetch = function(input, init){
        try {
          var body = init && init.body;
          if(!body && input && input.body) body = input.body;
          uploadBytes += bodySize(body);
        } catch(e){}
        return originalFetch.apply(this, arguments);
      };
      window.fetch._svResourceMonitor = true;
      window.fetch._svOriginal = originalFetch;
    }
    if(window.XMLHttpRequest && !window.XMLHttpRequest.prototype.send._svResourceMonitor){
      var originalSend = window.XMLHttpRequest.prototype.send;
      window.XMLHttpRequest.prototype.send = function(body){
        try { uploadBytes += bodySize(body); } catch(e){}
        return originalSend.apply(this, arguments);
      };
      window.XMLHttpRequest.prototype.send._svResourceMonitor = true;
      window.XMLHttpRequest.prototype.send._svOriginal = originalSend;
    }
  }

  function downloadBytes(){
    try {
      var entries = performance.getEntriesByType('resource');
      var start = Math.max(0, entries.length - 180);
      var sum = 0;
      for(var i=start; i<entries.length; i++){
        var entry = entries[i];
        sum += (entry.transferSize || entry.encodedBodySize || 0);
      }
      return sum;
    } catch(e){ return 0; }
  }

  function memoryInfo(){
    var m = performance.memory;
    if(!m) return { label:'No disponible', pct:0, detail:'El navegador no informa memoria JS' };
    var used = m.usedJSHeapSize || 0;
    var limit = m.jsHeapSizeLimit || m.totalJSHeapSize || 0;
    var pct = limit ? Math.min(100, Math.round(used / limit * 100)) : 0;
    return { label:bytes(used), pct:pct, detail:limit ? (pct + '% del límite JS') : 'Memoria JS usada' };
  }

  function connectionInfo(){
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if(!c) return 'Conexión estable';
    var down = c.downlink ? (c.downlink + ' Mbps') : 'sin dato';
    return (c.effectiveType ? c.effectiveType.toUpperCase() + ' · ' : '') + down;
  }

  function ensureCard(){
    var card = document.getElementById('sv-resource-monitor-card');
    var slot = document.getElementById('topbar-resource-monitor-slot');
    if(card) {
      if(slot && card.parentNode !== slot) slot.appendChild(card);
      return card;
    }
    card = document.createElement('div');
    card.id = 'sv-resource-monitor-card';
    card.className = 'admin-only sv-rm-card sv-rm-compact';
    card.innerHTML =
      '<div class="sv-rm-title"><i class="ti ti-activity"></i><span>Recursos</span><span class="badge b-blue" id="sv-rm-state">OK</span></div>'+
      '<div class="sv-rm-strip">'+
        '<div class="sv-rm-mini" title="Memoria JS"><span>Mem</span><strong id="sv-rm-memory">—</strong><em id="sv-rm-memory-detail">—</em><div class="sv-rm-meter"><span id="sv-rm-memory-bar"></span></div></div>'+
        '<div class="sv-rm-mini" title="Carga estimada de la interfaz"><span>CPU</span><strong id="sv-rm-cpu">—</strong><em>UI estimada</em><div class="sv-rm-meter"><span id="sv-rm-cpu-bar"></span></div></div>'+
        '<div class="sv-rm-mini" title="Descarga estimada del ciclo"><span>Down</span><strong id="sv-rm-down">—</strong><em id="sv-rm-conn">—</em></div>'+
        '<div class="sv-rm-mini" title="Subida estimada por formularios/API"><span>Up</span><strong id="sv-rm-up">—</strong><em>fetch/xhr</em></div>'+
      '</div>';
    if(slot) slot.appendChild(card);
    else document.body.appendChild(card);
    return card;
  }

  function setText(id, value){
    var el = document.getElementById(id);
    if(el) el.textContent = value;
  }

  function setBar(id, pct){
    var el = document.getElementById(id);
    if(el) {
      el.style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
      el.className = pct >= 75 ? 'danger' : (pct >= 50 ? 'warn' : '');
    }
  }

  function snapshot(){
    var mem = memoryInfo();
    var totalDown = downloadBytes();
    var deltaDown = Math.max(0, totalDown - lastDownload);
    lastDownload = totalDown;
    return {
      memory: mem,
      cpuPct: Math.round(loadPct),
      downloadTotal: totalDown,
      downloadDelta: deltaDown,
      uploadTotal: uploadBytes,
      connection: connectionInfo()
    };
  }

  function render(){
    var card = ensureCard();
    if(!card) return;
    if(!puedeMonitorear()){
      card.style.display = 'none';
      return;
    }
    card.style.display = '';
    var s = snapshot();
    setText('sv-rm-memory', s.memory.label);
    setText('sv-rm-memory-detail', s.memory.detail);
    setText('sv-rm-cpu', s.cpuPct + '%');
    setText('sv-rm-down', bytes(s.downloadDelta) + ' / ciclo');
    setText('sv-rm-up', bytes(s.uploadTotal));
    setText('sv-rm-conn', s.connection);
    setBar('sv-rm-memory-bar', s.memory.pct);
    setBar('sv-rm-cpu-bar', s.cpuPct);
    var state = document.getElementById('sv-rm-state');
    if(state){
      state.textContent = (s.memory.pct >= 75 || s.cpuPct >= 70) ? 'Atención' : 'Normal';
      state.className = 'badge ' + ((s.memory.pct >= 75 || s.cpuPct >= 70) ? 'b-amber' : 'b-green');
    }
  }

  function tick(){
    if(!puedeMonitorear()){
      pausarMonitor();
      return;
    }
    var now = performance.now();
    var expected = MONITOR_INTERVAL_MS;
    var lag = Math.max(0, now - lastTick - expected);
    lastTick = now;
    loadPct = Math.max(0, Math.min(100, (lag / expected) * 520));
    render();
  }

  function currentPage(){
    var active = document.querySelector('.page.active');
    return active ? active.id : '';
  }

  function renderAfterNavigation(){
    if(!puedeMonitorear()){
      pausarMonitor();
      return;
    }
    var page = currentPage();
    if(page === lastRenderPage) return;
    lastRenderPage = page;
    render();
  }

  function start(){
    if(started) return;
    started = true;
    patchNetwork();
    lastDownload = downloadBytes();
    lastRenderPage = currentPage();
    if(!puedeMonitorear()){
      pausarMonitor();
      return;
    }
    render();
    timer = setInterval(tick, MONITOR_INTERVAL_MS);
  }

  function reactivarSiCorresponde(){
    if(!puedeMonitorear()){
      pausarMonitor();
      return;
    }
    if(!started){
      start();
      return;
    }
    if(!timer){
      lastTick = performance.now();
      render();
      timer = setInterval(tick, MONITOR_INTERVAL_MS);
      return;
    }
    render();
  }

  window.svResourceMonitorSnapshot = snapshot;
  window.svRenderResourceMonitor = render;
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(start, 350); });
  document.addEventListener('sisventas:page-changed', function(){ setTimeout(renderAfterNavigation, 140); });
  document.addEventListener('sisventas:role-changed', function(){ setTimeout(reactivarSiCorresponde, 140); });
  document.addEventListener('firebase-ready', function(){ setTimeout(reactivarSiCorresponde, 700); });
  window.addEventListener('resize', function(){ setTimeout(reactivarSiCorresponde, 160); }, { passive:true });
})();
