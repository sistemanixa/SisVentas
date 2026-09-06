(function initSisVentasPush(global) {
  'use strict';

  var previewParams = new URLSearchParams(location.search);
  var previewEnabled = previewParams.get('push_preview') === '1';
  try { previewEnabled = previewEnabled || localStorage.getItem('sisventas.push.preview') === '1'; } catch (_) {}
  if (!previewEnabled) return;

  var REGION = 'southamerica-east1';
  var PROJECT_ID = 'nixa-sisventas';
  var ENDPOINT_BASE = 'https://' + REGION + '-' + PROJECT_ID + '.cloudfunctions.net/';
  var STORAGE_ENABLED = 'sisventas.push.enabled.v1';
  var messagingApiPromise = null;
  var foregroundUnsubscribe = null;
  var registrationInProgress = null;

  function context() {
    return typeof global.obtenerContextoSesionSisVentas === 'function'
      ? (global.obtenerContextoSesionSisVentas() || {})
      : { uid:global.currentUserUid || '', rol:global.currentRole || '', usuario:global.currentUser || '' };
  }

  function supported() {
    return !!(global.isSecureContext && 'Notification' in global && navigator.serviceWorker && global.fbApp && global.fbAuth);
  }

  function enabledLocally() {
    try { return localStorage.getItem(STORAGE_ENABLED) === '1'; } catch (_) { return false; }
  }

  function setEnabledLocally(enabled) {
    try { localStorage.setItem(STORAGE_ENABLED, enabled ? '1' : '0'); } catch (_) {}
  }

  async function authFetch(functionName, payload) {
    var user = global.fbAuth && global.fbAuth.currentUser;
    if (!user) throw new Error('La sesión no está autenticada');
    var idToken = await user.getIdToken();
    var response = await fetch(ENDPOINT_BASE + functionName, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + idToken },
      body: JSON.stringify(payload || {})
    });
    var body = await response.json().catch(function(){ return {}; });
    if (!response.ok || body.error) throw new Error(body.mensaje || 'No se pudo completar la configuración de notificaciones');
    return body;
  }

  function messagingApi() {
    if (!messagingApiPromise) {
      messagingApiPromise = import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');
    }
    return messagingApiPromise;
  }

  function platformLabel() {
    var ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'Android';
    if (/Edg\//i.test(ua)) return 'Edge escritorio';
    if (/Chrome\//i.test(ua)) return 'Chrome escritorio';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS PWA';
    return 'Navegador';
  }

  async function serviceWorkerRegistration() {
    var registration = await navigator.serviceWorker.register('./push-sw.js', { scope:'./push/', updateViaCache:'none' });
    await new Promise(function(resolve, reject) {
      if (registration.active) return resolve();
      var worker = registration.installing || registration.waiting;
      if (!worker) return reject(new Error('No se pudo iniciar el worker de notificaciones'));
      worker.addEventListener('statechange', function() {
        if (worker.state === 'activated') resolve();
        if (worker.state === 'redundant') reject(new Error('El worker de notificaciones quedó inactivo'));
      });
    });
    return registration;
  }

  async function registerDevice(options) {
    options = options || {};
    if (registrationInProgress) return registrationInProgress;
    registrationInProgress = (async function() {
      if (!supported()) throw new Error('Este navegador no admite notificaciones push en esta instalación');
      var permission = Notification.permission;
      if (options.requestPermission && permission === 'default') permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        if (permission === 'denied') throw new Error('Las notificaciones están bloqueadas en la configuración del navegador');
        return { enabled:false, permission:permission };
      }
      var config = await authFetch('configuracionPush', {});
      if (!config.vapidPublicKey) throw new Error('Firebase todavía no tiene configurada la clave pública Web Push');
      var api = await messagingApi();
      var messaging = api.getMessaging(global.fbApp);
      var swRegistration = await serviceWorkerRegistration();
      var token = await api.getToken(messaging, { vapidKey:config.vapidPublicKey, serviceWorkerRegistration:swRegistration });
      if (!token) throw new Error('Firebase no entregó un token para este dispositivo');
      var ctx = context();
      await authFetch('registrarDispositivoPush', {
        token:token,
        role:ctx.rol || '',
        userName:ctx.usuario || '',
        platform:platformLabel(),
        userAgent:(navigator.userAgent || '').slice(0, 240)
      });
      setEnabledLocally(true);
      bindForeground(messaging, api);
      refreshUi();
      return { enabled:true, permission:'granted' };
    })().finally(function(){ registrationInProgress = null; });
    return registrationInProgress;
  }

  async function unregisterDevice(options) {
    options = options || {};
    if (!global.fbAuth || !global.fbAuth.currentUser) return;
    var api = await messagingApi();
    var messaging = api.getMessaging(global.fbApp);
    var registration = await serviceWorkerRegistration();
    var config = await authFetch('configuracionPush', {});
    var token = await api.getToken(messaging, { vapidKey:config.vapidPublicKey, serviceWorkerRegistration:registration });
    if (token) await authFetch('desregistrarDispositivoPush', { token:token });
    if (!options.preservePreference) setEnabledLocally(false);
    refreshUi();
  }

  function bindForeground(messaging, api) {
    if (foregroundUnsubscribe) return;
    foregroundUnsubscribe = api.onMessage(messaging, function(payload) {
      var notification = payload.notification || {};
      var data = payload.data || {};
      var title = notification.title || data.title || '';
      var body = notification.body || data.body || 'Nueva notificación';
      if (typeof global.notify === 'function') global.notify((title ? title + ': ' : '') + body);
      document.dispatchEvent(new CustomEvent('sisventas:push-recibido', { detail:{ notification:notification, data:data } }));
    });
  }

  function state() {
    return {
      supported:supported(),
      permission:('Notification' in global) ? Notification.permission : 'unsupported',
      enabled:enabledLocally() && ('Notification' in global) && Notification.permission === 'granted'
    };
  }

  function stateText() {
    var current = state();
    if (!current.supported) return 'No compatible';
    if (current.permission === 'denied') return 'Bloqueadas por el navegador';
    if (current.enabled) return 'Activas en este dispositivo';
    return 'Desactivadas';
  }

  function refreshUi() {
    var label = document.getElementById('sv-push-menu-status');
    if (label) label.textContent = stateText();
    var button = document.getElementById('sv-push-toggle-button');
    if (button) {
      var current = state();
      button.textContent = current.enabled ? 'Desactivar en este dispositivo' : 'Activar notificaciones';
      button.classList.toggle('btn-primary', !current.enabled);
    }
    var detail = document.getElementById('sv-push-status-detail');
    if (detail) detail.textContent = stateText();
  }

  function ensureMenuEntry() {
    var panel = document.querySelector('#user-panel > div:nth-child(2)');
    if (!panel || document.getElementById('sv-push-menu-entry')) return;
    var entry = document.createElement('div');
    entry.id = 'sv-push-menu-entry';
    entry.className = 'up-item';
    entry.innerHTML = '<i class="ti ti-bell-ringing" style="font-size:15px"></i><div style="min-width:0"><div>Notificaciones</div><small id="sv-push-menu-status" style="display:block;color:var(--text3);font-size:10px">' + stateText() + '</small></div>';
    entry.addEventListener('click', function(){ if (typeof global.cerrarUserPanel === 'function') global.cerrarUserPanel(); openSettings(); });
    var divider = panel.querySelector('div[style*="height:0.5px"]');
    panel.insertBefore(entry, divider || null);
  }

  function openSettings() {
    var old = document.getElementById('sv-push-settings');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'sv-push-settings';
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = '<div class="modal" style="width:min(480px,calc(100vw - 24px))">' +
      '<div class="modal-head"><span class="modal-title"><i class="ti ti-bell-ringing"></i> Notificaciones del sistema</span><button class="modal-close" type="button" data-close><i class="ti ti-x"></i></button></div>' +
      '<div class="modal-body"><div style="padding:14px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg3)"><strong id="sv-push-status-detail">' + stateText() + '</strong><p style="margin:7px 0 0;color:var(--text3);font-size:12px;line-height:1.5">Recibí avisos de órdenes de trabajo, reclamos, presupuestos y agenda aunque SisVentas esté en segundo plano. La activación corresponde solamente a este navegador.</p></div></div>' +
      '<div class="modal-foot"><button class="btn" type="button" data-close>Cerrar</button><button class="btn btn-primary" id="sv-push-toggle-button" type="button"></button></div></div>';
    overlay.addEventListener('click', function(event){ if (event.target === overlay || event.target.closest('[data-close]')) overlay.remove(); });
    document.body.appendChild(overlay);
    var button = overlay.querySelector('#sv-push-toggle-button');
    button.addEventListener('click', async function() {
      button.disabled = true;
      try {
        if (state().enabled) {
          await unregisterDevice();
          if (typeof global.notify === 'function') global.notify('Notificaciones desactivadas en este dispositivo');
        } else {
          await registerDevice({ requestPermission:true });
          if (typeof global.notify === 'function') global.notify('Notificaciones activadas en este dispositivo');
        }
      } catch (error) {
        if (typeof global.notify === 'function') global.notify(error.message);
      } finally {
        button.disabled = false;
        refreshUi();
      }
    });
    refreshUi();
  }

  function openDestination(data) {
    data = data || {};
    var ctx = context();
    if (!ctx.autenticado && !ctx.uid) {
      try { sessionStorage.setItem('sisventas.push.pendingDestination', JSON.stringify(data)); } catch (_) {}
      return;
    }
    var type = String(data.type || data.tipo || '').toLowerCase();
    var id = data.entityId || data.id || '';
    if (type === 'ot') {
      if (typeof global.showPage === 'function') global.showPage('ordentrabajo', document.querySelector('[onclick*="ordentrabajo"]'));
      setTimeout(function(){ if (typeof global.verOT === 'function') global.verOT(id); }, 1800);
      return;
    }
    if (type === 'reclamo') {
      if (typeof global.showPage === 'function') global.showPage('soporte', document.querySelector('[onclick*="soporte"]'));
      var reclamoAttempts = 0;
      var reclamoTimer = setInterval(function(){
        reclamoAttempts += 1;
        if (typeof global.spAbrirModal === 'function' && global.SP_DATA && global.SP_DATA[id]) {
          clearInterval(reclamoTimer); global.spAbrirModal(id);
        } else if (reclamoAttempts > 30) clearInterval(reclamoTimer);
      }, 250);
      return;
    }
    if (type === 'presupuesto' && typeof global.showPage === 'function') global.showPage('presupuesto', document.querySelector('[onclick*="presupuesto"]'));
    if (type === 'agenda' && typeof global.showPage === 'function') global.showPage('agenda', document.querySelector('[onclick*="agenda"]'));
  }

  function consumeUrlDestination() {
    var params = new URLSearchParams(location.search);
    var type = params.get('pushType');
    var id = params.get('pushId');
    if (!type) return;
    params.delete('pushType'); params.delete('pushId');
    var clean = location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash;
    history.replaceState(null, '', clean);
    setTimeout(function(){ openDestination({ type:type, entityId:id }); }, 500);
  }

  navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SISVENTAS_PUSH_OPEN') openDestination(event.data.data || {});
  });

  document.addEventListener('sisventas:session-ready', function() {
    ensureMenuEntry();
    refreshUi();
    consumeUrlDestination();
    try {
      var pending = JSON.parse(sessionStorage.getItem('sisventas.push.pendingDestination') || 'null');
      if (pending) { sessionStorage.removeItem('sisventas.push.pendingDestination'); setTimeout(function(){ openDestination(pending); }, 500); }
    } catch (_) {}
    if (enabledLocally() && Notification.permission === 'granted') registerDevice({ requestPermission:false }).catch(function(error){ console.warn('[Push]', error); });
  });
  document.addEventListener('sisventas:session-ended', function() {
    if (foregroundUnsubscribe) { try { foregroundUnsubscribe(); } catch (_) {} foregroundUnsubscribe = null; }
    if (enabledLocally()) unregisterDevice({ preservePreference:true }).catch(function(error){ console.warn('[Push logout]', error); });
  });

  global.SisVentasPush = {
    state:state,
    activate:function(){ return registerDevice({ requestPermission:true }); },
    deactivate:unregisterDevice,
    openSettings:openSettings,
    openDestination:openDestination
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureMenuEntry);
  else ensureMenuEntry();
})(window);
