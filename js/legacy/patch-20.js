(function(){
  var KEY = 'sisventas_dash_ventas_ot_pct_v20_336';
  var DEFAULT = 54;
  var MIN = 38;
  var MAX = 72;
  function clamp(n){ return Math.max(MIN, Math.min(MAX, n)); }
  function applyPct(pct){
    var row = document.getElementById('dash-row2-admin');
    if(!row) return;
    pct = clamp(Number(pct) || DEFAULT);
    row.style.setProperty('--sv335-sales-width', pct.toFixed(1) + '%');
    row.style.setProperty('--sv335-divider-left', pct.toFixed(1) + '%');
  }
  function getSaved(){
    try { return clamp(parseFloat(localStorage.getItem(KEY)) || DEFAULT); }
    catch(e){ return DEFAULT; }
  }
  function savePct(pct){
    try { localStorage.setItem(KEY, String(clamp(pct))); } catch(e) {}
  }
  function ensure(){
    var row = document.getElementById('dash-row2-admin');
    if(!row) return;
    row.classList.add('sv335-resizable');
    if(!document.getElementById('sv335-dashboard-divider')){
      var divider = document.createElement('div');
      divider.id = 'sv335-dashboard-divider';
      divider.title = 'Arrastrar para ajustar Ventas / OT. Doble click para restablecer.';
      row.appendChild(divider);
      var dragging = false;
      function pctFromEvent(ev){
        var point = ev.touches && ev.touches.length ? ev.touches[0] : ev;
        var rect = row.getBoundingClientRect();
        return clamp(((point.clientX - rect.left) / rect.width) * 100);
      }
      function start(ev){
        if(window.innerWidth < 1200) return;
        dragging = true;
        divider.classList.add('dragging');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        move(ev);
        ev.preventDefault();
      }
      function move(ev){
        if(!dragging) return;
        var pct = pctFromEvent(ev);
        applyPct(pct);
        ev.preventDefault();
      }
      function end(ev){
        if(!dragging) return;
        dragging = false;
        divider.classList.remove('dragging');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        savePct(pctFromEvent(ev.changedTouches && ev.changedTouches.length ? ev.changedTouches[0] : ev));
      }
      divider.addEventListener('mousedown', start);
      divider.addEventListener('touchstart', start, {passive:false});
      divider.addEventListener('dblclick', function(){ applyPct(DEFAULT); savePct(DEFAULT); });
      window.addEventListener('mousemove', move, {passive:false});
      window.addEventListener('touchmove', move, {passive:false});
      window.addEventListener('mouseup', end);
      window.addEventListener('touchend', end);
    }
    if(!document.getElementById('sv335-dashboard-reset')){
      var reset = document.createElement('button');
      reset.id = 'sv335-dashboard-reset';
      reset.type = 'button';
      reset.textContent = 'Restablecer ancho';
      reset.title = 'Volver al ancho recomendado';
      reset.onclick = function(){ applyPct(DEFAULT); savePct(DEFAULT); };
      row.appendChild(reset);
    }
    applyPct(getSaved());
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure); else ensure();
  document.addEventListener('firebase-ready', function(){ setTimeout(ensure, 300); });
  window.addEventListener('resize', function(){ applyPct(getSaved()); });
  var oldShowPage = window.showPage;
  if(typeof oldShowPage === 'function' && !oldShowPage.__sv335Wrapped){
    var wrapped = function(){
      var r = oldShowPage.apply(this, arguments);
      setTimeout(ensure, 80);
      return r;
    };
    wrapped.__sv335Wrapped = true;
    window.showPage = wrapped;
  }
})();
