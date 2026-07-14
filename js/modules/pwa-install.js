/* ══════════════════════════════════════════════════════════════════════════════
   v20.339 — PWA instalable
   - Registra sw.js sin borrar caché al iniciar.
   - Expone botón Instalar cuando Chrome habilita beforeinstallprompt.
   - Mantiene compatibilidad con Google Password Manager y Firebase.
   ══════════════════════════════════════════════════════════════════════════════ */
(function(){
  var deferredPrompt = null;
  function notify(msg, type){
    try { if (typeof toast === 'function') return toast(msg, type || 'info'); } catch(e){}
    try { if (typeof showNotif === 'function') return showNotif(msg); } catch(e){}
  }
  function ensureInstallButton(){
    var btn = document.getElementById('sv339-install-app-btn');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'sv339-install-app-btn';
    btn.type = 'button';
    btn.innerHTML = '<i class="ti ti-download"></i><span>Instalar</span>';
    btn.style.cssText = 'display:none;position:fixed;right:18px;bottom:142px;z-index:9999;align-items:center;gap:7px;padding:10px 14px;border-radius:999px;border:0.5px solid var(--border2);background:var(--text);color:var(--bg2);font-family:inherit;font-size:13px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer';
    btn.onclick = async function(){
      if (!deferredPrompt) {
        notify('Para instalar: menú de Chrome → Agregar a pantalla principal.');
        return;
      }
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch(e) {}
      deferredPrompt = null;
      btn.style.display = 'none';
    };
    document.body.appendChild(btn);
    return btn;
  }
  function isStandalone(){
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone()) ensureInstallButton().style.display = 'inline-flex';
  });
  window.addEventListener('appinstalled', function(){
    deferredPrompt = null;
    var btn = document.getElementById('sv339-install-app-btn');
    if (btn) btn.style.display = 'none';
    notify('SisVentas instalado correctamente.');
  });
  window.svInstalarApp = function(){
    var btn = ensureInstallButton();
    btn.click();
  };
  window.svPwaEstado = function(){
    return {
      standalone: isStandalone(),
      serviceWorker: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
      promptDisponible: !!deferredPrompt
    };
  };
  function registerSW(){
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      console.warn('[PWA] Chrome solo permite instalar PWAs en HTTPS o localhost.');
      return;
    }
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(function(reg){
        if (reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
      })
      .catch(function(err){ console.warn('[PWA] No se pudo registrar sw.js:', err); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registerSW);
  else registerSW();
})();
