/* Lanzamiento de SisVentas 3: reingreso único y bienvenida por usuario/dispositivo. */
(function () {
  'use strict';
  var VERSION_LANZAMIENTO = 'v3.0.0';
  var VERSION_BIENVENIDA = String(window.SISVENTAS_PWA_VERSION || 'v3.0.1');
  var partesBienvenida = VERSION_BIENVENIDA.match(/^v3\.0\.(\d+)$/);
  var CAMPANA_BIENVENIDA_ACTIVA = !!(partesBienvenida && Number(partesBienvenida[1]) <= 20);

  function esVistaPreviaLocal() {
    try {
      return /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && new URLSearchParams(location.search).get('welcome') === 'v3';
    } catch (_) { return false; }
  }

  function claveUsuario() {
    var authUser = window.fbAuth && window.fbAuth.currentUser;
    var id = String((authUser && (authUser.uid || authUser.email)) || 'usuario');
    return id.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  }

  function claveReingreso() { return 'sisventas_v3_reingreso_' + claveUsuario(); }
  function claveBienvenida() { return 'sisventas_v3_bienvenida_' + claveUsuario(); }

  function bienvenidaPendiente() {
    if (document.getElementById('sv-v3-welcome')) return true;
    var pendiente = false;
    var mostrada = false;
    try {
      pendiente = sessionStorage.getItem('sisventas_v3_bienvenida_pendiente') === '1';
      mostrada = localStorage.getItem(claveBienvenida()) === VERSION;
    } catch (_) {}
    return pendiente || (CAMPANA_BIENVENIDA_ACTIVA && !mostrada);
  }

  window.svV3LaunchBeforeSession = function () {
    if (esVistaPreviaLocal()) return false;
    var restaurada = window._restaurandoSesionInicial === true && !window._loginEnCurso;
    var yaReingreso = false;
    try { yaReingreso = localStorage.getItem(claveReingreso()) === VERSION_LANZAMIENTO; } catch (_) {}
    if (yaReingreso) return false;

    try {
      localStorage.setItem(claveReingreso(), VERSION_LANZAMIENTO);
      sessionStorage.setItem('sisventas_v3_bienvenida_pendiente', '1');
    } catch (_) {}

    if (restaurada && typeof window._ejecutarLogout === 'function') {
      setTimeout(function () { window._ejecutarLogout('lanzamiento-v3'); }, 0);
      return true;
    }
    return false;
  };

  function cerrar() {
    var el = document.getElementById('sv-v3-welcome');
    if (el) {
      el.classList.add('is-closing');
      setTimeout(function () {
        if (el.parentNode) el.remove();
        document.dispatchEvent(new CustomEvent('sisventas:v3-welcome-closed'));
      }, 420);
    } else {
      document.dispatchEvent(new CustomEvent('sisventas:v3-welcome-closed'));
    }
    try {
      localStorage.setItem(claveBienvenida(), VERSION_BIENVENIDA);
      sessionStorage.removeItem('sisventas_v3_bienvenida_pendiente');
    } catch (_) {}
  }

  function mostrar(detalleSesion) {
    if (document.getElementById('sv-v3-welcome')) return;
    var pendiente = false;
    var mostrada = false;
    try {
      pendiente = sessionStorage.getItem('sisventas_v3_bienvenida_pendiente') === '1';
      mostrada = localStorage.getItem(claveBienvenida()) === VERSION_BIENVENIDA;
    } catch (_) {}
    if ((!CAMPANA_BIENVENIDA_ACTIVA && !esVistaPreviaLocal()) || (!pendiente && mostrada)) return;

    var nombre = String((detalleSesion && detalleSesion.usuario) || '').trim().split(/\s+/)[0] || '';
    var overlay = document.createElement('div');
    overlay.id = 'sv-v3-welcome';
    overlay.innerHTML =
      '<div class="sv-v3-welcome-orbit orbit-a"></div><div class="sv-v3-welcome-orbit orbit-b"></div>' +
      '<div class="sv-v3-welcome-stars" aria-hidden="true"></div>' +
      '<section class="sv-v3-welcome-card" role="dialog" aria-modal="true" aria-labelledby="sv-v3-welcome-title">' +
        '<div class="sv-v3-welcome-mark"><i class="ti ti-sparkles"></i></div>' +
        '<div class="sv-v3-welcome-kicker">NUEVA VERSIÓN</div>' +
        '<h1 id="sv-v3-welcome-title">¡Bienvenido'+(nombre?', '+nombre:'')+' a SisVentas 3!</h1>' +
        '<p>Una experiencia más clara, moderna y consistente, con el nuevo estilo azul y la posibilidad de volver al diseño clásico cuando quieras.</p>' +
        '<div class="sv-v3-welcome-pills"><span><i class="ti ti-palette"></i> Nuevo diseño</span><span><i class="ti ti-shield-check"></i> Datos auditados</span><span><i class="ti ti-bolt"></i> Mejor rendimiento</span></div>' +
        '<button type="button" class="btn sv-v3-welcome-start" onclick="svCerrarBienvenidaV3()">Entrar a SisVentas 3 <i class="ti ti-arrow-right"></i></button>' +
      '</section>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('is-visible'); });
  }

  window.svCerrarBienvenidaV3 = cerrar;
  window.svMostrarBienvenidaV3 = mostrar;
  window.svBienvenidaV3Pendiente = bienvenidaPendiente;
  document.addEventListener('sisventas:session-ready', function (event) {
    var detalle = event && event.detail ? event.detail : null;
    setTimeout(function () { mostrar(detalle); }, 900);
  });
  if (esVistaPreviaLocal()) {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () { mostrar({ usuario: 'Gonzalo' }); }, 1200);
    });
  }
})();
